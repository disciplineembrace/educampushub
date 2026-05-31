'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, BookOpen, X, MapPin, MessageCircle } from 'lucide-react'
import { useAppStore, formatINR, CATEGORIES, parseListingImages } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface WishListing {
  id: string
  title: string
  sellingPrice: number
  originalPrice: number
  category: string
  city: string
  condition: string
  images: string
  seller: { name: string; college: string | null }
}

export default function WishlistPage() {
  const { wishlist, toggleWishlist, setCurrentPage, setSelectedProductId } = useAppStore()
  const [listings, setListings] = useState<WishListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWishlist = async () => {
      if (wishlist.length === 0) { setLoading(false); return }
      setLoading(true)
      try {
        const res = await fetch('/api/listings?limit=50')
        const data = await res.json()
        const all = data.listings || []
        setListings(all.filter((l: WishListing) => wishlist.includes(l.id)))
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchWishlist()
  }, [wishlist])

  return (
    <div className="pt-20 pb-10 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-heading">
            My <span className="gradient-text">Wishlist</span>
          </h1>
          <p className="text-muted-foreground">{listings.length} saved items</p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-premium overflow-hidden">
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded" />
                  <div className="h-5 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Heart className="w-12 h-12 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3 font-heading">Your wishlist is empty</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start saving books you&apos;re interested in by clicking the heart icon on any listing
            </p>
            <Button onClick={() => setCurrentPage('explore')} className="btn-gradient text-white border-0 rounded-xl">
              <span>Browse Books</span>
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            <AnimatePresence>
              {listings.map((listing, i) => {
                const lcat = CATEGORIES.find(c => c.id === listing.category)
                const listingImgs = parseListingImages(listing.images)
                const savings = listing.originalPrice > 0 ? Math.round(((listing.originalPrice - listing.sellingPrice) / listing.originalPrice) * 100) : 0

                return (
                  <motion.div
                    key={listing.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                    className="group card-premium glow-hover overflow-hidden cursor-pointer"
                    onClick={() => { setSelectedProductId(listing.id); setCurrentPage('product') }}
                  >
                    <div className={`relative aspect-[4/3] ${listingImgs.length > 0 ? '' : `bg-gradient-to-br ${lcat?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center`}`}>
                      {listingImgs.length > 0 ? (
                        <img src={listingImgs[0]} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <BookOpen className="w-10 h-10 text-white/50" />
                      )}
                      {savings > 0 && (
                        <Badge className="absolute bottom-3 left-3 bg-emerald-500 text-white border-0 text-xs font-bold rounded-full px-2.5">Save {savings}%</Badge>
                      )}
                      <motion.button
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 dark:bg-black/50 flex items-center justify-center backdrop-blur-sm"
                        whileTap={{ scale: 0.85 }}
                        onClick={(e) => { e.stopPropagation(); toggleWishlist(listing.id) }}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </motion.button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-2 mb-1.5">{listing.title}</h3>
                      <span className="text-lg font-bold text-brand">{formatINR(listing.sellingPrice)}</span>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px] rounded-full">{listing.condition}</Badge>
                        <Badge variant="secondary" className="text-[10px] gap-0.5 rounded-full"><MapPin className="w-2.5 h-2.5" />{listing.district || listing.city}{listing.state ? `, ${listing.state}` : ''}</Badge>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
