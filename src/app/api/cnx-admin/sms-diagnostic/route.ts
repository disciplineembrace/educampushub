import { NextRequest, NextResponse } from 'next/server'
import {
  isSmsProviderConfigured,
  getConfiguredProviders,
  sendOTPSMS,
  generateOTP,
  checkOTPRateLimit,
} from '@/lib/otp-utils'

/**
 * POST /api/cnx-admin/sms-diagnostic
 *
 * Admin-only endpoint to test SMS delivery and diagnose issues.
 * Requires: { testPhone: "9876543210" }
 * Optional: { dryRun: true } — only check config, don't send SMS
 *
 * This helps admins verify their Fast2SMS/MSG91 setup without
 * going through the full login/forgot-password flow.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testPhone, dryRun } = body

    // Basic auth check — verify this is coming from admin panel
    const adminSession = request.cookies.get('cnx_admin_session')
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 401 })
    }

    // ─── Step 1: Check SMS Provider Configuration ───
    const providers = getConfiguredProviders()
    const isConfigured = isSmsProviderConfigured()

    const config = {
      providers,
      isConfigured,
      fast2sms: {
        apiKeySet: !!(process.env.FAST2SMS_API_KEY),
        apiKeyLength: process.env.FAST2SMS_API_KEY?.length || 0,
        dltTemplateId: process.env.FAST2SMS_DLT_TEMPLATE_ID || '(not set)',
        senderId: process.env.FAST2SMS_SENDER_ID || 'FSTSMS (default)',
      },
      msg91: {
        authKeySet: !!(process.env.MSG91_AUTH_KEY),
        templateId: process.env.MSG91_TEMPLATE_ID || '(not set)',
      },
    }

    if (dryRun) {
      return NextResponse.json({
        mode: 'dry_run',
        config,
        message: isConfigured
          ? 'SMS provider is configured. Use dryRun: false with a test phone number to test delivery.'
          : 'No SMS provider is configured! Set FAST2SMS_API_KEY or MSG91_AUTH_KEY in environment variables.',
      })
    }

    // ─── Step 2: Validate Test Phone Number ───
    if (!testPhone || typeof testPhone !== 'string') {
      return NextResponse.json({
        error: 'testPhone is required. Provide a 10-digit Indian mobile number.',
        config,
      }, { status: 400 })
    }

    const cleaned = testPhone.replace(/\D/g, '')
    const normalized = cleaned.length === 12 && cleaned.startsWith('91') ? cleaned.slice(2) : cleaned

    if (!/^[6-9]\d{9}$/.test(normalized)) {
      return NextResponse.json({
        error: `Invalid phone number: "${testPhone}". Must be a valid 10-digit Indian mobile number starting with 6-9.`,
        config,
      }, { status: 400 })
    }

    // ─── Step 3: Check Rate Limit ───
    const rateLimit = checkOTPRateLimit(normalized)
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: `Rate limit hit: ${rateLimit.reason}`,
        config,
        retryAfterMs: rateLimit.retryAfterMs,
      }, { status: 429 })
    }

    // ─── Step 4: Send Test OTP ───
    if (!isConfigured) {
      return NextResponse.json({
        success: false,
        config,
        message: 'No SMS provider configured. Cannot send test OTP.',
        testPhone: normalized.slice(0, 2) + '****' + normalized.slice(-2),
      }, { status: 503 })
    }

    const testOtp = generateOTP()
    const maskedPhone = normalized.slice(0, 2) + '****' + normalized.slice(-2)

    console.log(`[SMS Diagnostic] Sending test OTP ${testOtp} to ${maskedPhone}`)

    const smsResult = await sendOTPSMS(normalized, testOtp)

    return NextResponse.json({
      success: smsResult.success,
      config,
      testPhone: maskedPhone,
      otp: testOtp, // Always show OTP in diagnostic mode for verification
      result: {
        provider: smsResult.provider,
        message: smsResult.message,
        deliveryId: smsResult.deliveryId || null,
        needsAccountSetup: smsResult.needsAccountSetup || false,
        setupInstructions: smsResult.setupInstructions || null,
        isConsoleFallback: smsResult.isConsoleFallback || false,
      },
      error: smsResult.error || null,
    })

  } catch (error: any) {
    console.error('[SMS Diagnostic] Error:', error)
    return NextResponse.json({
      error: 'Diagnostic failed',
      details: error.message,
    }, { status: 500 })
  }
}
