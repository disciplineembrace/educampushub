import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const FAKE_EMAILS = [
  'test@example.com',
  'user1@test.com',
  'testuser@example.com',
  'debugtest99@example.com',
  'pradiptest1137@gmail.com',
  'test_otp_flow_123@example.com',
  'apitest_1782526641@example.com',
  'apitest_1782526840@example.com',
  'apitest_1782526873@example.com',
  'apitest_1782526887@example.com',
  'apitest_1782526915@example.com',
  'apitest_1782526927@example.com',
  'apitest_1782526946@example.com',
  'e2e_test_1782527589@example.com',
]

const KEEP_EMAILS = [
  'sagathiyapradip2002@gmail.com',
  'disciplineembrace@gmail.com',
  'sagathiyasoya2009@gmail.com',
  'sagathiyapradip1137@gmail.com',
]

try {
  console.log('=== BEFORE CLEANUP ===')
  const before = await Promise.all([
    db.user.count(), db.userSession.count(), db.listing.count(),
    db.payment.count(), db.wishlist.count(), db.report.count(),
    db.adminSession.count(), db.auditLog.count(),
  ])
  console.log(`users=${before[0]} userSessions=${before[1]} listings=${before[2]} payments=${before[3]} wishlist=${before[4]} reports=${before[5]} adminSessions=${before[6]} auditLogs=${before[7]}`)

  console.log('\n=== VERIFYING KEEP ACCOUNTS EXIST ===')
  for (const email of KEEP_EMAILS) {
    const u = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, isAdmin: true, isSuperAdmin: true } })
    if (!u) {
      console.error(`!! KEEP account not found: ${email} — ABORTING`)
      process.exit(1)
    }
    console.log(`  ✓ ${u.email} | ${u.name} | ${u.isSuperAdmin ? 'SUPER_ADMIN' : u.isAdmin ? 'ADMIN' : 'USER'}`)
  }

  const fakeUsers = await db.user.findMany({
    where: { email: { in: FAKE_EMAILS } },
    select: { id: true, email: true, name: true, createdAt: true },
  })
  console.log(`\n=== FOUND ${fakeUsers.length} FAKE USERS TO DELETE ===`)
  for (const u of fakeUsers) {
    console.log(`  - ${u.email} (created=${u.createdAt.toISOString().slice(0,10)})`)
  }
  const fakeIds = fakeUsers.map(u => u.id)

  if (fakeIds.length === 0) {
    console.log('\nNo fake users to delete. Exiting.')
    process.exit(0)
  }

  console.log('\n=== DELETING RELATED DATA (cascade) ===')
  const del = await Promise.all([
    db.userSession.deleteMany({ where: { userId: { in: fakeIds } } }),
    db.adminSession.deleteMany({ where: { userId: { in: fakeIds } } }),
    db.listing.deleteMany({ where: { sellerId: { in: fakeIds } } }),
    db.payment.deleteMany({ where: { userId: { in: fakeIds } } }),
    db.wishlist.deleteMany({ where: { userId: { in: fakeIds } } }),
    db.report.deleteMany({ where: { reporterId: { in: fakeIds } } }),
    db.auditLog.deleteMany({ where: { actorId: { in: fakeIds } } }),
  ])
  console.log(`  userSessions deleted: ${del[0].count}`)
  console.log(`  adminSessions deleted: ${del[1].count}`)
  console.log(`  listings deleted: ${del[2].count}`)
  console.log(`  payments deleted: ${del[3].count}`)
  console.log(`  wishlist deleted: ${del[4].count}`)
  console.log(`  reports deleted: ${del[5].count}`)
  console.log(`  auditLogs deleted: ${del[6].count}`)

  console.log('\n=== DELETING FAKE USERS ===')
  const delUsers = await db.user.deleteMany({ where: { id: { in: fakeIds } } })
  console.log(`  users deleted: ${delUsers.count}`)

  console.log('\n=== AFTER CLEANUP ===')
  const after = await Promise.all([
    db.user.count(), db.userSession.count(), db.listing.count(),
    db.payment.count(), db.wishlist.count(), db.report.count(),
    db.adminSession.count(), db.auditLog.count(),
  ])
  console.log(`users=${after[0]} userSessions=${after[1]} listings=${after[2]} payments=${after[3]} wishlist=${after[4]} reports=${after[5]} adminSessions=${after[6]} auditLogs=${after[7]}`)

  console.log('\n=== REMAINING USERS ===')
  const remaining = await db.user.findMany({
    select: { email: true, name: true, isAdmin: true, isSuperAdmin: true, isVerified: true, createdAt: true, _count: { select: { listings: true, payments: true, sessions: true } } },
    orderBy: { createdAt: 'asc' },
  })
  for (const u of remaining) {
    const tags = []
    if (u.isSuperAdmin) tags.push('SUPER_ADMIN')
    else if (u.isAdmin) tags.push('ADMIN')
    if (!u.isVerified) tags.push('UNVERIFIED')
    console.log(`  ${u.email} | ${u.name} | listings=${u._count.listings} payments=${u._count.payments} sessions=${u._count.sessions} ${tags.length ? '['+tags.join(',')+']' : ''}`)
  }
  console.log('\n✓ Cleanup complete.')
} catch (err) {
  console.error('CLEANUP FAILED:', err.message)
  console.error(err.stack)
  process.exit(1)
} finally {
  await db.$disconnect()
}
