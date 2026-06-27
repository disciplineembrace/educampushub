import { NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'https://educampushub.vercel.app'}/api/auth/google/callback`

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

export async function GET() {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 })
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  // Set state in a short-lived cookie for CSRF verification
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )

  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
