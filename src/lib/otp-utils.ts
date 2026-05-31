/**
 * OTP Utility Module for EduCampusHub
 * 
 * Uses Neon serverless driver (HTTP) for database queries
 * to ensure reliable connectivity in serverless environments.
 */

import { getNeonSql } from './db'
import { randomInt } from 'crypto'

// ─── Configuration ───

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const OTP_RATE_LIMIT_WINDOW = 60 * 1000
const OTP_MAX_REQUESTS_PER_HOUR = 5
const OTP_MAX_VERIFY_ATTEMPTS = 3

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

// ─── SMS Delivery ───

interface SMSResult {
  success: boolean
  message: string
  provider?: string
}

export async function sendOTPSMS(phone: string, otp: string): Promise<SMSResult> {
  const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY

  if (FAST2SMS_API_KEY) {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otp,
          numbers: phone,
          flash: 0,
        }),
      })

      const data = await response.json()
      if (data.return === true) {
        return { success: true, message: 'OTP sent successfully', provider: 'Fast2SMS' }
      }
    } catch (error) {
      console.error('Fast2SMS request error:', error)
    }
  }

  // Fallback: Log OTP to server console
  console.log(`[OTP] Phone: ${phone}, OTP: ${otp}, Expires: ${OTP_EXPIRY_MINUTES}min`)

  return {
    success: true,
    message: 'OTP sent to your registered mobile number',
    provider: 'console_log',
  }
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
