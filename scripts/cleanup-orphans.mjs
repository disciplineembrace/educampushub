import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

try {
  console.log('=== CHECKING FOR ORPHAN RECORDS ===')

  // Find adminSessions whose userId no longer exists in User table
  const allUsers = await db.user.findMany({ select: { id: true } })
  const validUserIds = new Set(allUsers.map(u => u.id))
  console.log(`Valid user IDs: ${validUserIds.size}`)

  const allAdminSessions = await db.adminSession.findMany({ select: { id: true, userId: true, expiresAt: true } })
  const orphanAdminSessions = allAdminSessions.filter(s => !validUserIds.has(s.userId))
  console.log(`adminSessions total=${allAdminSessions.length} orphan=${orphanAdminSessions.length}`)

  // Find expired adminSessions too (regardless of orphan status)
  const now = new Date()
  const expiredAdminSessions = allAdminSessions.filter(s => s.expiresAt < now)
  console.log(`adminSessions expired=${expiredAdminSessions.length}`)

  // Find auditLogs whose actorId no longer exists
  const allAuditLogs = await db.auditLog.findMany({ select: { id: true, actorId: true } })
  const orphanAuditLogs = allAuditLogs.filter(a => !validUserIds.has(a.actorId))
  console.log(`auditLogs total=${allAuditLogs.length} orphan=${orphanAuditLogs.length}`)

  // Find userSessions whose userId no longer exists
  const allUserSessions = await db.userSession.findMany({ select: { id: true, userId: true, expiresAt: true } })
  const orphanUserSessions = allUserSessions.filter(s => !validUserIds.has(s.userId))
  console.log(`userSessions total=${allUserSessions.length} orphan=${orphanUserSessions.length}`)

  console.log('\n=== CLEANING ORPHANS + EXPIRED SESSIONS ===')
  // Delete orphan adminSessions
  const orphanAdminIds = orphanAdminSessions.map(s => s.id)
  if (orphanAdminIds.length) {
    const r = await db.adminSession.deleteMany({ where: { id: { in: orphanAdminIds } } })
    console.log(`  orphan adminSessions deleted: ${r.count}`)
  }

  // Delete expired adminSessions (any that remain expired)
  const delExpiredAdmin = await db.adminSession.deleteMany({ where: { expiresAt: { lt: now } } })
  console.log(`  expired adminSessions deleted: ${delExpiredAdmin.count}`)

  // Delete orphan userSessions
  const orphanUserSessionIds = orphanUserSessions.map(s => s.id)
  if (orphanUserSessionIds.length) {
    const r = await db.userSession.deleteMany({ where: { id: { in: orphanUserSessionIds } } })
    console.log(`  orphan userSessions deleted: ${r.count}`)
  }

  // Delete expired userSessions
  const delExpiredUser = await db.userSession.deleteMany({ where: { expiresAt: { lt: now } } })
  console.log(`  expired userSessions deleted: ${delExpiredUser.count}`)

  // Delete orphan auditLogs
  const orphanAuditIds = orphanAuditLogs.map(a => a.id)
  if (orphanAuditIds.length) {
    const r = await db.auditLog.deleteMany({ where: { id: { in: orphanAuditIds } } })
    console.log(`  orphan auditLogs deleted: ${r.count}`)
  }

  // Also clean up any stale PasswordResetOTP records (old OTP-based system)
  const otpCount = await db.passwordResetOTP.count()
  if (otpCount > 0) {
    const delOtp = await db.passwordResetOTP.deleteMany({})
    console.log(`  passwordResetOTPs deleted (deprecated OTP system): ${delOtp.count}`)
  } else {
    console.log(`  passwordResetOTPs: 0 (already clean)`)
  }

  // Final state
  console.log('\n=== FINAL STATE ===')
  const final = await Promise.all([
    db.user.count(), db.userSession.count(), db.adminSession.count(),
    db.listing.count(), db.payment.count(), db.wishlist.count(),
    db.report.count(), db.auditLog.count(), db.passwordResetOTP.count(),
  ])
  console.log(`users=${final[0]} userSessions=${final[1]} adminSessions=${final[2]} listings=${final[3]} payments=${final[4]} wishlist=${final[5]} reports=${final[6]} auditLogs=${final[7]} passwordResetOTPs=${final[8]}`)

  console.log('\n=== FINAL REMAINING USERS ===')
  const users = await db.user.findMany({
    select: { email: true, name: true, isAdmin: true, isSuperAdmin: true, isVerified: true, createdAt: true, _count: { select: { listings: true, payments: true, sessions: true } } },
    orderBy: { createdAt: 'asc' },
  })
  for (const u of users) {
    const tags = []
    if (u.isSuperAdmin) tags.push('SUPER_ADMIN')
    else if (u.isAdmin) tags.push('ADMIN')
    if (!u.isVerified) tags.push('UNVERIFIED')
    console.log(`  ${u.email} | ${u.name} | listings=${u._count.listings} payments=${u._count.payments} sessions=${u._count.sessions} ${tags.length ? '['+tags.join(',')+']' : ''}`)
  }
} catch (err) {
  console.error('FAILED:', err.message)
  console.error(err.stack)
  process.exit(1)
} finally {
  await db.$disconnect()
}
