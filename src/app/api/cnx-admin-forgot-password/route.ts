import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/admin-auth'
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTPSMS,
  getAdminPhone,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  isSmsProviderConfigured,
  getConfiguredProviders,
} from '@/lib/otp-utils'

// ─── Rate Limiting for forgot-password endpoint ───

const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_FORGOT_ATTEMPTS = 5
const FORGOT_LOCKOUT_MS = 15 * 60 * 1000

/**
 * POST /api/cnx-admin-forgot-password
 * 
 * Actions:
 * 1. send_otp     — Verify admin email, generate OTP, send to registered phone
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

      // Verify admin exists (using Neon HTTP)
      const users = await sql`SELECT id, "isAdmin", "isBanned", phone FROM "User" WHERE email = ${email} LIMIT 1`
      const user = users?.[0]
      
      if (!user || !user.isAdmin) {
        const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
        forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
        return NextResponse.json(
          { error: 'If this email belongs to an admin account, an OTP will be sent to the registered phone number.' },
          { status: 200 }
        )
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'Account is banned. Contact support.' }, { status: 403 })
      }

      // Get admin's registered phone
      const phone = user.phone
      if (!phone) {
        return NextResponse.json(
          { error: 'No phone number registered with this admin account. Contact super admin.' },
          { status: 400 }
        )
      }

      // Check OTP rate limit
      const rateLimit = checkOTPRateLimit(phone)
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
      }

      // Generate and store OTP
      const otp = generateOTP()
      await storeOTP(email, phone, otp)

      // Send OTP via SMS (multi-provider with fallback)
      const smsResult = await sendOTPSMS(phone, otp)

      // Cleanup expired OTPs
      cleanupExpiredOTPs().catch(() => {})

      // Mask phone for response
      const maskedPhone = phone.slice(0, 2) + '****' + phone.slice(-2)

      // If SMS completely failed (invalid phone), return error
      if (!smsResult.success) {
        console.error(`[Admin Forgot Password] SMS delivery failed for ${email}: ${smsResult.error}`)
        return NextResponse.json({
          error: `Failed to send OTP to ${maskedPhone}. ${smsResult.message}`,
          smsError: true,
          needsAccountSetup: smsResult.needsAccountSetup || false,
          setupInstructions: smsResult.setupInstructions || '',
        }, { status: 503 })
      }

      // Warn if using console_log (no real SMS provider)
      const isConsoleFallback = smsResult.provider === 'console_log'

      return NextResponse.json({
        success: true,
        message: isConsoleFallback
          ? 'OTP generated but no SMS provider configured. Contact admin.'
          : `OTP sent to ${maskedPhone}`,
        maskedPhone,
        provider: smsResult.provider,
        ...(isConsoleFallback && { warning: 'OTP was not actually delivered via SMS. Configure MSG91 or Fast2SMS.' }),
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      })
    }

    // ─── Step 2: Verify OTP ───
    if (action === 'verify_otp') {
      const { email, otp } = body

      if (!email || !otp) {
        return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
      }

      const result = await verifyOTP(email, otp)

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
      const { email, verificationToken, newPassword } = body

      if (!email || !verificationToken || !newPassword) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
      }

      // Verify the verification token
      const otpRecords = await sql`
        SELECT id, email, phone, "isVerified", "usedAt" 
        FROM "PasswordResetOTP" 
        WHERE id = ${verificationToken}
      `
      const otpRecord = otpRecords?.[0]

      if (!otpRecord || !otpRecord.isVerified || otpRecord.email !== email) {
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

      // Delete the OTP record
      await sql`DELETE FROM "PasswordResetOTP" WHERE id = ${verificationToken}`

      // Create audit log
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
      await sql`
        INSERT INTO "AuditLog" (id, "actorId", action, "targetType", "targetId", details, "ipAddress", "createdAt")
        VALUES (gen_random_uuid(), ${adminUser.id}, 'password_reset_otp', 'user', ${adminUser.id}, 
        ${JSON.stringify({ method: 'mobile_otp', phone: otpRecord.phone })}, ${ip}, CURRENT_TIMESTAMP)
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
