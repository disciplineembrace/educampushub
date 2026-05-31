import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminFromCookies, hasPermission, revokeAdminSession, type AdminRole } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

// Verify admin for every request
async function verifyAdmin(request: Request) {
  const admin = await getAdminFromCookies()
  if (!admin) return null

  const user = await db.user.findUnique({ where: { id: admin.userId } })
  if (!user || !user.isAdmin || user.isBanned) return null

  return { ...admin, user }
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
    const users = await db.user.findMany({ include: { _count: { select: { listings: true } } }, orderBy: { createdAt: 'desc' } })
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
    const logs = await db.auditLog.findMany({ include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })
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
        const allowedUserFields = ['name', 'email', 'college', 'city', 'isVerified', 'phone']
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
      case 'delete_user': {
        if (!hasPermission(admin.role as AdminRole, 'all')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const targetUser = await db.user.findUnique({ where: { id: targetId } })
        if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        if (targetUser.isAdmin) return NextResponse.json({ error: 'Cannot delete admin accounts' }, { status: 403 })
        // Create audit log BEFORE deleting the user (since audit log references the user as actor)
        await db.auditLog.create({ data: { actorId: admin.userId, action: 'delete_user', targetType: 'user', targetId, ipAddress: ip, details: JSON.stringify({ name: targetUser.name, email: targetUser.email }) } })
        // Delete user's listings and their related data
        const userListings = await db.listing.findMany({ where: { sellerId: targetId }, select: { id: true } })
        const listingIds = userListings.map(l => l.id)
        if (listingIds.length > 0) {
          await db.wishlist.deleteMany({ where: { listingId: { in: listingIds } } })
          await db.report.deleteMany({ where: { listingId: { in: listingIds } } })
          await db.listing.deleteMany({ where: { id: { in: listingIds } } })
        }
        // Delete other user data
        await db.wishlist.deleteMany({ where: { userId: targetId } })
        await db.report.deleteMany({ where: { reporterId: targetId } })
        await db.adminSession.deleteMany({ where: { userId: targetId } })
        await db.payment.deleteMany({ where: { userId: targetId } })
        // Delete audit logs that reference this user as target (not as actor)
        await db.auditLog.deleteMany({ where: { targetId, targetType: 'user' } })
        // Finally delete the user
        await db.user.delete({ where: { id: targetId } })
        return NextResponse.json({ success: true })
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
        
        // Update payment status
        await db.payment.update({ where: { id: targetId }, data: { status: 'verified', verifiedAt: new Date() } })
        
        // Handle based on payment type
        if (payment.paymentType === 'premium_plan') {
          // Activate premium plan
          const premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
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
          // Regular upload credit
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
    sameSite: 'strict',
    path: '/cnx-admin-panel',
    maxAge: 0,
  })
  return response
}
