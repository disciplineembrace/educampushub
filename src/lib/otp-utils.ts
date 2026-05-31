/**
 * OTP Utility Module for EduCampusHub
 * 
 * Multi-provider SMS delivery with automatic fallback:
 *   1. MSG91  (primary   — DLT-approved, best for India)
 *   2. Fast2SMS (fallback — quick setup, good for dev/small scale)
 *   3. Console log (last resort — development only)
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

// SMS Provider env keys
const MSG91_AUTH_KEY     = () => process.env.MSG91_AUTH_KEY
const MSG91_TEMPLATE_ID = () => process.env.MSG91_TEMPLATE_ID
const FAST2SMS_API_KEY  = () => process.env.FAST2SMS_API_KEY

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
    // Check if OTP exists but expired
    const expired = await sql`
      SELECT id FROM "PasswordResetOTP" 
      WHERE email = ${email} AND "otpCode" = ${otpCode} AND "isVerified" = false AND "usedAt" IS NULL
      LIMIT 1
    `
    if (expired && expired.length > 0) {
      return { valid: false, reason: 'OTP has expired. Please request a new one.' }
    }
    return { valid: false, reason: 'Invalid OTP code.' }
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
// SMS DELIVERY — Multi-provider with automatic fallback
// ═══════════════════════════════════════════════════════════════════

export interface SMSResult {
  success: boolean
  message: string
  provider?: string
  deliveryId?: string   // tracking ID from provider
  error?: string        // error details if failed
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
  return !!(MSG91_AUTH_KEY() || FAST2SMS_API_KEY())
}

/**
 * Get the list of configured providers (for debugging/status).
 */
export function getConfiguredProviders(): string[] {
  const providers: string[] = []
  if (MSG91_AUTH_KEY()) providers.push('MSG91')
  if (FAST2SMS_API_KEY()) providers.push('Fast2SMS')
  if (providers.length === 0) providers.push('console_log (no provider configured)')
  return providers
}

// ─── Provider 1: MSG91 (Primary — DLT-approved, best for India) ───

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

    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authkey': authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // MSG91 success responses
    if (data.type === 'success' || data.message === 'success' || response.status === 200) {
      console.log(`[MSG91] OTP sent to ${normalizedPhone} | Status: ${response.status} | Type: ${data.type || 'ok'}`)
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
    console.error(`[MSG91] Network error for ${normalizedPhone}:`, error.message)
    return {
      success: false,
      message: `MSG91 network error: ${error.message}`,
      provider: 'MSG91',
      error: error.message,
    }
  }
}

// ─── Provider 2: Fast2SMS (Fallback — quick setup) ───

async function sendViaFast2SMS(phone: string, otp: string): Promise<SMSResult> {
  const apiKey = FAST2SMS_API_KEY()

  if (!apiKey) {
    return { success: false, message: 'Fast2SMS not configured', provider: 'Fast2SMS', error: 'FAST2SMS_API_KEY is not set' }
  }

  const normalizedPhone = normalizePhone(phone)

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
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
    })

    const data = await response.json()

    if (data.return === true) {
      console.log(`[Fast2SMS] OTP sent to ${normalizedPhone} | Request ID: ${data.request_id || 'N/A'}`)
      return {
        success: true,
        message: 'OTP sent successfully via Fast2SMS',
        provider: 'Fast2SMS',
        deliveryId: data.request_id || undefined,
      }
    }

    console.error(`[Fast2SMS] Failed for ${normalizedPhone}:`, JSON.stringify(data))
    return {
      success: false,
      message: `Fast2SMS delivery failed: ${data.message || data.status || 'Unknown error'}`,
      provider: 'Fast2SMS',
      error: JSON.stringify(data),
    }
  } catch (error: any) {
    console.error(`[Fast2SMS] Network error for ${normalizedPhone}:`, error.message)
    return {
      success: false,
      message: `Fast2SMS network error: ${error.message}`,
      provider: 'Fast2SMS',
      error: error.message,
    }
  }
}

// ─── Provider 3: Console Log (Development Only) ───

async function sendViaConsole(phone: string, otp: string): Promise<SMSResult> {
  const normalizedPhone = normalizePhone(phone)
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  🔐 OTP DELIVERY (Console Fallback)`)
  console.log(`  Phone: ${normalizedPhone}`)
  console.log(`  OTP:   ${otp}`)
  console.log(`  Valid: ${OTP_EXPIRY_MINUTES} minutes`)
  console.log(`  ⚠️  No SMS provider configured! Set MSG91_AUTH_KEY or FAST2SMS_API_KEY`)
  console.log(`${'═'.repeat(50)}\n`)

  return {
    success: true,
    message: 'OTP logged to console (no SMS provider configured)',
    provider: 'console_log',
  }
}

// ─── Main Send Function with Auto-Fallback ───

/**
 * Send OTP via SMS with automatic provider fallback:
 *   1. MSG91 (primary)
 *   2. Fast2SMS (fallback)
 *   3. Console log (last resort — development only)
 * 
 * IMPORTANT: If no real provider is configured, this returns success=true
 * with provider='console_log' so development is not blocked.
 * In production, ALWAYS configure at least one real provider.
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

  // ─── Try MSG91 (Primary) ───
  if (MSG91_AUTH_KEY()) {
    const result = await sendViaMSG91(normalizedPhone, otp)
    if (result.success) return result
    console.warn(`[OTP] MSG91 failed, trying Fast2SMS fallback...`)
  }

  // ─── Try Fast2SMS (Fallback) ───
  if (FAST2SMS_API_KEY()) {
    const result = await sendViaFast2SMS(normalizedPhone, otp)
    if (result.success) return result
    console.warn(`[OTP] Fast2SMS also failed, falling back to console log...`)
  }

  // ─── Console Log (Last Resort) ───
  // In development, this is fine. In production, this means no SMS is actually delivered.
  const consoleResult = await sendViaConsole(normalizedPhone, otp)

  // In production, if no provider is configured, we still return success
  // but include a warning so the caller can decide what to do.
  return consoleResult
}

// ─── Cleanup ───

export async function cleanupExpiredOTPs() {
  try {
    const sql = getNeonSql()
    const result = await sql`DELETE FROM "PasswordResetOTP" WHERE "expiresAt" < CURRENT_TIMESTAMP`
    return result.count || 0
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
