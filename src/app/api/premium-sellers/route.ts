import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET: Fetch premium sellers for featured section
export async function GET() {
  try {
    const sellers = await db.user.findMany({
      where: {
        premiumActive: true,
        isBanned: false,
      },
      select: {
        id: true,
        name: true,
        college: true,
        avatar: true,
        premiumActive: true,
        totalBooksUploaded: true,
        rating: true,
      },
      orderBy: [
        { rating: 'desc' },
        { totalBooksUploaded: 'desc' },
      ],
      take: 20,
    })

    return NextResponse.json({ sellers })
  } catch (error) {
    console.error('Premium sellers fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch premium sellers' }, { status: 500 })
  }
}
