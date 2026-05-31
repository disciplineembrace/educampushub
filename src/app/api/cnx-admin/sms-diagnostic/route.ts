import { NextRequest, NextResponse } from 'next/server'
import { verifyBrevoConnection } from '@/lib/brevo-email'
import {
  generateOTP,
  checkOTPRateLimit,
  sendOTP,
  maskEmail,
} from '@/lib/otp-utils'

/**
 * POST /api/cnx-admin/sms-diagnostic
 *
 * Admin-only endpoint to test email OTP delivery and diagnose issues.
 * Requires: { testEmail: "admin@example.com" }
 * Optional: { dryRun: true } — only check config, don't send email
 *
 * This helps admins verify their Brevo email setup without
 * going through the full login/forgot-password flow.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testEmail, dryRun } = body

    // Basic auth check — verify this is coming from admin panel
    const adminSession = request.cookies.get('cnx_admin_session')
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 401 })
    }

    // ─── Step 1: Check Brevo Email Configuration ───
    const brevoCheck = await verifyBrevoConnection()

    const config = {
      emailProvider: 'Brevo',
      brevo: {
        apiKeySet: !!(process.env.BREVO_API_KEY),
        apiKeyLength: process.env.BREVO_API_KEY?.length || 0,
        connectionValid: brevoCheck.valid,
        connectionInfo: brevoCheck.info || '(unable to verify)',
      },
    }

    if (dryRun) {
      return NextResponse.json({
        mode: 'dry_run',
        config,
        message: brevoCheck.valid
          ? 'Brevo email provider is configured and connected. Use dryRun: false with a test email address to test delivery.'
          : 'Brevo email provider is not properly configured! Set BREVO_API_KEY in environment variables.',
      })
    }

    // ─── Step 2: Validate Test Email ───
    if (!testEmail || typeof testEmail !== 'string') {
      return NextResponse.json({
        error: 'testEmail is required. Provide a valid email address.',
        config,
      }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(testEmail)) {
      return NextResponse.json({
        error: `Invalid email address: "${testEmail}".`,
        config,
      }, { status: 400 })
    }

    // ─── Step 3: Check Rate Limit ───
    const rateLimit = checkOTPRateLimit(testEmail)
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: `Rate limit hit: ${rateLimit.reason}`,
        config,
        retryAfterMs: rateLimit.retryAfterMs,
      }, { status: 429 })
    }

    // ─── Step 4: Send Test OTP via Email ───
    if (!brevoCheck.valid) {
      return NextResponse.json({
        success: false,
        config,
        message: 'Brevo email provider not configured. Cannot send test OTP.',
        testEmail: maskEmail(testEmail),
      }, { status: 503 })
    }

    const testOtp = generateOTP()
    const maskedTestEmail = maskEmail(testEmail)

    console.log(`[Email Diagnostic] Sending test OTP ${testOtp} to ${maskedTestEmail}`)

    const sendResult = await sendOTP({
      email: testEmail,
      otp: testOtp,
      purpose: 'login',
      userName: 'Diagnostic Test',
    })

    return NextResponse.json({
      success: sendResult.emailSent,
      config,
      testEmail: maskedTestEmail,
      otp: testOtp, // Always show OTP in diagnostic mode for verification
      result: {
        emailSent: sendResult.emailSent,
        message: sendResult.message,
      },
      error: sendResult.emailSent ? null : 'Email delivery failed',
    })

  } catch (error: any) {
    console.error('[Email Diagnostic] Error:', error)
    return NextResponse.json({
      error: 'Diagnostic failed',
      details: error.message,
    }, { status: 500 })
  }
}
