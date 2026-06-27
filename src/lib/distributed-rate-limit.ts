/**
 * Distributed rate limiting using Postgres.
 *
 * In Vercel serverless, in-memory Maps reset on every cold start, so a
 * determined attacker can bypass them just by sending requests fast enough
 * to hit different instances. This module persists attempt counters to the
 * database (Neon Postgres), giving us durable, distributed rate limiting
 * without adding any new infrastructure.
 *
 * Schema (auto-created on first use):
 *   CREATE TABLE "RateLimit" (
 *     "key" TEXT PRIMARY KEY,            -- e.g. "forgot-pwd:ip:1.2.3.4"
 *     "count" INTEGER NOT NULL DEFAULT 0,
 *     "firstAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *     "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
 *   );
 */
import { getNeonSql } from '@/lib/db'

const sql = getNeonSql()

let schemaInitialized = false

async function ensureSchema() {
  if (schemaInitialized) return
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "RateLimit" (
        "key" TEXT PRIMARY KEY,
        "count" INTEGER NOT NULL DEFAULT 0,
        "firstAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
    schemaInitialized = true
  } catch (err) {
    // If the table already exists or there's a transient error, fall back
    // to no-op (the in-memory limiter in callers still provides best-effort
    // protection within a single instance).
    console.error('RateLimit schema init failed:', err)
  }
}

export interface DistributedRateLimitResult {
  allowed: boolean
  count: number
  retryAfterMs: number
}

/**
 * Check (without incrementing) whether a key is currently rate-limited.
 */
export async function checkDistributedRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<DistributedRateLimitResult> {
  await ensureSchema()
  try {
    const rows = await sql`
      SELECT count, "firstAttemptAt", "lastAttemptAt"
      FROM "RateLimit"
      WHERE "key" = ${key}
    `
    if (rows.length === 0) {
      return { allowed: true, count: 0, retryAfterMs: 0 }
    }
    const row = rows[0]
    const firstAt = new Date(row.firstAttemptAt).getTime()
    const now = Date.now()

    // If the window has expired, the limit has reset
    if (now - firstAt > windowMs) {
      return { allowed: true, count: 0, retryAfterMs: 0 }
    }

    if (row.count >= maxAttempts) {
      const retryAfterMs = windowMs - (now - firstAt)
      return { allowed: false, count: row.count, retryAfterMs: Math.max(retryAfterMs, 0) }
    }

    return { allowed: true, count: row.count, retryAfterMs: 0 }
  } catch {
    // On DB error, fail open (allow) — in-memory limiter still applies
    return { allowed: true, count: 0, retryAfterMs: 0 }
  }
}

/**
 * Atomically increment the counter for a key. Returns the new count.
 * Resets the counter if the window has expired.
 */
export async function incrementDistributedRateLimit(
  key: string,
  windowMs: number
): Promise<number> {
  await ensureSchema()
  try {
    // Upsert with window reset logic
    const rows = await sql`
      INSERT INTO "RateLimit" ("key", "count", "firstAttemptAt", "lastAttemptAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("key")
      DO UPDATE SET
        count = CASE
          WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "RateLimit"."firstAttemptAt")) * 1000 > ${windowMs}
          THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "firstAttemptAt" = CASE
          WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - "RateLimit"."firstAttemptAt")) * 1000 > ${windowMs}
          THEN CURRENT_TIMESTAMP
          ELSE "RateLimit"."firstAttemptAt"
        END,
        "lastAttemptAt" = CURRENT_TIMESTAMP
      RETURNING count
    `
    return rows[0]?.count ?? 1
  } catch (err) {
    console.error('RateLimit increment failed:', err)
    return 0
  }
}

/**
 * Reset the counter for a key (call after successful action).
 */
export async function clearDistributedRateLimit(key: string): Promise<void> {
  await ensureSchema()
  try {
    await sql`DELETE FROM "RateLimit" WHERE "key" = ${key}`
  } catch {
    // best-effort
  }
}
