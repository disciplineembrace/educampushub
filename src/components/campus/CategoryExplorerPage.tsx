'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, BookOpen, GraduationCap, Stethoscope, Wrench, Scale, Target, FileText, PenTool, Tablet, Notebook, Package, BookMarked, Backpack, Sparkles, ArrowRight } from 'lucide-react'
import { useAppStore, CATEGORIES, formatINR, parseListingImages, getCategoryTranslationKey } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen, GraduationCap, Stethoscope, Wrench, Scale, Target, FileText,
  PenTool, Tablet, Notebook, Package, BookMarked, Backpack,
}

interface Listing {
  id: string
  title: string
  sellingPrice: number
  originalPrice: number
  category: string
  condition: string
  city: string
  isDigital: boolean
  listingType: string
  views: number
  images: string
  seller: { name: string; college: string | null; isVerified: boolean; rating: number }
}

const FEATURED_COLLECTIONS = [
  { key: 'backToSchool', icon: Backpack, color: 'from-brand to-accent' },
  { key: 'examPrepBundle', icon: Target, color: 'from-amber-500 to-orange-500' },
  { key: 'collegeStarterKit', icon: Package, color: 'from-emerald-500 to-green-600' },
]

export default function CategoryExplorerPage() {
  const { setCurrentPage, setSelectedCategory, setSelectedProductId, searchQuery, setSearchQuery } = useAppStore()
  const { t } = useTranslation()
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedCat) { setListings([]); return }
    const fetchListings = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/listings?category=${selectedCat}&limit=12`)
        const data = await res.json()
        setListings(data.listings || [])
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchListings()
  }, [selectedCat])

  const handleCategoryClick = (catId: string) => {
    if (selectedCat === catId) {
      setSelectedCat(null)
    } else {
      setSelectedCat(catId)
    }
  }

  const handleExploreAll = (catId: string) => {
    setSelectedCategory(catId)
    setCurrentPage('explore')
  }

  const handleListingClick = (id: string) => {
    setSelectedProductId(id)
    setCurrentPage('product')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setCurrentPage('explore')
    }
  }

  return (
    <div className="pt-20 pb-10 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/10 text-brand text-sm font-medium mb-4 border border-brand/20">
            <Sparkles className="w-4 h-4" />
            {t('categoryExplorer.badgeText')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 font-heading">
            {t('categoryExplorer.heading.prefix')} <span className="gradient-text">{t('categoryExplorer.heading.highlight')}</span> {t('categoryExplorer.heading.suffix')}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            {t('categoryExplorer.subheading')}
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-lg mx-auto">
            <div className="search-modern rounded-2xl flex items-center px-4">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('categoryExplorer.searchPlaceholder')}
                className="h-12 border-0 bg-transparent focus-visible:ring-0 text-base"
              />
              <Button type="submit" size="sm" className="btn-gradient text-white border-0 rounded-xl shrink-0">
                <span>{t('categoryExplorer.searchButton')}</span>
              </Button>
            </div>
          </form>
        </motion.div>

        {/* Featured Collections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4 font-heading">{t('categoryExplorer.featuredCollections.heading')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FEATURED_COLLECTIONS.map(collection => (
              <button
                key={collection.key}
                onClick={() => setCurrentPage('explore')}
                className="p-4 rounded-2xl card-premium glow-hover text-center group"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${collection.color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                  <collection.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t(`categoryExplorer.featuredCollections.${collection.key}.name`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(`categoryExplorer.featuredCollections.${collection.key}.description`)}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* All Categories Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4 font-heading">{t('categoryExplorer.allCategories.heading')}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3">
            {CATEGORIES.map((cat, i) => {
              const IconComp = ICON_MAP[cat.icon] || BookOpen
              const isSelected = selectedCat === cat.id
              return (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`category-card p-3 sm:p-4 rounded-2xl text-center group ${isSelected ? 'ring-2 ring-brand bg-brand/5' : 'card-premium'}`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                    <IconComp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight">{t(`categories.${cat.translationKey}.name`)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{t(`categories.${cat.translationKey}.description`)}</p>
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* Category Listings */}
        {selectedCat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground font-heading">
                {CATEGORIES.find(c => c.id === selectedCat) ? t(`categories.${CATEGORIES.find(c => c.id === selectedCat)?.translationKey}.name`) : 'Listings'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => handleExploreAll(selectedCat)} className="text-brand rounded-xl gap-1">
                {t('categoryExplorer.viewAll')} <ArrowRight className="w-3 h-3" />
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">{t('categoryExplorer.emptyListings')}</p>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage('sell')} className="mt-3 rounded-xl">
                  {t('categoryExplorer.beFirstToList')}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {listings.map((listing, i) => {
                  const cat = CATEGORIES.find(c => c.id === listing.category)
                  const listingImgs = parseListingImages(listing.images)
                  const savings = listing.originalPrice > 0 ? Math.round(((listing.originalPrice - listing.sellingPrice) / listing.originalPrice) * 100) : 0
                  return (
                    <motion.div
                      key={listing.id}
                      className="group card-premium glow-hover overflow-hidden cursor-pointer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ y: -4 }}
                      onClick={() => handleListingClick(listing.id)}
                    >
                      <div className={`relative aspect-[4/3] ${listingImgs.length > 0 ? '' : `bg-gradient-to-br ${cat?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center`}`}>
                        {listingImgs.length > 0 ? (
                          <img src={listingImgs[0]} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <BookOpen className="w-10 h-10 text-white/50" />
                        )}
                        {listing.isDigital && (
                          <Badge className="absolute top-2 right-2 digital-pulse bg-cyan text-white border-0 text-[9px] px-1.5 py-0.5 rounded-full">{t('categoryExplorer.badge.digital')}</Badge>
                        )}
                        {listing.listingType === 'giveaway' && (
                          <Badge className="absolute top-2 left-2 bg-emerald-500 text-white border-0 text-[9px] px-1.5 py-0.5 rounded-full">{t('categoryExplorer.badge.free')}</Badge>
                        )}
                        {savings > 0 && (
                          <Badge className="absolute bottom-2 left-2 bg-emerald-500 text-white border-0 text-xs font-bold rounded-full px-2">
                            {t('categoryExplorer.badge.save', { savings })}
                          </Badge>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-foreground text-sm leading-snug mb-1 line-clamp-2 group-hover:text-brand transition-colors">
                          {listing.title}
                        </h3>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-base font-bold text-brand">{listing.listingType === 'giveaway' ? 'FREE' : formatINR(listing.sellingPrice)}</span>
                          {listing.originalPrice > 0 && listing.listingType !== 'giveaway' && (
                            <span className="text-xs text-muted-foreground line-through">{formatINR(listing.originalPrice)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[9px] rounded-full">{listing.condition}</Badge>
                          <span className="text-[10px] text-muted-foreground">{listing.district || listing.city}{listing.state ? `, ${listing.state}` : ''}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
