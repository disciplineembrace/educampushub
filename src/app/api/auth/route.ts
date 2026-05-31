import { db, getNeonSql } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkApiRateLimit, isValidEmail, sanitizeString } from '@/lib/api-security'
import bcrypt from 'bcryptjs'
import { createHmac, randomUUID } from 'crypto'
import {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTPSMS,
  checkOTPRateLimit,
  cleanupExpiredOTPs,
  isSmsProviderConfigured,
} from '@/lib/otp-utils'

const JWT_SECRET = process.env.JWT_SECRET || 'educampushub-insecure-dev-secret-change-me'

// Strip sensitive fields from user object before returning
function sanitizeUser(user: Record<string, unknown>) {
  const { passwordHash, adminSessions, auditLogs, sessions, ...safe } = user
  return safe
}

// Password strength validation: 8+ chars, uppercase, lowercase, digit, special char
function isPasswordStrong(password: string): boolean {
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  return hasUppercase && hasLowercase && hasDigit && hasSpecial
}

// Create a simple signed token (same pattern as admin-auth)
function createSignedToken(userId: string): string {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (30 * 24 * 60 * 60) // 30 days
  const payload = { userId, type: 'user_session', iat, exp }
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

// Create a session token and UserSession record
async function createUserSession(userId: string, request: Request) {
  const token = createSignedToken(userId)

  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded?.split(',')[0]?.trim() || null
  const userAgent = request.headers.get('user-agent') || null
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  try {
    await db.userSession.create({
      data: {
        userId,
        token,
        ipAddress,
        userAgent,
        expiresAt,
      },
    })
  } catch (dbError) {
    // If UserSession table doesn't exist yet, just log and continue
    // The token itself is still valid (signed JWT)
    console.error('UserSession create failed (table may not exist yet):', dbError)
  }

  return token
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkApiRateLimit(request)
    if (rateLimit && !rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { action } = body

    // ─── REGISTER ─────────────────────────────────────────────
    if (action === 'register') {
      const { name, email, password, phone } = body

      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return NextResponse.json({ error: 'Name must be between 2 and 100 characters' }, { status: 400 })
      }

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }

      if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Please enter a valid email' }, { status: 400 })
      }

      if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 })
      }

      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }

      if (!isPasswordStrong(password)) {
        return NextResponse.json({ error: 'Password must include uppercase, lowercase, number, and special character' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()
      const sanitizedName = sanitizeString(name.trim(), 100)

      // Check if email already exists
      const existingUser = await db.user.findUnique({ where: { email: sanitizedEmail } })
      if (existingUser) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
      }

      // Hash password with bcrypt (12 rounds)
      const passwordHash = await bcrypt.hash(password, 12)

      // Create user
      const user = await db.user.create({
        data: {
          email: sanitizedEmail,
          name: sanitizedName,
          phone: phone ? sanitizeString(phone.trim(), 20) : null,
          passwordHash,
          isVerified: false,
        },
      })

      // Create session
      const token = await createUserSession(user.id, request)

      const safeUser = sanitizeUser(user as unknown as Record<string, unknown>)

      const response = NextResponse.json({
        user: safeUser,
        token,
        message: 'Account created successfully!',
      }, { status: 201 })

      // Set httpOnly cookie
      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })

      return response
    }

    // ─── LOGIN ────────────────────────────────────────────────
    if (action === 'login') {
      const { email, password } = body

      if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }

      if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 })
      }

      const sanitizedEmail = email.toLowerCase().trim()

      // Find user by email
      const user = await db.user.findUnique({ where: { email: sanitizedEmail } })
      if (!user || !user.passwordHash) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      // Compare password with bcrypt
      const passwordMatch = await bcrypt.compare(password, user.passwordHash)
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      }

      // Check if banned
      if (user.isBanned) {
        return NextResponse.json({ error: 'This account has been banned' }, { status: 403 })
      }

      // Create session
      const token = await createUserSession(user.id, request)

      const safeUser = sanitizeUser(user as unknown as Record<string, unknown>)

      const response = NextResponse.json({
        user: safeUser,
        token,
      })

      // Set httpOnly cookie
      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })

      return response
    }

    // ─── SEND REGISTRATION OTP ───────────────────────────────
    if (action === 'send_registration_otp') {
      const { phone, email } = body

      if (!phone || typeof phone !== 'string') {
        return NextResponse.json({ error: 'Phone number is required for OTP verification' }, { status: 400 })
      }

      // Validate Indian phone format
      const cleanedPhone = phone.replace(/\D/g, '')
      const normalizedPhone = cleanedPhone.length === 12 ? cleanedPhone.slice(2) : cleanedPhone

      if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
        return NextResponse.json({ error: 'Please enter a valid 10-digit Indian mobile number' }, { status: 400 })
      }

      // Check if phone already registered
      const existingPhone = await db.user.findFirst({ where: { phone: normalizedPhone } })
      if (existingPhone) {
        return NextResponse.json({ error: 'This phone number is already registered. Please login instead.' }, { status: 409 })
      }

      // If email provided, check if already registered
      const regEmail = email?.toLowerCase().trim()
      if (regEmail) {
        const existingEmail = await db.user.findUnique({ where: { email: regEmail } })
        if (existingEmail) {
          return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
        }
      }

      // Check SMS provider
      if (!isSmsProviderConfigured()) {
        return NextResponse.json({
          error: 'SMS service is currently unavailable. Please try again later or contact support.',
          smsError: true,
        }, { status: 503 })
      }

      // Check OTP rate limit
      const rateLimit = checkOTPRateLimit(normalizedPhone)
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: rateLimit.reason, retryAfterMs: rateLimit.retryAfterMs }, { status: 429 })
      }

      // Generate and store OTP (use a temporary email placeholder)
      const tempEmail = regEmail || `phone_${normalizedPhone}@temp.registration`
      const otp = generateOTP()
      await storeOTP(tempEmail, normalizedPhone, otp)

      // Send OTP via SMS
      const smsResult = await sendOTPSMS(normalizedPhone, otp)

      // Cleanup expired OTPs
      cleanupExpiredOTPs().catch(() => {})

      // Mask phone for response
      const maskedPhone = normalizedPhone.slice(0, 2) + '****' + normalizedPhone.slice(-2)

      if (!smsResult.success) {
        console.error(`[Registration] SMS delivery failed for ${normalizedPhone}: ${smsResult.error}`)
        return NextResponse.json({
          error: `Failed to send OTP to ${maskedPhone}. Please check your number and try again.`,
          smsError: true,
        }, { status: 503 })
      }

      return NextResponse.json({
        success: true,
        message: `OTP sent to ${maskedPhone}`,
        maskedPhone,
        ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
      })
    }

    // ─── VERIFY REGISTRATION OTP ───────────────────────────────
    if (action === 'verify_registration_otp') {
      const { phone, otp } = body

      if (!phone || !otp) {
        return NextResponse.json({ error: 'Phone number and OTP are required' }, { status: 400 })
      }

      const cleanedPhone = phone.replace(/\D/g, '')
      const normalizedPhone = cleanedPhone.length === 12 ? cleanedPhone.slice(2) : cleanedPhone

      // Find OTP record by phone (using temp email pattern)
      const tempEmail = `phone_${normalizedPhone}@temp.registration`

      // Try with temp email first, then try to find by phone directly
      let result = await verifyOTP(tempEmail, otp)

      // If not found with temp email, try finding OTP by phone in DB
      if (!result.valid) {
        const neonSql = getNeonSql()
        const otpRecords = await neonSql`
          SELECT email FROM "PasswordResetOTP"
          WHERE phone = ${normalizedPhone} AND "otpCode" = ${otp} AND "isVerified" = false AND "usedAt" IS NULL
          ORDER BY "createdAt" DESC LIMIT 1
        `
        if (otpRecords?.[0]) {
          result = await verifyOTP(otpRecords[0].email, otp)
        }
      }

      if (!result.valid) {
        return NextResponse.json({ error: result.reason || 'Invalid or expired OTP' }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Phone number verified successfully',
        verificationToken: result.recordId,
      })
    }

    // ─── LOGOUT ───────────────────────────────────────────────
    if (action === 'logout') {
      const { token } = body

      if (token) {
        try {
          await db.userSession.updateMany({
            where: { token, isRevoked: false },
            data: { isRevoked: true },
          })
        } catch {
          // Session table may not exist yet
        }
      }

      const response = NextResponse.json({ message: 'Logged out successfully' })

      // Clear the session cookie
      response.cookies.set('session_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })

      return response
    }

    // ─── DEFAULT (backward compat: email-only flow) ───────────
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Sanitize email
    const sanitizedEmail = email.toLowerCase().trim()

    let user = await db.user.findUnique({ where: { email: sanitizedEmail } })

    if (!user) {
      // Create new user with sanitized name from email
      const nameFromEmail = sanitizeString(
        sanitizedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        100
      )
      user = await db.user.create({
        data: {
          email: sanitizedEmail,
          name: nameFromEmail,
        }
      })
    }

    if (user.isBanned) {
      return NextResponse.json({ error: 'Account has been banned' }, { status: 403 })
    }

    const safeUser = sanitizeUser(user as unknown as Record<string, unknown>)

    return NextResponse.json({ user: safeUser })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
