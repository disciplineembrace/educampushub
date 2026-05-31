'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Crown, Star, ChevronLeft, ChevronRight, BookOpen, BadgeCheck } from 'lucide-react'
import { useAppStore, formatINR } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface PremiumSeller {
  id: string
  name: string
  college: string | null
  avatar: string | null
  premiumActive: boolean
  totalBooksUploaded: number
  rating: number
}

export default function FeaturedSellerCarousel() {
  const [sellers, setSellers] = useState<PremiumSeller[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const { setCurrentPage } = useAppStore()
  const { t } = useTranslation()

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await fetch('/api/premium-sellers')
        if (res.ok) {
          const data = await res.json()
          setSellers(data.sellers || [])
        }
      } catch (err) {
        console.error('Failed to fetch premium sellers:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSellers()
  }, [])

  const visibleCount = typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : typeof window !== 'undefined' && window.innerWidth < 1024 ? 2 : 4

  const next = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, Math.max(0, sellers.length - visibleCount)))
  }, [sellers.length, visibleCount])

  const prev = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (sellers.length <= visibleCount) return
    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= sellers.length - visibleCount) return 0
        return prev + 1
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [sellers.length, visibleCount])

  if (!loading && sellers.length === 0) return null

  return (
    <section className="py-16 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm font-medium mb-3">
            <Crown className="w-4 h-4" /> Premium Sellers
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-heading">
            Featured <span className="text-amber-500">Sellers</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Top-rated premium sellers who offer the best books with verified quality and fast responses
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Navigation buttons */}
            {sellers.length > visibleCount && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={prev}
                  disabled={currentIndex === 0}
                  className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-800 shadow-lg border-0 hidden sm:flex"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={next}
                  disabled={currentIndex >= sellers.length - visibleCount}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-800 shadow-lg border-0 hidden sm:flex"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}

            <div className="overflow-hidden">
              <motion.div
                className="flex gap-4"
                animate={{ x: `-${currentIndex * (100 / visibleCount + 1)}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {sellers.map((seller, i) => (
                  <motion.div
                    key={seller.id}
                    className="w-full sm:w-1/2 lg:w-1/4 shrink-0"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="p-5 rounded-2xl bg-card border-2 border-amber-200 dark:border-amber-800 hover:shadow-lg hover:shadow-amber-500/5 transition-all cursor-pointer group"
                      onClick={() => {
                        // Could navigate to seller's profile/listings
                        setCurrentPage('explore')
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-bold shrink-0 ring-2 ring-amber-300 dark:ring-amber-700">
                          {seller.avatar ? (
                            <img src={seller.avatar} alt={seller.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            seller.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground truncate">{seller.name}</p>
                            <Badge className="bg-amber-500 text-white border-0 text-[8px] px-1.5 py-0 rounded-full shrink-0">
                              <Crown className="w-2.5 h-2.5 mr-0.5" /> PRO
                            </Badge>
                          </div>
                          {seller.college && (
                            <p className="text-xs text-muted-foreground truncate">{seller.college}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <BookOpen className="w-3 h-3" />
                            <span>{seller.totalBooksUploaded} books</span>
                          </div>
                          {seller.rating > 0 && (
                            <div className="flex items-center gap-1 text-xs text-amber-500">
                              <Star className="w-3 h-3 fill-amber-500" />
                              <span>{seller.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <BadgeCheck className="w-4 h-4 text-emerald-500" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Dots indicator */}
            {sellers.length > visibleCount && (
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {Array.from({ length: Math.min(sellers.length - visibleCount + 1, 8) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentIndex === i ? 'bg-amber-500 w-4' : 'bg-muted-foreground/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
