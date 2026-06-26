import { db, getNeonSql } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkApiRateLimit, isValidEmail, sanitizeString } from '@/lib/api-security'
import bcrypt from 'bcryptjs'
import { createHmac, randomUUID } from 'crypto'
import {
  SECURITY_QUESTIONS,
  isValidSecurityQuestionIndex,
  validateSecurityAnswer,
  hashSecurityAnswer,
} from '@/lib/security-question'

const JWT_SECRET = process.env.JWT_SECRET || 'educampushub-insecure-dev-secret-change-me'

// Strip sensitive fields from user object before returning
function sanitizeUser(user: Record<string, unknown>) {
  const {
    passwordHash,
    adminSessions,
    auditLogs,
    sessions,
    securityAnswerHash,   // NEVER expose the hashed answer to the client
    securityAttempts,     // Don't reveal how many failed attempts the user has
    securityLockedUntil,
    ...safe
  } = user
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

    // ─── REGISTER (No OTP required — direct email + password signup) ───
    if (action === 'register') {
      const { name, email, password, phone, securityQuestionIdx, securityAnswer } = body

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

      // ─── Security question validation (REQUIRED for new registrations) ───
      if (!isValidSecurityQuestionIndex(securityQuestionIdx)) {
        return NextResponse.json({ error: 'Please select a valid security question' }, { status: 400 })
      }

      if (!securityAnswer || typeof securityAnswer !== 'string') {
        return NextResponse.json({ error: 'Security answer is required' }, { status: 400 })
      }

      const answerValidation = validateSecurityAnswer(securityAnswer)
      if (!answerValidation.valid) {
        return NextResponse.json({ error: answerValidation.error || 'Invalid security answer' }, { status: 400 })
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

      // Hash security answer with bcrypt (12 rounds, normalized)
      const securityAnswerHash = await hashSecurityAnswer(securityAnswer)

      // Create user (directly verified since no OTP needed)
      const user = await db.user.create({
        data: {
          email: sanitizedEmail,
          name: sanitizedName,
          phone: phone ? sanitizeString(phone.trim(), 20) : null,
          passwordHash,
          isVerified: true,
          securityQuestionIdx,
          securityAnswerHash,
          securityUpdatedAt: new Date(),
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

    // ─── LOGIN (Email/username + password only, No OTP) ───
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

      // Prevent admin login through user portal
      if (user.isAdmin) {
        return NextResponse.json({ error: 'Admin accounts must use the admin login panel' }, { status: 403 })
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

    // ─── LOGOUT ───
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

    // ─── Invalid Action ───
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
