import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/admin-auth'
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTPSMS,
  getUserByPhone,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  isSmsProviderConfigured,
} from '@/lib/otp-utils'

// ─── Rate Limiting for forgot-password endpoint ───

const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_FORGOT_ATTEMPTS = 5
const FORGOT_LOCKOUT_MS = 15 * 60 * 1000

/**
 * POST /api/auth/forgot-password
 *
 * Actions:
 * 1. send_otp     — Verify user phone, generate OTP, send to that phone
 * 2. verify_otp   — Verify the OTP code
 * 3. reset_password — Reset password after OTP is verified
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body
    const sql = getNeonSql()

    // ─── Step 1: Send OTP ───
    if (action === 'send_otp') {
      const { phone } = body

      if (!phone || typeof phone !== 'string') {
        return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
      }

      // Validate Indian phone format
      const cleanedPhone = phone.replace(/\D/g, '')
      if (cleanedPhone.length !== 10 && !(cleanedPhone.length === 12 && cleanedPhone.startsWith('91'))) {
        return NextResponse.json({ error: 'Please enter a valid 10-digit Indian mobile number' }, { status: 400 })
      }

      const normalizedPhone = cleanedPhone.length === 12 ? cleanedPhone.slice(2) : cleanedPhone

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

      // Find user by phone number
      const user = await getUserByPhone(normalizedPhone)

      if (!user || !user.passwordHash) {
        // Don't reveal whether the phone exists — but still rate-limit
        const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
        forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
        return NextResponse.json(
          { error: 'No account found with this phone number, or account uses Google sign-in only.' },
          { status: 404 }
        )
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'This account has been banned. Contact support.' }, { status: 403 })
      }

      // Check OTP rate limit
      const rateLimit = checkOTPRateLimit(normalizedPhone)
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
      }

      // Generate and store OTP
      const otp = generateOTP()
      await storeOTP(user.email, normalizedPhone, otp)

      // Send OTP via SMS (multi-provider with fallback)
      const smsResult = await sendOTPSMS(normalizedPhone, otp)

      // Cleanup expired OTPs
      cleanupExpiredOTPs().catch(() => {})

      // Mask phone for response
      const maskedPhone = normalizedPhone.slice(0, 2) + '****' + normalizedPhone.slice(-2)

      // If SMS completely failed (invalid phone), return error
      if (!smsResult.success) {
        console.error(`[Forgot Password] SMS delivery failed for ${normalizedPhone}: ${smsResult.error}`)
        return NextResponse.json({
          error: `Failed to send OTP to ${maskedPhone}. ${smsResult.message}. Please try again later.`,
          smsError: true,
        }, { status: 503 })
      }

      // Warn if using console_log (no real SMS provider)
      const isConsoleFallback = smsResult.provider === 'console_log'

      return NextResponse.json({
        success: true,
        message: isConsoleFallback
          ? 'OTP generated but no SMS provider configured. Contact support.'
          : `OTP sent to ${maskedPhone}`,
        maskedPhone,
        email: user.email,
        provider: smsResult.provider,
        ...(isConsoleFallback && { warning: 'OTP was not actually delivered via SMS. Configure MSG91 or Fast2SMS.' }),
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      })
    }

    // ─── Step 2: Verify OTP ───
    if (action === 'verify_otp') {
      const { phone, otp } = body

      if (!phone || !otp) {
        return NextResponse.json({ error: 'Phone number and OTP are required' }, { status: 400 })
      }

      const cleanedPhone = phone.replace(/\D/g, '')
      const normalizedPhone = cleanedPhone.length === 12 ? cleanedPhone.slice(2) : cleanedPhone

      // Find user to get email
      const user = await getUserByPhone(normalizedPhone)
      if (!user) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      const result = await verifyOTP(user.email, otp)

      if (!result.valid) {
        return NextResponse.json({ error: result.reason }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
        verificationToken: result.recordId,
      })
    }

    // ─── Step 3: Reset Password ───
    if (action === 'reset_password') {
      const { phone, verificationToken, newPassword } = body

      if (!phone || !verificationToken || !newPassword) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
      }

      const cleanedPhone = phone.replace(/\D/g, '')
      const normalizedPhone = cleanedPhone.length === 12 ? cleanedPhone.slice(2) : cleanedPhone

      // Find user by phone
      const user = await getUserByPhone(normalizedPhone)
      if (!user) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      // Verify the verification token
      const otpRecords = await sql`
        SELECT id, email, phone, "isVerified", "usedAt"
        FROM "PasswordResetOTP"
        WHERE id = ${verificationToken}
      `
      const otpRecord = otpRecords?.[0]

      if (!otpRecord || !otpRecord.isVerified || otpRecord.email !== user.email) {
        return NextResponse.json({ error: 'Invalid or expired verification. Please start over.' }, { status: 400 })
      }

      // Check if OTP record is too old (max 10 minutes after verification)
      if (otpRecord.usedAt && Date.now() - new Date(otpRecord.usedAt).getTime() > 10 * 60 * 1000) {
        return NextResponse.json({ error: 'Verification expired. Please start over.' }, { status: 400 })
      }

      // Validate password strength
      const validation = validatePasswordStrength(newPassword)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 })
      }

      // Update password
      const newHash = await hashPassword(newPassword)
      await sql`
        UPDATE "User" SET "passwordHash" = ${newHash}, "updatedAt" = CURRENT_TIMESTAMP
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
        message: 'Password updated successfully. Please log in with your new password.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('User forgot password error:', error)
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
