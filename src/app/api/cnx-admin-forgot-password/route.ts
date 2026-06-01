import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/admin-auth'
import { createHmac } from 'crypto'

// ─── Rate Limiting for forgot-password endpoint ───
// NOTE: In-memory rate limiting is imperfect in serverless (resets on cold starts),
// but it still provides meaningful protection within a single instance's lifetime.
const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_FORGOT_ATTEMPTS = 5
const FORGOT_LOCKOUT_MS = 15 * 60 * 1000

// ─── HMAC-based Reset Tokens (stateless, serverless-safe) ───
// Instead of storing tokens in an in-memory Map (which is lost on serverless cold starts),
// we encode the email + timestamp into the token and sign it with HMAC.
// The token is self-contained and verifiable without any server-side storage.

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
 * POST /api/cnx-admin-forgot-password
 *
 * Actions:
 * 1. verify_email  — Verify admin email exists, return reset token
 * 2. reset_password — Reset password using reset token
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body
    const sql = getNeonSql()

    // ─── Step 1: Verify Email ───
    if (action === 'verify_email') {
      const { email } = body

      if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }

      // Rate limit by IP
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
      const now = Date.now()
      const attempt = forgotPasswordAttempts.get(ip)

      if (attempt && attempt.count >= MAX_FORGOT_ATTEMPTS && now - attempt.lastAttempt < FORGOT_LOCKOUT_MS) {
        const retryAfter = Math.ceil((FORGOT_LOCKOUT_MS - (now - attempt.lastAttempt)) / 60000)
        return NextResponse.json({ error: `Too many attempts. Try again in ${retryAfter} minutes.` }, { status: 429 })
      }

      if (attempt && now - attempt.lastAttempt > FORGOT_LOCKOUT_MS) {
        forgotPasswordAttempts.delete(ip)
      }

      // Verify admin exists
      const users = await sql`SELECT id, name, "isAdmin", "isBanned" FROM "User" WHERE email = ${email} LIMIT 1`
      const user = users?.[0]

      if (!user || !user.isAdmin) {
        const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
        forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
        return NextResponse.json({ error: 'No admin account found with this email.' }, { status: 400 })
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'Account is banned. Contact support.' }, { status: 403 })
      }

      // Generate a stateless HMAC-signed reset token
      const resetToken = createResetToken(email)

      return NextResponse.json({
        success: true,
        message: 'Email verified. You can now reset your password.',
        resetToken,
        adminName: user.name,
      })
    }

    // ─── Step 2: Reset Password ───
    if (action === 'reset_password') {
      const { email, resetToken, newPassword } = body

      if (!email || !resetToken || !newPassword) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
      }

      // Verify HMAC-signed reset token (stateless — no in-memory lookup needed)
      const tokenData = verifyResetToken(resetToken)
      if (!tokenData || tokenData.email !== email) {
        return NextResponse.json({ error: 'Invalid or expired reset token. Please start over.' }, { status: 400 })
      }

      // Validate password strength
      const validation = validatePasswordStrength(newPassword)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 })
      }

      // Find admin user
      const adminUsers = await sql`SELECT id, "isAdmin" FROM "User" WHERE email = ${email} LIMIT 1`
      const adminUser = adminUsers?.[0]

      if (!adminUser || !adminUser.isAdmin) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      // Update password
      const newHash = await hashPassword(newPassword)
      await sql`
        UPDATE "User" SET "passwordHash" = ${newHash}, "mustChangePassword" = false, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${adminUser.id}
      `

      // Revoke all admin sessions (force re-login)
      await sql`
        UPDATE "AdminSession" SET "isRevoked" = true
        WHERE "userId" = ${adminUser.id} AND "isRevoked" = false
      `

      // Create audit log
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
      await sql`
        INSERT INTO "AuditLog" (id, "actorId", action, "targetType", "targetId", details, "ipAddress", "createdAt")
        VALUES (gen_random_uuid(), ${adminUser.id}, 'password_reset', 'user', ${adminUser.id},
        ${JSON.stringify({ method: 'direct_reset', email })}, ${ip}, CURRENT_TIMESTAMP)
      `

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
