import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { checkApiRateLimit } from '@/lib/api-security'

const DEFAULT_UPI_ID = 'sagathiyapradip1137-3@oksbi'
const FREE_UPLOAD_LIMIT = 5
const UPLOAD_FEE = 10
const PREMIUM_PLAN_PRICE = 149
const PREMIUM_BOOK_LIMIT = 29
const PAYMENT_EXPIRY_MINUTES = 5

// Helper: Get UPI ID from SiteConfig or fallback
async function getUpiId(): Promise<string> {
  try {
    const config = await db.siteConfig.findUnique({ where: { id: 'default' } })
    return config?.upiId || DEFAULT_UPI_ID
  } catch {
    return DEFAULT_UPI_ID
  }
}

// GET: Check upload credit status + premium status
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        freeUploadUsed: true,
        paidUploadCredits: true,
        totalBooksUploaded: true,
        planType: true,
        premiumActive: true,
        premiumBooksUsed: true,
        premiumBookLimit: true,
        premiumExpiryDate: true,
        premiumPurchaseDate: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if premium is expired
    let premiumActive = user.premiumActive
    if (premiumActive && user.premiumExpiryDate && new Date(user.premiumExpiryDate) < new Date()) {
      premiumActive = false
      await db.user.update({
        where: { id: userId },
        data: { premiumActive: false, planType: 'normal' }
      })
    }

    const freeRemaining = Math.max(0, FREE_UPLOAD_LIMIT - user.freeUploadUsed)
    const premiumRemaining = premiumActive ? Math.max(0, (user.premiumBookLimit || PREMIUM_BOOK_LIMIT) - (user.premiumBooksUsed || 0)) : 0
    const totalCredits = freeRemaining + user.paidUploadCredits + premiumRemaining
    const canUpload = totalCredits > 0

    return NextResponse.json({
      freeUploadUsed: user.freeUploadUsed,
      freeUploadLimit: FREE_UPLOAD_LIMIT,
      freeRemaining,
      paidUploadCredits: user.paidUploadCredits,
      totalBooksUploaded: user.totalBooksUploaded,
      totalCredits,
      canUpload,
      pricePerUpload: UPLOAD_FEE,
      // Premium fields
      planType: user.planType || 'normal',
      premiumActive,
      premiumBooksUsed: user.premiumBooksUsed || 0,
      premiumBookLimit: user.premiumBookLimit || PREMIUM_BOOK_LIMIT,
      premiumRemaining,
      premiumExpiryDate: user.premiumExpiryDate,
      premiumPurchaseDate: user.premiumPurchaseDate,
      premiumPlanPrice: PREMIUM_PLAN_PRICE,
    })
  } catch (error) {
    console.error('Upload status error:', error)
    return NextResponse.json({ error: 'Failed to fetch upload status' }, { status: 500 })
  }
}

// POST: Create a payment session (upload fee or premium plan)
export async function POST(request: Request) {
  try {
    const rateLimit = checkApiRateLimit(request)
    if (rateLimit && !rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many payment requests. Please try again later.' }, { status: 429 })
    }

    const { userId, paymentType = 'upload_fee' } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Determine payment amount and details
    let amount: number
    let uploadCredit: number
    let txnNote: string

    if (paymentType === 'premium_plan') {
      if (user.premiumActive) {
        return NextResponse.json({ error: 'You already have an active Premium plan' }, { status: 400 })
      }
      amount = PREMIUM_PLAN_PRICE
      uploadCredit = PREMIUM_BOOK_LIMIT
      txnNote = 'EduCampusHub+Premium+Plan'
    } else {
      amount = UPLOAD_FEE
      uploadCredit = 1
      txnNote = 'EduCampusHub+Upload+Credit'
    }

    const upiId = await getUpiId()

    // Check if user already has a pending payment of the same type
    const existingPending = await db.payment.findFirst({
      where: {
        userId,
        paymentType,
        status: 'pending',
        expiresAt: { gt: new Date() },
      }
    })

    if (existingPending) {
      const upiUrl = `upi://pay?pa=${upiId}&pn=EduCampusHub&am=${amount}&cu=INR&tn=${txnNote}`
      const qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 256, margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      })
      return NextResponse.json({
        paymentId: existingPending.id,
        amount: existingPending.amount,
        upiId,
        upiUrl,
        qrCode: qrDataUrl,
        expiresAt: existingPending.expiresAt,
        createdAt: existingPending.createdAt,
        status: existingPending.status,
        paymentType,
      })
    }

    // Create new payment session
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000)

    const payment = await db.payment.create({
      data: {
        userId,
        amount,
        paymentMethod: 'upi_qr',
        paymentType,
        upiId,
        status: 'pending',
        uploadCredit,
        expiresAt,
      }
    })

    const upiUrl = `upi://pay?pa=${upiId}&pn=EduCampusHub&am=${amount}&cu=INR&tn=${txnNote}`
    const qrDataUrl = await QRCode.toDataURL(upiUrl, {
      width: 256, margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })

    return NextResponse.json({
      paymentId: payment.id,
      amount: payment.amount,
      upiId,
      upiUrl,
      qrCode: qrDataUrl,
      expiresAt: payment.expiresAt,
      createdAt: payment.createdAt,
      status: payment.status,
      paymentType,
    })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 })
  }
}
