/**
 * Security Question Utility
 *
 * Used by:
 *   - /api/auth           (registration: capture Q + hashed answer)
 *   - /api/auth/forgot-password  (verify answer before allowing password reset)
 *   - /api/auth/security-question (manage Q&A from profile page)
 *
 * Security principles:
 *   - Answers are NEVER stored as plain text. We normalize them
 *     (trim, collapse whitespace, lowercase) and then bcrypt-hash them
 *     with 12 rounds. bcrypt is intentionally slow, which throttles
 *     brute-force attacks even if the DB leaks.
 *   - Brute-force protection: in-memory attempt tracker (best-effort
 *     for serverless) + DB-backed `securityAttempts` + `securityLockedUntil`.
 *     After MAX_ATTEMPTS failed verifications, the account is locked
 *     for LOCKOUT_MS minutes before more attempts are allowed.
 *   - Verification responses NEVER reveal which part of the request
 *     was wrong — the API always returns the same generic error string
 *     "Invalid security answer." for any wrong/missing/locked case.
 */

import bcrypt from 'bcryptjs'

// ─── The 7 security questions offered to users ───
export const SECURITY_QUESTIONS: string[] = [
  'What is your favorite book?',
  'What was your childhood nickname?',
  'What was the name of your first teacher?',
  'What is your favorite movie?',
  'What is your favorite place?',
  'What was the name of your childhood best friend?',
  'What is your favorite color?',
]

// ─── Brute-force protection constants ───
export const MAX_SECURITY_ATTEMPTS = 5          // max wrong attempts before lockout
export const SECURITY_LOCKOUT_MS = 15 * 60 * 1000  // 15 minutes lockout
export const SECURITY_ANSWER_MIN = 2
export const SECURITY_ANSWER_MAX = 100

// ─── Answer normalization ───
/**
 * Normalize a security answer before hashing or comparing.
 *
 *  - Trim leading/trailing whitespace
 *  - Collapse internal whitespace runs to a single space
 *  - Lowercase (so "Harry Potter" and "harry potter" match)
 *
 * We deliberately do NOT strip punctuation or diacritics — those
 * changes might surprise legitimate users who later type the answer
 * slightly differently.
 */
export function normalizeSecurityAnswer(answer: string): string {
  return answer
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, SECURITY_ANSWER_MAX)
}

// ─── Validation ───
export function isValidSecurityQuestionIndex(idx: unknown): idx is number {
  return (
    typeof idx === 'number' &&
    Number.isInteger(idx) &&
    idx >= 0 &&
    idx < SECURITY_QUESTIONS.length
  )
}

export function validateSecurityAnswer(answer: string): { valid: boolean; error?: string } {
  if (!answer || typeof answer !== 'string') {
    return { valid: false, error: 'Security answer is required' }
  }
  const normalized = normalizeSecurityAnswer(answer)
  if (normalized.length < SECURITY_ANSWER_MIN) {
    return { valid: false, error: `Answer must be at least ${SECURITY_ANSWER_MIN} characters` }
  }
  if (normalized.length > SECURITY_ANSWER_MAX) {
    return { valid: false, error: `Answer must be at most ${SECURITY_ANSWER_MAX} characters` }
  }
  return { valid: true }
}

// ─── Hashing ───
const BCRYPT_ROUNDS = 12

export async function hashSecurityAnswer(answer: string): Promise<string> {
  const normalized = normalizeSecurityAnswer(answer)
  return bcrypt.hash(normalized, BCRYPT_ROUNDS)
}

export async function verifySecurityAnswer(answer: string, hash: string): Promise<boolean> {
  try {
    const normalized = normalizeSecurityAnswer(answer)
    return await bcrypt.compare(normalized, hash)
  } catch {
    return false
  }
}

// ─── In-memory attempt tracker (best-effort; serverless may reset on cold start) ───
// Keyed by email. Falls back to DB-backed counters when this resets.
interface AttemptRecord {
  count: number
  lastAttempt: number
  lockedUntil: number | null
}
const attemptStore = new Map<string, AttemptRecord>()

export function getInMemoryAttempts(email: string): AttemptRecord {
  const now = Date.now()
  const rec = attemptStore.get(email) || { count: 0, lastAttempt: 0, lockedUntil: null }
  // Clear expired lockout
  if (rec.lockedUntil && rec.lockedUntil < now) {
    rec.count = 0
    rec.lockedUntil = null
  }
  return rec
}

export function recordInMemoryFailure(email: string): { locked: boolean; retryAfterMs: number } {
  const now = Date.now()
  const rec = getInMemoryAttempts(email)
  rec.count += 1
  rec.lastAttempt = now
  if (rec.count >= MAX_SECURITY_ATTEMPTS) {
    rec.lockedUntil = now + SECURITY_LOCKOUT_MS
    attemptStore.set(email, rec)
    return { locked: true, retryAfterMs: SECURITY_LOCKOUT_MS }
  }
  attemptStore.set(email, rec)
  return { locked: false, retryAfterMs: 0 }
}

export function clearInMemoryAttempts(email: string): void {
  attemptStore.delete(email)
}

/**
 * Check if a user is currently locked out, given their DB-backed
 * lockout timestamp. Returns retryAfterMs (0 if not locked).
 */
export function checkLockout(lockedUntil: Date | null): { locked: boolean; retryAfterMs: number } {
  if (!lockedUntil) return { locked: false, retryAfterMs: 0 }
  const ms = lockedUntil.getTime() - Date.now()
  if (ms <= 0) return { locked: false, retryAfterMs: 0 }
  return { locked: true, retryAfterMs: ms }
}

/**
 * Format a millisecond duration as a friendly "X min Y sec" or "Y seconds" string.
 */
export function formatLockoutRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} seconds`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (seconds === 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`
  return `${minutes} min ${seconds} sec`
}

// ─── Generic error string (never reveal which part failed) ───
export const INVALID_SECURITY_ANSWER_ERROR = 'Invalid security answer.'
