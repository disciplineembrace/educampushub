import { NextResponse } from 'next/server'
import { db, getNeonSql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import {
  SECURITY_QUESTIONS,
  isValidSecurityQuestionIndex,
  validateSecurityAnswer,
  hashSecurityAnswer,
  verifySecurityAnswer,
} from '@/lib/security-question'

/**
 * Get the authed user from the session cookie.
 * Returns null if not logged in.
 */
async function getAuthedUser() {
  const cookieStore = await import('next/headers').then(m => m.cookies())
  const token = cookieStore.get('session_token')?.value
  if (!token) return null

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, signature] = parts
    const { createHmac, timingSafeEqual } = await import('crypto')
    const JWT_SECRET = process.env.JWT_SECRET || 'educampushub-insecure-dev-secret-change-me'
    const expectedSig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expectedSig)
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      userId: string
      type: string
      exp: number
    }
    if (payload.type !== 'user_session') return null
    if (payload.exp * 1000 < Date.now()) return null

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        securityQuestionIdx: true,
        securityAnswerHash: true,
        isAdmin: true,
        isBanned: true,
      },
    })
    return user
  } catch {
    return null
  }
}

/**
 * GET /api/auth/security-question
 *
 * Returns the current user's security question text (NOT the answer).
 * Used by the Profile page to display which question is currently set.
 */
export async function GET() {
  try {
    const user = await getAuthedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.isBanned) {
      return NextResponse.json({ error: 'Account banned' }, { status: 403 })
    }

    if (
      user.securityQuestionIdx === null ||
      user.securityQuestionIdx === undefined ||
      !user.securityAnswerHash
    ) {
      return NextResponse.json({
        hasSecurityQuestion: false,
        securityQuestion: null,
        availableQuestions: SECURITY_QUESTIONS,
      })
    }

    return NextResponse.json({
      hasSecurityQuestion: true,
      securityQuestion: SECURITY_QUESTIONS[user.securityQuestionIdx],
      securityQuestionIdx: user.securityQuestionIdx,
      securityUpdatedAt: null, // we don't track this in select; could be added
      availableQuestions: SECURITY_QUESTIONS,
    })
  } catch (error) {
    console.error('Security question GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch security question' }, { status: 500 })
  }
}

/**
 * POST /api/auth/security-question
 *
 * Body:
 *   - action: 'setup' | 'update'
 *   - currentPassword: string (required for 'update' on accounts that already have a Q)
 *   - securityQuestionIdx: number
 *   - securityAnswer: string
 *
 * Used by the Profile page to set or change the security question.
 * Changing requires confirming with the current password.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.isBanned) {
      return NextResponse.json({ error: 'Account banned' }, { status: 403 })
    }
    // Admin accounts manage their security via admin panel — block here
    if (user.isAdmin) {
      return NextResponse.json({ error: 'Admins must use the admin panel' }, { status: 403 })
    }

    const body = await request.json()
    const { action, currentPassword, securityQuestionIdx, securityAnswer } = body

    if (action !== 'setup' && action !== 'update') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // ─── Validate the new question + answer ───
    if (!isValidSecurityQuestionIndex(securityQuestionIdx)) {
      return NextResponse.json({ error: 'Please select a valid security question' }, { status: 400 })
    }
    if (!securityAnswer || typeof securityAnswer !== 'string') {
      return NextResponse.json({ error: 'Security answer is required' }, { status: 400 })
    }
    const answerValidation = validateSecurityAnswer(securityAnswer)
    if (!answerValidation.valid) {
      return NextResponse.json(
        { error: answerValidation.error || 'Invalid security answer' },
        { status: 400 }
      )
    }

    // ─── Authorization for 'update' ───
    // If the user already has a security question, require the current password
    // (NOT the old security answer — that would let anyone who knows the answer
    // change it, defeating the purpose). The current password is the stronger
    // proof of identity for an authenticated session.
    const alreadyHasQuestion =
      user.securityQuestionIdx !== null &&
      user.securityQuestionIdx !== undefined &&
      !!user.securityAnswerHash

    if (alreadyHasQuestion || action === 'update') {
      if (!currentPassword || typeof currentPassword !== 'string') {
        return NextResponse.json(
          { error: 'Current password is required to change your security question' },
          { status: 400 }
        )
      }
      if (!user.passwordHash) {
        return NextResponse.json({ error: 'No password set on this account' }, { status: 400 })
      }
      const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!passwordOk) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    }

    // ─── Persist the new question + hashed answer ───
    const newHash = await hashSecurityAnswer(securityAnswer)
    const sql = getNeonSql()
    await sql`
      UPDATE "User"
      SET "securityQuestionIdx" = ${securityQuestionIdx},
          "securityAnswerHash" = ${newHash},
          "securityAttempts" = 0,
          "securityLockedUntil" = NULL,
          "securityUpdatedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `

    return NextResponse.json({
      success: true,
      message: alreadyHasQuestion
        ? 'Security question updated successfully.'
        : 'Security question set up successfully.',
      securityQuestion: SECURITY_QUESTIONS[securityQuestionIdx],
    })
  } catch (error) {
    console.error('Security question POST error:', error)
    return NextResponse.json({ error: 'Failed to save security question' }, { status: 500 })
  }
}
