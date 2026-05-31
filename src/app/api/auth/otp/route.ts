import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { checkApiRateLimit, isValidEmail, isValidIndianMobile } from '@/lib/api-security'
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTP,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  getUserByEmail,
  checkEmailExists,
  maskEmail,
  maskPhone,
  type OTPPurpose,
} from '@/lib/otp-utils'
import bcrypt from 'bcryptjs'
import { createHmac, randomUUID } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'educampushub-insecure-dev-secret-change-me'

// ─── Rate Limiting for forgot-password attempts by IP ───

const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_FORGOT_ATTEMPTS = 5
const FORGOT_LOCKOUT_MS = 15 * 60 * 1000

// ─── Helper: Create signed token ───

function createSignedToken(userId: string): string {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (30 * 24 * 60 * 60) // 30 days
  const payload = { userId, type: 'user_session', iat, exp }
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

// ─── Helper: Create UserSession ───

async function createUserSession(userId: string, request: Request) {
  const token = createSignedToken(userId)
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded?.split(',')[0]?.trim() || null
  const userAgent = request.headers.get('user-agent') || null
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  try {
    const sql = getNeonSql()
    await sql`
      INSERT INTO "UserSession" (id, "userId", token, "ipAddress", "userAgent", "expiresAt", "isRevoked", "createdAt")
      VALUES (${randomUUID()}, ${userId}, ${token}, ${ipAddress}, ${userAgent}, ${expiresAt.toISOString()}, false, CURRENT_TIMESTAMP)
    `
  } catch (dbError) {
    console.error('UserSession create failed:', dbError)
  }

  return token
}

// ─── Helper: Strip sensitive fields ───

function sanitizeUser(user: Record<string, unknown>) {
  const { passwordHash, adminSessions, auditLogs, sessions, ...safe } = user
  return safe
}

/**
 * POST /api/auth/otp
 * 
 * Actions:
 * 1. send         — Send OTP to email (for login, register, forgot_password)
 * 2. verify       — Verify OTP code
 * 3. register     — Complete registration after OTP verification
 * 4. login        — Complete login after OTP verification
 * 5. reset_password — Reset password after OTP verification (forgot password)
 */
export async function POST(request: Request) {
  try {
    // General rate limiting
    const rateLimit = checkApiRateLimit(request)
    if (rateLimit && !rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { action } = body
    const sql = getNeonSql()

    // ═══════════════════════════════════════════════════════
    // ACTION: SEND OTP
    // ═══════════════════════════════════════════════════════
    if (action === 'send') {
      const { email, purpose } = body as { email: string; purpose: OTPPurpose }

      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
      }

      if (!['login', 'register', 'forgot_password'].includes(purpose)) {
        return NextResponse.json({ error: 'Invalid OTP purpose' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // ─── Purpose-specific validation ───
      if (purpose === 'register') {
        // For registration, email must NOT already exist
        const emailExists = await checkEmailExists(sanitizedEmail)
        if (emailExists) {
          return NextResponse.json({ error: 'An account with this email already exists. Please login instead.' }, { status: 409 })
        }
      }

      if (purpose === 'login' || purpose === 'forgot_password') {
        // For login/forgot_password, email must exist
        const user = await getUserByEmail(sanitizedEmail)
        if (!user) {
          // Security: Don't reveal whether email exists
          return NextResponse.json({ 
            success: true, 
            message: 'If this email is registered, an OTP will be sent.',
            maskedEmail: maskEmail(sanitizedEmail),
            otpSent: false,
          })
        }

        if (user.isBanned) {
          return NextResponse.json({ error: 'This account has been banned.' }, { status: 403 })
        }
      }

      // ─── Rate limiting by IP for forgot_password ───
      if (purpose === 'forgot_password') {
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
      }

      // ─── OTP rate limit per email + purpose ───
      const rateLimitKey = `${sanitizedEmail}:${purpose}`
      const otpRateLimit = checkOTPRateLimit(rateLimitKey)
      if (!otpRateLimit.allowed) {
        return NextResponse.json({ error: otpRateLimit.reason, retryAfterMs: otpRateLimit.retryAfterMs }, { status: 429 })
      }

      // ─── Generate and store OTP ───
      const otp = generateOTP()
      const existingUser = await getUserByEmail(sanitizedEmail)

      await storeOTP({
        email: sanitizedEmail,
        phone: existingUser?.phone || undefined,
        otpCode: otp,
        purpose,
      })

      // ─── Send OTP via Email (and SMS if phone exists) ───
      const sendResult = await sendOTP({
        email: sanitizedEmail,
        phone: existingUser?.phone || undefined,
        otp,
        purpose,
        userName: existingUser?.name,
      })

      // ─── Cleanup expired OTPs (fire-and-forget) ───
      cleanupExpiredOTPs().catch(() => {})

      // ─── Increment forgot password attempt counter ───
      if (purpose === 'forgot_password') {
        const forwarded = request.headers.get('x-forwarded-for')
        const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
        const now = Date.now()
        const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
        forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
      }

      return NextResponse.json({
        success: true,
        message: sendResult.message,
        maskedEmail: maskEmail(sanitizedEmail),
        maskedPhone: existingUser?.phone ? maskPhone(existingUser.phone) : null,
        emailSent: sendResult.emailSent,
        smsSent: sendResult.smsSent,
        otpSent: sendResult.emailSent || sendResult.smsSent,
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      })
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: VERIFY OTP
    // ═══════════════════════════════════════════════════════
    if (action === 'verify') {
      const { email, otp, purpose } = body as { email: string; otp: string; purpose: OTPPurpose }

      if (!email || !otp || !purpose) {
        return NextResponse.json({ error: 'Email, OTP, and purpose are required' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      const result = await verifyOTP(sanitizedEmail, otp, purpose)

      if (!result.valid) {
        return NextResponse.json({ error: result.reason }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
        verificationToken: result.recordId,
      })
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: REGISTER (after OTP verified)
    // ═══════════════════════════════════════════════════════
    if (action === 'register') {
      const { name, email, password, phone, verificationToken } = body as {
        name: string; email: string; password: string; phone?: string; verificationToken: string
      }

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return NextResponse.json({ error: 'Name must be between 2 and 100 characters' }, { status: 400 })
      }

      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 })
      }

      if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 })
      }

      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }

      const hasUppercase = /[A-Z]/.test(password)
      const hasLowercase = /[a-z]/.test(password)
      const hasDigit = /\d/.test(password)
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
      if (!(hasUppercase && hasLowercase && hasDigit && hasSpecial)) {
        return NextResponse.json({ error: 'Password must include uppercase, lowercase, number, and special character' }, { status: 400 })
      }

      if (!verificationToken) {
        return NextResponse.json({ error: 'Email verification is required' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // Validate phone if provided
      if (phone && !isValidIndianMobile(phone)) {
        return NextResponse.json({ error: 'Please enter a valid 10-digit Indian mobile number' }, { status: 400 })
      }

      // Verify the OTP token
      const otpRecords = await sql`
        SELECT id, email, "isVerified", "usedAt", "expiresAt"
        FROM "PasswordResetOTP"
        WHERE id = ${verificationToken}
      `
      const otpRecord = otpRecords?.[0]

      if (!otpRecord || !otpRecord.isVerified || otpRecord.email !== sanitizedEmail) {
        return NextResponse.json({ error: 'Invalid or expired verification. Please start over.' }, { status: 400 })
      }

      // Check if OTP verification is too old (max 10 minutes after verification)
      if (otpRecord.usedAt && Date.now() - new Date(otpRecord.usedAt).getTime() > 10 * 60 * 1000) {
        return NextResponse.json({ error: 'Verification expired. Please start over.' }, { status: 400 })
      }

      // Check if email already exists (double-check after OTP)
      const emailExists = await checkEmailExists(sanitizedEmail)
      if (emailExists) {
        return NextResponse.json({ error: 'Email already registered. Please login instead.' }, { status: 409 })
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12)

      // Create user with isVerified = true (since OTP verified)
      const user = await sql`
        INSERT INTO "User" (id, email, name, phone, "passwordHash", "isVerified", "isAdmin", "mustChangePassword", "isBanned", rating, "totalSales", "freeUploadUsed", "paidUploadCredits", "totalBooksUploaded", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${sanitizedEmail}, ${name.trim()}, ${phone ? phone.trim() : null}, ${passwordHash}, true, false, false, false, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, email, name, phone, "isVerified", "isAdmin", "createdAt"
      `

      if (!user || user.length === 0) {
        return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
      }

      const newUser = user[0]

      // Delete the OTP record
      await sql`DELETE FROM "PasswordResetOTP" WHERE id = ${verificationToken}`

      // Create session
      const token = await createUserSession(newUser.id, request)

      const response = NextResponse.json({
        user: sanitizeUser(newUser as unknown as Record<string, unknown>),
        token,
        message: 'Account created successfully!',
      }, { status: 201 })

      // Set httpOnly cookie
      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      })

      return response
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: LOGIN (after OTP verified)
    // ═══════════════════════════════════════════════════════
    if (action === 'login') {
      const { email, verificationToken } = body as { email: string; verificationToken: string }

      if (!email || !verificationToken) {
        return NextResponse.json({ error: 'Email and verification token are required' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // Verify the OTP token
      const otpRecords = await sql`
        SELECT id, email, "isVerified", "usedAt"
        FROM "PasswordResetOTP"
        WHERE id = ${verificationToken}
      `
      const otpRecord = otpRecords?.[0]

      if (!otpRecord || !otpRecord.isVerified || otpRecord.email !== sanitizedEmail) {
        return NextResponse.json({ error: 'Invalid or expired verification. Please start over.' }, { status: 400 })
      }

      if (otpRecord.usedAt && Date.now() - new Date(otpRecord.usedAt).getTime() > 10 * 60 * 1000) {
        return NextResponse.json({ error: 'Verification expired. Please start over.' }, { status: 400 })
      }

      // Get user
      const user = await getUserByEmail(sanitizedEmail)
      if (!user) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'This account has been banned' }, { status: 403 })
      }

      // Delete the OTP record
      await sql`DELETE FROM "PasswordResetOTP" WHERE id = ${verificationToken}`

      // Mark user email as verified
      await sql`
        UPDATE "User" SET "isVerified" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${user.id}
      `

      // Create session
      const token = await createUserSession(user.id, request)

      // Get full user data
      const fullUser = await sql`SELECT * FROM "User" WHERE id = ${user.id} LIMIT 1`

      const response = NextResponse.json({
        user: sanitizeUser(fullUser[0] as unknown as Record<string, unknown>),
        token,
      })

      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      })

      return response
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: RESET PASSWORD (after OTP verified for forgot_password)
    // ═══════════════════════════════════════════════════════
    if (action === 'reset_password') {
      const { email, verificationToken, newPassword } = body as {
        email: string; verificationToken: string; newPassword: string
      }

      if (!email || !verificationToken || !newPassword) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // Verify the verification token
      const otpRecords = await sql`
        SELECT id, email, "isVerified", "usedAt"
        FROM "PasswordResetOTP"
        WHERE id = ${verificationToken}
      `
      const otpRecord = otpRecords?.[0]

      if (!otpRecord || !otpRecord.isVerified || otpRecord.email !== sanitizedEmail) {
        return NextResponse.json({ error: 'Invalid or expired verification. Please start over.' }, { status: 400 })
      }

      if (otpRecord.usedAt && Date.now() - new Date(otpRecord.usedAt).getTime() > 10 * 60 * 1000) {
        return NextResponse.json({ error: 'Verification expired. Please start over.' }, { status: 400 })
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }

      const hasUppercase = /[A-Z]/.test(newPassword)
      const hasLowercase = /[a-z]/.test(newPassword)
      const hasDigit = /\d/.test(newPassword)
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)
      if (!(hasUppercase && hasLowercase && hasDigit && hasSpecial)) {
        return NextResponse.json({ error: 'Password must include uppercase, lowercase, number, and special character' }, { status: 400 })
      }

      // Find user
      const user = await getUserByEmail(sanitizedEmail)
      if (!user) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'This account has been banned' }, { status: 403 })
      }

      // Hash new password
      const newHash = await bcrypt.hash(newPassword, 12)

      // Update password
      await sql`
        UPDATE "User" SET "passwordHash" = ${newHash}, "isVerified" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
      `

      // Revoke all user sessions (force re-login)
      await sql`
        UPDATE "UserSession" SET "isRevoked" = true 
        WHERE "userId" = ${user.id} AND "isRevoked" = false
      `

      // Delete the OTP record
      await sql`DELETE FROM "PasswordResetOTP" WHERE id = ${verificationToken}`

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Auth OTP error:', error)
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
