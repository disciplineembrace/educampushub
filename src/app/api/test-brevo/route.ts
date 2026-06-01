import { NextResponse } from 'next/server'
import { sendOTPEmail, verifyBrevoConnection } from '@/lib/brevo-email'

// Admin-only test endpoint - requires secret key in header
export async function GET(request: Request) {
  // Protect endpoint: require admin secret key
  const authHeader = request.headers.get('x-admin-secret')
  const adminSecret = process.env.ADMIN_SECRET || 'educampushub-admin-2024'

  if (authHeader !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized. This endpoint is for admin use only.' }, { status: 401 })
  }

  const brevoKey = process.env.BREVO_API_KEY || ''

  if (!brevoKey) {
    return NextResponse.json({
      error: 'No email service configured',
      hint: 'Set BREVO_API_KEY in environment variables',
    })
  }

  // Test connection first
  const connectionTest = await verifyBrevoConnection()

  // Try sending a test email
  const emailResult = await sendOTPEmail({
    to: 'sagathiyapradip2002@gmail.com',
    otp: '123456',
    purpose: 'admin_login',
    userName: 'Pradip',
    expiryMinutes: 5,
  })

  return NextResponse.json({
    connectionTest,
    emailResult,
  })
}
