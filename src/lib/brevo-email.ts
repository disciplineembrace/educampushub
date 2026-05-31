/**
 * Email Utility for EduCampusHub
 * 
 * Sends OTP verification emails via:
 * 1. Resend API (primary - no IP restrictions)
 * 2. Brevo SMTP API (fallback)
 * 
 * Environment Variables:
 * - RESEND_API_KEY: Resend API key (primary, recommended)
 * - BREVO_API_KEY: Brevo API key (fallback)
 * - EMAIL_FROM: Sender email address (optional, defaults vary by provider)
 * - EMAIL_FROM_NAME: Sender name (optional, defaults to 'EduCampusHub')
 */

// ─── Configuration ───

const RESEND_API_KEY = () => process.env.RESEND_API_KEY || ''
const BREVO_API_KEY = () => process.env.BREVO_API_KEY || ''
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const SENDER_NAME = () => process.env.EMAIL_FROM_NAME || 'EduCampusHub'

// Default sender emails per provider
// Brevo: Must use a verified sender email in Brevo account
// Resend: Uses onboarding@resend.dev by default (for testing), or custom domain
const RESEND_SENDER_EMAIL = () => process.env.EMAIL_FROM || 'onboarding@resend.dev'
const BREVO_SENDER_EMAIL = () => process.env.EMAIL_FROM || 'disciplineembrace@gmail.com'

// ─── Types ───

interface EmailResult {
  success: boolean
  message: string
  messageId?: string
  provider?: string
}

interface OTPEmailParams {
  to: string
  otp: string
  purpose: 'forgot_password' | 'admin_login' | 'admin_forgot_password'
  userName?: string
  expiryMinutes?: number
}

// ─── Email Template Generator ───

function getOTPEmailHTML(params: OTPEmailParams): string {
  const { otp, purpose, userName, expiryMinutes = 5 } = params

  const purposeConfig: Record<string, { title: string; greeting: string; body: string }> = {
    forgot_password: {
      title: 'Reset Your Password',
      greeting: userName ? `Hello ${userName},` : 'Hello,',
      body: 'You requested to reset your password. Use the verification code below to proceed. If you did not make this request, you can safely ignore this email.',
    },
    admin_login: {
      title: 'Admin Login Verification Code',
      greeting: userName ? `Hello ${userName},` : 'Hello,',
      body: 'You are logging into the EduCampusHub Admin Panel. Please use the verification code below to complete your login. If you did not attempt this login, please secure your account immediately.',
    },
    admin_forgot_password: {
      title: 'Admin Password Reset Code',
      greeting: userName ? `Hello ${userName},` : 'Hello,',
      body: 'You requested to reset your admin password. Use the verification code below to proceed. If you did not make this request, you can safely ignore this email.',
    },
  }

  const config = purposeConfig[purpose] || purposeConfig.forgot_password

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f5f7; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <!-- Header with brand colors -->
          <tr>
            <td style="background: linear-gradient(135deg, #002868 0%, #003d8f 100%); border-radius: 16px 16px 0 0; padding: 40px 40px 30px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #FF6600 0%, #FF8533 100%); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(255, 102, 0, 0.3);">
                      <span style="font-size: 24px; color: white; font-weight: bold;">E</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
                    Edu<span style="color: #FF6600;">CampusHub</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 40px 32px; border-left: 1px solid #e8e8ec; border-right: 1px solid #e8e8ec;">
              <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.3px;">
                ${config.title}
              </h1>
              <p style="margin: 0 0 20px; font-size: 15px; color: #6b7280; line-height: 1.5;">
                ${config.greeting}
              </p>
              <p style="margin: 0 0 28px; font-size: 15px; color: #374151; line-height: 1.6;">
                ${config.body}
              </p>
              
              <!-- OTP Code Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #f8f9ff 0%, #eef1ff 100%); border: 2px dashed #002868; border-radius: 12px; padding: 24px 20px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                      Verification Code
                    </p>
                    <p style="margin: 0; font-size: 36px; font-weight: 800; color: #002868; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace;">
                      ${otp}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Expiry Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 12px 16px;">
                    <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                      <strong>Expires in ${expiryMinutes} minutes.</strong> This code is valid for a limited time only. Do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                If you didn't request this code, you can safely ignore this email. Your account is secure.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fb; border-radius: 0 0 16px 16px; padding: 24px 40px; border: 1px solid #e8e8ec; border-top: none; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">
                This is an automated email from EduCampusHub. Please do not reply.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                &copy; 2025 EduCampusHub. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

function getOTPEmailText(params: OTPEmailParams): string {
  const { otp, purpose, userName, expiryMinutes = 5 } = params

  const purposeText: Record<string, string> = {
    forgot_password: 'password reset',
    admin_login: 'admin login verification',
    admin_forgot_password: 'admin password reset',
  }

  return `
EduCampusHub - ${purposeText[purpose] || 'Verification'} Code

${userName ? `Hello ${userName},` : 'Hello,'}

Your verification code is: ${otp}

This code expires in ${expiryMinutes} minutes.

If you didn't request this code, you can safely ignore this email.

© 2025 EduCampusHub. All rights reserved.
  `.trim()
}

// ─── Send via Resend ───

async function sendViaResend(params: OTPEmailParams): Promise<EmailResult> {
  const apiKey = RESEND_API_KEY()
  if (!apiKey) {
    return { success: false, message: 'RESEND_API_KEY not configured', provider: 'resend' }
  }

  try {
    const htmlContent = getOTPEmailHTML(params)
    const textContent = getOTPEmailText(params)
    const senderEmail = RESEND_SENDER_EMAIL()
    const senderName = SENDER_NAME()

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [params.to],
        subject: `Your EduCampusHub Verification Code: ${params.otp}`,
        html: htmlContent,
        text: textContent,
        tags: [
          { name: 'type', value: 'otp' },
          { name: 'purpose', value: params.purpose },
        ],
      }),
    })

    const data = await response.json()

    if (response.ok && data.id) {
      console.log(`[Resend] OTP email sent to ${params.to}, id: ${data.id}`)
      return {
        success: true,
        message: 'OTP email sent successfully',
        messageId: data.id,
        provider: 'Resend',
      }
    }

    console.error('[Resend] API error:', JSON.stringify(data))
    return {
      success: false,
      message: data.message || data.error?.message || 'Failed to send email via Resend',
      provider: 'Resend',
    }
  } catch (error) {
    console.error('[Resend] Request error:', error)
    return {
      success: false,
      message: 'Resend service temporarily unavailable',
      provider: 'Resend',
    }
  }
}

// ─── Send via Brevo ───

async function sendViaBrevo(params: OTPEmailParams): Promise<EmailResult> {
  const apiKey = BREVO_API_KEY()
  if (!apiKey) {
    return { success: false, message: 'BREVO_API_KEY not configured', provider: 'brevo' }
  }

  try {
    const htmlContent = getOTPEmailHTML(params)
    const textContent = getOTPEmailText(params)
    const senderEmail = BREVO_SENDER_EMAIL()
    const senderName = SENDER_NAME()

    const payload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: params.to,
          name: params.userName || params.to.split('@')[0],
        },
      ],
      subject: `Your EduCampusHub Verification Code: ${params.otp}`,
      htmlContent,
      textContent,
      headers: {
        'X-Mailer': 'EduCampusHub-OTP-Service',
      },
      tags: [`otp`, params.purpose],
    }

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (response.ok && data.messageId) {
      console.log(`[Brevo] OTP email sent to ${params.to}, messageId: ${data.messageId}`)
      return {
        success: true,
        message: 'OTP email sent successfully',
        messageId: data.messageId,
        provider: 'Brevo',
      }
    }

    // Handle Brevo API errors
    console.error('[Brevo] API error:', JSON.stringify(data))

    return {
      success: false,
      message: data.message || 'Failed to send email via Brevo',
      provider: 'Brevo',
    }
  } catch (error) {
    console.error('[Brevo] Request error:', error)
    return {
      success: false,
      message: 'Brevo service temporarily unavailable',
      provider: 'Brevo',
    }
  }
}

// ─── Main Send OTP Email Function ───

export async function sendOTPEmail(params: OTPEmailParams): Promise<EmailResult> {
  const resendKey = RESEND_API_KEY()
  const brevoKey = BREVO_API_KEY()

  // If no email service is configured, log to console
  if (!resendKey && !brevoKey) {
    console.error('[Email] No email service configured. Set RESEND_API_KEY or BREVO_API_KEY.')
    console.log(`[OTP-EMAIL] To: ${params.to}, OTP: ${params.otp}, Purpose: ${params.purpose}`)
    return {
      success: false,
      message: 'Email service not configured',
      provider: 'console_log',
    }
  }

  // Try Resend first (no IP restrictions, more reliable)
  if (resendKey) {
    console.log('[Email] Attempting to send via Resend...')
    const result = await sendViaResend(params)
    if (result.success) return result
    console.warn('[Email] Resend failed, trying Brevo as fallback...')
  }

  // Try Brevo as fallback
  if (brevoKey) {
    console.log('[Email] Attempting to send via Brevo...')
    const result = await sendViaBrevo(params)
    if (result.success) return result
    console.warn('[Email] Brevo also failed.')
  }

  // All providers failed - log OTP to console for debugging
  console.log(`[OTP-EMAIL-FALLBACK] To: ${params.to}, OTP: ${params.otp}, Purpose: ${params.purpose}`)
  return {
    success: false,
    message: 'All email providers failed. Please check your email service configuration.',
    provider: 'console_log',
  }
}

// ─── Verify Email Connection ───

export async function verifyBrevoConnection(): Promise<{ valid: boolean; info?: string }> {
  // Check Resend first
  const resendKey = RESEND_API_KEY()
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        return { valid: true, info: 'Resend: Connected successfully' }
      }
      return { valid: false, info: `Resend: API returned status ${response.status}` }
    } catch (error) {
      return { valid: false, info: `Resend: Connection error: ${(error as Error).message}` }
    }
  }

  // Check Brevo
  const brevoKey = BREVO_API_KEY()
  if (brevoKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'api-key': brevoKey,
          Accept: 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        return { valid: true, info: `Brevo: Connected: ${data.email}` }
      }

      // Check if it's an IP restriction error
      const data = await response.json()
      if (data.code === 'unauthorized' && data.message?.includes('unrecognised IP')) {
        return {
          valid: false,
          info: `Brevo: IP restriction active. Disable it at https://app.brevo.com/security/authorised_ips or switch to Resend (set RESEND_API_KEY).`,
        }
      }
      return { valid: false, info: `Brevo: API returned status ${response.status}` }
    } catch (error) {
      return { valid: false, info: `Brevo: Connection error: ${(error as Error).message}` }
    }
  }

  return { valid: false, info: 'No email service configured. Set RESEND_API_KEY or BREVO_API_KEY.' }
}
