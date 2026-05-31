import { NextResponse } from 'next/server'
import { getNeonSql } from '@/lib/db'
import { createAdminSession, verifyPassword, hashPassword, validatePasswordStrength, type AdminRole } from '@/lib/admin-auth'
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTPSMS,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  checkOTPVerifyAttempts,
  incrementVerifyAttempt,
  isSmsProviderConfigured,
  getConfiguredProviders,
} from '@/lib/otp-utils'

// Rate limiting in-memory (production would use Redis)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000

/**
 * Helper: Find admin user by email using Neon HTTP driver
 */
async function findAdminUser(email: string) {
  const sql = getNeonSql()
  const users = await sql`
    SELECT id, email, name, "isAdmin", "isBanned", "passwordHash", "mustChangePassword", "adminRole",
           "twoFactorEnabled", "isSuperAdmin", phone
    FROM "User" WHERE email = ${email} LIMIT 1
  `
  return users?.[0] || null
}

/**
 * Helper: Update user password using Neon HTTP driver
 */
async function updateUserPassword(userId: string, newHash: string) {
  const sql = getNeonSql()
  await sql`
    UPDATE "User" SET "passwordHash" = ${newHash}, "mustChangePassword" = false, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `
}

// POST - Admin login with email + password, 2FA for Super Admin, admin management
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    // ─── Change Password Action ───
    if (action === 'change_password') {
      const { email, currentPassword, newPassword } = body

      if (!email || !currentPassword || !newPassword) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
      }

      const user = await findAdminUser(email)
      if (!user || !user.isAdmin || !user.passwordHash) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      const isValid = await verifyPassword(currentPassword, user.passwordHash)
      if (!isValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      const validation = validatePasswordStrength(newPassword)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 })
      }

      const newHash = await hashPassword(newPassword)
      await updateUserPassword(user.id, newHash)

      return NextResponse.json({ success: true, message: 'Password changed successfully' })
    }

    // ─── 2FA: Send Login OTP (for Super Admin or 2FA-enabled accounts) ───
    if (action === 'send_login_otp') {
      const { email } = body
      if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }

      const user = await findAdminUser(email)
      if (!user || !user.isAdmin || !user.phone) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      if (user.isBanned) {
        return NextResponse.json({ error: 'Account is banned' }, { status: 403 })
      }

      // Only for Super Admin or 2FA-enabled accounts
      if (!user.twoFactorEnabled && !user.isSuperAdmin && user.adminRole !== 'super_admin') {
        return NextResponse.json({ error: '2FA not required for this account' }, { status: 400 })
      }

      // Check rate limit
      const rateLimit = checkOTPRateLimit(user.phone)
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
      }

      // Generate and store OTP
      const otp = generateOTP()
      await storeOTP(email, user.phone, otp)

      // Send OTP via SMS (multi-provider with fallback)
      const smsResult = await sendOTPSMS(user.phone, otp)

      // Cleanup expired OTPs
      cleanupExpiredOTPs().catch(() => {})

      // Mask phone for response
      const maskedPhone = user.phone.slice(0, 2) + '****' + user.phone.slice(-2)

      // If SMS completely failed (invalid phone), return error
      if (!smsResult.success) {
        console.error(`[2FA] SMS delivery failed for ${email}: ${smsResult.error}`)
        return NextResponse.json({
          error: `Failed to send OTP to ${maskedPhone}. ${smsResult.message}. Please try again or contact support.`,
          smsError: true,
        }, { status: 503 })
      }

      // Create audit log for 2FA attempt
      const sql = getNeonSql()
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
      await sql`
        INSERT INTO "AuditLog" (id, "actorId", action, "targetType", "targetId", details, "ipAddress", "createdAt")
        VALUES (gen_random_uuid(), ${user.id}, '2fa_otp_sent', 'user', ${user.id},
        ${JSON.stringify({ maskedPhone, provider: smsResult.provider, deliveryId: smsResult.deliveryId })}, ${ip}, CURRENT_TIMESTAMP)
      `

      // Warn if using console_log (no real SMS provider)
      const isConsoleFallback = smsResult.provider === 'console_log'

      return NextResponse.json({
        success: true,
        message: isConsoleFallback
          ? `OTP generated but no SMS provider configured. Contact admin.`
          : `OTP sent to ${maskedPhone}`,
        maskedPhone,
        requiresOTP: true,
        provider: smsResult.provider,
        ...(isConsoleFallback && { warning: 'OTP was not actually delivered via SMS. Configure MSG91 or Fast2SMS.' }),
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      })
    }

    // ─── 2FA: Verify Login OTP ───
    if (action === 'verify_login_otp') {
      const { email, otp: otpCode } = body
      if (!email || !otpCode) {
        return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
      }

      const user = await findAdminUser(email)
      if (!user || !user.isAdmin) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }

      // Verify OTP
      const result = await verifyOTP(email, otpCode)
      if (!result.valid) {
        // Track failed attempt
        const otpRecords = await getNeonSql()`
          SELECT id FROM "PasswordResetOTP"
          WHERE email = ${email} AND "isVerified" = false AND "usedAt" IS NULL
          ORDER BY "createdAt" DESC LIMIT 1
        `
        if (otpRecords?.[0]) {
          incrementVerifyAttempt(otpRecords[0].id)
        }
        return NextResponse.json({ error: result.reason }, { status: 400 })
      }

      // OTP verified! Create a fully-authenticated session with 2FA flag
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
      const userAgent = request.headers.get('user-agent') || undefined
      const role = (user.adminRole || 'support_admin') as AdminRole
      const isSuperAdmin = user.isSuperAdmin || user.adminRole === 'super_admin'

      let token
      try {
        token = await createAdminSession(user.id, user.email, role, isSuperAdmin, true, ip, userAgent)
      } catch (sessionError) {
        console.error('Session creation error:', sessionError)
        // Fallback: create token without DB session (stateless)
        const { createHmac } = await import('crypto')
        const JWT_SECRET = process.env.JWT_SECRET || 'educampushub-jwt-secret-2024-secure'
        const iat = Math.floor(Date.now() / 1000)
        const exp = iat + (4 * 60 * 60)
        const payload = { userId: user.id, email: user.email, role, isSuperAdmin, twoFactorVerified: true, iat, exp }
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
        const body64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
        const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body64}`).digest('base64url')
        token = `${header}.${body64}.${signature}`
      }

      // Create audit log for 2FA success
      const sql = getNeonSql()
      await sql`
        INSERT INTO "AuditLog" (id, "actorId", action, "targetType", "targetId", details, "ipAddress", "createdAt")
        VALUES (gen_random_uuid(), ${user.id}, '2fa_login_success', 'user', ${user.id},
        ${JSON.stringify({ method: 'mobile_otp' })}, ${ip}, CURRENT_TIMESTAMP)
      `

      // Delete the used OTP record
      if (result.recordId) {
        await sql`DELETE FROM "PasswordResetOTP" WHERE id = ${result.recordId}`
      }

      const response = NextResponse.json({
        success: true,
        admin: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.adminRole || 'support_admin',
          isSuperAdmin,
          twoFactorVerified: true,
          mustChangePassword: user.mustChangePassword,
        }
      })

      response.cookies.set('cnx_admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/cnx-admin-panel',
        maxAge: 4 * 60 * 60,
      })

      return response
    }

    // ─── Login Action (Step 1: email + password) ───
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Rate limiting by IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
    const now = Date.now()
    const attempt = loginAttempts.get(ip)

    if (attempt && attempt.count >= MAX_ATTEMPTS && now - attempt.lastAttempt < LOCKOUT_DURATION) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
    }

    if (attempt && now - attempt.lastAttempt > LOCKOUT_DURATION) {
      loginAttempts.delete(ip)
    }

    // Find admin user by email
    let user
    try {
      user = await findAdminUser(email)
    } catch (dbError) {
      console.error('DB lookup error:', dbError)
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
    }

    if (!user || !user.isAdmin || user.isBanned) {
      const current = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 }
      loginAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Verify password with bcrypt
    if (!user.passwordHash) {
      return NextResponse.json({ error: 'Account not configured. Contact super admin.' }, { status: 403 })
    }

    const passwordValid = await verifyPassword(password, user.passwordHash)
    if (!passwordValid) {
      const current = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 }
      loginAttempts.set(ip, { count: current.count + 1, lastAttempt: now })
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const role = (user.adminRole || 'support_admin') as AdminRole
    const isSuperAdmin = user.isSuperAdmin || user.adminRole === 'super_admin'
    const requires2FA = user.twoFactorEnabled || isSuperAdmin

    // ─── If Super Admin or 2FA enabled, require OTP before granting full access ───
    if (requires2FA) {
      // Create audit log for login attempt (password verified, pending 2FA)
      const sql = getNeonSql()
      await sql`
        INSERT INTO "AuditLog" (id, "actorId", action, "targetType", "targetId", details, "ipAddress", "createdAt")
        VALUES (gen_random_uuid(), ${user.id}, 'login_password_ok_2fa_pending', 'user', ${user.id},
        ${JSON.stringify({ role, isSuperAdmin })}, ${ip}, CURRENT_TIMESTAMP)
      `

      // Return that 2FA is required — DO NOT create a session yet
      // Reset rate limit since password was correct
      loginAttempts.delete(ip)

      return NextResponse.json({
        success: true,
        requires2FA: true,
        admin: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.adminRole || 'support_admin',
          isSuperAdmin,
          mustChangePassword: user.mustChangePassword,
        }
      })
    }

    // ─── No 2FA required: Create session directly ───
    let token
    try {
      const userAgent = request.headers.get('user-agent') || undefined
      token = await createAdminSession(user.id, user.email, role, isSuperAdmin, false, ip, userAgent)
    } catch (sessionError) {
      console.error('Session creation error:', sessionError)
      // Fallback: create token without DB session (stateless)
      const { createHmac } = await import('crypto')
      const JWT_SECRET = process.env.JWT_SECRET || 'educampushub-jwt-secret-2024-secure'
      const iat = Math.floor(Date.now() / 1000)
      const exp = iat + (4 * 60 * 60)
      const payload = { userId: user.id, email: user.email, role, isSuperAdmin, twoFactorVerified: false, iat, exp }
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
      const body64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
      const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body64}`).digest('base64url')
      token = `${header}.${body64}.${signature}`
    }

    // Reset rate limit on success
    loginAttempts.delete(ip)

    // Create audit log for successful login
    const sql = getNeonSql()
    await sql`
      INSERT INTO "AuditLog" (id, "actorId", action, "targetType", "targetId", details, "ipAddress", "createdAt")
      VALUES (gen_random_uuid(), ${user.id}, 'admin_login', 'user', ${user.id},
      ${JSON.stringify({ role, isSuperAdmin, twoFactorVerified: false })}, ${ip}, CURRENT_TIMESTAMP)
    `

    const response = NextResponse.json({
      success: true,
      admin: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.adminRole || 'support_admin',
        isSuperAdmin,
        twoFactorVerified: false,
        mustChangePassword: user.mustChangePassword,
      }
    })

    response.cookies.set('cnx_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/cnx-admin-panel',
      maxAge: 4 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('Admin auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
