'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Star, BookOpen, Heart, Settings, BadgeCheck, MapPin, GraduationCap, Mail, Phone, ArrowLeft, CreditCard, CheckCircle, Clock, XCircle, Pencil, Trash2, Loader2, MoreVertical, Eye, Crown, ShieldQuestion, ShieldCheck, AlertCircle, EyeOff, Lock } from 'lucide-react'
import { useAppStore, formatINR, CATEGORIES, parseListingImages, type EditingListingData } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INDIAN_CITIES } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

// Mirror of SECURITY_QUESTIONS from src/lib/security-question.ts
const SECURITY_QUESTIONS = [
  'What is your favorite book?',
  'What was your childhood nickname?',
  'What was the name of your first teacher?',
  'What is your favorite movie?',
  'What is your favorite place?',
  'What was the name of your childhood best friend?',
  'What is your favorite color?',
]

interface UserListing {
  id: string
  title: string
  description: string
  sellingPrice: number
  originalPrice: number
  category: string
  state: string
  district: string
  city: string
  condition: string
  isSold: boolean
  views: number
  images: string
  listingType?: string
  course?: string | null
  semester?: string | null
  college?: string | null
  whatsappNumber?: string
  subcategory?: string | null
  standard?: string | null
  board?: string | null
  isDigital?: boolean
  fileUrl?: string | null
  seller?: { id: string }
}

export default function ProfilePage() {
  const { currentUser, setCurrentPage, setCurrentUser, setSelectedProductId, wishlist, setEditingListing } = useAppStore()
  const [myListings, setMyListings] = useState<UserListing[]>([])
  const [wishlistListings, setWishlistListings] = useState<UserListing[]>([])
  const [payments, setPayments] = useState<{ id: string; amount: number; status: string; utrNumber: string | null; createdAt: string; verifiedAt: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', college: '', city: '', phone: '', whatsapp: '' })
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Security Question state ───
  const [securityLoading, setSecurityLoading] = useState(true)
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false)
  const [currentSecurityQuestion, setCurrentSecurityQuestion] = useState<string | null>(null)
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    questionIdx: '' as number | '',
    answer: '',
  })
  const [showSecurityCurrentPassword, setShowSecurityCurrentPassword] = useState(false)
  const [securitySaving, setSecuritySaving] = useState(false)
  const [securityError, setSecurityError] = useState('')

  useEffect(() => {
    if (!currentUser) return
    setEditForm({
      name: currentUser.name,
      college: currentUser.college || '',
      city: currentUser.city || '',
      phone: currentUser.phone || '',
      whatsapp: currentUser.whatsapp || '',
    })

    const fetchData = async () => {
      setLoading(true)
      try {
        const [listingsRes, paymentsRes] = await Promise.all([
          fetch(`/api/listings?limit=50&sellerId=${currentUser.id}`),
          fetch(`/api/payment/history?userId=${currentUser.id}`),
        ])
        const listingsData = await listingsRes.json()
        const allListings = listingsData.listings || []
        setMyListings(allListings)
        setWishlistListings(allListings.filter((l: UserListing & { id: string }) => wishlist.includes(l.id)))

        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json()
          setPayments(paymentsData.payments || [])
        }
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    // ─── Load current security question ───
    const fetchSecurity = async () => {
      setSecurityLoading(true)
      try {
        const res = await fetch('/api/auth/security-question')
        if (res.status === 401) {
          // Session expired — send user back to login so they can re-authenticate
          // before trying to view/edit their security question.
          window.location.href = '/login?redirect=/profile&reason=session_expired'
          return
        }
        if (!res.ok) {
          setSecurityLoading(false)
          return
        }
        const data = await res.json()
        setHasSecurityQuestion(!!data.hasSecurityQuestion)
        setCurrentSecurityQuestion(data.securityQuestion || null)
      } catch {
        // ignore
      } finally {
        setSecurityLoading(false)
      }
    }
    fetchSecurity()
  }, [currentUser, wishlist])

  // ─── Save security question ───
  const handleSaveSecurityQuestion = async () => {
    if (!currentUser) return
    setSecurityError('')

    if (securityForm.questionIdx === '' || securityForm.questionIdx === null) {
      setSecurityError('Please select a security question')
      return
    }
    if (!securityForm.answer.trim()) {
      setSecurityError('Please enter an answer')
      return
    }
    if (securityForm.answer.trim().length < 2) {
      setSecurityError('Answer must be at least 2 characters')
      return
    }
    if (securityForm.answer.trim().length > 100) {
      setSecurityError('Answer must be at most 100 characters')
      return
    }
    // If user already has a question set, current password is required
    if (hasSecurityQuestion && !securityForm.currentPassword) {
      setSecurityError('Current password is required to change your security question')
      return
    }

    setSecuritySaving(true)
    try {
      const res = await fetch('/api/auth/security-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: hasSecurityQuestion ? 'update' : 'setup',
          currentPassword: securityForm.currentPassword || undefined,
          securityQuestionIdx: securityForm.questionIdx,
          securityAnswer: securityForm.answer,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // 401 means the session is invalid/expired — give a clearer hint
        if (res.status === 401) {
          setSecurityError('Your session has expired. Please log in again to set your security question.')
          // Optionally redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/login?redirect=/profile'
          }, 2000)
          return
        }
        setSecurityError(data.error || 'Failed to save security question')
        return
      }

      toast.success(data.message || 'Security question saved successfully')
      setHasSecurityQuestion(true)
      setCurrentSecurityQuestion(SECURITY_QUESTIONS[securityForm.questionIdx as number])
      setSecurityForm({ currentPassword: '', questionIdx: '', answer: '' })
    } catch {
      setSecurityError('Network error. Please try again.')
    } finally {
      setSecuritySaving(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!currentUser) return
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentUser.id, ...editForm })
      })
      const data = await res.json()
      setCurrentUser({ ...currentUser, ...editForm })
      setEditing(false)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEditListing = (listing: UserListing, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const editingData: EditingListingData = {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      originalPrice: listing.originalPrice,
      sellingPrice: listing.sellingPrice,
      category: listing.category,
      subcategory: listing.subcategory || null,
      listingType: listing.listingType || 'sell',
      course: listing.course || null,
      semester: listing.semester || null,
      standard: listing.standard || null,
      board: listing.board || null,
      college: listing.college || null,
      state: listing.state || '',
      district: listing.district || '',
      city: listing.city || '',
      condition: listing.condition,
      whatsappNumber: listing.whatsappNumber || '',
      images: listing.images,
      isDigital: listing.isDigital || false,
      fileUrl: listing.fileUrl || null,
    }
    setEditingListing(editingData)
    setCurrentPage('editListing')
  }

  const handleDeleteListing = (listingId: string) => {
    setDeletingListingId(listingId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!currentUser || !deletingListingId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/listings?id=${deletingListingId}&sellerId=${currentUser.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Listing deleted successfully!')
        setMyListings(prev => prev.filter(l => l.id !== deletingListingId))
      } else {
        toast.error(data.error || 'Failed to delete listing')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDeletingListingId(null)
    }
  }

  if (!currentUser) {
    return (
      <div className="pt-20 pb-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Please login</h3>
          <Button onClick={() => setCurrentPage('login')} className="btn-gradient text-white border-0">
            <span>Login</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-20 pb-10 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <Button variant="ghost" onClick={() => setCurrentPage('home')} className="gap-2 -ml-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </motion.div>

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="p-6 card-premium">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-2xl font-bold shrink-0 ring-4 ring-brand/10">
                {currentUser.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-foreground font-heading">{currentUser.name}</h1>
                  {currentUser.premiumActive && <Badge className="bg-amber-500 text-white border-0 text-xs rounded-full gap-1"><Crown className="w-3 h-3" />Premium</Badge>}
                  {currentUser.isVerified && <BadgeCheck className="w-5 h-5 text-brand" />}
                  {currentUser.isAdmin && <Badge className="bg-brand text-white border-0 text-xs rounded-full">Admin</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{currentUser.email}</span>
                  {currentUser.college && <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />{currentUser.college}</span>}
                  {currentUser.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{currentUser.city}</span>}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-medium">{currentUser.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{currentUser.totalSales} sales</span>
                </div>
              </div>
              <Button variant="outline" onClick={() => setEditing(!editing)} className="gap-2 shrink-0 rounded-xl">
                <Settings className="w-4 h-4" /> {editing ? 'Cancel' : 'Edit Profile'}
              </Button>
            </div>

            {editing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6 pt-6 border-t border-border space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block">Name</Label>
                    <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">College</Label>
                    <Input value={editForm.college} onChange={e => setEditForm(p => ({ ...p, college: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">City</Label>
                    <Select value={editForm.city} onValueChange={v => setEditForm(p => ({ ...p, city: v }))}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select city" /></SelectTrigger>
                      <SelectContent>
                        {INDIAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Phone</Label>
                    <Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block">WhatsApp Number</Label>
                    <Input value={editForm.whatsapp} onChange={e => setEditForm(p => ({ ...p, whatsapp: e.target.value }))} className="h-10 rounded-xl" />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} className="btn-gradient text-white border-0 rounded-xl">
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              </motion.div>
            )}
          </Card>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Listings', value: myListings.length, icon: BookOpen },
            { label: 'Sales', value: currentUser.totalSales, icon: Star },
            { label: 'Rating', value: currentUser.rating.toFixed(1), icon: BadgeCheck },
          ].map(stat => (
            <Card key={stat.label} className="p-4 card-premium text-center">
              <stat.icon className="w-5 h-5 text-brand mx-auto mb-2" />
              <p className="text-xl font-bold text-foreground font-heading">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="listings">
          <TabsList className="mb-6">
            <TabsTrigger value="listings" className="gap-2 rounded-xl"><BookOpen className="w-4 h-4" /> My Listings</TabsTrigger>
            <TabsTrigger value="wishlist" className="gap-2 rounded-xl"><Heart className="w-4 h-4" /> Wishlist</TabsTrigger>
            <TabsTrigger value="payments" className="gap-2 rounded-xl"><CreditCard className="w-4 h-4" /> Payments</TabsTrigger>
            <TabsTrigger value="security" className="gap-2 rounded-xl"><ShieldQuestion className="w-4 h-4" /> Security</TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            {myListings.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">No listings yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Start selling your books!</p>
                <Button onClick={() => setCurrentPage('sell')} className="btn-gradient text-white border-0">
                  <span>Sell Now</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map(listing => {
                  const lcat = CATEGORIES.find(c => c.id === listing.category)
                  const listingImgs = parseListingImages(listing.images)
                  return (
                    <Card
                      key={listing.id}
                      className="overflow-hidden card-premium"
                    >
                      <div className="flex">
                        {/* Image */}
                        <div
                          className={`w-28 sm:w-36 shrink-0 aspect-[4/3] ${listingImgs.length > 0 ? '' : `bg-gradient-to-br ${lcat?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center`} relative cursor-pointer`}
                          onClick={() => { setSelectedProductId(listing.id); setCurrentPage('product') }}
                        >
                          {listingImgs.length > 0 ? (
                            <img src={listingImgs[0]} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <BookOpen className="w-8 h-8 text-white/50" />
                          )}
                          {listing.isSold && <Badge className="absolute top-2 left-2 bg-gray-500 text-white border-0 rounded-full text-[10px]">Sold</Badge>}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-3 sm:p-4 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => { setSelectedProductId(listing.id); setCurrentPage('product') }}
                            >
                              <h4 className="text-sm font-semibold line-clamp-1 hover:text-brand transition-colors">{listing.title}</h4>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-base font-bold text-brand">{formatINR(listing.sellingPrice)}</span>
                                {listing.originalPrice > 0 && (
                                  <span className="text-xs text-muted-foreground line-through">{formatINR(listing.originalPrice)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 py-0">{listing.condition}</Badge>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Eye className="w-3 h-3" />{listing.views}</span>
                                {lcat && <span className="text-[10px] text-muted-foreground">{lcat.name}</span>}
                              </div>
                            </div>

                            {/* Edit & Delete Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditListing(listing)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-brand hover:bg-brand/10"
                                title="Edit listing"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteListing(listing.id)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                title="Delete listing"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="wishlist">
            {wishlistListings.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
                <p className="text-muted-foreground text-sm mb-4">Save books you&apos;re interested in</p>
                <Button onClick={() => setCurrentPage('explore')} variant="outline" className="rounded-xl">Browse Books</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {wishlistListings.map(listing => {
                  const lcat = CATEGORIES.find(c => c.id === listing.category)
                  const listingImgs = parseListingImages(listing.images)
                  const imgBgClass = listingImgs.length > 0 ? '' : 'bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center'
                  const catBgClass = lcat?.color || 'from-gray-400 to-gray-500'
                  return (
                    <Card
                      key={listing.id}
                      className="overflow-hidden cursor-pointer hover:shadow-md transition-all card-premium"
                      onClick={() => { setSelectedProductId(listing.id); setCurrentPage('product') }}
                    >
                      <div className={`aspect-[4/3] ${listingImgs.length > 0 ? imgBgClass : `bg-gradient-to-br ${catBgClass} flex items-center justify-center`}`}>
                        {listingImgs.length > 0 ? (
                          <img src={listingImgs[0]} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <BookOpen className="w-8 h-8 text-white/50" />
                        )}
                      </div>
                      <div className="p-3">
                        <h4 className="text-sm font-medium line-clamp-1">{listing.title}</h4>
                        <p className="text-base font-bold text-brand mt-1">{formatINR(listing.sellingPrice)}</p>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments">
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">No Payments Yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Your payment history will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map(payment => {
                  const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
                    verified: { icon: CheckCircle, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', label: 'Verified' },
                    pending: { icon: Clock, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30', label: 'Pending' },
                    rejected: { icon: XCircle, color: 'text-red-500 bg-red-50 dark:bg-red-950/30', label: 'Rejected' },
                    expired: { icon: XCircle, color: 'text-gray-500 bg-gray-50 dark:bg-gray-950/30', label: 'Expired' },
                  }
                  const config = statusConfig[payment.status] || statusConfig.pending
                  const StatusIcon = config.icon
                  return (
                    <Card key={payment.id} className="p-4 card-premium">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color}`}>
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Upload Credit - {formatINR(payment.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {payment.utrNumber && ` · UTR: ${payment.utrNumber}`}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${config.color} border-0 text-xs rounded-full`}>
                          {config.label}
                        </Badge>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── Security Tab: Manage Security Question ─── */}
          <TabsContent value="security">
            <div className="space-y-4">
              {/* Status card */}
              <Card className="p-5 card-premium">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    securityLoading
                      ? 'bg-muted text-muted-foreground'
                      : hasSecurityQuestion
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                  }`}>
                    {securityLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : hasSecurityQuestion ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <ShieldQuestion className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {securityLoading
                        ? 'Loading security status…'
                        : hasSecurityQuestion
                          ? 'Security question is set'
                          : 'No security question set'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasSecurityQuestion
                        ? 'You can use it to recover your password if you forget it.'
                        : 'Set one now to enable password recovery.'}
                    </p>
                    {hasSecurityQuestion && currentSecurityQuestion && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Current question
                        </p>
                        <p className="text-sm text-foreground mt-0.5">{currentSecurityQuestion}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Setup / update form */}
              <Card className="p-5 card-premium">
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {hasSecurityQuestion ? 'Change Security Question' : 'Set Up Security Question'}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {hasSecurityQuestion
                    ? 'Enter your current password, then pick a new question and answer.'
                    : 'Pick one of the questions below and enter your answer. You\'ll need to answer it correctly to reset your password in the future.'}
                </p>

                {securityError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{securityError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {hasSecurityQuestion && (
                    <div>
                      <Label className="mb-1.5 block text-xs">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type={showSecurityCurrentPassword ? 'text' : 'password'}
                          value={securityForm.currentPassword}
                          onChange={e => setSecurityForm(p => ({ ...p, currentPassword: e.target.value }))}
                          placeholder="Enter your current password"
                          className="h-11 pl-10 pr-10 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecurityCurrentPassword(!showSecurityCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showSecurityCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Required to verify it&apos;s really you.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="mb-1.5 block text-xs">Security Question</Label>
                    <Select
                      value={securityForm.questionIdx === '' ? '' : String(securityForm.questionIdx)}
                      onValueChange={v => setSecurityForm(p => ({ ...p, questionIdx: v === '' ? '' : Number(v) }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Choose a security question" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECURITY_QUESTIONS.map((q, idx) => (
                          <SelectItem key={idx} value={String(idx)}>
                            {q}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-xs">Your Answer</Label>
                    <div className="relative">
                      <ShieldQuestion className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={securityForm.answer}
                        onChange={e => setSecurityForm(p => ({ ...p, answer: e.target.value }))}
                        placeholder="Enter your answer"
                        maxLength={100}
                        className="h-11 pl-10 rounded-xl"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Answers are stored securely (bcrypt-hashed) and never displayed to anyone, including you.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleSaveSecurityQuestion}
                      disabled={securitySaving}
                      className="btn-gradient text-white border-0 rounded-xl gap-2"
                    >
                      {securitySaving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                      ) : (
                        <><ShieldCheck className="w-4 h-4" /> {hasSecurityQuestion ? 'Update' : 'Save'} Security Question</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSecurityForm({ currentPassword: '', questionIdx: '', answer: '' })
                        setSecurityError('')
                      }}
                      className="rounded-xl"
                    >
                      Reset Form
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Help card */}
              <Card className="p-4 card-premium bg-muted/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <p className="font-semibold text-foreground mb-1">Tips for choosing a good answer</p>
                    <ul className="space-y-1 list-disc pl-4">
                      <li>Use something only you would know — not info you post publicly on social media.</li>
                      <li>Avoid answers that change over time (e.g., favorite movie might change next year).</li>
                      <li>Case doesn&apos;t matter — &quot;Harry Potter&quot; and &quot;harry potter&quot; are treated as the same answer.</li>
                      <li>After 5 wrong attempts, the recovery is temporarily locked for 15 minutes.</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone. All data including images, views, and wishlist entries will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="rounded-xl gap-2">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
