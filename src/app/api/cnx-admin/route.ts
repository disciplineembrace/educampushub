import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromCookies, hasPermission, revokeAdminSession, canManageAdmins, canModifySuperAdmin, hashPassword, type AdminRole } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

// Verify admin for every request
async function verifyAdmin(request: Request) {
  const admin = await getAdminFromCookies()
  if (!admin) return null

  try {
    const user = await db.user.findUnique({ where: { id: admin.userId } })
    if (!user || !user.isAdmin || user.isBanned) return null
    return { ...admin, user }
  } catch (dbError) {
    // If DB lookup fails, still allow based on token verification alone
    console.warn('[Admin API] User DB lookup failed, using token payload:', dbError)
    return admin
  }
}

// GET - Fetch admin data (stats, users, reports, listings)
export async function GET(request: Request) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'stats'

  if (type === 'stats') {
    const [totalUsers, totalListings, activeListings, totalReports, unresolvedReports, featuredListings] = await Promise.all([
      db.user.count(),
      db.listing.count(),
      db.listing.count({ where: { isSold: false } }),
      db.report.count(),
      db.report.count({ where: { isResolved: false } }),
      db.listing.count({ where: { isFeatured: true } }),
    ])
    const categoryStats = await db.listing.groupBy({ by: ['category'], _count: { category: true }, where: { isSold: false } })
    const cityStats = await db.listing.groupBy({ by: ['city'], _count: { city: true }, where: { isSold: false }, orderBy: { _count: { city: 'desc' } }, take: 5 })
    const totalViews = await db.listing.aggregate({ _sum: { views: true } })
    const recentListings = await db.listing.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { seller: { select: { name: true, college: true } } } })

    return NextResponse.json({ totalUsers, totalListings, activeListings, totalReports, unresolvedReports, featuredListings, totalViews: totalViews._sum.views || 0, categoryStats, cityStats, recentListings })
  }

  if (type === 'users') {
    // ⚠️ SECURITY: explicitly select columns — never use `include` without `select`
    // because that returns ALL User columns including passwordHash and securityAnswerHash.
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        college: true,
        city: true,
        avatar: true,
        isVerified: true,
        isAdmin: true,
        isBanned: true,
        rating: true,
        totalSales: true,
        whatsapp: true,
        createdAt: true,
        updatedAt: true,
        district: true,
        state: true,
        planType: true,
        premiumActive: true,
        premiumBookLimit: true,
        premiumBooksUsed: true,
        premiumExpiryDate: true,
        premiumPurchaseDate: true,
        totalBooksUploaded: true,
        freeUploadUsed: true,
        paidUploadCredits: true,
        adminRole: true,
        isSuperAdmin: true,
        // Deliberately EXCLUDE: passwordHash, securityAnswerHash, securityAttempts,
        // securityLockedUntil, securityUpdatedAt, mustChangePassword, twoFactorEnabled
        // — never leak these to the admin UI
        _count: { select: { listings: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ users })
  }

  if (type === 'reports') {
    const reports = await db.report.findMany({ include: { listing: { select: { id: true, title: true } }, reporter: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ reports })
  }

  if (type === 'listings') {
    const listings = await db.listing.findMany({ include: { seller: { select: { id: true, name: true, email: true, college: true } } }, orderBy: { createdAt: 'desc' }, take: 50 })
    return NextResponse.json({ listings })
  }

  if (type === 'listing-detail') {
    const listingId = searchParams.get('id')
    if (!listingId) return NextResponse.json({ error: 'Missing listing id' }, { status: 400 })
    const listing = await db.listing.findUnique({
      where: { id: listingId },
      include: { seller: { select: { id: true, name: true, email: true, college: true, phone: true, isVerified: true, isBanned: true } } },
    })
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    return NextResponse.json({ listing })
  }

  if (type === 'user-detail') {
    const userId = searchParams.get('id')
    if (!userId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    // ⚠️ SECURITY: use `select` (not `include`) at the top level so we don't
    // accidentally leak passwordHash / securityAnswerHash to the admin UI.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        college: true,
        city: true,
        avatar: true,
        isVerified: true,
        isAdmin: true,
        isBanned: true,
        rating: true,
        totalSales: true,
        whatsapp: true,
        createdAt: true,
        updatedAt: true,
        district: true,
        state: true,
        planType: true,
        premiumActive: true,
        premiumBookLimit: true,
        premiumBooksUsed: true,
        premiumExpiryDate: true,
        premiumPurchaseDate: true,
        totalBooksUploaded: true,
        freeUploadUsed: true,
        paidUploadCredits: true,
        adminRole: true,
        isSuperAdmin: true,
        // Deliberately EXCLUDE sensitive columns
        listings: {
          select: { id: true, title: true, sellingPrice: true, isSold: true, isFeatured: true, isVerified: true, isUrgent: true, isDigital: true, uploadType: true, category: true, state: true, district: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          select: { id: true, amount: true, paymentType: true, status: true, createdAt: true, verifiedAt: true },
          orderBy: { createdAt: 'desc' },
        },
        wishlistItems: { select: { id: true, listingId: true, listing: { select: { id: true, title: true, sellingPrice: true } } } },
        reports: { select: { id: true, reason: true, isResolved: true, createdAt: true, listing: { select: { id: true, title: true } } } },
        _count: { select: { listings: true, wishlistItems: true, reports: true, payments: true, adminSessions: true, auditLogs: true } },
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json({ user })
  }

  if (type === 'user-listings') {
    const userId = searchParams.get('id')
    if (!userId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    const userListings = await db.listing.findMany({
      where: { sellerId: userId },
      include: { seller: { select: { id: true, name: true, email: true, college: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ listings: userListings })
  }

  if (type === 'audit-logs') {
    if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const logs = await db.auditLog.findMany({ include: { actor: { select: { name: true, email: true, adminRole: true, isSuperAdmin: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })
    return NextResponse.json({ logs })
  }

  if (type === 'payments') {
    if (!hasPermission(admin.role as AdminRole, 'manage_payments')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const payments = await db.payment.findMany({
      include: { user: { select: { id: true, name: true, email: true, college: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ payments })
  }

  // ─── New: Admin accounts list (Super Admin only) ───
  if (type === 'admin-accounts') {
    if (!canManageAdmins(admin.role as AdminRole, admin.isSuperAdmin)) {
      return NextResponse.json({ error: 'Only Super Admin can view admin accounts' }, { status: 403 })
    }
    const admins = await db.user.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        adminRole: true,
        isSuperAdmin: true,
        twoFactorEnabled: true,
        isVerified: true,
        isBanned: true,
        mustChangePassword: true,
        createdAt: true,
        _count: { select: { auditLogs: true, adminSessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    // Get recent login info from audit logs
    const adminsWithLogins = await Promise.all(admins.map(async (a) => {
      const lastLoginLog = await db.auditLog.findFirst({
        where: { actorId: a.id, action: { in: ['admin_login', '2fa_login_success'] } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, ipAddress: true },
      })
      return { ...a, lastLogin: lastLoginLog?.createdAt || null, lastLoginIp: lastLoginLog?.ipAddress || null }
    }))
    return NextResponse.json({ admins: adminsWithLogins })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

// POST - Admin actions
export async function POST(request: Request) {
  const admin = await verifyAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, targetId, details, updates } = body
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  try {
    switch (action) {
      case 'delete_listing': {
        if (!hasPermission(admin.role as AdminRole, 'delete_listing')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.wishlist.deleteMany({ where: { listingId: targetId } })
        await db.report.deleteMany({ where: { listingId: targetId } })
        await db.listing.delete({ where: { id: targetId } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'delete_listing', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'ban_user': {
        if (!hasPermission(admin.role as AdminRole, 'ban_user')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        // Check if target is Super Admin
        const banTarget = await db.user.findUnique({ where: { id: targetId } })
        if (!banTarget) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        if (banTarget.isSuperAdmin || banTarget.adminRole === 'super_admin') {
          const canModify = canModifySuperAdmin(admin.role as AdminRole, admin.isSuperAdmin, true, 'ban')
          if (!canModify.allowed) return NextResponse.json({ error: canModify.reason }, { status: 403 })
        }
        await db.user.update({ where: { id: targetId }, data: { isBanned: true } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'ban_user', targetType: 'user', targetId, ipAddress: ip, details: details || null } })
        return NextResponse.json({ success: true })
      }
      case 'unban_user': {
        if (!hasPermission(admin.role as AdminRole, 'ban_user')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.user.update({ where: { id: targetId }, data: { isBanned: false } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'unban_user', targetType: 'user', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'verify_seller': {
        if (!hasPermission(admin.role as AdminRole, 'verify_seller')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.user.update({ where: { id: targetId }, data: { isVerified: true } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'verify_seller', targetType: 'user', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'feature_listing': {
        if (!hasPermission(admin.role as AdminRole, 'feature_listing')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.listing.update({ where: { id: targetId }, data: { isFeatured: true } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'feature_listing', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'unfeature_listing': {
        if (!hasPermission(admin.role as AdminRole, 'feature_listing')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.listing.update({ where: { id: targetId }, data: { isFeatured: false } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'unfeature_listing', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'verify_listing': {
        if (!hasPermission(admin.role as AdminRole, 'verify_seller')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.listing.update({ where: { id: targetId }, data: { isVerified: true } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'verify_listing', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'unverify_listing': {
        if (!hasPermission(admin.role as AdminRole, 'verify_seller')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.listing.update({ where: { id: targetId }, data: { isVerified: false } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'unverify_listing', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'mark_sold': {
        if (!hasPermission(admin.role as AdminRole, 'feature_listing')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.listing.update({ where: { id: targetId }, data: { isSold: true } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'mark_sold', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'mark_unsold': {
        if (!hasPermission(admin.role as AdminRole, 'feature_listing')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.listing.update({ where: { id: targetId }, data: { isSold: false } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'mark_unsold', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'toggle_urgent': {
        if (!hasPermission(admin.role as AdminRole, 'feature_listing')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const listing = await db.listing.findUnique({ where: { id: targetId }, select: { isUrgent: true } })
        if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        const newValue = !listing.isUrgent
        await db.listing.update({ where: { id: targetId }, data: { isUrgent: newValue } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: newValue ? 'mark_urgent' : 'unmark_urgent', targetType: 'listing', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true, isUrgent: newValue })
      }
      case 'edit_listing': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        if (!updates) return NextResponse.json({ error: 'Missing updates' }, { status: 400 })
        const allowedFields = ['title', 'description', 'originalPrice', 'sellingPrice', 'category', 'subcategory', 'state', 'district', 'city', 'condition', 'isFeatured', 'isVerified', 'isSold', 'isUrgent', 'isDigital']
        const cleanUpdates: Record<string, unknown> = {}
        for (const key of allowedFields) {
          if (updates[key] !== undefined) {
            cleanUpdates[key] = updates[key]
          }
        }
        if (Object.keys(cleanUpdates).length === 0) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
        await db.listing.update({ where: { id: targetId }, data: cleanUpdates })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'edit_listing', targetType: 'listing', targetId, ipAddress: ip, details: JSON.stringify(cleanUpdates) } })
        return NextResponse.json({ success: true })
      }
      case 'edit_user': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        if (!updates) return NextResponse.json({ error: 'Missing updates' }, { status: 400 })
        // Check if target is Super Admin
        const editTarget = await db.user.findUnique({ where: { id: targetId } })
        if (!editTarget) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        if (editTarget.isSuperAdmin || editTarget.adminRole === 'super_admin') {
          const canModify = canModifySuperAdmin(admin.role as AdminRole, admin.isSuperAdmin, true, 'edit')
          if (!canModify.allowed) return NextResponse.json({ error: canModify.reason }, { status: 403 })
          // Don't allow changing Super Admin's adminRole or isSuperAdmin
          delete updates.adminRole
          delete updates.isSuperAdmin
          delete updates.isAdmin
        }
        const allowedUserFields = ['name', 'email', 'college', 'city', 'isVerified', 'phone', 'state', 'district']
        const cleanUserUpdates: Record<string, unknown> = {}
        for (const key of allowedUserFields) {
          if (updates[key] !== undefined) {
            cleanUserUpdates[key] = updates[key]
          }
        }
        if (Object.keys(cleanUserUpdates).length === 0) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
        await db.user.update({ where: { id: targetId }, data: cleanUserUpdates })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'edit_user', targetType: 'user', targetId, ipAddress: ip, details: JSON.stringify(cleanUserUpdates) } })
        return NextResponse.json({ success: true })
      }
      case 'delete_user_summary': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        // ⚠️ Self-delete prevention: backend enforces this here too
        if (targetId === admin.userId) {
          return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 })
        }
        const summaryUser = await db.user.findUnique({
          where: { id: targetId },
          include: {
            listings: { select: { id: true, title: true, sellingPrice: true, isSold: true, isFeatured: true, uploadType: true, category: true, images: true } },
            payments: { select: { id: true, amount: true, paymentType: true, status: true } },
            _count: { select: { listings: true, wishlistItems: true, reports: true, payments: true, adminSessions: true, auditLogs: true, sessions: true } },
          },
        })
        if (!summaryUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        // Super Admin accounts CANNOT be deleted
        if (summaryUser.isSuperAdmin || summaryUser.adminRole === 'super_admin') {
          return NextResponse.json({ error: 'Super Admin account cannot be deleted' }, { status: 403 })
        }
        if (summaryUser.isAdmin) {
          // Only Super Admin can delete other admin accounts
          if (!canManageAdmins(admin.role as AdminRole, admin.isSuperAdmin)) {
            return NextResponse.json({ error: 'Only Super Admin can delete admin accounts' }, { status: 403 })
          }
        }
        const totalViewsFromListings = await db.listing.aggregate({ _sum: { views: true }, where: { sellerId: targetId } })
        const totalSavesFromListings = await db.listing.aggregate({ _sum: { saves: true }, where: { sellerId: targetId } })
        const reportsOnUserListings = await db.report.count({ where: { listing: { sellerId: targetId } } })
        const wishlistsOnUserListings = await db.wishlist.count({ where: { listing: { sellerId: targetId } } })
        const verifiedPayments = summaryUser.payments.filter(p => p.status === 'verified')
        const totalSpent = verifiedPayments.reduce((sum, p) => sum + p.amount, 0)
        // totalSpent is a float — guard against NaN
        const safeTotalSpent = Number.isFinite(totalSpent) ? totalSpent : 0
        return NextResponse.json({
          user: { id: summaryUser.id, name: summaryUser.name, email: summaryUser.email, college: summaryUser.college, phone: summaryUser.phone, state: summaryUser.state, district: summaryUser.district, planType: summaryUser.planType, premiumActive: summaryUser.premiumActive, isVerified: summaryUser.isVerified, isAdmin: summaryUser.isAdmin, adminRole: summaryUser.adminRole, createdAt: summaryUser.createdAt },
          resources: {
            listings: summaryUser._count.listings || 0,
            activeListings: summaryUser.listings.filter(l => !l.isSold).length,
            soldListings: summaryUser.listings.filter(l => l.isSold).length,
            premiumListings: summaryUser.listings.filter(l => l.uploadType === 'premium').length,
            featuredListings: summaryUser.listings.filter(l => l.isFeatured).length,
            totalViews: totalViewsFromListings._sum.views || 0,
            totalSaves: totalSavesFromListings._sum.saves || 0,
            totalSpentOnPlatform: safeTotalSpent,
            payments: summaryUser._count.payments || 0,
            verifiedPayments: verifiedPayments.length || 0,
            wishlistItems: summaryUser._count.wishlistItems || 0,
            reportsFiled: summaryUser._count.reports || 0,
            reportsOnListings: reportsOnUserListings || 0,
            wishlistsOnListings: wishlistsOnUserListings || 0,
            sessions: summaryUser._count.adminSessions || 0,
            userSessions: summaryUser._count.sessions || 0,
            auditLogs: summaryUser._count.auditLogs || 0,
          },
          listingTitles: summaryUser.listings.slice(0, 10).map(l => ({ id: l.id, title: l.title, price: l.sellingPrice, category: l.category })),
        })
      }
      case 'delete_user': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        // Validate userId — must be a non-empty string
        if (!targetId || typeof targetId !== 'string' || targetId.trim() === '') {
          return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
        }
        // ⚠️ SECURITY: prevent admins from deleting their own account
        if (targetId === admin.userId) {
          return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 })
        }
        const targetUser = await db.user.findUnique({ where: { id: targetId } })
        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        // Super Admin accounts CANNOT be deleted
        if (targetUser.isSuperAdmin || targetUser.adminRole === 'super_admin') {
          return NextResponse.json({ error: 'Super Admin account cannot be deleted' }, { status: 403 })
        }
        if (targetUser.isAdmin && !canManageAdmins(admin.role as AdminRole, admin.isSuperAdmin)) {
          return NextResponse.json({ error: 'Only Super Admin can delete admin accounts' }, { status: 403 })
        }

        // ─── Cascade delete in a single transaction ───
        // Order matters: child rows first, parent rows last.
        // 1. Listings owned by user → must first delete Wishlists & Reports that reference those listings
        // 2. User's own Wishlists (saved items)
        // 3. Reports filed BY the user (as reporter)
        // 4. AdminSessions (admin login sessions for this user)
        // 5. UserSessions (regular login sessions — was MISSING before this fix)
        // 6. Payments
        // 7. AuditLogs where this user is the TARGET (historical audit of actions on this user)
        //    NOTE: AuditLogs where this user is the ACTOR are preserved (so we retain "admin X deleted user Y" trail)
        // 8. Finally, the User row itself
        const breakdown = await db.$transaction(async (tx) => {
          // Find all listings owned by the user
          const userListings = await tx.listing.findMany({
            where: { sellerId: targetId },
            select: { id: true },
          })
          const listingIds = userListings.map((l) => l.id)

          // Delete wishlists & reports that reference user's listings
          let wishlistsOnListings = 0
          let reportsOnListings = 0
          if (listingIds.length > 0) {
            wishlistsOnListings = await tx.wishlist.deleteMany({ where: { listingId: { in: listingIds } } }).then((r) => r.count)
            reportsOnListings = await tx.report.deleteMany({ where: { listingId: { in: listingIds } } }).then((r) => r.count)
            await tx.listing.deleteMany({ where: { id: { in: listingIds } } })
          }

          // Delete user's own wishlist items (saved by user)
          const wishlistItems = await tx.wishlist.deleteMany({ where: { userId: targetId } }).then((r) => r.count)
          // Delete reports filed by user
          const reportsFiled = await tx.report.deleteMany({ where: { reporterId: targetId } }).then((r) => r.count)
          // Delete admin sessions
          const adminSessions = await tx.adminSession.deleteMany({ where: { userId: targetId } }).then((r) => r.count)
          // Delete regular user sessions (was MISSING in previous implementation)
          const userSessions = await tx.userSession.deleteMany({ where: { userId: targetId } }).then((r) => r.count)
          // Delete payments
          const payments = await tx.payment.deleteMany({ where: { userId: targetId } }).then((r) => r.count)
          // Delete audit logs that TARGET this user (preserve actor logs for historical trail)
          const targetAuditLogs = await tx.auditLog.deleteMany({ where: { targetId, targetType: 'user' } }).then((r) => r.count)

          // Finally delete the user
          await tx.user.delete({ where: { id: targetId } })

          return {
            uploads: 0, // currently no separate uploads table; uploads are tracked as Listing rows with uploadType
            books: listingIds.length, // listings = books/uploads in this app's domain
            payments,
            listings: listingIds.length,
            reviews: 0, // no separate reviews table in current schema
            sales: targetUser.totalSales || 0, // historical sales counter from user record
            wishlistItems,
            reportsFiled,
            reportsOnListings,
            wishlistsOnListings,
            adminSessions,
            userSessions,
            targetAuditLogs,
          }
        })

        // Record audit log AFTER successful deletion (actor = admin, target = deleted user id)
        // We use a separate db call (outside the transaction) so the audit row commits even
        // if the audit insert itself fails.
        try {
          await db.auditLog.create({
            data: {
              actorId: admin.userId,
              action: 'delete_user',
              targetType: 'user',
              targetId,
              ipAddress: ip,
              details: JSON.stringify({
                name: targetUser.name,
                email: targetUser.email,
                isAdmin: targetUser.isAdmin,
                adminRole: targetUser.adminRole,
                affectedRecords:
                  breakdown.listings +
                  breakdown.payments +
                  breakdown.wishlistItems +
                  breakdown.reportsFiled +
                  breakdown.reportsOnListings +
                  breakdown.wishlistsOnListings +
                  breakdown.adminSessions +
                  breakdown.userSessions +
                  breakdown.targetAuditLogs,
                breakdown,
              }),
            },
          })
        } catch {
          // Audit log failure is non-fatal — the deletion already succeeded
        }

        const affectedRecords =
          breakdown.listings +
          breakdown.payments +
          breakdown.wishlistItems +
          breakdown.reportsFiled +
          breakdown.reportsOnListings +
          breakdown.wishlistsOnListings +
          breakdown.adminSessions +
          breakdown.userSessions +
          breakdown.targetAuditLogs

        return NextResponse.json({
          success: true,
          deletedUserId: targetId,
          affectedRecords,
          breakdown: {
            uploads: breakdown.uploads,
            books: breakdown.books,
            payments: breakdown.payments,
            listings: breakdown.listings,
            reviews: breakdown.reviews,
            sales: breakdown.sales,
          },
        })
      }
      case 'delete_user_listings': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const userForListings = await db.user.findUnique({ where: { id: targetId } })
        if (!userForListings) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        const userListingIds = await db.listing.findMany({ where: { sellerId: targetId }, select: { id: true } })
        const ids = userListingIds.map(l => l.id)
        if (ids.length > 0) {
          await db.wishlist.deleteMany({ where: { listingId: { in: ids } } })
          await db.report.deleteMany({ where: { listingId: { in: ids } } })
          await db.listing.deleteMany({ where: { id: { in: ids } } })
        }
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'delete_user_listings', targetType: 'user', targetId, ipAddress: ip, details: JSON.stringify({ count: ids.length }) } })
        return NextResponse.json({ success: true })
      }
      case 'resolve_report': {
        if (!hasPermission(admin.role as AdminRole, 'manage_reports')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.report.update({ where: { id: targetId }, data: { isResolved: true } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'resolve_report', targetType: 'report', targetId, ipAddress: ip } })
        return NextResponse.json({ success: true })
      }
      case 'approve_payment': {
        if (!hasPermission(admin.role as AdminRole, 'manage_payments')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const payment = await db.payment.findUnique({ where: { id: targetId } })
        if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
        if (payment.status === 'verified') return NextResponse.json({ error: 'Already verified' }, { status: 400 })
        
        await db.payment.update({ where: { id: targetId }, data: { status: 'verified', verifiedAt: new Date() } })
        
        if (payment.paymentType === 'premium_plan') {
          const premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          await db.user.update({
            where: { id: payment.userId },
            data: {
              planType: 'premium',
              premiumActive: true,
              premiumBookLimit: 29,
              premiumBooksUsed: 0,
              premiumExpiryDate: premiumExpiry,
              premiumPurchaseDate: new Date(),
            }
          })
          await db.auditLog.create({ data: { actorId: admin.userId, action: 'approve_premium', targetType: 'payment', targetId, ipAddress: ip, details: JSON.stringify({ amount: payment.amount, userId: payment.userId, plan: 'premium' }) } })
        } else {
          await db.user.update({ where: { id: payment.userId }, data: { paidUploadCredits: { increment: payment.uploadCredit } } })
          await db.auditLog.create({ data: { actorId: admin.userId, action: 'approve_payment', targetType: 'payment', targetId, ipAddress: ip, details: JSON.stringify({ amount: payment.amount, userId: payment.userId, credits: payment.uploadCredit }) } })
        }
        return NextResponse.json({ success: true })
      }
      case 'reject_payment': {
        if (!hasPermission(admin.role as AdminRole, 'manage_payments')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        await db.payment.update({ where: { id: targetId }, data: { status: 'rejected' } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'reject_payment', targetType: 'payment', targetId, ipAddress: ip, details: details || null } })
        return NextResponse.json({ success: true })
      }
      case 'grant_credits': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const credits = Number(details?.credits) || 1
        await db.user.update({ where: { id: targetId }, data: { paidUploadCredits: { increment: credits } } })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'grant_credits', targetType: 'user', targetId, ipAddress: ip, details: JSON.stringify({ credits }) } })
        return NextResponse.json({ success: true })
      }
      case 'toggle_premium': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const targetUser = await db.user.findUnique({ where: { id: targetId } })
        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        const newPremium = !targetUser.premiumActive
        const premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await db.user.update({
          where: { id: targetId },
          data: {
            planType: newPremium ? 'premium' : 'normal',
            premiumActive: newPremium,
            premiumBookLimit: newPremium ? 29 : targetUser.premiumBookLimit,
            premiumExpiryDate: newPremium ? premiumExpiry : null,
            premiumPurchaseDate: newPremium ? new Date() : targetUser.premiumPurchaseDate,
          }
        })
        await db.auditLog.create({ data: { actorId: admin.userId, action: newPremium ? 'activate_premium' : 'deactivate_premium', targetType: 'user', targetId, ipAddress: ip, details: JSON.stringify({ name: targetUser.name, email: targetUser.email }) } })
        return NextResponse.json({ success: true, premiumActive: newPremium })
      }
      case 'update_upi': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const newUpiId = details?.upiId
        if (!newUpiId || typeof newUpiId !== 'string') return NextResponse.json({ error: 'UPI ID is required' }, { status: 400 })
        await db.siteConfig.upsert({
          where: { id: 'default' },
          update: { upiId: newUpiId },
          create: { id: 'default', upiId: newUpiId, upiName: 'EduCampusHub' }
        })
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'update_upi', targetType: 'config', targetId: 'default', ipAddress: ip, details: JSON.stringify({ upiId: newUpiId }) } })
        return NextResponse.json({ success: true, upiId: newUpiId })
      }
      case 'revenue_analytics': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const [totalRevenue, uploadFeeRevenue, premiumRevenue, premiumUsers, pendingPayments] = await Promise.all([
          db.payment.aggregate({ _sum: { amount: true }, where: { status: 'verified' } }),
          db.payment.aggregate({ _sum: { amount: true }, where: { status: 'verified', paymentType: 'upload_fee' } }),
          db.payment.aggregate({ _sum: { amount: true }, where: { status: 'verified', paymentType: 'premium_plan' } }),
          db.user.count({ where: { premiumActive: true } }),
          db.payment.count({ where: { status: { in: ['pending', 'pending_verification'] } } }),
        ])
        return NextResponse.json({
          totalRevenue: totalRevenue._sum.amount || 0,
          uploadFeeRevenue: uploadFeeRevenue._sum.amount || 0,
          premiumRevenue: premiumRevenue._sum.amount || 0,
          premiumUsers,
          pendingPayments,
        })
      }

      // ═══════════════════════════════════════════════════════════
      // SUPER ADMIN: Admin Account Management
      // ═══════════════════════════════════════════════════════════

      case 'create_admin': {
        if (!canManageAdmins(admin.role as AdminRole, admin.isSuperAdmin)) {
          return NextResponse.json({ error: 'Only Super Admin can create admin accounts' }, { status: 403 })
        }
        const { name, email, phone, password, role: newRole } = updates || {}
        if (!name || !email || !password) {
          return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
        }
        // Check if email already exists
        const existingUser = await db.user.findUnique({ where: { email } })
        if (existingUser) {
          return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
        }
        // Validate password strength
        const { validatePasswordStrength } = await import('@/lib/admin-auth')
        const validation = validatePasswordStrength(password)
        if (!validation.valid) {
          return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 })
        }
        // Only super_admin role is allowed, or moderator/support_admin
        const validRoles = ['super_admin', 'moderator', 'support_admin']
        const assignedRole = validRoles.includes(newRole) ? newRole : 'support_admin'
        // Don't allow creating another Super Admin with isSuperAdmin flag
        const newHash = await hashPassword(password)
        const newUser = await db.user.create({
          data: {
            email,
            name,
            phone: phone || null,
            isAdmin: true,
            adminRole: assignedRole,
            isSuperAdmin: false, // Only the seed can set isSuperAdmin
            twoFactorEnabled: assignedRole === 'super_admin',
            passwordHash: newHash,
            mustChangePassword: true,
            isVerified: true,
          }
        })
        await db.auditLog.create({
          data: {
            actorId: admin.userId,
            action: 'create_admin',
            targetType: 'user',
            targetId: newUser.id,
            ipAddress: ip,
            details: JSON.stringify({ name, email, role: assignedRole }),
          }
        })
        return NextResponse.json({ success: true, admin: { id: newUser.id, name, email, role: assignedRole } })
      }

      case 'update_admin_role': {
        if (!canManageAdmins(admin.role as AdminRole, admin.isSuperAdmin)) {
          return NextResponse.json({ error: 'Only Super Admin can modify admin roles' }, { status: 403 })
        }
        const targetAdmin = await db.user.findUnique({ where: { id: targetId } })
        if (!targetAdmin || !targetAdmin.isAdmin) {
          return NextResponse.json({ error: 'Admin account not found' }, { status: 404 })
        }
        // Cannot modify Super Admin's role
        if (targetAdmin.isSuperAdmin) {
          return NextResponse.json({ error: 'Super Admin role cannot be changed' }, { status: 403 })
        }
        // Cannot modify own role
        if (targetAdmin.id === admin.userId) {
          return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 })
        }
        const validRoles = ['super_admin', 'moderator', 'support_admin']
        const newRole = updates?.role
        if (!validRoles.includes(newRole)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }
        await db.user.update({
          where: { id: targetId },
          data: {
            adminRole: newRole,
            twoFactorEnabled: newRole === 'super_admin' ? true : targetAdmin.twoFactorEnabled,
          }
        })
        await db.auditLog.create({
          data: {
            actorId: admin.userId,
            action: 'update_admin_role',
            targetType: 'user',
            targetId,
            ipAddress: ip,
            details: JSON.stringify({ oldRole: targetAdmin.adminRole, newRole }),
          }
        })
        return NextResponse.json({ success: true })
      }

      case 'remove_admin': {
        if (!canManageAdmins(admin.role as AdminRole, admin.isSuperAdmin)) {
          return NextResponse.json({ error: 'Only Super Admin can remove admin accounts' }, { status: 403 })
        }
        const removeTarget = await db.user.findUnique({ where: { id: targetId } })
        if (!removeTarget || !removeTarget.isAdmin) {
          return NextResponse.json({ error: 'Admin account not found' }, { status: 404 })
        }
        // Cannot remove Super Admin
        if (removeTarget.isSuperAdmin) {
          return NextResponse.json({ error: 'Super Admin account cannot be removed' }, { status: 403 })
        }
        // Cannot remove yourself
        if (removeTarget.id === admin.userId) {
          return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 403 })
        }
        // Demote to regular user
        await db.user.update({
          where: { id: targetId },
          data: {
            isAdmin: false,
            adminRole: null,
            twoFactorEnabled: false,
            isSuperAdmin: false,
          }
        })
        // Revoke all admin sessions
        await db.adminSession.updateMany({
          where: { userId: targetId, isRevoked: false },
          data: { isRevoked: true },
        })
        await db.auditLog.create({
          data: {
            actorId: admin.userId,
            action: 'remove_admin',
            targetType: 'user',
            targetId,
            ipAddress: ip,
            details: JSON.stringify({ name: removeTarget.name, email: removeTarget.email, previousRole: removeTarget.adminRole }),
          }
        })
        return NextResponse.json({ success: true })
      }

      case 'reset_admin_password': {
        if (!canManageAdmins(admin.role as AdminRole, admin.isSuperAdmin)) {
          return NextResponse.json({ error: 'Only Super Admin can reset admin passwords' }, { status: 403 })
        }
        const resetTarget = await db.user.findUnique({ where: { id: targetId } })
        if (!resetTarget || !resetTarget.isAdmin) {
          return NextResponse.json({ error: 'Admin account not found' }, { status: 404 })
        }
        // Cannot reset Super Admin password this way
        if (resetTarget.isSuperAdmin) {
          return NextResponse.json({ error: 'Super Admin password must be reset via Forgot Password flow' }, { status: 403 })
        }
        const newPassword = updates?.password
        if (!newPassword) {
          return NextResponse.json({ error: 'New password is required' }, { status: 400 })
        }
        const { validatePasswordStrength } = await import('@/lib/admin-auth')
        const validation = validatePasswordStrength(newPassword)
        if (!validation.valid) {
          return NextResponse.json({ error: validation.errors.join('. ') }, { status: 400 })
        }
        const newHash = await hashPassword(newPassword)
        await db.user.update({
          where: { id: targetId },
          data: {
            passwordHash: newHash,
            mustChangePassword: true,
          }
        })
        // Revoke all sessions to force re-login
        await db.adminSession.updateMany({
          where: { userId: targetId, isRevoked: false },
          data: { isRevoked: true },
        })
        await db.auditLog.create({
          data: {
            actorId: admin.userId,
            action: 'reset_admin_password',
            targetType: 'user',
            targetId,
            ipAddress: ip,
            details: JSON.stringify({ name: resetTarget.name, email: resetTarget.email }),
          }
        })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}

// DELETE - Logout
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('cnx_admin_session')?.value
    if (token) {
      await revokeAdminSession(token)
    }
  } catch {
    // ignore errors during logout
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('cnx_admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
