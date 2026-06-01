'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Crown, BookOpen, Zap, CreditCard, ArrowLeft, Clock, BarChart3, TrendingUp, Eye, Heart } from 'lucide-react'
import { useAppStore, formatINR } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import PaymentModal from '@/components/campus/PaymentModal'

interface DashboardData {
  freeUploadUsed: number
  freeUploadLimit: number
  freeRemaining: number
  paidUploadCredits: number
  totalBooksUploaded: number
  totalCredits: number
  canUpload: boolean
  planType: string
  premiumActive: boolean
  premiumBooksUsed: number
  premiumBookLimit: number
  premiumRemaining: number
  premiumExpiryDate: string | null
  premiumPurchaseDate: string | null
  premiumPlanPrice: number
  pricePerUpload: number
}

interface MyListing {
  id: string
  title: string
  sellingPrice: number
  views: number
  saves: number
  uploadType: string
  isFeatured: boolean
  isSold: boolean
  createdAt: string
}

export default function PremiumDashboard() {
  const { currentUser, setCurrentPage, setSelectedProductId } = useAppStore()
  const { t } = useTranslation()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [myListings, setMyListings] = useState<MyListing[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentType, setPaymentType] = useState<'upload_fee' | 'premium_plan'>('premium_plan')

  useEffect(() => {
    if (!currentUser) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const [creditsRes, listingsRes] = await Promise.all([
          fetch(`/api/payment?userId=${currentUser.id}`),
          fetch(`/api/listings?sellerId=${currentUser.id}&limit=50`),
        ])
        if (creditsRes.ok) {
          const data = await creditsRes.json()
          setDashboardData(data)
        }
        if (listingsRes.ok) {
          const data = await listingsRes.json()
          setMyListings(data.listings || [])
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currentUser])

  const refreshData = async () => {
    if (!currentUser) return
    try {
      const res = await fetch(`/api/payment?userId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setDashboardData(data)
      }
    } catch {
      // ignore
    }
  }

  if (!currentUser) {
    return (
      <div className="pt-20 pb-10 min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Login Required</h3>
          <p className="text-muted-foreground mb-6">You need to be logged in to view your dashboard</p>
          <Button onClick={() => setCurrentPage('login')} className="btn-gradient text-white border-0 rounded-xl px-8">
            Login Now
          </Button>
        </div>
      </div>
    )
  }

  const isPremium = dashboardData?.premiumActive
  const premiumPercentage = dashboardData
    ? (dashboardData.premiumBooksUsed / (dashboardData.premiumBookLimit || 29)) * 100
    : 0
  const freePercentage = dashboardData
    ? (dashboardData.freeUploadUsed / (dashboardData.freeUploadLimit || 5)) * 100
    : 0

  // Calculate total views and saves
  const totalViews = myListings.reduce((sum, l) => sum + l.views, 0)
  const totalSaves = myListings.reduce((sum, l) => sum + l.saves, 0)

  // Premium expiry calculation
  const daysRemaining = dashboardData?.premiumExpiryDate
    ? Math.max(0, Math.ceil((new Date(dashboardData.premiumExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="pt-20 pb-10 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <Button variant="ghost" onClick={() => setCurrentPage('home')} className="gap-2 -ml-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-heading">Seller Dashboard</h1>
            {isPremium && (
              <Badge className="bg-amber-500 text-white border-0 text-xs px-3 py-1 rounded-full gap-1">
                <Crown className="w-3 h-3" /> Premium
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {isPremium
              ? `Premium Seller — ${daysRemaining} days remaining`
              : 'Track your uploads, credits, and listing performance'
            }
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="p-4 rounded-2xl border-0 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-brand" />
                    </div>
                    <span className="text-xs text-muted-foreground">Books Listed</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground font-heading">{dashboardData?.totalBooksUploaded || 0}</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="p-4 rounded-2xl border-0 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-emerald-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">Total Views</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground font-heading">{totalViews}</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="p-4 rounded-2xl border-0 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Heart className="w-4 h-4 text-red-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">Total Saves</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground font-heading">{totalSaves}</p>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className={`p-4 rounded-2xl border-0 shadow-md ${isPremium ? 'ring-2 ring-amber-400/50' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isPremium ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
                      {isPremium ? <Crown className="w-4 h-4 text-amber-500" /> : <Zap className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <span className="text-xs text-muted-foreground">{isPremium ? 'Premium' : 'Plan'}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground font-heading">
                    {isPremium ? `${daysRemaining}d left` : dashboardData?.canUpload ? 'Active' : 'No Credits'}
                  </p>
                </Card>
              </motion.div>
            </div>

            {/* Upload Credits Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              {isPremium ? (
                <Card className="p-6 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50/50 to-card dark:from-amber-950/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Crown className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Premium Uploads</h3>
                        <p className="text-xs text-muted-foreground">
                          {dashboardData?.premiumBooksUsed || 0} of {dashboardData?.premiumBookLimit || 29} used
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-heading">
                        {dashboardData?.premiumRemaining || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">remaining</p>
                    </div>
                  </div>
                  <Progress value={premiumPercentage} className="h-2" />
                </Card>
              ) : (
                <Card className="p-6 rounded-2xl border-2 border-brand/20 bg-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-brand" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">Free Uploads</h3>
                        <p className="text-xs text-muted-foreground">
                          {dashboardData?.freeUploadUsed || 0} of {dashboardData?.freeUploadLimit || 5} used
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-brand font-heading">
                        {dashboardData?.freeRemaining || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">free remaining</p>
                    </div>
                  </div>
                  <Progress value={freePercentage} className="h-2" />

                  {dashboardData && dashboardData.paidUploadCredits > 0 && (
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Paid credits</span>
                      <span className="font-medium text-foreground">{dashboardData.paidUploadCredits}</span>
                    </div>
                  )}

                  {!dashboardData?.canUpload && !isPremium && (
                    <div className="mt-4 flex gap-3">
                      <Button
                        onClick={() => { setPaymentType('premium_plan'); setShowPaymentModal(true) }}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-0 rounded-xl gap-2"
                      >
                        <Crown className="w-4 h-4" /> Upgrade Premium
                      </Button>
                      <Button
                        onClick={() => { setPaymentType('upload_fee'); setShowPaymentModal(true) }}
                        variant="outline"
                        className="flex-1 rounded-xl gap-2"
                      >
                        <CreditCard className="w-4 h-4" /> Buy ₹10 Credit
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </motion.div>

            {/* My Listings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground font-heading">My Listings</h2>
                <Button
                  onClick={() => setCurrentPage('sell')}
                  size="sm"
                  className="btn-gradient text-white border-0 rounded-xl gap-1.5"
                >
                  + New Listing
                </Button>
              </div>

              {myListings.length === 0 ? (
                <Card className="p-8 rounded-2xl text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No listings yet. Start selling your books!</p>
                  <Button onClick={() => setCurrentPage('sell')} className="btn-gradient text-white border-0 rounded-xl">
                    List Your First Book
                  </Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {myListings.map((listing, i) => (
                    <motion.div
                      key={listing.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer hover:shadow-md transition-all ${
                        listing.uploadType === 'premium'
                          ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10'
                          : 'border-border bg-card'
                      }`}
                      onClick={() => { setSelectedProductId(listing.id); setCurrentPage('product') }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        listing.uploadType === 'premium' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-brand/10'
                      }`}>
                        {listing.uploadType === 'premium' ? (
                          <Crown className="w-5 h-5 text-amber-500" />
                        ) : (
                          <BookOpen className="w-5 h-5 text-brand" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{listing.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {listing.views}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {listing.saves}
                          </span>
                          {listing.isFeatured && (
                            <Badge className="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px] px-1.5 py-0 rounded-full">
                              Featured
                            </Badge>
                          )}
                          {listing.isSold && (
                            <Badge className="bg-muted text-muted-foreground border-0 text-[10px] px-1.5 py-0 rounded-full">
                              Sold
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-brand">{formatINR(listing.sellingPrice)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(listing.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Upgrade CTA for non-premium */}
            {!isPremium && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <Card className="p-6 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 text-center">
                  <Crown className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground mb-2">Upgrade to Premium</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    Get 29 book uploads, premium badge, search priority, and featured seller placement — all for just ₹149/month
                  </p>
                  <Button
                    onClick={() => { setPaymentType('premium_plan'); setShowPaymentModal(true) }}
                    className="bg-amber-500 hover:bg-amber-600 text-white border-0 rounded-xl h-11 px-8 font-semibold shadow-lg shadow-amber-500/30"
                  >
                    <Crown className="w-4 h-4 mr-2" /> Upgrade Now — ₹149
                  </Button>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Payment Modal */}
      {currentUser && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); refreshData() }}
          userId={currentUser.id}
          onPaymentSuccess={refreshData}
          paymentType={paymentType}
        />
      )}
    </div>
  )
}
