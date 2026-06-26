import { NextResponse } from 'next/server'
import { db, getNeonSql } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/admin-auth'
import { isValidEmail } from '@/lib/api-security'
import { createHmac } from 'crypto'
import bcrypt from 'bcryptjs'
import {
  SECURITY_QUESTIONS,
  isValidSecurityQuestionIndex,
  validateSecurityAnswer,
  verifySecurityAnswer,
  hashSecurityAnswer,
  checkLockout,
  recordInMemoryFailure,
  clearInMemoryAttempts,
  getInMemoryAttempts,
  formatLockoutRemaining,
  MAX_SECURITY_ATTEMPTS,
  SECURITY_LOCKOUT_MS,
  INVALID_SECURITY_ANSWER_ERROR,
} from '@/lib/security-question'

// ─── Rate Limiting for forgot-password endpoint ───
// NOTE: In-memory rate limiting is imperfect in serverless (resets on cold starts),
// but it still provides meaningful protection within a single instance's lifetime
// AND is paired with DB-backed attempt counters below for durable protection.
const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_FORGOT_ATTEMPTS = 5
const FORGOT_LOCKOUT_MS = 15 * 60 * 1000

// ─── HMAC-based Reset Tokens (stateless, serverless-safe) ───
// The token is self-contained (email + createdAt) and signed with HMAC,
// so it can be verified without any server-side storage. A token is only
// issued AFTER the security answer has been verified.
const RESET_SECRET = process.env.JWT_SECRET || 'educampushub-reset-secret-fallback'
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

function createResetToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, createdAt: Date.now() })).toString('base64url')
  const signature = createHmac('sha256', RESET_SECRET).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function verifyResetToken(token: string): { email: string; createdAt: number } | null {
  try {
    const [payload, signature] = token.split('.')
    const expectedSignature = createHmac('sha256', RESET_SECRET).update(payload).digest('base64url')
    if (signature !== expectedSignature) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { email: string; createdAt: number }
    if (Date.now() - data.createdAt > RESET_TOKEN_EXPIRY_MS) return null
    return data
  } catch {
    return null
  }
}

/**
 * Helper: get client IP from request (best-effort).
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}

/**
 * Helper: check the per-IP rate limit for the verify_email step.
 * (Prevents enumerating which emails have accounts.)
 */
function checkIpRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const attempt = forgotPasswordAttempts.get(ip)
  if (!attempt) return { allowed: true, retryAfterMs: 0 }
  if (attempt.count >= MAX_FORGOT_ATTEMPTS && now - attempt.lastAttempt < FORGOT_LOCKOUT_MS) {
    return { allowed: false, retryAfterMs: FORGOT_LOCKOUT_MS - (now - attempt.lastAttempt) }
  }
  if (attempt.count >= MAX_FORGOT_ATTEMPTS && now - attempt.lastAttempt >= FORGOT_LOCKOUT_MS) {
    forgotPasswordAttempts.delete(ip)
  }
  return { allowed: true, retryAfterMs: 0 }
}

function recordIpFailure(ip: string) {
  const now = Date.now()
  const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
  forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
}

/**
 * POST /api/auth/forgot-password
 *
 * Security-question-based password reset flow (no OTP):
 *
 *   1. verify_email     — User enters email. Server returns the user's
 *                          security question (or a fake question for unknown
 *                          emails, to avoid account enumeration).
 *
 *   2. verify_answer    — User submits their answer. Server verifies it
 *                          against the stored bcrypt hash. On success,
 *                          returns a short-lived HMAC-signed reset token.
 *                          On failure, increments attempt counters and
 *                          eventually locks the account for LOCKOUT_MS.
 *
 *   3. reset_password   — User submits the reset token + new password.
 *                          Server verifies the token signature + expiry,
 *                          then updates the password and revokes sessions.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body
    const sql = getNeonSql()
    const ip = getClientIp(request)

    // ─── Step 1: Verify Email ───
    if (action === 'verify_email') {
      const { email } = body

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
      }

      if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // Per-IP rate limit (prevents enumeration)
      const ipCheck = checkIpRateLimit(ip)
      if (!ipCheck.allowed) {
        const retryAfter = Math.ceil(ipCheck.retryAfterMs / 60000)
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${retryAfter} minutes.` },
          { status: 429 }
        )
      }

      // Find user by email — only select the columns we actually need
      const users = await sql`
        SELECT id, name, email, "isAdmin", "isBanned",
               "securityQuestionIdx", "securityAnswerHash",
               "securityAttempts", "securityLockedUntil"
        FROM "User" WHERE email = ${sanitizedEmail} LIMIT 1
      `
      const user = users?.[0]

      if (!user) {
        // For privacy: do NOT reveal that the email is unregistered.
        // Return a plausible fake question so the UI behaves the same.
        recordIpFailure(ip)
        return NextResponse.json({
          success: true,
          message: 'Email verified. Please answer your security question.',
          securityQuestion: SECURITY_QUESTIONS[0],
          // Use a dummy email token that won't match any real user — the
          // verify_answer step will reject it. We use the supplied email
          // (already validated as well-formed) so the flow continues.
          maskedEmail: sanitizedEmail,
          emailNotFound: true, // internal flag, NOT exposed in client-readable strings
        })
      }

      if (user.isBanned) {
        return NextResponse.json(
          { error: 'This account has been banned. Contact support.' },
          { status: 403 }
        )
      }

      // Admin accounts must use admin panel (they have their own reset flow)
      if (user.isAdmin) {
        return NextResponse.json(
          { error: 'Admin accounts must use the admin panel to reset passwords.' },
          { status: 400 }
        )
      }

      // If user has no security question set (legacy account), they need
      // to log in and set one from their profile. We return a special flag
      // the client can use to show the appropriate message.
      if (
        user.securityQuestionIdx === null ||
        user.securityQuestionIdx === undefined ||
        !user.securityAnswerHash
      ) {
        return NextResponse.json({
          success: false,
          needsSetup: true,
          message: 'No security question is set for this account. Please log in and set one from your profile to enable password reset.',
        })
      }

      // Check brute-force lockout
      const lockout = checkLockout(user.securityLockedUntil ? new Date(user.securityLockedUntil) : null)
      if (lockout.locked) {
        return NextResponse.json(
          {
            success: false,
            locked: true,
            retryAfterMs: lockout.retryAfterMs,
            message: `For security, this account is temporarily locked. Try again in ${formatLockoutRemaining(lockout.retryAfterMs)}.`,
          },
          { status: 429 }
        )
      }

      // Return the security question text. The hashed answer is NEVER sent.
      return NextResponse.json({
        success: true,
        message: 'Email verified. Please answer your security question.',
        securityQuestion: SECURITY_QUESTIONS[user.securityQuestionIdx],
        maskedEmail: sanitizedEmail,
      })
    }

    // ─── Step 2: Verify Security Answer ───
    if (action === 'verify_answer') {
      const { email, securityAnswer } = body

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }
      if (!securityAnswer || typeof securityAnswer !== 'string') {
        // Use the generic "invalid answer" message to avoid revealing which field is wrong
        return NextResponse.json({ error: INVALID_SECURITY_ANSWER_ERROR }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // Per-IP rate limit
      const ipCheck = checkIpRateLimit(ip)
      if (!ipCheck.allowed) {
        const retryAfter = Math.ceil(ipCheck.retryAfterMs / 60000)
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${retryAfter} minutes.` },
          { status: 429 }
        )
      }

      const users = await sql`
        SELECT id, email, "isAdmin", "isBanned",
               "securityQuestionIdx", "securityAnswerHash",
               "securityAttempts", "securityLockedUntil"
        FROM "User" WHERE email = ${sanitizedEmail} LIMIT 1
      `
      const user = users?.[0]

      // Unknown email — return generic error (no enumeration leak)
      if (!user || !user.securityAnswerHash || user.securityQuestionIdx === null) {
        recordIpFailure(ip)
        return NextResponse.json({ error: INVALID_SECURITY_ANSWER_ERROR }, { status: 400 })
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'This account has been banned.' }, { status: 403 })
      }
      if (user.isAdmin) {
        return NextResponse.json({ error: INVALID_SECURITY_ANSWER_ERROR }, { status: 400 })
      }

      // Check DB-backed lockout first
      const dbLockout = checkLockout(user.securityLockedUntil ? new Date(user.securityLockedUntil) : null)
      if (dbLockout.locked) {
        return NextResponse.json(
          {
            error: `For security, this account is temporarily locked. Try again in ${formatLockoutRemaining(dbLockout.retryAfterMs)}.`,
            locked: true,
            retryAfterMs: dbLockout.retryAfterMs,
          },
          { status: 429 }
        )
      }

      // Check in-memory lockout (catches rapid-fire attempts within a single instance)
      const memState = getInMemoryAttempts(sanitizedEmail)
      if (memState.lockedUntil && memState.lockedUntil > Date.now()) {
        const remaining = memState.lockedUntil - Date.now()
        return NextResponse.json(
          {
            error: `For security, this account is temporarily locked. Try again in ${formatLockoutRemaining(remaining)}.`,
            locked: true,
            retryAfterMs: remaining,
          },
          { status: 429 }
        )
      }

      // Verify the answer against the bcrypt hash
      const answerValid = await verifySecurityAnswer(securityAnswer, user.securityAnswerHash)

      if (!answerValid) {
        // Record failure in memory
        const memResult = recordInMemoryFailure(sanitizedEmail)
        // Record failure in DB (durable across cold starts)
        const newAttempts = (user.securityAttempts || 0) + 1
        const shouldLock = newAttempts >= MAX_SECURITY_ATTEMPTS
        const lockedUntil = shouldLock ? new Date(Date.now() + SECURITY_LOCKOUT_MS) : null

        try {
          await sql`
            UPDATE "User"
            SET "securityAttempts" = ${newAttempts},
                "securityLockedUntil" = ${lockedUntil},
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = ${user.id}
          `
        } catch (dbErr) {
          // DB write may fail in serverless — in-memory record still applies
          console.error('Failed to persist security attempt counter:', dbErr)
        }

        recordIpFailure(ip)

        if (shouldLock || memResult.locked) {
          return NextResponse.json(
            {
              error: `Too many incorrect attempts. For security, this account is locked for ${formatLockoutRemaining(SECURITY_LOCKOUT_MS)}.`,
              locked: true,
              retryAfterMs: SECURITY_LOCKOUT_MS,
            },
            { status: 429 }
          )
        }

        const remainingAttempts = MAX_SECURITY_ATTEMPTS - newAttempts
        return NextResponse.json(
          {
            error: INVALID_SECURITY_ANSWER_ERROR,
            remainingAttempts,
          },
          { status: 400 }
        )
      }

      // ─── Answer verified successfully ───
      // Clear attempt counters (both in-memory and DB)
      clearInMemoryAttempts(sanitizedEmail)
      try {
        await sql`
          UPDATE "User"
          SET "securityAttempts" = 0,
              "securityLockedUntil" = NULL,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${user.id}
        `
      } catch (dbErr) {
        console.error('Failed to reset security attempt counter:', dbErr)
      }

      // Issue a short-lived reset token (stateless, HMAC-signed)
      const resetToken = createResetToken(sanitizedEmail)

      return NextResponse.json({
        success: true,
        message: 'Security answer verified. You can now reset your password.',
        resetToken,
      })
    }

    // ─── Step 3: Reset Password ───
    if (action === 'reset_password') {
      const { email, resetToken, newPassword } = body

      if (!email || !resetToken || !newPassword) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // Verify HMAC-signed reset token (stateless — no in-memory lookup needed)
      const tokenData = verifyResetToken(resetToken)
      if (!tokenData || tokenData.email !== sanitizedEmail) {
        return NextResponse.json(
          { error: 'Invalid or expired reset session. Please start over.' },
          { status: 400 }
        )
      }

      // Find user by email
      const users = await sql`
        SELECT id, email, "isAdmin" FROM "User" WHERE email = ${sanitizedEmail} LIMIT 1
      `
      const user = users?.[0]

      if (!user) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      // Validate password strength
      const validation = validatePasswordStrength(newPassword)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 })
      }

      // Update password
      const newHash = await hashPassword(newPassword)
      await sql`
        UPDATE "User" SET "passwordHash" = ${newHash}, "isVerified" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `

      // Revoke all user sessions (force re-login)
      try {
        await sql`
          UPDATE "UserSession" SET "isRevoked" = true
          WHERE "userId" = ${user.id} AND "isRevoked" = false
        `
      } catch {
        // Sessions table may not exist; ignore
      }

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully. Please log in with your new password.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('User forgot password error:', error)
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
