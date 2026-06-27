import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

try {
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      isBanned: true,
      isVerified: true,
      isSuperAdmin: true,
      createdAt: true,
      updatedAt: true,
      college: true,
      city: true,
      _count: { select: { listings: true, payments: true, wishlistItems: true, reports: true, sessions: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Total users: ${users.length}\n`)
  for (const u of users) {
    const tags = []
    if (u.isSuperAdmin) tags.push('SUPER_ADMIN')
    else if (u.isAdmin) tags.push('ADMIN')
    if (u.isBanned) tags.push('BANNED')
    if (!u.isVerified) tags.push('UNVERIFIED')
    const tagStr = tags.length ? ` [${tags.join(',')}]` : ''
    console.log(`email=${u.email}`)
    console.log(`  name=${u.name} | college=${u.college || '-'} | city=${u.city || '-'}`)
    console.log(`  counts: listings=${u._count.listings} payments=${u._count.payments} wishlist=${u._count.wishlistItems} reports=${u._count.reports} sessions=${u._count.sessions}`)
    console.log(`  created=${u.createdAt.toISOString()} | updated=${u.updatedAt.toISOString()}${tagStr}`)
    console.log('')
  }
} finally {
  await db.$disconnect()
}
