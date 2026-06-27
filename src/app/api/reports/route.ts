import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAdminFromCookies } from '@/lib/admin-auth'
import { checkApiRateLimit, sanitizeString } from '@/lib/api-security'

export async function GET() {
  try {
    // Only admins can read reports
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reports = await db.report.findMany({
      include: {
        listing: { select: { id: true, title: true } },
        reporter: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Reports GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkApiRateLimit(request)
    if (rateLimit && !rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    // Anyone can create a report (for reporting listings)
    const { listingId, reporterId, reason } = await request.json()
    if (!listingId || !reporterId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    // Sanitize reason
    const sanitizedReason = sanitizeString(reason, 500)

    // ⚠️ Validate that listingId and reporterId reference real rows BEFORE
    // attempting to create — otherwise Prisma throws a FK violation that
    // surfaces as a 500 "Failed to create report" (looks like a server bug
    // and leaks info via the error message).
    const [listingExists, reporterExists] = await Promise.all([
      db.listing.findUnique({ where: { id: listingId }, select: { id: true } }),
      db.user.findUnique({ where: { id: reporterId }, select: { id: true } }),
    ])
    if (!listingExists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    if (!reporterExists) {
      return NextResponse.json({ error: 'Reporter account not found' }, { status: 404 })
    }

    const report = await db.report.create({ data: { listingId, reporterId, reason: sanitizedReason } })
    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error('Reports POST error:', error)
    // Distinguish Prisma FK violations from genuine server errors
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003') {
      return NextResponse.json({ error: 'Referenced listing or reporter does not exist' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    // Only admins can update/resolve reports
    const admin = await getAdminFromCookies()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, isResolved } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }
    const report = await db.report.update({ where: { id }, data: { isResolved } })
    return NextResponse.json({ report })
  } catch (error) {
    console.error('Reports PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }
}
