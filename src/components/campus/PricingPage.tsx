'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Crown,
  ChevronDown,
  Zap,
  Shield,
  BookOpen,
  Star,
  Clock,
  CreditCard,
  Loader2,
} from 'lucide-react'
import { useAppStore, formatINR } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import PremiumPlanModal from './PremiumPlanModal'

interface UploadStatus {
  freeUploadUsed: number
  freeUploadLimit: number
  freeRemaining: number
  paidUploadCredits: number
  totalBooksUploaded: number
  totalCredits: number
  canUpload: boolean
  pricePerUpload: number
  planType: string
  premiumActive: boolean
  premiumBooksUsed: number
  premiumBookLimit: number
  premiumRemaining: number
  premiumExpiryDate: string | null
  premiumPurchaseDate: string | null
  premiumPlanPrice: number
}

interface FAQItem {
  question: string
  answer: string
}

const FAQ_DATA: FAQItem[] = [
  {
    question: 'What happens after 5 free uploads?',
    answer:
      'After using your 5 free uploads, each additional book upload costs just ₹10. You can buy upload credits one at a time as needed, or upgrade to the Premium plan for unlimited uploads within the plan period.',
  },
  {
    question: 'How does the Premium plan work?',
    answer:
      'The Premium plan costs ₹149 for 30 days. During this period, you can upload up to 29 books, get a Premium badge on your profile, premium tags on your listings, priority in search results, and featured seller placement for more visibility.',
  },
  {
    question: 'Can I cancel Premium?',
    answer:
      'The Premium plan is valid for 30 days from the date of purchase and automatically expires. There is no auto-renewal, so you don\'t need to worry about cancellation. You can purchase it again whenever you want.',
  },
  {
    question: 'How long does Premium last?',
    answer:
      'Premium lasts for 30 days from the date of activation. After that, your account reverts to the Normal plan. Any books you uploaded during Premium will remain listed with their premium tags.',
  },
  {
    question: 'What payment methods are supported?',
    answer:
      'We currently support UPI payments through any UPI app (Google Pay, PhonePe, Paytm, BHIM, etc.). After making the payment, you\'ll need to submit the UTR/reference number or a screenshot as proof. Our admin team verifies payments within 24 hours.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function PricingPage() {
  const { currentUser, setCurrentPage } = useAppStore()
  const { t } = useTranslation()
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(() => !!currentUser?.id)

  // Fetch upload status on mount if user is logged in
  useEffect(() => {
    if (!currentUser?.id) return
    let cancelled = false
    fetch(`/api/payment?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (!data.error) {
          setUploadStatus(data)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingStatus(false)
      })
    return () => { cancelled = true }
  }, [currentUser?.id])

  const handleStartSelling = () => {
    if (currentUser) {
      setCurrentPage('sell')
    } else {
      setCurrentPage('login')
    }
  }

  const handlePremiumSuccess = () => {
    // Refresh upload status after premium payment
    if (currentUser?.id) {
      fetch(`/api/payment?userId=${currentUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setUploadStatus(data)
          }
        })
        .catch(() => {})
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-brand/5">
      {/* Header Section */}
      <div className="relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          {/* Back Button */}
          <motion.button
            onClick={() => setCurrentPage('home')}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.97 }}
          >
            <ArrowLeft className="w-4 h-4 group-hover:text-brand transition-colors" />
            <span className="text-sm font-medium">Back to Home</span>
          </motion.button>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading gradient-text mb-3">
              Choose Your Plan
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
              Start selling your books on EduCampusHub. First 5 uploads are free!
            </p>
          </motion.div>
        </div>
      </div>

      {/* Current Plan Status Banner */}
      {currentUser && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
        >
          {loadingStatus ? (
            <Card className="p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand animate-spin" />
              <span className="text-sm text-muted-foreground">Loading your plan details...</span>
            </Card>
          ) : uploadStatus ? (
            <Card className="p-5 border-brand/20 bg-gradient-to-r from-brand/5 to-accent/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                    {uploadStatus.premiumActive ? (
                      <Crown className="w-5 h-5 text-amber-500" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-brand" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        Current Plan: {uploadStatus.planType === 'premium' ? 'Premium Seller' : 'Normal'}
                      </span>
                      {uploadStatus.premiumActive && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3 mr-0.5" /> Active
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                      <span>{uploadStatus.freeRemaining} free uploads left</span>
                      {uploadStatus.paidUploadCredits > 0 && (
                        <span>• {uploadStatus.paidUploadCredits} paid credits</span>
                      )}
                      {uploadStatus.premiumActive && (
                        <span>• {uploadStatus.premiumRemaining} premium uploads left</span>
                      )}
                    </div>
                  </div>
                </div>
                {uploadStatus.premiumActive && uploadStatus.premiumExpiryDate && (
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                      Expires {formatDate(uploadStatus.premiumExpiryDate)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ) : null}
        </motion.div>
      )}

      {/* Pricing Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {/* Normal Plan Card */}
          <motion.div variants={itemVariants}>
            <Card className="relative p-6 sm:p-8 h-full flex flex-col border-border hover:shadow-lg transition-shadow duration-300">
              {/* Plan Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-brand" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground font-heading">Normal Plan</h2>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-foreground font-heading">Free to Start</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Perfect for casual sellers looking to sell a few books.
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'First 5 Uploads Free',
                  '₹10 Per Upload After That',
                  'Sell Any Book Category',
                  'WhatsApp Chat with Buyers',
                  'Profile & Listings Page',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                onClick={handleStartSelling}
                className="w-full h-12 text-base font-semibold rounded-xl border-2 border-brand text-brand bg-transparent hover:bg-brand hover:text-white transition-all duration-300"
              >
                Start Selling
              </Button>
            </Card>
          </motion.div>

          {/* Premium Plan Card */}
          <motion.div variants={itemVariants}>
            <div className="relative">
              {/* Glow effect behind the card */}
              <div className="absolute -inset-[1px] bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-xl opacity-75 blur-[2px]" />

              <Card className="relative p-6 sm:p-8 h-full flex flex-col bg-white dark:bg-gray-900 border-0 rounded-xl overflow-hidden">
                {/* MOST POPULAR Badge */}
                <div className="absolute top-0 right-0">
                  <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                    MOST POPULAR
                  </div>
                </div>

                {/* Gold shimmer border effect */}
                <div className="absolute inset-0 rounded-xl pointer-events-none">
                  <div className="absolute inset-0 rounded-xl border-2 border-amber-400/50" />
                </div>

                {/* Plan Header */}
                <div className="mb-6 relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground font-heading">Premium Seller</h2>
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-bold gradient-text font-heading">₹149</span>
                    <span className="text-sm text-muted-foreground ml-1">/30 days</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    For serious sellers who want maximum visibility and sales.
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1 relative">
                  {[
                    'Upload 29 Books',
                    'Premium Badge on Profile',
                    'Premium Tag on Listings',
                    'Priority in Search Results',
                    'Featured Seller Section',
                    'More Visibility',
                    'Gold Border on Listings',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm text-foreground font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  onClick={() => setShowPremiumModal(true)}
                  className="w-full h-12 text-base font-semibold rounded-xl btn-gradient text-white border-0 shadow-lg shadow-brand/20"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </Button>
              </Card>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-12"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-foreground mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-sm">Got questions? We&apos;ve got answers.</p>
        </div>

        <div className="space-y-3">
          {FAQ_DATA.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.05 }}
            >
              <Card className="overflow-hidden border-border hover:border-brand/30 transition-colors">
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
                >
                  <span className="font-medium text-foreground pr-4 text-sm sm:text-base">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: openFAQ === index ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFAQ === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-foreground mb-2">
            Compare Plans
          </h2>
          <p className="text-muted-foreground text-sm">See which plan is right for you.</p>
        </div>

        <Card className="overflow-hidden border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-4 font-semibold text-foreground">Feature</th>
                  <th className="text-center p-4 font-semibold text-foreground">Normal</th>
                  <th className="text-center p-4 font-semibold">
                    <span className="gradient-text">Premium</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Price', normal: 'Free / ₹10 per upload', premium: '₹149 / 30 days' },
                  { feature: 'Book Uploads', normal: '5 Free + Paid', premium: '29 Books' },
                  { feature: 'Profile Badge', normal: false, premium: true },
                  { feature: 'Premium Tags', normal: false, premium: true },
                  { feature: 'Search Priority', normal: false, premium: true },
                  { feature: 'Featured Section', normal: false, premium: true },
                  { feature: 'Gold Border on Listings', normal: false, premium: true },
                  { feature: 'WhatsApp Chat', normal: true, premium: true },
                  { feature: 'Profile & Listings Page', normal: true, premium: true },
                  { feature: 'All Categories', normal: true, premium: true },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-foreground font-medium">{row.feature}</td>
                    <td className="p-4 text-center">
                      {typeof row.normal === 'boolean' ? (
                        row.normal ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : (
                        <span className="text-foreground text-xs sm:text-sm">{row.normal}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {typeof row.premium === 'boolean' ? (
                        row.premium ? (
                          <Check className="w-5 h-5 text-amber-500 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-foreground text-xs sm:text-sm">{row.premium}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* Premium Plan Modal */}
      {currentUser && (
        <PremiumPlanModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          userId={currentUser.id}
          onPaymentSuccess={handlePremiumSuccess}
        />
      )}
    </div>
  )
}
