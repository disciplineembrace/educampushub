/**
 * OTP Utility Module for EduCampusHub
 *
 * Production-ready Fast2SMS integration for OTP delivery.
 * Uses the official Fast2SMS bulkV2 API with route fallback:
 *   1. OTP route (route: 'otp') — built-in OTP template, best delivery rate
 *   2. Quick route (route: 'q')  — works without DLT, good for new accounts
 *   3. Transactional route (route: 't') — needs ₹100+ wallet balance
 *
 * Uses Neon serverless driver (HTTP) for database queries
 * to ensure reliable connectivity in serverless environments.
 */

import { getNeonSql } from './db'
import { randomInt } from 'crypto'

// ─── Configuration ───

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const OTP_RATE_LIMIT_WINDOW = 60 * 1000        // 1 minute between OTPs
const OTP_MAX_REQUESTS_PER_HOUR = 5
const OTP_MAX_VERIFY_ATTEMPTS = 3
const SMS_TIMEOUT_MS = 15_000                    // 15 second timeout per SMS attempt

// SMS Provider env keys
const FAST2SMS_API_KEY  = () => process.env.FAST2SMS_API_KEY
const FAST2SMS_DLT_TEMPLATE_ID = () => process.env.FAST2SMS_DLT_TEMPLATE_ID
const FAST2SMS_SENDER_ID = () => process.env.FAST2SMS_SENDER_ID || 'FSTSMS'
const MSG91_AUTH_KEY     = () => process.env.MSG91_AUTH_KEY
const MSG91_TEMPLATE_ID = () => process.env.MSG91_TEMPLATE_ID

// ─── Rate Limiting State ───

const otpRequestLog = new Map<string, { count: number; lastRequest: number; hourlyCount: number; hourlyReset: number }>()
const otpVerifyAttempts = new Map<string, number>()

// ─── OTP Generation ───

export function generateOTP(): string {
  let otp = ''
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += randomInt(0, 10).toString()
  }
  return otp
}

// ─── Rate Limiting ───

export function checkOTPRateLimit(phone: string): { allowed: boolean; retryAfterMs?: number; reason?: string } {
  const now = Date.now()
  const record = otpRequestLog.get(phone)

  if (!record) {
    otpRequestLog.set(phone, { count: 1, lastRequest: now, hourlyCount: 1, hourlyReset: now + 60 * 60 * 1000 })
    return { allowed: true }
  }

  if (now - record.lastRequest < OTP_RATE_LIMIT_WINDOW) {
    const retryAfterMs = OTP_RATE_LIMIT_WINDOW - (now - record.lastRequest)
    return { allowed: false, retryAfterMs, reason: `Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before requesting a new OTP` }
  }

  if (now > record.hourlyReset) {
    record.hourlyCount = 0
    record.hourlyReset = now + 60 * 60 * 1000
  }

  if (record.hourlyCount >= OTP_MAX_REQUESTS_PER_HOUR) {
    const retryAfterMs = record.hourlyReset - now
    return { allowed: false, retryAfterMs, reason: `Too many OTP requests. Try again in ${Math.ceil(retryAfterMs / 60000)} minutes` }
  }

  record.count++
  record.lastRequest = now
  record.hourlyCount++

  return { allowed: true }
}

export function checkOTPVerifyAttempts(otpId: string): boolean {
  const attempts = otpVerifyAttempts.get(otpId) || 0
  return attempts < OTP_MAX_VERIFY_ATTEMPTS
}

export function incrementVerifyAttempt(otpId: string) {
  const attempts = otpVerifyAttempts.get(otpId) || 0
  otpVerifyAttempts.set(otpId, attempts + 1)
}

export function clearVerifyAttempts(otpId: string) {
  otpVerifyAttempts.delete(otpId)
}

// ─── OTP Storage (via Neon HTTP) ───

export async function storeOTP(email: string, phone: string, otpCode: string) {
  const sql = getNeonSql()

  // Delete any unused OTPs for this email
  await sql`
    DELETE FROM "PasswordResetOTP"
    WHERE email = ${email} AND "isVerified" = false AND "usedAt" IS NULL
  `

  // Store new OTP
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
  const result = await sql`
    INSERT INTO "PasswordResetOTP" (id, email, phone, "otpCode", "isVerified", "expiresAt", "createdAt")
    VALUES (gen_random_uuid(), ${email}, ${phone}, ${otpCode}, false, ${expiresAt.toISOString()}, CURRENT_TIMESTAMP)
    RETURNING id
  `

  return result[0]
}

export async function verifyOTP(email: string, otpCode: string): Promise<{ valid: boolean; recordId?: string; reason?: string }> {
  const sql = getNeonSql()

  // Find the OTP record
  const records = await sql`
    SELECT id, "isVerified", "usedAt", "expiresAt"
    FROM "PasswordResetOTP"
    WHERE email = ${email} AND "otpCode" = ${otpCode} AND "isVerified" = false AND "usedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  `

  if (!records || records.length === 0) {
    // Check if OTP exists but was already used or verified
    const usedRecord = await sql`
      SELECT id FROM "PasswordResetOTP"
      WHERE email = ${email} AND "otpCode" = ${otpCode} AND ("isVerified" = true OR "usedAt" IS NOT NULL)
      LIMIT 1
    `
    if (usedRecord && usedRecord.length > 0) {
      return { valid: false, reason: 'OTP already used. Please request a new one.' }
    }
    return { valid: false, reason: 'Invalid OTP code. Please check and try again.' }
  }

  const record = records[0]

  // Check if expired
  if (new Date(record.expiresAt) < new Date()) {
    return { valid: false, reason: 'OTP has expired. Please request a new one.' }
  }

  // Check verify attempt limit
  if (!checkOTPVerifyAttempts(record.id)) {
    return { valid: false, reason: 'Too many failed attempts. Please request a new OTP.' }
  }

  // Mark as verified
  await sql`
    UPDATE "PasswordResetOTP"
    SET "isVerified" = true, "usedAt" = CURRENT_TIMESTAMP
    WHERE id = ${record.id}
  `

  clearVerifyAttempts(record.id)

  return { valid: true, recordId: record.id }
}

// ═══════════════════════════════════════════════════════════════════
// SMS DELIVERY — Fast2SMS with route fallback + MSG91 fallback
// ═══════════════════════════════════════════════════════════════════

export interface SMSResult {
  success: boolean
  message: string
  provider?: string
  deliveryId?: string   // tracking ID from provider
  error?: string        // error details if failed
  isConsoleFallback?: boolean  // true if no real SMS was sent
  needsAccountSetup?: boolean  // true if SMS provider account needs setup (balance/verification)
  setupInstructions?: string   // human-readable instructions for account setup
}

/**
 * Normalize Indian phone number to 10 digits.
 * Accepts: 9876543210, +919876543210, 919876543210
 * Returns: 9876543210
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 10) return digits
  return digits // return as-is, let provider validate
}

/**
 * Check if any SMS provider is configured.
 * Used by API routes to give proper error messages.
 */
export function isSmsProviderConfigured(): boolean {
  return !!(FAST2SMS_API_KEY() || MSG91_AUTH_KEY())
}

/**
 * Get the list of configured providers (for debugging/status).
 */
export function getConfiguredProviders(): string[] {
  const providers: string[] = []
  if (FAST2SMS_API_KEY()) providers.push('Fast2SMS')
  if (MSG91_AUTH_KEY()) providers.push('MSG91')
  if (providers.length === 0) providers.push('console_log (no provider configured)')
  return providers
}

// ─── Fetch with timeout helper ───

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

// ─── Fast2SMS Error Classification ───

function classifyFast2SMSError(statusCode: number, rawMessage: string): {
  userMessage: string
  needsAccountSetup: boolean
  setupInstructions: string
} {
  switch (statusCode) {
    case 996:
      return {
        userMessage: 'SMS OTP route needs website verification on Fast2SMS.',
        needsAccountSetup: true,
        setupInstructions: 'Go to fast2sms.com → OTP Message menu → Verify your website. This enables the OTP route for sending verification codes.',
      }
    case 999:
      return {
        userMessage: 'Fast2SMS requires a minimum ₹100 transaction before using API routes.',
        needsAccountSetup: true,
        setupInstructions: 'Add at least ₹100 balance to your Fast2SMS wallet and complete one transaction. After that, all API routes (Quick, Transactional, OTP) will work.',
      }
    case 412:
      return {
        userMessage: 'Fast2SMS API authentication failed.',
        needsAccountSetup: true,
        setupInstructions: 'Check your Fast2SMS API key. Go to fast2sms.com → API Documentation → Copy the correct authorization key.',
      }
    case 406:
      return {
        userMessage: 'Invalid sender ID configured for Fast2SMS.',
        needsAccountSetup: true,
        setupInstructions: 'Use the default sender ID or register a custom one on Fast2SMS.',
      }
    case 301:
      return {
        userMessage: 'Insufficient balance in Fast2SMS wallet.',
        needsAccountSetup: true,
        setupInstructions: 'Add balance to your Fast2SMS wallet at fast2sms.com → Wallet.',
      }
    default:
      return {
        userMessage: rawMessage || 'Unknown Fast2SMS error',
        needsAccountSetup: false,
        setupInstructions: '',
      }
  }
}

// ─── Provider 1: Fast2SMS (Primary) ───

async function sendViaFast2SMS(phone: string, otp: string): Promise<SMSResult> {
  const apiKey = FAST2SMS_API_KEY()

  if (!apiKey) {
    return { success: false, message: 'Fast2SMS not configured', provider: 'Fast2SMS', error: 'FAST2SMS_API_KEY is not set' }
  }

  const normalizedPhone = normalizePhone(phone)
  const maskedPhone = `${normalizedPhone.slice(0, 2)}****${normalizedPhone.slice(-2)}`
  const otpMessage = `${otp} is your EduCampusHub verification code. Do not share with anyone. Valid for ${OTP_EXPIRY_MINUTES} minutes.`

  // Collect errors from each route attempt for diagnostic purposes
  const routeErrors: { route: string; statusCode: number; message: string }[] = []

  try {
    // ─── Attempt 1: OTP Route (BEST for OTP delivery — uses built-in template) ───
    // The OTP route uses Fast2SMS's pre-approved OTP template which has the highest
    // delivery rate and doesn't require custom DLT templates.
    console.log(`[Fast2SMS] Attempt 1: OTP route for ${maskedPhone}`)

    try {
      const otpResponse = await fetchWithTimeout('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: normalizedPhone,
          flash: 0,
        }),
      }, SMS_TIMEOUT_MS)

      const otpData = await otpResponse.json()

      if (otpData.return === true) {
        console.log(`[Fast2SMS] OTP route SUCCESS for ${maskedPhone} | Request ID: ${otpData.request_id || 'N/A'}`)
        return {
          success: true,
          message: 'OTP sent successfully via Fast2SMS',
          provider: 'Fast2SMS',
          deliveryId: otpData.request_id || undefined,
        }
      }

      routeErrors.push({ route: 'otp', statusCode: otpData.status_code, message: otpData.message })
      console.warn(`[Fast2SMS] OTP route failed (${otpData.status_code}): ${otpData.message}`)
    } catch (e: any) {
      const errMsg = e.name === 'AbortError' ? 'Request timed out' : e.message
      routeErrors.push({ route: 'otp', statusCode: 0, message: errMsg })
      console.warn(`[Fast2SMS] OTP route error: ${errMsg}`)
    }

    // ─── Attempt 2: Quick Route (works without DLT/website verification) ───
    // The Quick route is designed for users without DLT registration.
    // It works for promotional, transactional, and OTP messages.
    console.log(`[Fast2SMS] Attempt 2: Quick route for ${maskedPhone}`)

    try {
      const qResponse = await fetchWithTimeout('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: otpMessage,
          language: 'english',
          flash: 0,
          numbers: normalizedPhone,
        }),
      }, SMS_TIMEOUT_MS)

      const qData = await qResponse.json()

      if (qData.return === true) {
        console.log(`[Fast2SMS] Quick route SUCCESS for ${maskedPhone} | Request ID: ${qData.request_id || 'N/A'}`)
        return {
          success: true,
          message: 'OTP sent successfully via Fast2SMS (Quick route)',
          provider: 'Fast2SMS',
          deliveryId: qData.request_id || undefined,
        }
      }

      routeErrors.push({ route: 'quick', statusCode: qData.status_code, message: qData.message })
      console.warn(`[Fast2SMS] Quick route failed (${qData.status_code}): ${qData.message}`)
    } catch (e: any) {
      const errMsg = e.name === 'AbortError' ? 'Request timed out' : e.message
      routeErrors.push({ route: 'quick', statusCode: 0, message: errMsg })
      console.warn(`[Fast2SMS] Quick route error: ${errMsg}`)
    }

    // ─── Attempt 3: Transactional Route (needs ₹100+ balance) ───
    console.log(`[Fast2SMS] Attempt 3: Transactional route for ${maskedPhone}`)

    try {
      const tResponse = await fetchWithTimeout('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 't',
          message: `${otpMessage} -EduCampusHub`,
          language: 'english',
          flash: 0,
          numbers: normalizedPhone,
        }),
      }, SMS_TIMEOUT_MS)

      const tData = await tResponse.json()

      if (tData.return === true) {
        console.log(`[Fast2SMS] Transactional route SUCCESS for ${maskedPhone} | Request ID: ${tData.request_id || 'N/A'}`)
        return {
          success: true,
          message: 'OTP sent successfully via Fast2SMS (Transactional)',
          provider: 'Fast2SMS',
          deliveryId: tData.request_id || undefined,
        }
      }

      routeErrors.push({ route: 'transactional', statusCode: tData.status_code, message: tData.message })
      console.warn(`[Fast2SMS] Transactional route failed (${tData.status_code}): ${tData.message}`)
    } catch (e: any) {
      const errMsg = e.name === 'AbortError' ? 'Request timed out' : e.message
      routeErrors.push({ route: 'transactional', statusCode: 0, message: errMsg })
      console.warn(`[Fast2SMS] Transactional route error: ${errMsg}`)
    }

    // ─── Attempt 4: DLT Route (if template configured) ───
    const dltTemplateId = FAST2SMS_DLT_TEMPLATE_ID()
    if (dltTemplateId) {
      console.log(`[Fast2SMS] Attempt 4: DLT route with template ${dltTemplateId}`)

      try {
        const dltResponse = await fetchWithTimeout('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'dlt',
            sender_id: FAST2SMS_SENDER_ID(),
            message: otpMessage,
            template_id: dltTemplateId,
            numbers: normalizedPhone,
            flash: 0,
          }),
        }, SMS_TIMEOUT_MS)

        const dltData = await dltResponse.json()

        if (dltData.return === true) {
          console.log(`[Fast2SMS] DLT route SUCCESS for ${maskedPhone} | Request ID: ${dltData.request_id || 'N/A'}`)
          return {
            success: true,
            message: 'OTP sent successfully via Fast2SMS (DLT)',
            provider: 'Fast2SMS',
            deliveryId: dltData.request_id || undefined,
          }
        }

        routeErrors.push({ route: 'dlt', statusCode: dltData.status_code, message: dltData.message })
        console.warn(`[Fast2SMS] DLT route failed (${dltData.status_code}): ${dltData.message}`)
      } catch (e: any) {
        const errMsg = e.name === 'AbortError' ? 'Request timed out' : e.message
        routeErrors.push({ route: 'dlt', statusCode: 0, message: errMsg })
        console.warn(`[Fast2SMS] DLT route error: ${errMsg}`)
      }
    }

    // ─── All routes failed — determine the root cause ───
    console.error(`[Fast2SMS] All routes failed for ${maskedPhone}. Errors:`, JSON.stringify(routeErrors))

    // Find the most significant error for user feedback
    const needs999 = routeErrors.find(e => e.statusCode === 999)
    const needs996 = routeErrors.find(e => e.statusCode === 996)
    const needs412 = routeErrors.find(e => e.statusCode === 412)

    // Priority: 999 (needs ₹100 transaction) > 996 (needs website verification) > 412 (auth) > other
    const primaryError = needs999 || needs996 || needs412 || routeErrors[0]
    const classification = classifyFast2SMSError(primaryError.statusCode, primaryError.message)

    return {
      success: false,
      message: classification.userMessage,
      provider: 'Fast2SMS',
      error: JSON.stringify(routeErrors),
      needsAccountSetup: classification.needsAccountSetup,
      setupInstructions: classification.setupInstructions,
    }
  } catch (error: any) {
    console.error(`[Fast2SMS] Network error for ${maskedPhone}:`, error.message)
    return {
      success: false,
      message: `Fast2SMS network error: ${error.message}`,
      provider: 'Fast2SMS',
      error: error.message,
    }
  }
}

// ─── Provider 2: MSG91 (Fallback — DLT-approved, best for India production) ───

async function sendViaMSG91(phone: string, otp: string): Promise<SMSResult> {
  const authKey = MSG91_AUTH_KEY()
  const templateId = MSG91_TEMPLATE_ID()

  if (!authKey) {
    return { success: false, message: 'MSG91 not configured', provider: 'MSG91', error: 'MSG91_AUTH_KEY is not set' }
  }

  const normalizedPhone = normalizePhone(phone)

  try {
    // MSG91 OTP API — sends OTP via template
    const body: Record<string, string> = {
      mobiles: normalizedPhone,
      otp,
    }

    // If template ID is provided, use the send API with template
    if (templateId) {
      body.template_id = templateId
    }

    const response = await fetchWithTimeout('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authkey': authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }, SMS_TIMEOUT_MS)

    const data = await response.json()

    // MSG91 success responses
    if (data.type === 'success' || data.message === 'success' || response.status === 200) {
      console.log(`[MSG91] OTP sent to ${normalizedPhone.slice(0, 2)}****${normalizedPhone.slice(-2)} | Status: ${response.status} | Type: ${data.type || 'ok'}`)
      return {
        success: true,
        message: 'OTP sent successfully via MSG91',
        provider: 'MSG91',
        deliveryId: data.request_id || data.otp_id || undefined,
      }
    }

    console.error(`[MSG91] Failed for ${normalizedPhone}:`, JSON.stringify(data))
    return {
      success: false,
      message: `MSG91 delivery failed: ${data.message || data.type || 'Unknown error'}`,
      provider: 'MSG91',
      error: JSON.stringify(data),
    }
  } catch (error: any) {
    const errMsg = error.name === 'AbortError' ? 'Request timed out' : error.message
    console.error(`[MSG91] Network error for ${normalizedPhone}:`, errMsg)
    return {
      success: false,
      message: `MSG91 network error: ${errMsg}`,
      provider: 'MSG91',
      error: errMsg,
    }
  }
}

// ─── Provider 3: Console Log (Development Only) ───

async function sendViaConsole(phone: string, otp: string): Promise<SMSResult> {
  const normalizedPhone = normalizePhone(phone)
  const isProduction = process.env.NODE_ENV === 'production'

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  OTP DELIVERY (Console Fallback)`)
  console.log(`  Phone: ${normalizedPhone}`)
  console.log(`  OTP:   ${otp}`)
  console.log(`  Valid: ${OTP_EXPIRY_MINUTES} minutes`)
  console.log(`  WARNING: No SMS provider configured! Set FAST2SMS_API_KEY or MSG91_AUTH_KEY`)
  console.log(`${'='.repeat(50)}\n`)

  // CRITICAL: In production, console fallback means OTP was NOT actually delivered.
  // Return success=false so the UI shows a proper error instead of misleading the user.
  if (isProduction) {
    return {
      success: false,
      message: 'SMS service is not configured. Please contact support.',
      provider: 'console_log',
      isConsoleFallback: true,
      error: 'No SMS provider is configured in production. OTP was NOT delivered to the phone.',
    }
  }

  // In development, return success so testing can proceed
  return {
    success: true,
    message: `OTP logged to console (dev mode): ${otp}`,
    provider: 'console_log',
    isConsoleFallback: true,
  }
}

// ─── Main Send Function with Auto-Fallback ───

/**
 * Send OTP via SMS with automatic provider fallback:
 *   1. Fast2SMS (primary — configured with API key)
 *   2. MSG91 (fallback — if configured)
 *   3. Console log (development only — returns failure in production)
 *
 * IMPORTANT: In production, if no real provider is configured, this returns
 * success=false with a clear error message. The API routes should handle this
 * and show a proper error to the user.
 */
export async function sendOTPSMS(phone: string, otp: string): Promise<SMSResult> {
  const normalizedPhone = normalizePhone(phone)

  // Validate Indian phone number
  if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
    return {
      success: false,
      message: 'Invalid Indian mobile number. Must be 10 digits starting with 6-9.',
      error: `Phone "${phone}" normalized to "${normalizedPhone}" is not valid`,
    }
  }

  console.log(`[OTP] Sending OTP to ${normalizedPhone.slice(0, 2)}****${normalizedPhone.slice(-2)}`)
  console.log(`[OTP] Configured providers: ${getConfiguredProviders().join(', ')}`)

  // ─── Try Fast2SMS (Primary) ───
  if (FAST2SMS_API_KEY()) {
    const result = await sendViaFast2SMS(normalizedPhone, otp)
    if (result.success) return result
    console.warn(`[OTP] Fast2SMS failed: ${result.message}. Error: ${result.error}`)
    // If Fast2SMS needs account setup, return immediately with setup instructions
    // (no point trying MSG91 if Fast2SMS is misconfigured)
    if (result.needsAccountSetup) {
      return result
    }
  } else {
    console.warn('[OTP] FAST2SMS_API_KEY is not set in environment variables!')
  }

  // ─── Try MSG91 (Fallback) ───
  if (MSG91_AUTH_KEY()) {
    const result = await sendViaMSG91(normalizedPhone, otp)
    if (result.success) return result
    console.warn(`[OTP] MSG91 also failed: ${result.message}. Error: ${result.error}`)
  }

  // ─── Console Log (Last Resort) ───
  // In development, this allows testing. In production, this returns failure.
  const consoleResult = await sendViaConsole(normalizedPhone, otp)
  return consoleResult
}

// ─── Cleanup ───

export async function cleanupExpiredOTPs() {
  try {
    const sql = getNeonSql()
    const result = await sql`DELETE FROM "PasswordResetOTP" WHERE "expiresAt" < CURRENT_TIMESTAMP`
    return (result as any).count || 0
  } catch {
    return 0
  }
}

// ─── Get Admin Phone by Email ───

export async function getAdminPhone(email: string): Promise<string | null> {
  try {
    const sql = getNeonSql()
    const result = await sql`
      SELECT phone, "isAdmin" FROM "User" WHERE email = ${email} LIMIT 1
    `
    if (!result || result.length === 0) return null
    if (!result[0].isAdmin || !result[0].phone) return null
    return result[0].phone
  } catch {
    return null
  }
}

// ─── Get User by Phone Number ───

export async function getUserByPhone(phone: string): Promise<{ id: string; email: string; name: string; phone: string; isBanned: boolean; passwordHash: string | null } | null> {
  try {
    const sql = getNeonSql()
    const result = await sql`
      SELECT id, email, name, phone, "isBanned", "passwordHash" FROM "User" WHERE phone = ${phone} LIMIT 1
    `
    if (!result || result.length === 0) return null
    return result[0] as { id: string; email: string; name: string; phone: string; isBanned: boolean; passwordHash: string | null }
  } catch {
    return null
  }
}
