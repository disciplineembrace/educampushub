import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

try {
  const EMAIL = 'sagathiyasoya2009@gmail.com'
  const NEW_PASSWORD = 'Pradip@2009'
  const SECURITY_Q_IDX = 6 // "What is your favorite color?"
  const SECURITY_ANSWER = 'Black'

  console.log(`Restoring user: ${EMAIL}`)
  const pwHash = await bcrypt.hash(NEW_PASSWORD, 10)
  // Normalize answer same way as src/lib/security-question.ts: trim + collapse spaces + lowercase
  const normalized = SECURITY_ANSWER.trim().replace(/\s+/g, ' ').toLowerCase()
  const ansHash = await bcrypt.hash(normalized, 12)

  await db.user.update({
    where: { email: EMAIL },
    data: {
      passwordHash: pwHash,
      mustChangePassword: false,
      securityQuestionIdx: SECURITY_Q_IDX,
      securityAnswerHash: ansHash,
      securityAttempts: 0,
      securityLockedUntil: null,
      securityUpdatedAt: new Date(),
    },
  })
  console.log(`  ✓ Password set to: ${NEW_PASSWORD}`)
  console.log(`  ✓ Security Q: "What is your favorite color?"`)
  console.log(`  ✓ Security A: "${SECURITY_ANSWER}" (normalized: "${normalized}")`)
} catch (e) {
  console.error('FAILED:', e.message)
  process.exit(1)
} finally { await db.$disconnect() }
