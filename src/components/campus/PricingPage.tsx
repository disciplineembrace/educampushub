'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Crown, Zap, ArrowLeft, CreditCard, BookOpen, Star, Shield, Clock } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import PaymentModal from '@/components/campus/PaymentModal'

export default function PricingPage() {
  const { currentUser, setCurrentPage } = useAppStore()
  const { t } = useTranslation()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentType, setPaymentType] = useState<'upload_fee' | 'premium_plan'>('premium_plan')
  const [uploadCredits, setUploadCredits] = useState<{
    freeRemaining: number
    paidUploadCredits: number
    totalCredits: number
    canUpload: boolean
    freeUploadLimit: number
    premiumActive: boolean
    premiumBooksUsed: number
    premiumBookLimit: number
    premiumRemaining: number
    planType: string
  } | null>(null)

  useEffect(() => {
    if (!currentUser) return
    const fetchCredits = async () => {
      try {
        const res = await fetch(`/api/payment?userId=${currentUser.id}`)
        if (res.ok) {
          const data = await res.json()
          setUploadCredits(data)
        }
      } catch {
        // ignore
      }
    }
    fetchCredits()
  }, [currentUser])

  const handleUpgradePremium = () => {
    if (!currentUser) {
      setCurrentPage('login')
      return
    }
    setPaymentType('premium_plan')
    setShowPaymentModal(true)
  }

  const handleBuyCredits = () => {
    if (!currentUser) {
      setCurrentPage('login')
      return
    }
    setPaymentType('upload_fee')
    setShowPaymentModal(true)
  }

  const refreshCredits = async () => {
    if (!currentUser) return
    try {
      const res = await fetch(`/api/payment?userId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setUploadCredits(data)
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="pt-20 pb-16 min-h-screen">
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
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium mb-4">
            <Crown className="w-4 h-4" /> Choose Your Plan
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 font-heading">
            Sell More, <span className="gradient-text">Earn More</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Start selling your books for free. Upgrade to Premium for maximum visibility and unlimited uploads.
          </p>
        </motion.div>

        {/* Current Status Banner */}
        {currentUser && uploadCredits && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className={`p-4 rounded-2xl border-2 ${
              uploadCredits.premiumActive
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700'
                : 'bg-brand/5 border-brand/20'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    uploadCredits.premiumActive
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
                      : 'bg-brand/10 text-brand'
                  }`}>
                    {uploadCredits.premiumActive ? <Crown className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {uploadCredits.premiumActive ? 'Premium Seller' : 'Normal Plan'} — Account Status
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uploadCredits.premiumActive
                        ? `${uploadCredits.premiumRemaining} premium uploads remaining (${uploadCredits.premiumBooksUsed}/${uploadCredits.premiumBookLimit} used)`
                        : `${uploadCredits.freeRemaining} free uploads · ${uploadCredits.paidUploadCredits} paid credits`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Normal Plan Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative"
          >
            <div className="h-full rounded-3xl border-2 border-border bg-card p-6 sm:p-8 flex flex-col">
              {/* Plan header */}
              <div className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-brand" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">Normal Plan</h2>
                <p className="text-sm text-muted-foreground">Perfect for casual sellers</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground font-heading">Free</span>
                  <span className="text-sm text-muted-foreground">to start</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Then ₹10 per upload after 5 free</p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-8 flex-1">
                {[
                  { text: 'First 5 Uploads Free', highlight: true },
                  { text: '₹10 Per Upload After That' },
                  { text: 'Standard Listing Visibility' },
                  { text: 'WhatsApp Chat with Buyers' },
                  { text: 'Basic Search Results' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      feature.highlight ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'
                    }`}>
                      <Check className={`w-3 h-3 ${feature.highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                    </div>
                    <span className={`text-sm ${feature.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Button
                onClick={handleBuyCredits}
                variant="outline"
                className="w-full h-12 rounded-xl text-base font-semibold"
              >
                <CreditCard className="w-4 h-4 mr-2" /> Buy Upload Credits
              </Button>
            </div>
          </motion.div>

          {/* Premium Plan Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="relative"
          >
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <Badge className="bg-amber-500 text-white border-0 px-4 py-1 rounded-full text-xs font-bold shadow-lg shadow-amber-500/30">
                <Star className="w-3 h-3 mr-1" /> Most Popular
              </Badge>
            </div>

            <div className="h-full rounded-3xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-b from-amber-50/50 to-card dark:from-amber-950/20 p-6 sm:p-8 flex flex-col shadow-lg shadow-amber-500/5 ring-1 ring-amber-400/20">
              {/* Plan header */}
              <div className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                  <Crown className="w-6 h-6 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">Premium Plan</h2>
                <p className="text-sm text-muted-foreground">For serious sellers who want more</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-amber-600 dark:text-amber-400 font-heading">₹149</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Upload up to 29 books</p>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-8 flex-1">
                {[
                  { text: 'Upload 29 Books', highlight: true },
                  { text: 'Premium Badge on Profile', highlight: true },
                  { text: 'Search Priority', highlight: true },
                  { text: 'Featured Seller Section', highlight: true },
                  { text: 'More Visibility', highlight: true },
                  { text: 'Gold Border on Listings' },
                  { text: 'Premium Dashboard' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      feature.highlight ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-amber-50 dark:bg-amber-900/20'
                    }`}>
                      <Check className={`w-3 h-3 ${feature.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500'}`} />
                    </div>
                    <span className={`text-sm ${feature.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {uploadCredits?.premiumActive ? (
                <div className="w-full h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                  <Crown className="w-4 h-4" /> Active Premium Seller
                </div>
              ) : (
                <Button
                  onClick={handleUpgradePremium}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-lg shadow-amber-500/30"
                >
                  <Crown className="w-4 h-4 mr-2" /> Upgrade to Premium
                </Button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Comparison Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-16"
        >
          <h2 className="text-2xl font-bold text-foreground text-center mb-8 font-heading">
            Why Go <span className="gradient-text">Premium</span>?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              {
                icon: BookOpen,
                title: '29 Book Uploads',
                description: 'List up to 29 books in a single month, compared to just 5 free uploads on the normal plan. Perfect for students with large collections.',
                color: 'from-brand to-accent',
              },
              {
                icon: Shield,
                title: 'Priority Visibility',
                description: 'Your listings appear above normal listings in search results. Premium books get a gold border and a Crown badge, attracting more buyers instantly.',
                color: 'from-amber-500 to-orange-500',
              },
              {
                icon: Clock,
                title: 'Featured Seller',
                description: 'Get showcased in the Featured Seller carousel on the homepage. This prime placement gives your listings significantly more visibility and buyer engagement.',
                color: 'from-emerald-500 to-green-500',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="text-center p-6 rounded-2xl card-premium"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-4`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <h2 className="text-2xl font-bold text-foreground text-center mb-8 font-heading">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'How does the payment work?',
                a: 'You pay via UPI (GPay, PhonePe, Paytm, etc.). After payment, upload a screenshot as proof. Our admin will verify it within 24 hours and activate your plan.',
              },
              {
                q: 'What happens after my 5 free uploads?',
                a: 'After using your 5 free uploads, you can buy individual upload credits for ₹10 each, or upgrade to the Premium plan for ₹149 and get 29 uploads.',
              },
              {
                q: 'How long does the Premium plan last?',
                a: 'The Premium plan is valid for 30 days from the date of activation. You can upload up to 29 books during this period.',
              },
              {
                q: 'Can I get a refund?',
                a: 'Since this is a digital service with immediate access, refunds are not available. However, if you face any issues, please contact our support team.',
              },
            ].map((faq, i) => (
              <div key={i} className="p-5 rounded-2xl card-premium">
                <h4 className="font-semibold text-foreground mb-2">{faq.q}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Payment Modal */}
      {currentUser && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); refreshCredits() }}
          userId={currentUser.id}
          onPaymentSuccess={refreshCredits}
          paymentType={paymentType}
        />
      )}
    </div>
  )
}
