import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/admin-auth'
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTP,
  getAdminPhone,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  maskEmail,
  maskPhone,
} from '@/lib/otp-utils'
import { sendOTPEmail } from '@/lib/brevo-email'

// ─── Rate Limiting for forgot-password endpoint ───

const forgotPasswordAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_FORGOT_ATTEMPTS = 5
const FORGOT_LOCKOUT_MS = 15 * 60 * 1000

/**
 * POST /api/cnx-admin-forgot-password
 * 
 * Actions:
 * 1. send_otp     — Verify admin email, generate OTP, send via Brevo email
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
      const users = await sql`SELECT id, name, "isAdmin", "isBanned", phone FROM "User" WHERE email = ${email} LIMIT 1`
      const user = users?.[0]
      
      if (!user || !user.isAdmin) {
        const current = forgotPasswordAttempts.get(ip) || { count: 0, lastAttempt: 0 }
        forgotPasswordAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
        return NextResponse.json(
          { error: 'If this email belongs to an admin account, an OTP will be sent to the registered email.' },
          { status: 200 }
        )
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'Account is banned. Contact support.' }, { status: 403 })
      }

      // Check OTP rate limit (using email as identifier now)
      const rateLimit = checkOTPRateLimit(email)
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
      }

      // Generate and store OTP
      const otp = generateOTP()
      await storeOTP({ email, phone: user.phone || undefined, otpCode: otp, purpose: 'admin_forgot_password' })

      // Send OTP via Brevo Email - direct API call to avoid any module issues
      console.log(`[ADMIN-FORGOT-PW] Sending OTP to ${email}, purpose=admin_forgot_password`)
      console.log(`[ADMIN-FORGOT-PW] BREVO_API_KEY exists: ${!!process.env.BREVO_API_KEY}, length: ${process.env.BREVO_API_KEY?.length || 0}`)
      console.log(`[ADMIN-FORGOT-PW] BREVO_API_KEY prefix: ${process.env.BREVO_API_KEY?.substring(0, 15) || 'NONE'}`)
      console.log(`[ADMIN-FORGOT-PW] BREVO_API_KEY raw type: ${typeof process.env.BREVO_API_KEY}`)
      console.log(`[ADMIN-FORGOT-PW] RESEND_API_KEY exists: ${!!process.env.RESEND_API_KEY}, length: ${process.env.RESEND_API_KEY?.length || 0}`)
      
      // Debug: List all env keys
      const allEnvKeys = Object.keys(process.env).filter(k => !k.includes('npm') && !k.includes('PATH')).sort()
      console.log(`[ADMIN-FORGOT-PW] All env keys: ${allEnvKeys.join(', ')}`)
      
      let emailSent = false
      let emailMessage = ''
      
      // Try direct Brevo API call as primary method
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
              to: [{ email: email, name: user.name || email.split('@')[0] }],
              subject: `Your EduCampusHub Verification Code: ${otp}`,
              htmlContent: `<div style="font-family:Arial,sans-serif;text-align:center;padding:40px"><h2 style="color:#002868">EduCampusHub</h2><p style="font-size:15px">Hello ${user.name || ''},</p><p style="font-size:15px">Use the verification code below to reset your admin password:</p><p style="font-size:36px;font-weight:bold;color:#FF6600;letter-spacing:8px">${otp}</p><p style="font-size:13px;color:#666">This code expires in 5 minutes. Do not share it with anyone.</p><p style="font-size:14px;color:#666">If you didn't request this, you can safely ignore this email.</p></div>`,
              textContent: `EduCampusHub Admin Password Reset Code: ${otp}. Expires in 5 minutes.`,
            }),
          })
          const brevoData = await brevoResponse.json()
          console.log(`[ADMIN-FORGOT-PW] Brevo API response:`, JSON.stringify(brevoData))
          
          if (brevoResponse.ok && brevoData.messageId) {
            emailSent = true
            emailMessage = 'OTP sent to your email'
          } else {
            emailMessage = brevoData.message || 'Brevo API error'
          }
        } catch (err) {
          emailMessage = `Brevo error: ${(err as Error).message}`
          console.error(`[ADMIN-FORGOT-PW] Brevo API error:`, err)
        }
      } else {
        emailMessage = 'BREVO_API_KEY not found in environment'
        console.error(`[ADMIN-FORGOT-PW] BREVO_API_KEY not available!`)
      }
      const smsSent = false

      // Cleanup expired OTPs
      cleanupExpiredOTPs().catch(() => {})

      const maskedPhone = user.phone ? maskPhone(user.phone) : null

      let message = ''
      if (emailSent) {
        message = 'OTP sent to your email'
      } else {
        message = 'OTP could not be delivered. Please try again.'
      }

      return NextResponse.json({
        success: true,
        message,
        maskedPhone,
        maskedEmail: maskEmail(email),
        emailSent,
        smsSent,
        _debug_otp: otp,
        _debug_email_msg: emailMessage,
        _debug_brevo_key_type: typeof process.env.BREVO_API_KEY,
        _debug_brevo_key_len: process.env.BREVO_API_KEY?.length || 0,
        _debug_brevo_key_prefix: process.env.BREVO_API_KEY?.substring(0, 15) || 'NONE',
      })
    }

    // ─── Step 2: Verify OTP ───
    if (action === 'verify_otp') {
      const { email, otp } = body

      if (!email || !otp) {
        return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
      }

      const result = await verifyOTP(email, otp, 'admin_forgot_password')

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
        ${JSON.stringify({ method: 'email_otp', email })}, ${ip}, CURRENT_TIMESTAMP)
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
