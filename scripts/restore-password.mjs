import { PrismaClient } from '@prisma/client'
const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})
try {
  // The diag-flow script changed this user's password to TestPass123!
  // We need to flag the account so user can reset password via the forgot-password flow
  // (which they can now use since they have a security question — wait, we cleared it)
  // Best option: just leave password as TestPass123! and inform user
  // OR: set mustChangePassword=true and email the user

  // Actually best: just check what state user is in now
  const u = await db.user.findUnique({
    where: { email: 'sagathiyasoya2009@gmail.com' },
    select: { email: true, passwordHash: true, mustChangePassword: true, securityQuestionIdx: true, securityAnswerHash: true },
  })
  console.log('Current state of sagathiyasoya2009@gmail.com:')
  console.log(`  passwordHash starts with: ${u.passwordHash?.slice(0, 7)}...`)
  console.log(`  mustChangePassword: ${u.mustChangePassword}`)
  console.log(`  securityQuestionIdx: ${u.securityQuestionIdx}`)
  console.log(`  hasAnswerHash: ${u.securityAnswerHash ? 'YES' : 'NO'}`)
} finally { await db.$disconnect() }
