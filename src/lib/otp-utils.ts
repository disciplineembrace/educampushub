/**
 * OTP Utility Module for EduCampusHub
 * 
 * Email OTP delivery via Brevo (Sendinblue) API.
 * Uses Neon serverless driver (HTTP) for database queries
 * to ensure reliable connectivity in serverless environments.
 * 
 * OTP Purposes: login, register, forgot_password, admin_forgot_password
 */

import { getNeonSql } from './db'
import { randomInt } from 'crypto'
import { sendOTPEmail } from './brevo-email'

// ─── Configuration ───

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const OTP_RATE_LIMIT_WINDOW = 60 * 1000      // 60 seconds between OTP requests
const OTP_MAX_REQUESTS_PER_HOUR = 5           // Max 5 OTP requests per identifier per hour
const OTP_MAX_VERIFY_ATTEMPTS = 3             // Max 3 wrong verification attempts per OTP

// ─── Rate Limiting State ───

const otpRequestLog = new Map<string, { count: number; lastRequest: number; hourlyCount: number; hourlyReset: number }>()
const otpVerifyAttempts = new Map<string, number>()

// ─── OTP Purpose Types ───

export type OTPPurpose = 'login' | 'register' | 'forgot_password' | 'admin_forgot_password'

// ─── OTP Generation ───

export function generateOTP(): string {
  let otp = ''
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += randomInt(0, 10).toString()
  }
  return otp
}

// ─── Rate Limiting ───

export function checkOTPRateLimit(identifier: string): { allowed: boolean; retryAfterMs?: number; reason?: string } {
  const now = Date.now()
  const record = otpRequestLog.get(identifier)

  if (!record) {
    otpRequestLog.set(identifier, { count: 1, lastRequest: now, hourlyCount: 1, hourlyReset: now + 60 * 60 * 1000 })
    return { allowed: true }
  }

  // 60-second cooldown between requests
  if (now - record.lastRequest < OTP_RATE_LIMIT_WINDOW) {
    const retryAfterMs = OTP_RATE_LIMIT_WINDOW - (now - record.lastRequest)
    return { allowed: false, retryAfterMs, reason: `Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before requesting a new OTP` }
  }

  // Reset hourly counter if expired
  if (now > record.hourlyReset) {
    record.hourlyCount = 0
    record.hourlyReset = now + 60 * 60 * 1000
  }

  // Max 5 requests per hour
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

interface StoreOTPParams {
  email: string
  phone?: string
  otpCode: string
  purpose: OTPPurpose
}

export async function storeOTP(params: StoreOTPParams): Promise<{ id: string }> {
  const sql = getNeonSql()
  const { email, phone, otpCode, purpose } = params

  // Delete any unused OTPs for this email + purpose combination
  await sql`
    DELETE FROM "PasswordResetOTP" 
    WHERE email = ${email} AND purpose = ${purpose} AND "isVerified" = false AND "usedAt" IS NULL
  `

  // Store new OTP
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
  const result = await sql`
    INSERT INTO "PasswordResetOTP" (id, email, phone, "otpCode", purpose, "isVerified", "expiresAt", "createdAt")
    VALUES (gen_random_uuid(), ${email}, ${phone || null}, ${otpCode}, ${purpose}, false, ${expiresAt.toISOString()}, CURRENT_TIMESTAMP)
    RETURNING id
  `

  return { id: result[0].id }
}

// ─── OTP Verification ───

export async function verifyOTP(
  email: string, 
  otpCode: string, 
  purpose: OTPPurpose
): Promise<{ valid: boolean; recordId?: string; reason?: string }> {
  const sql = getNeonSql()

  // Find the OTP record matching email + otpCode + purpose
  const records = await sql`
    SELECT id, "isVerified", "usedAt", "expiresAt" 
    FROM "PasswordResetOTP" 
    WHERE email = ${email} AND "otpCode" = ${otpCode} AND purpose = ${purpose} AND "isVerified" = false AND "usedAt" IS NULL
    ORDER BY "createdAt" DESC 
    LIMIT 1
  `

  if (!records || records.length === 0) {
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

// ─── SMS Result Interface ───

interface SMSResult {
  success: boolean
  message: string
  provider?: string
}

// ─── Email OTP Delivery (Brevo) ───

interface EmailOTPParams {
  email: string
  otp: string
  purpose: OTPPurpose
  userName?: string
}

export async function sendOTPEmailViaBrevo(params: EmailOTPParams): Promise<SMSResult> {
  const result = await sendOTPEmail({
    to: params.email,
    otp: params.otp,
    purpose: params.purpose,
    userName: params.userName,
    expiryMinutes: OTP_EXPIRY_MINUTES,
  })

  return {
    success: result.success,
    message: result.message,
    provider: result.provider || 'Brevo',
  }
}

// ─── Combined OTP Send (Email primary) ───

interface SendOTPParams {
  email: string
  phone?: string
  otp: string
  purpose: OTPPurpose
  userName?: string
}

export async function sendOTP(params: SendOTPParams): Promise<{ 
  emailSent: boolean; 
  smsSent: boolean; 
  message: string 
}> {
  // Send OTP via Brevo email (primary method)
  const emailResult = await sendOTPEmailViaBrevo({
    email: params.email,
    otp: params.otp,
    purpose: params.purpose,
    userName: params.userName,
  })

  const emailSent = emailResult.success
  const smsSent = false // SMS removed — Brevo email is the only provider now

  let message = ''
  if (emailSent) {
    message = 'OTP sent to your email'
  } else {
    message = 'OTP could not be delivered. Please try again.'
  }

  return { emailSent, smsSent, message }
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

// ─── Get User by Email ───

export async function getUserByEmail(email: string): Promise<{ id: string; name: string; email: string; phone: string | null; isAdmin: boolean; isBanned: boolean } | null> {
  try {
    const sql = getNeonSql()
    const result = await sql`
      SELECT id, name, email, phone, "isAdmin", "isBanned" FROM "User" WHERE email = ${email} LIMIT 1
    `
    if (!result || result.length === 0) return null
    return result[0] as { id: string; name: string; email: string; phone: string | null; isAdmin: boolean; isBanned: boolean }
  } catch {
    return null
  }
}

// ─── Check if Email Exists ───

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    const sql = getNeonSql()
    const result = await sql`SELECT id FROM "User" WHERE email = ${email} LIMIT 1`
    return result && result.length > 0
  } catch {
    return false
  }
}

// ─── Mask Email for Display ───

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`
}

// ─── Mask Phone for Display ───

export function maskPhone(phone: string): string {
  if (phone.length < 4) return phone
  return phone.slice(0, 2) + '****' + phone.slice(-2)
}

// ─── Backward-compat: sendOTPSMS (now just logs — SMS removed) ───

export async function sendOTPSMS(phone: string, otp: string): Promise<SMSResult> {
  // SMS delivery removed. Log only.
  console.log(`[OTP-SMS-REMOVED] Phone: ${phone}, OTP: ${otp} — SMS not sent (Fast2SMS removed). Use email OTP instead.`)
  return {
    success: false,
    message: 'SMS service is no longer available. OTP sent via email.',
    provider: 'none',
  }
}

// ─── Get User by Phone (kept for backward compat) ───

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
