'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Crown, Star, BookOpen, ArrowRight } from 'lucide-react'
import { useAppStore, formatINR } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PremiumSeller {
  id: string
  name: string
  college: string | null
  avatar: string | null
  premiumActive: boolean
  totalBooksUploaded: number
  rating: number
}

export default function FeaturedSellers() {
  const { setCurrentPage, setSelectedProductId } = useAppStore()
  const [sellers, setSellers] = useState<PremiumSeller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPremiumSellers = async () => {
      try {
        const res = await fetch('/api/premium-sellers')
        if (res.ok) {
          const data = await res.json()
          setSellers(data.sellers || [])
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchPremiumSellers()
  }, [])

  if (loading) {
    return (
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center animate-pulse">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="h-7 w-48 bg-muted rounded-lg animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-44 bg-muted/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (sellers.length === 0) return null

  return (
    <section className="py-16 px-4 sm:px-6 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground font-heading">
                Featured <span className="text-amber-500">Premium</span> Sellers
              </h2>
              <p className="text-sm text-muted-foreground">Trusted sellers with premium quality books</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage('pricing')}
            className="text-amber-600 hover:text-amber-700 gap-1 hidden sm:flex"
          >
            Become Premium <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>

        {/* Sellers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sellers.slice(0, 10).map((seller, idx) => (
            <motion.div
              key={seller.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className="relative group"
            >
              <div className="p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900 text-center hover:shadow-lg hover:shadow-amber-500/10 transition-all">
                {/* Premium Badge */}
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-amber-500 text-white border-0 text-[9px] px-1.5 py-0.5 rounded-full gap-0.5 shadow-md">
                    <Crown className="w-2.5 h-2.5" /> PRO
                  </Badge>
                </div>

                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-bold mx-auto mb-2 ring-2 ring-amber-200 dark:ring-amber-800">
                  {seller.avatar ? (
                    <img src={seller.avatar} alt={seller.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    seller.name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Name */}
                <h4 className="text-sm font-semibold text-foreground truncate">{seller.name}</h4>

                {/* College */}
                {seller.college && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{seller.college}</p>
                )}

                {/* Stats */}
                <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <BookOpen className="w-3 h-3" /> {seller.totalBooksUploaded}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-amber-400" /> {seller.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-6 text-center sm:hidden">
          <Button
            onClick={() => setCurrentPage('pricing')}
            className="bg-amber-500 hover:bg-amber-600 text-white border-0 rounded-xl gap-2"
          >
            <Crown className="w-4 h-4" /> Become a Premium Seller
          </Button>
        </div>
      </div>
    </section>
  )
}
