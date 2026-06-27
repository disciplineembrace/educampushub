import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHmac, randomUUID } from 'crypto'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://educampushub.vercel.app'}/api/auth/google/callback`
const JWT_SECRET = process.env.JWT_SECRET || 'educampushub-insecure-dev-secret-change-me'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://educampushub.vercel.app'

// Create a signed JWT token (same as /api/auth)
function createSignedToken(userId: string): string {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (30 * 24 * 60 * 60) // 30 days
  const payload = { userId, type: 'user_session', iat, exp }
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

// Strip sensitive fields from user object
function sanitizeUser(user: Record<string, unknown>) {
  const { passwordHash, adminSessions, auditLogs, sessions, ...safe } = user
  return safe
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // User denied access
    if (error === 'access_denied' || !code) {
      return NextResponse.redirect(`${APP_URL}/?google_error=access_denied`)
    }

    // Verify CSRF state
    const cookieState = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('google_oauth_state='))
      ?.split('=')[1]?.trim()

    if (!state || state !== cookieState) {
      return NextResponse.redirect(`${APP_URL}/?google_error=invalid_state`)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.error('Google token exchange failed:', errText)
      return NextResponse.redirect(`${APP_URL}/?google_error=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token } = tokenData

    // Get user profile from Google
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!profileResponse.ok) {
      console.error('Google profile fetch failed:', profileResponse.status)
      return NextResponse.redirect(`${APP_URL}/?google_error=profile_fetch_failed`)
    }

    const googleUser = await profileResponse.json()
    const email = googleUser.email as string | undefined
    const name = googleUser.name as string | undefined
    const picture = googleUser.picture as string | undefined

    if (!email) {
      return NextResponse.redirect(`${APP_URL}/?google_error=no_email`)
    }

    const sanitizedEmail = email.toLowerCase().trim()

    // Find or create user in database
    let user = await db.user.findUnique({ where: { email: sanitizedEmail } })

    if (!user) {
      // Create new user (Google-verified)
      user = await db.user.create({
        data: {
          email: sanitizedEmail,
          name: name || email.split('@')[0],
          avatar: picture || null,
          isVerified: true, // Google has verified the email
        },
      })
    } else {
      // Update existing user if needed
      const updateData: Record<string, unknown> = {}

      if (!user.isVerified) {
        updateData.isVerified = true
      }
      if (picture && !user.avatar) {
        updateData.avatar = picture
      }
      if (name && !user.name) {
        updateData.name = name
      }

      if (Object.keys(updateData).length > 0) {
        user = await db.user.update({
          where: { id: user.id },
          data: updateData,
        })
      }
    }

    // Check if banned
    if (user.isBanned) {
      return NextResponse.redirect(`${APP_URL}/?google_error=account_banned`)
    }

    // Prevent admin login through Google OAuth
    if (user.isAdmin) {
      return NextResponse.redirect(`${APP_URL}/?google_error=admin_use_panel`)
    }

    // Create custom session token (same as email/password login)
    const token = createSignedToken(user.id)

    // Create UserSession record
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded?.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') || null
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    try {
      await db.userSession.create({
        data: { userId: user.id, token, ipAddress, userAgent, expiresAt },
      })
    } catch (dbError) {
      console.error('UserSession create failed:', dbError)
      // Token itself is still valid (signed JWT)
    }

    const safeUser = sanitizeUser(user as unknown as Record<string, unknown>)

    // Encode user data for URL (for client-side Zustand store update)
    const userDataEncoded = Buffer.from(JSON.stringify(safeUser)).toString('base64url')

    // Redirect to home with user data and set session cookie
    const response = NextResponse.redirect(
      `${APP_URL}/?google_login=success&user_data=${userDataEncoded}`
    )

    // Set httpOnly session cookie (same as email/password login)
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    // Clear the CSRF state cookie
    response.cookies.set('google_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(`${APP_URL}/?google_error=server_error`)
  }
}
