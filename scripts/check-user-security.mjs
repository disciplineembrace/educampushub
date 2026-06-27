import { PrismaClient } from '@prisma/client'
const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})
try {
  const users = await db.user.findMany({
    select: {
      email: true, name: true,
      securityQuestionIdx: true,
      securityAnswerHash: true,
      securityAttempts: true,
      securityLockedUntil: true,
      securityUpdatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  console.log('User security question status:')
  for (const u of users) {
    const hasQ = u.securityQuestionIdx !== null && u.securityAnswerHash !== null
    const locked = u.securityLockedUntil && u.securityLockedUntil > new Date()
    console.log(`  ${u.email}`)
    console.log(`    securityQuestionIdx: ${u.securityQuestionIdx} (null = NOT SET)`)
    console.log(`    hasAnswerHash:       ${u.securityAnswerHash ? 'YES' : 'NO'}`)
    console.log(`    securityAttempts:    ${u.securityAttempts}`)
    console.log(`    securityLockedUntil: ${u.securityLockedUntil ? u.securityLockedUntil.toISOString() : 'null'}${locked ? ' [LOCKED]' : ''}`)
    console.log(`    securityUpdatedAt:   ${u.securityUpdatedAt ? u.securityUpdatedAt.toISOString() : 'null'}`)
    console.log('')
  }
} finally { await db.$disconnect() }
