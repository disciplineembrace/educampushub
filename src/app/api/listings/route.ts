import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { checkApiRateLimit, isValidIndianMobile, isValidPrice, sanitizeString } from '@/lib/api-security'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const listing = await db.listing.findUnique({
        where: { id },
        include: { seller: true }
      })
      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      }
      await db.listing.update({ where: { id }, data: { views: { increment: 1 } } })
      return NextResponse.json({ listing: { ...listing, views: listing.views + 1 } })
    }

    const category = searchParams.get('category')
    const city = searchParams.get('city')
    const course = searchParams.get('course')
    const semester = searchParams.get('semester')
    const search = searchParams.get('search')
    const condition = searchParams.get('condition')
    const sortBy = searchParams.get('sortBy') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const featured = searchParams.get('featured')
    const listingType = searchParams.get('listingType')
    const board = searchParams.get('board')
    const standard = searchParams.get('standard')
    const isDigital = searchParams.get('isDigital')
    const sellerId = searchParams.get('sellerId')
    const state = searchParams.get('state')
    const district = searchParams.get('district')

    const where: Record<string, unknown> = { isSold: false }

    if (category && category !== 'all') where.category = category
    if (city && city !== 'all') where.city = city
    if (course) where.course = { contains: course }
    if (semester && semester !== 'all') where.semester = semester
    if (condition) where.condition = condition
    if (featured === 'true') where.isFeatured = true
    if (listingType && listingType !== 'all') where.listingType = listingType
    if (board && board !== 'all') where.board = board
    if (standard && standard !== 'all') where.standard = standard
    if (isDigital === 'true') where.isDigital = true
    if (sellerId) where.sellerId = sellerId
    if (state) where.state = state
    if (district) where.district = district
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { course: { contains: search } },
        { college: { contains: search } },
        { subcategory: { contains: search } },
      ]
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' }
    if (sortBy === 'price-low') orderBy = { sellingPrice: 'asc' }
    else if (sortBy === 'price-high') orderBy = { sellingPrice: 'desc' }
    else if (sortBy === 'popular') orderBy = { views: 'desc' }

    const [listings, total] = await Promise.all([
      db.listing.findMany({
        where,
        include: { seller: { select: { id: true, name: true, college: true, city: true, isVerified: true, rating: true, avatar: true } } },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.listing.count({ where })
    ])

    return NextResponse.json({ listings, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Listings GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const rateLimit = checkApiRateLimit(request)
    if (rateLimit && !rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const { title, description, originalPrice, sellingPrice, category, subcategory, listingType, course, semester, standard, board, college, state, district, city, condition, whatsappNumber, sellerId, isDigital, fileUrl, images } = body

    // Validate required fields
    if (!title || !description || !category || !condition || !whatsappNumber || !sellerId) {
      return NextResponse.json({ error: 'Missing required fields: title, description, category, condition, whatsappNumber, sellerId are required' }, { status: 400 })
    }

    if (!state && !city) {
      return NextResponse.json({ error: 'State and district (or city) are required' }, { status: 400 })
    }

    // Validate selling price
    if (!sellingPrice || sellingPrice <= 0) {
      return NextResponse.json({ error: 'Selling price must be greater than 0' }, { status: 400 })
    }

    // Validate whatsapp number (Indian 10-digit)
    if (!/^\d{10}$/.test(whatsappNumber.replace(/\s/g, ''))) {
      return NextResponse.json({ error: 'Invalid WhatsApp number format' }, { status: 400 })
    }

    // Parse and validate images
    let imagesJson = '[]'
    if (images) {
      try {
        const parsed = typeof images === 'string' ? JSON.parse(images) : images
        if (Array.isArray(parsed)) {
          // Validate each URL is a safe path
          const safeUrls = parsed.filter((url: string) => {
            if (typeof url !== 'string') return false
            // Allow relative paths from upload directory or blob URLs (for local fallback)
            if (url.startsWith('blob:')) return true
            return url.startsWith('/uploads/') && !url.includes('..')
          })
          imagesJson = JSON.stringify(safeUrls)
        }
      } catch {
        imagesJson = '[]'
      }
    }

    // Rate limiting: Check if seller has created too many listings recently
    const recentListings = await db.listing.count({
      where: {
        sellerId,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      }
    })
    if (recentListings >= 5) {
      return NextResponse.json({ error: 'Too many listings created recently. Please wait a few minutes.' }, { status: 429 })
    }

    // Check upload credits
    const FREE_UPLOAD_LIMIT = 5
    const user = await db.user.findUnique({ where: { id: sellerId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const freeRemaining = Math.max(0, FREE_UPLOAD_LIMIT - user.freeUploadUsed)
    const totalCredits = freeRemaining + user.paidUploadCredits

    if (totalCredits <= 0) {
      return NextResponse.json({ 
        error: 'Upload limit reached. Please purchase upload credits to continue.', 
        code: 'UPLOAD_LIMIT_REACHED',
        freeUploadUsed: user.freeUploadUsed,
        freeUploadLimit: FREE_UPLOAD_LIMIT,
        paidUploadCredits: user.paidUploadCredits,
      }, { status: 403 })
    }

    // Use a transaction to create listing and decrement credits atomically
    const listing = await db.$transaction(async (tx) => {
      const newListing = await tx.listing.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          originalPrice: originalPrice || 0,
          sellingPrice: sellingPrice || 0,
          category,
          subcategory: subcategory || null,
          listingType: listingType || 'sell',
          course: course || null,
          semester: semester || null,
          standard: standard || null,
          board: board || null,
          college: college || null,
          state: state || '',
          district: district || '',
          city: city || district || '',
          condition,
          whatsappNumber: whatsappNumber.replace(/\s/g, ''),
          sellerId,
          images: imagesJson,
          isDigital: isDigital || false,
          fileUrl: fileUrl || null,
        },
        include: { seller: true }
      })

      // Deduct upload credit and update counters atomically
      if (user.freeUploadUsed < FREE_UPLOAD_LIMIT) {
        await tx.user.update({ 
          where: { id: sellerId }, 
          data: { 
            freeUploadUsed: { increment: 1 },
            totalBooksUploaded: { increment: 1 },
          } 
        })
      } else {
        await tx.user.update({ 
          where: { id: sellerId }, 
          data: { 
            paidUploadCredits: { decrement: 1 },
            totalBooksUploaded: { increment: 1 },
          } 
        })
      }

      return newListing
    })

    return NextResponse.json({ listing }, { status: 201 })
  } catch (error) {
    console.error('Listings POST error:', error)
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, sellerId, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
    }

    // Verify the listing exists
    const existingListing = await db.listing.findUnique({ where: { id } })
    if (!existingListing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Ownership check: sellerId must match the listing's sellerId
    // If no sellerId provided, deny access
    if (!sellerId) {
      return NextResponse.json({ error: 'Authentication required. Please provide sellerId.' }, { status: 401 })
    }

    if (existingListing.sellerId !== sellerId) {
      return NextResponse.json({ error: 'You can only edit your own listings.' }, { status: 403 })
    }

    // Whitelist allowed update fields for regular users
    const allowedFields = ['title', 'description', 'originalPrice', 'sellingPrice', 'category', 'subcategory', 'listingType', 'course', 'semester', 'standard', 'board', 'college', 'state', 'district', 'city', 'condition', 'whatsappNumber', 'images', 'isSold', 'isDigital', 'fileUrl']
    const sanitizedUpdates: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        sanitizedUpdates[key] = updates[key]
      }
    }

    // Sanitize text fields
    if (sanitizedUpdates.title) sanitizedUpdates.title = String(sanitizedUpdates.title).trim()
    if (sanitizedUpdates.description) sanitizedUpdates.description = String(sanitizedUpdates.description).trim()
    if (sanitizedUpdates.whatsappNumber) {
      const whatsapp = String(sanitizedUpdates.whatsappNumber).replace(/\s/g, '')
      if (!/^\d{10}$/.test(whatsapp)) {
        return NextResponse.json({ error: 'Invalid WhatsApp number format' }, { status: 400 })
      }
      sanitizedUpdates.whatsappNumber = whatsapp
    }

    const listing = await db.listing.update({
      where: { id },
      data: sanitizedUpdates,
    })

    return NextResponse.json({ listing })
  } catch (error) {
    console.error('Listings PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const sellerId = searchParams.get('sellerId')

    if (!id) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
    }

    if (!sellerId) {
      return NextResponse.json({ error: 'Authentication required. Please provide sellerId.' }, { status: 401 })
    }

    // Verify the listing exists and belongs to the user
    const existingListing = await db.listing.findUnique({ where: { id } })
    if (!existingListing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (existingListing.sellerId !== sellerId) {
      return NextResponse.json({ error: 'You can only delete your own listings.' }, { status: 403 })
    }

    await db.wishlist.deleteMany({ where: { listingId: id } })
    await db.report.deleteMany({ where: { listingId: id } })
    await db.listing.delete({ where: { id } })

    return NextResponse.json({ message: 'Listing deleted' })
  } catch (error) {
    console.error('Listings DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 })
  }
}
