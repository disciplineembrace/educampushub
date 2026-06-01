import { createHmac, timingSafeEqual } from 'crypto'
import { db } from './db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('WARNING: JWT_SECRET not set in environment. Using insecure default. Set JWT_SECRET in production!')
  return 'educampushub-insecure-dev-secret-change-me'
})()
const ADMIN_COOKIE_NAME = 'cnx_admin_session'
const SESSION_DURATION = 4 * 60 * 60 * 1000 // 4 hours
const BCRYPT_ROUNDS = 12

export type AdminRole = 'super_admin' | 'moderator' | 'support_admin'

export interface AdminPayload {
  userId: string
  email: string
  role: AdminRole
  isSuperAdmin: boolean
  twoFactorVerified: boolean
  iat: number
  exp: number
}

// ─── Password Hashing (bcrypt) ───

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 8) errors.push('Password must be at least 8 characters')
  if (password.length > 128) errors.push('Password must be less than 128 characters')
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number')
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain at least one special character')
  return { valid: errors.length === 0, errors }
}

// ─── JWT Token Creation / Verification ───

function createSignedToken(payload: AdminPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifySignedToken(token: string): AdminPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, signature] = parts
    const expectedSignature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')

    const sigBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as AdminPayload

    if (payload.exp && payload.exp * 1000 < Date.now()) return null

    return payload
  } catch {
    return null
  }
}

// ─── Admin Session Management ───

export async function createAdminSession(
  userId: string,
  email: string,
  role: AdminRole,
  isSuperAdmin: boolean,
  twoFactorVerified: boolean,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    const iat = Math.floor(Date.now() / 1000)
    const exp = iat + (4 * 60 * 60) // 4 hours

    const payload: AdminPayload = { userId, email, role, isSuperAdmin, twoFactorVerified, iat, exp }
    const token = createSignedToken(payload)

    await db.adminSession.create({
      data: {
        userId,
        token,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt: new Date(exp * 1000),
      }
    })

    return token
  } catch (error) {
    console.error('Create admin session error:', error)
    throw error
  }
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const payload = verifySignedToken(token)
    if (!payload) return null

    const session = await db.adminSession.findUnique({
      where: { token },
      include: { user: true }
    })

    if (!session || session.isRevoked || session.expiresAt < new Date() || session.user.isBanned) {
      return null
    }

    // 2FA check removed - direct login now
    // (Previously: Super Admin must have completed 2FA)
    return payload
  } catch {
    return null
  }
}

export async function getAdminFromCookies(): Promise<AdminPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
    if (!token) return null
    return verifyAdminToken(token)
  } catch {
    return null
  }
}

export async function revokeAdminSession(token: string) {
  try {
    await db.adminSession.update({
      where: { token },
      data: { isRevoked: true }
    })
  } catch {
    // Session may not exist
  }
}

export async function cleanExpiredSessions() {
  try {
    await db.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    })
  } catch {
    // Ignore cleanup errors
  }
}

// ─── Role Permissions ───

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['all'],
  moderator: ['delete_listing', 'ban_user', 'verify_seller', 'manage_reports', 'feature_listing', 'manage_payments', 'approve_uploads'],
  support_admin: ['manage_reports', 'verify_seller', 'manage_payments', 'approve_uploads'],
}

export function hasPermission(role: AdminRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  if (perms.includes('all')) return true
  return perms.includes(permission)
}

// ─── Super Admin Protection ───

/**
 * Check if a user is the immutable Super Admin.
 * The Super Admin account (identified by isSuperAdmin flag) has special protections.
 */
export function isSuperAdminAccount(user: { isSuperAdmin?: boolean; adminRole?: string | null }): boolean {
  return user.isSuperAdmin === true || user.adminRole === 'super_admin'
}

/**
 * Check if a Super Admin account can be modified by the given actor.
 * Super Admin accounts CANNOT be:
 * - Deleted by anyone
 * - Banned by anyone
 * - Demoted by anyone except another Super Admin
 */
export function canModifySuperAdmin(actorRole: AdminRole, actorIsSuperAdmin: boolean, targetIsSuperAdmin: boolean, action: string): { allowed: boolean; reason?: string } {
  // Super Admin accounts cannot be targeted for destructive actions
  if (targetIsSuperAdmin) {
    // Only Super Admin can modify other Super Admin accounts
    if (!actorIsSuperAdmin) {
      return { allowed: false, reason: 'Super Admin accounts cannot be modified by other roles' }
    }

    // Even Super Admin cannot delete the primary Super Admin account
    if (action === 'delete' || action === 'delete_user') {
      return { allowed: false, reason: 'Super Admin account cannot be deleted' }
    }

    // Super Admin can ban/unban, edit, but NOT delete
    return { allowed: true }
  }

  return { allowed: true }
}

/**
 * Check if the actor can create or remove admin accounts.
 * Only Super Admin can create, edit, or remove admin accounts.
 */
export function canManageAdmins(actorRole: AdminRole, actorIsSuperAdmin: boolean): boolean {
  return actorIsSuperAdmin || actorRole === 'super_admin'
}
