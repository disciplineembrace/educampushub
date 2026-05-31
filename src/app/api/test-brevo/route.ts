import { NextResponse } from 'next/server'
import { sendOTPEmail, verifyBrevoConnection } from '@/lib/brevo-email'

export async function GET() {
  const resendKey = process.env.RESEND_API_KEY || ''
  const brevoKey = process.env.BREVO_API_KEY || ''

  if (!resendKey && !brevoKey) {
    return NextResponse.json({
      error: 'No email service configured',
      hint: 'Set RESEND_API_KEY (recommended) or BREVO_API_KEY in environment variables',
      debug: {
        BREVO_API_KEY_set: !!process.env.BREVO_API_KEY,
        BREVO_API_KEY_length: process.env.BREVO_API_KEY?.length || 0,
        BREVO_API_KEY_prefix: process.env.BREVO_API_KEY?.substring(0, 10) || 'none',
        RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
      }
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
    providers: {
      resend: resendKey ? `${resendKey.substring(0, 10)}...` : 'not configured',
      brevo: brevoKey ? `${brevoKey.substring(0, 15)}...` : 'not configured',
    },
    connectionTest,
    emailResult,
  })
}
