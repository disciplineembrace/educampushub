/**
 * Brevo (Sendinblue) Email Utility for EduCampusHub
 * 
 * Sends OTP verification emails via Brevo SMTP API.
 * API Key stored as BREVO_API_KEY environment variable.
 * 
 * Brevo API docs: https://developers.brevo.com/reference/sendtransacemail
 */

// ─── Configuration ───

const BREVO_API_KEY = () => process.env.BREVO_API_KEY || ''
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const SENDER_EMAIL = 'noreply@educampushub.in'
const SENDER_NAME = 'EduCampusHub'

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
                      <strong>⏱ Expires in ${expiryMinutes} minutes.</strong> This code is valid for a limited time only. Do not share it with anyone.
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
                © 2025 EduCampusHub. All rights reserved.
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

// ─── Send OTP Email ───

export async function sendOTPEmail(params: OTPEmailParams): Promise<EmailResult> {
  const apiKey = BREVO_API_KEY()

  if (!apiKey) {
    console.error('[Brevo] BREVO_API_KEY is not set. Email OTP will not be sent.')
    console.log(`[OTP-EMAIL] To: ${params.to}, OTP: ${params.otp}, Purpose: ${params.purpose}`)
    return {
      success: false,
      message: 'Email service not configured',
      provider: 'console_log',
    }
  }

  try {
    const htmlContent = getOTPEmailHTML(params)
    const textContent = getOTPEmailText(params)

    const payload = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
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

    // Fallback to console log
    console.log(`[OTP-EMAIL-FALLBACK] To: ${params.to}, OTP: ${params.otp}, Purpose: ${params.purpose}`)

    return {
      success: false,
      message: data.message || 'Failed to send email via Brevo',
      provider: 'console_log',
    }
  } catch (error) {
    console.error('[Brevo] Request error:', error)
    console.log(`[OTP-EMAIL-FALLBACK] To: ${params.to}, OTP: ${params.otp}, Purpose: ${params.purpose}`)
    return {
      success: false,
      message: 'Email service temporarily unavailable',
      provider: 'console_log',
    }
  }
}

// ─── Verify Brevo API Key ───

export async function verifyBrevoConnection(): Promise<{ valid: boolean; info?: string }> {
  const apiKey = BREVO_API_KEY()
  if (!apiKey) {
    return { valid: false, info: 'BREVO_API_KEY is not set' }
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        Accept: 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return { valid: true, info: `Connected: ${data.email}` }
    }
    return { valid: false, info: `API returned status ${response.status}` }
  } catch (error) {
    return { valid: false, info: `Connection error: ${(error as Error).message}` }
  }
}
