'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, MapPin, Star, MessageCircle, BookOpen, BadgeCheck, Flame, Eye, Crown } from 'lucide-react'
import { useAppStore, formatINR, CATEGORIES, parseListingImages } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Listing {
  id: string
  title: string
  description: string
  originalPrice: number
  sellingPrice: number
  category: string
  course: string | null
  city: string
  condition: string
  whatsappNumber: string
  isFeatured: boolean
  isUrgent: boolean
  isVerified: boolean
  views: number
  images: string
  seller: { id: string; name: string; college: string | null; isVerified: boolean; rating: number }
}

function ListingCard({ listing, index }: { listing: Listing; index: number }) {
  const { setCurrentPage, setSelectedProductId, wishlist, toggleWishlist } = useAppStore()
  const { t } = useTranslation()
  const isWishlisted = wishlist.includes(listing.id)
  const savings = listing.originalPrice > 0 ? Math.round(((listing.originalPrice - listing.sellingPrice) / listing.originalPrice) * 100) : 0
  const cat = CATEGORIES.find(c => c.id === listing.category)
  const listingImages = parseListingImages(listing.images)
  const conditionColor: Record<string, string> = {
    'Like New': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Good': 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light',
    'Fair': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Poor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  const handleCardClick = () => {
    setSelectedProductId(listing.id)
    setCurrentPage('product')
  }

  return (
    <motion.div
      className={`group overflow-hidden cursor-pointer ${listing.uploadType === 'premium' ? 'ring-2 ring-amber-400 dark:ring-amber-500 shadow-lg shadow-amber-500/10' : 'card-premium glow-hover'}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -6 }}
      onClick={handleCardClick}
    >
      {/* Image placeholder */}
      <div className={`relative aspect-[4/3] ${listingImages.length > 0 ? '' : `bg-gradient-to-br ${cat?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center`} overflow-hidden`}>
        {listingImages.length > 0 ? (
          <img src={listingImages[0]} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <BookOpen className="w-12 h-12 text-white/60" />
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {listing.uploadType === 'premium' && (
            <Badge className="bg-amber-500 text-white border-0 text-[10px] px-2.5 py-0.5 rounded-full">
              <Crown className="w-3 h-3 mr-0.5" /> Premium
            </Badge>
          )}
          {listing.isFeatured && (
            <Badge className="bg-amber-500 text-white border-0 text-[10px] px-2.5 py-0.5 rounded-full">
              <Star className="w-3 h-3 mr-0.5" /> {t('featured.badge.featured')}
            </Badge>
          )}
          {listing.isUrgent && (
            <Badge className="bg-red-500 text-white border-0 text-[10px] px-2.5 py-0.5 rounded-full">
              <Flame className="w-3 h-3 mr-0.5" /> {t('featured.badge.urgent')}
            </Badge>
          )}
          {listing.isVerified && (
            <Badge className="bg-emerald-500 text-white border-0 text-[10px] px-2.5 py-0.5 rounded-full">
              <BadgeCheck className="w-3 h-3 mr-0.5" /> {t('featured.badge.verified')}
            </Badge>
          )}
        </div>

        {/* Wishlist */}
        <motion.button
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 dark:bg-black/50 flex items-center justify-center backdrop-blur-sm hover:scale-110 transition-transform"
          whileTap={{ scale: 0.85 }}
          onClick={(e) => { e.stopPropagation(); toggleWishlist(listing.id) }}
        >
          <Heart className={`w-4 h-4 transition-colors ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600 dark:text-gray-300'}`} />
        </motion.button>

        {/* Savings badge */}
        {savings > 0 && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-emerald-500 text-white border-0 text-xs font-bold rounded-full px-2.5">
              {t('featured.badge.save', { savings })}
            </Badge>
          </div>
        )}

        {/* Views */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 text-white/80 text-xs">
          <Eye className="w-3 h-3" /> {listing.views}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-brand transition-colors">
          {listing.title}
        </h3>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-lg font-bold text-brand">{formatINR(listing.sellingPrice)}</span>
          {listing.originalPrice > 0 && (
            <span className="text-xs text-muted-foreground line-through">{formatINR(listing.originalPrice)}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="secondary" className={`text-[10px] rounded-full ${conditionColor[listing.condition] || ''}`}>
            {listing.condition}
          </Badge>
          <Badge variant="secondary" className="text-[10px] gap-1 rounded-full">
            <MapPin className="w-2.5 h-2.5" /> {listing.district || listing.city}{listing.state ? `, ${listing.state}` : ''}
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-[10px] font-bold shrink-0 ring-2 ring-brand/10">
              {listing.seller.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{listing.seller.name}</p>
              {listing.seller.college && (
                <p className="text-[10px] text-muted-foreground truncate">{listing.seller.college}</p>
              )}
            </div>
          </div>
          <a
            href={`https://wa.me/91${listing.whatsappNumber}?text=Hi! I saw your listing "${listing.title}" on EduCampusHub`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <Button size="sm" className="h-7 bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs px-3 gap-1 rounded-full">
              <MessageCircle className="w-3 h-3" /> {t('featured.chat')}
            </Button>
          </a>
        </div>
      </div>
    </motion.div>
  )
}

function ListingSkeleton() {
  return (
    <div className="card-premium overflow-hidden">
      <Skeleton className="aspect-[4/3]" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  )
}

export default function FeaturedListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const res = await fetch('/api/listings?featured=true&limit=8')
        const data = await res.json()
        setListings(data.listings || [])
      } catch (err) {
        console.error('Failed to fetch featured listings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchListings()
  }, [])

  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 font-heading">
            {t('featured.heading.prefix')} <span className="gradient-text">{t('featured.heading.highlight')}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('featured.subheading')}
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {listings.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export { ListingCard, ListingSkeleton }
export type { Listing }
