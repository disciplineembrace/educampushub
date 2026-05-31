'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Heart, MessageCircle, MapPin, Star, Shield, BadgeCheck, Eye, Flag, BookOpen, Share2, Clock, Bookmark, BookOpenCheck, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useAppStore, formatINR, CATEGORIES, parseListingImages, type EditingListingData } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ListingDetail {
  id: string
  title: string
  description: string
  originalPrice: number
  sellingPrice: number
  category: string
  course: string | null
  semester: string | null
  college: string | null
  state: string
  district: string
  city: string
  condition: string
  whatsappNumber: string
  images: string
  isFeatured: boolean
  isUrgent: boolean
  isVerified: boolean
  isDigital: boolean
  listingType: string
  views: number
  createdAt: string
  seller: {
    id: string
    name: string
    email: string
    college: string | null
    city: string | null
    isVerified: boolean
    rating: number
    totalSales: number
    avatar: string | null
  }
}

export default function ProductDetailPage() {
  const { selectedProductId, setCurrentPage, wishlist, toggleWishlist, currentUser, savedMaterials, toggleSavedMaterial, addRecentlyViewed, setEditingListing } = useAppStore()
  const [listing, setListing] = useState<ListingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportReason, setReportReason] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reported, setReported] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!selectedProductId) return
    const fetchListing = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/listings?id=${selectedProductId}`)
        const data = await res.json()
        setListing(data.listing)
        if (data.listing) addRecentlyViewed(data.listing.id)
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchListing()
  }, [selectedProductId])

  const isOwner = currentUser && listing && currentUser.id === listing.seller.id
  const locationDisplay = listing ? (listing.district && listing.state ? `${listing.district}, ${listing.state}` : listing.city) : ''

  const handleEdit = () => {
    if (!listing || !currentUser) return
    const editingData: EditingListingData = {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      originalPrice: listing.originalPrice,
      sellingPrice: listing.sellingPrice,
      category: listing.category,
      subcategory: null,
      listingType: listing.listingType,
      course: listing.course,
      semester: listing.semester,
      standard: null,
      board: null,
      college: listing.college,
      state: listing.state,
      district: listing.district,
      city: listing.city,
      condition: listing.condition,
      whatsappNumber: listing.whatsappNumber,
      images: listing.images,
      isDigital: listing.isDigital,
      fileUrl: null,
    }
    setEditingListing(editingData)
    setCurrentPage('editListing')
  }

  const handleDelete = async () => {
    if (!listing || !currentUser) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/listings?id=${listing.id}&sellerId=${currentUser.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        toast.success('Listing deleted successfully!')
        setCurrentPage('explore')
      } else {
        toast.error(data.error || 'Failed to delete listing')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const isWishlisted = listing ? wishlist.includes(listing.id) : false
  const isSaved = listing ? savedMaterials.includes(listing.id) : false
  const isDigital = listing?.isDigital || false
  const listingType = listing?.listingType || 'sell'
  const savings = listing && listing.originalPrice > 0 ? Math.round(((listing.originalPrice - listing.sellingPrice) / listing.originalPrice) * 100) : 0

  // Parse images from listing
  const listingImages = parseListingImages(listing?.images)
  const cat = listing ? CATEGORIES.find(c => c.id === listing.category) : null
  const conditionColor: Record<string, string> = {
    'Like New': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Good': 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light',
    'Fair': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Poor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  const handleReport = async () => {
    if (!listing || !currentUser || !reportReason) return
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, reporterId: currentUser.id, reason: reportReason })
      })
      setReported(true)
      setReportOpen(false)
      setTimeout(() => setReported(false), 3000)
    } catch (err) {
      console.error('Report error:', err)
    }
  }

  if (loading) {
    return (
      <div className="pt-20 pb-10 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="pt-20 pb-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Listing not found</h3>
          <Button variant="outline" onClick={() => setCurrentPage('explore')}>Browse Listings</Button>
        </div>
      </div>
    )
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return `${Math.floor(days / 30)} months ago`
  }

  return (
    <div className="pt-20 pb-10 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Button variant="ghost" onClick={() => setCurrentPage('explore')} className="gap-2 -ml-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back to listings
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Image Gallery */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className={`relative aspect-square rounded-2xl overflow-hidden ${listingImages.length > 0 ? '' : `bg-gradient-to-br ${cat?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center`}`}>
              {listingImages.length > 0 ? (
                <img
                  src={listingImages[currentImageIndex] || listingImages[0]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BookOpen className="w-24 h-24 text-white/50" />
              )}

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                {listing.isFeatured && <Badge className="bg-amber-500 text-white border-0 rounded-full"><Star className="w-3 h-3 mr-1" />Featured</Badge>}
                {listing.isUrgent && <Badge className="bg-red-500 text-white border-0 rounded-full">Urgent Sale</Badge>}
                {listing.isVerified && <Badge className="bg-emerald-500 text-white border-0 rounded-full"><BadgeCheck className="w-3 h-3 mr-1" />Verified</Badge>}
              </div>

              {/* Image nav dots */}
              {listingImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {listingImages.map((_, idx) => (
                    <button
                      key={idx}
                      className={`w-2 h-2 rounded-full ${currentImageIndex === idx ? 'bg-white' : 'bg-white/40'}`}
                      onClick={() => setCurrentImageIndex(idx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnail row */}
            {listingImages.length > 1 ? (
              <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                {listingImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`shrink-0 w-20 aspect-[4/3] rounded-xl overflow-hidden transition-all ${currentImageIndex === idx ? 'ring-2 ring-brand opacity-100' : 'opacity-60 hover:opacity-100'}`}
                  >
                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : listingImages.length <= 1 ? (
              <div className="flex gap-2 mt-3">
                {[0, 1, 2].map(i => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`flex-1 aspect-[4/3] rounded-xl bg-gradient-to-br ${cat?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity ${currentImageIndex === i ? 'ring-2 ring-brand opacity-100' : ''}`}
                  >
                    <BookOpen className="w-6 h-6 text-white/50" />
                  </button>
                ))}
              </div>
            ) : null}
          </motion.div>

          {/* Details */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="space-y-5">
              {/* Title & Price */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 font-heading">{listing.title}</h1>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-bold text-brand">{formatINR(listing.sellingPrice)}</span>
                  {listing.originalPrice > 0 && (
                    <>
                      <span className="text-lg text-muted-foreground line-through">{formatINR(listing.originalPrice)}</span>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 font-bold rounded-full">
                        Save {savings}%
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Quick info */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className={`gap-1 rounded-full ${conditionColor[listing.condition] || ''}`}>
                  {listing.condition}
                </Badge>
                <Badge variant="secondary" className="gap-1 rounded-full"><MapPin className="w-3 h-3" />{locationDisplay}</Badge>
                {listing.course && <Badge variant="secondary" className="rounded-full">{listing.course}</Badge>}
                {listing.semester && <Badge variant="secondary" className="rounded-full">{listing.semester} Semester</Badge>}
                <Badge variant="secondary" className="gap-1 rounded-full"><Eye className="w-3 h-3" />{listing.views} views</Badge>
                <Badge variant="secondary" className="gap-1 rounded-full"><Clock className="w-3 h-3" />{timeAgo(listing.createdAt)}</Badge>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
              </div>

              {listing.college && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">College</h3>
                  <p className="text-sm text-muted-foreground">{listing.college}</p>
                </div>
              )}

              {/* Seller Card */}
              <div className="p-5 rounded-2xl card-premium glow-hover">
                <h3 className="text-sm font-semibold text-foreground mb-3">Seller Information</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-lg font-bold ring-2 ring-brand/10">
                    {listing.seller.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{listing.seller.name}</p>
                      {listing.seller.isVerified && <BadgeCheck className="w-4 h-4 text-brand" />}
                    </div>
                    {listing.seller.college && <p className="text-xs text-muted-foreground">{listing.seller.college}</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium">{listing.seller.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{listing.seller.totalSales} sales</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Actions */}
              {isOwner && (
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleEdit}
                    className="flex-1 h-11 rounded-xl gap-2 border-brand/30 text-brand hover:bg-brand/5"
                  >
                    <Pencil className="w-4 h-4" /> Edit Listing
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="flex-1 h-11 rounded-xl gap-2 border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Listing
                  </Button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {/* Read Now for Digital Products */}
                {isDigital && (
                  <Button
                    onClick={() => setCurrentPage('reader')}
                    className="w-full h-12 btn-cyan text-white border-0 rounded-xl text-base font-semibold gap-2"
                  >
                    <BookOpenCheck className="w-5 h-5" /> Read Now
                  </Button>
                )}

                {/* Giveaway badge */}
                {listingType === 'giveaway' && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-center">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">This item is being given away for free!</p>
                  </div>
                )}

                {/* Exchange badge */}
                {listingType === 'exchange' && (
                  <div className="p-3 rounded-xl bg-brand/5 dark:bg-brand/10 border border-brand/20 dark:border-brand/30 text-center">
                    <p className="text-sm font-semibold text-brand">This item is available for exchange</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <a
                    href={`https://wa.me/91${listing.whatsappNumber}?text=Hi! I saw your listing "${listing.title}" on EduCampusHub`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white border-0 rounded-xl text-base font-semibold gap-2 hover:shadow-lg hover:shadow-emerald-500/20 transition-all">
                      <MessageCircle className="w-5 h-5" /> WhatsApp
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => toggleWishlist(listing.id)}
                    className={`h-12 px-4 rounded-xl transition-all ${isWishlisted ? 'bg-red-50 border-red-200 text-red-500 dark:bg-red-950/30 dark:border-red-800' : ''}`}
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toggleSavedMaterial(listing.id)}
                    className={`h-12 px-4 rounded-xl transition-all ${isSaved ? 'bg-amber-50 border-amber-200 text-amber-500 dark:bg-amber-950/30 dark:border-amber-800' : ''}`}
                  >
                    <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-amber-500' : ''}`} />
                  </Button>
                  <Button variant="outline" className="h-12 px-4 rounded-xl">
                    <Share2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Trust & Safety */}
              <div className="p-4 rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/20 dark:border-brand/30">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Trust & Safety</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Always meet in a public place. Check the book before paying. EduCampusHub never asks for payment directly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Report */}
              <div className="pt-2">
                {reported ? (
                  <p className="text-sm text-emerald-600 font-medium">✓ Report submitted. We&apos;ll review it shortly.</p>
                ) : (
                  <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 text-xs">
                        <Flag className="w-3 h-3" /> Report this listing
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Report Listing</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Textarea
                          value={reportReason}
                          onChange={e => setReportReason(e.target.value)}
                          placeholder="Why are you reporting this listing? (e.g., inappropriate content, scam, wrong information)"
                          className="min-h-[100px] rounded-xl"
                        />
                        <Button
                          onClick={handleReport}
                          disabled={!reportReason || !currentUser}
                          className="w-full btn-gradient text-white border-0"
                        >
                          <span>Submit Report</span>
                        </Button>
                        {!currentUser && <p className="text-xs text-muted-foreground text-center">Please login to report a listing</p>}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {/* Delete Confirmation Dialog */}
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Listing</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete &quot;{listing?.title}&quot;? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl">
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-xl gap-2">
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete Permanently
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
