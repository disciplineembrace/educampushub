import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/admin-auth'
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  maskEmail,
  getUserByEmail,
} from '@/lib/otp-utils'
import { isValidEmail } from '@/lib/api-security'

// ─── Rate Limiting for forgot-password endpoint ───

const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_FORGOT_ATTEMPTS = 5
const FORGOT_LOCKOUT_MS = 15 * 60 * 1000

/**
 * POST /api/auth/forgot-password
 *
 * Email-based OTP flow for password reset:
 * 1. send_otp       — User enters email, OTP sent via Brevo
 * 2. verify_otp     — Verify the OTP code
 * 3. reset_password — Reset password after OTP is verified
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    // ─── Step 1: Send OTP to Email ───
    if (action === 'send_otp') {
      const { email } = body

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
      }

      if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

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

      // Find user by email
      const user = await getUserByEmail(sanitizedEmail)

      if (!user) {
        // Security: Don't reveal whether email exists
        const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
        forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
        return NextResponse.json({
          success: true,
          message: 'If this email is registered, an OTP will be sent.',
          maskedEmail: maskEmail(sanitizedEmail),
          otpSent: false,
        })
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'This account has been banned. Contact support.' }, { status: 403 })
      }

      // Don't allow OTP for admin accounts via this route — they should use admin forgot password
      if (user.isAdmin) {
        return NextResponse.json({ error: 'Admin accounts must use the admin panel to reset passwords.' }, { status: 400 })
      }

      // Check OTP rate limit
      const rateLimit = checkOTPRateLimit(sanitizedEmail)
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
      }

      // Generate and store OTP
      const otp = generateOTP()
      await storeOTP({ email: sanitizedEmail, otpCode: otp, purpose: 'forgot_password' })

      // Send OTP via Brevo Email - direct API call
      let emailSent = false

      const brevoKey = process.env.BREVO_API_KEY
      if (brevoKey) {
        try {
          const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': brevoKey,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              sender: { name: 'EduCampusHub', email: 'disciplineembrace@gmail.com' },
              to: [{ email: sanitizedEmail, name: user.name || sanitizedEmail.split('@')[0] }],
              subject: `Your EduCampusHub Verification Code: ${otp}`,
              htmlContent: `<div style="font-family:Arial,sans-serif;text-align:center;padding:40px"><h2 style="color:#002868">EduCampusHub</h2><p style="font-size:15px">Hello ${user.name || ''},</p><p style="font-size:15px">You requested to reset your password. Use the verification code below to proceed:</p><p style="font-size:36px;font-weight:bold;color:#FF6600;letter-spacing:8px">${otp}</p><p style="font-size:13px;color:#666">This code expires in 5 minutes. Do not share it with anyone.</p><p style="font-size:14px;color:#666">If you didn't request this, you can safely ignore this email.</p></div>`,
              textContent: `EduCampusHub Password Reset Code: ${otp}. Expires in 5 minutes.`,
            }),
          })
          const brevoData = await brevoResponse.json()
          if (brevoResponse.ok && brevoData.messageId) {
            emailSent = true
          }
        } catch (err) {
          console.error('[OTP] Brevo API error:', err)
        }
      }

      // Cleanup expired OTPs
      cleanupExpiredOTPs().catch(() => {})

      // Mask email for response
      const maskedEmailAddress = maskEmail(sanitizedEmail)

      // Increment forgot password attempt counter
      const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
      forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })

      if (!emailSent) {
        return NextResponse.json({
          error: `Failed to send OTP to ${maskedEmailAddress}. Please try again.`,
          emailError: true,
        }, { status: 503 })
      }

      return NextResponse.json({
        success: true,
        message: `OTP sent to ${maskedEmailAddress}`,
        maskedEmail: maskedEmailAddress,
      })
    }

    // ─── Step 2: Verify OTP ───
    if (action === 'verify_otp') {
      const { email, otp } = body

      if (!email || !otp) {
        return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      const result = await verifyOTP(sanitizedEmail, otp, 'forgot_password')

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

      const sanitizedEmail = email.toLowerCase().trim()

      // Find user by email
      const user = await getUserByEmail(sanitizedEmail)
      if (!user) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      // Verify the verification token
      const sql = getNeonSql()
      const otpRecords = await sql`
        SELECT id, email, "isVerified", "usedAt"
        FROM "PasswordResetOTP"
        WHERE id = ${verificationToken}
      `
      const otpRecord = otpRecords?.[0]

      if (!otpRecord || !otpRecord.isVerified || otpRecord.email !== sanitizedEmail) {
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
        message: 'Password updated successfully. Please log in with your new password.',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('User forgot password error:', error)
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
  }
}
