'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, BookOpen, AlertTriangle, FileText, LogOut,
  RefreshCw, Trash2, Ban, BadgeCheck, Star, Eye, TrendingUp,
  Shield, ChevronRight, Clock, MoreVertical, CheckCircle2, XCircle, X,
  Crown, UserCog, HeadphonesIcon, Search, CreditCard, IndianRupee, Image as ImageIcon,
  Pencil, PackageCheck, PackageX, Zap, FileDigit, UserX, ListX, Save, EyeOff,
  Fingerprint, UserPlus, KeyRound, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatINR, CATEGORIES } from '@/lib/store'
import { INDIAN_STATES, INDIAN_DISTRICTS } from '@/lib/indian-states-districts'
import { toast } from 'sonner'
import AdminLogin from './AdminLogin'

// ─── Types ────────────────────────────────────────────────────────

type AdminTab = 'overview' | 'users' | 'listings' | 'reports' | 'audit' | 'payments' | 'admins'

interface AdminInfo {
  id: string
  name: string
  email: string
  role: string
  isSuperAdmin?: boolean
  twoFactorVerified?: boolean
}

interface Stats {
  totalUsers: number
  totalListings: number
  activeListings: number
  totalReports: number
  unresolvedReports: number
  featuredListings: number
  totalViews: number
  categoryStats: { category: string; count: number }[]
  cityStats: { city: string; count: number }[]
  recentListings: { id: string; title: string; sellingPrice: number; isSold: boolean; isFeatured: boolean; isVerified: boolean; createdAt: string; seller: { name: string; college: string | null } }[]
}

interface UserItem {
  id: string
  name: string
  email: string
  college: string | null
  city: string | null
  state?: string
  district?: string
  phone?: string | null
  isVerified: boolean
  isBanned: boolean
  isAdmin: boolean
  adminRole: string | null
  rating: number
  totalSales: number
  planType?: string
  premiumActive?: boolean
  premiumExpiryDate?: string | null
  premiumBooksUsed?: number
  premiumBookLimit?: number
  freeUploadUsed?: number
  paidUploadCredits?: number
  totalBooksUploaded?: number
  whatsapp?: string | null
  createdAt: string
  _count: { listings: number }
}

interface UserDetailData extends UserItem {
  listings: {
    id: string
    title: string
    sellingPrice: number
    isSold: boolean
    isFeatured: boolean
    isVerified: boolean
    isUrgent: boolean
    isDigital: boolean
    uploadType: string
    category: string
    state: string
    district: string
    createdAt: string
  }[]
  payments: {
    id: string
    amount: number
    paymentType: string
    status: string
    createdAt: string
    verifiedAt: string | null
  }[]
  wishlistItems: { id: string; listingId: string; listing: { id: string; title: string; sellingPrice: number } }[]
  reports: { id: string; reason: string; isResolved: boolean; createdAt: string; listing: { id: string; title: string } }[]
  _count: { listings: number; wishlistItems: number; reports: number; payments: number; adminSessions: number; auditLogs: number }
}

interface DeleteSummary {
  user: { id: string; name: string; email: string; college: string | null; phone: string | null; state: string; district: string; planType: string; premiumActive: boolean; isVerified: boolean; createdAt: string }
  resources: {
    listings: number
    activeListings: number
    soldListings: number
    premiumListings: number
    featuredListings: number
    totalViews: number
    totalSaves: number
    totalSpentOnPlatform: number
    payments: number
    verifiedPayments: number
    wishlistItems: number
    reportsFiled: number
    reportsOnListings: number
    wishlistsOnListings: number
    sessions: number
    userSessions?: number
    auditLogs: number
  }
  listingTitles: { id: string; title: string; price: number; category: string }[]
}

interface ListingItem {
  id: string
  title: string
  description: string
  category: string
  state: string
  district: string
  city: string
  condition: string
  sellingPrice: number
  originalPrice: number
  isFeatured: boolean
  isVerified: boolean
  isSold: boolean
  isUrgent?: boolean
  isDigital?: boolean
  views: number
  createdAt: string
  seller: { id: string; name: string; email: string; college: string | null }
}

interface ListingDetail extends ListingItem {
  subcategory: string | null
  course: string | null
  semester: string | null
  standard: string | null
  board: string | null
  college: string | null
  whatsappNumber: string
  isUrgent: boolean
  isDigital: boolean
  fileUrl: string | null
  images: string
  saves: number
  updatedAt: string
}

interface ReportItem {
  id: string
  reason: string
  isResolved: boolean
  createdAt: string
  listing: { id: string; title: string }
  reporter: { id: string; name: string; email: string }
}

interface AuditLogItem {
  id: string
  action: string
  targetType: string
  targetId: string
  details: string | null
  ipAddress: string | null
  createdAt: string
  actor: { name: string; email: string; adminRole?: string | null; isSuperAdmin?: boolean }
}

interface AdminAccountItem {
  id: string
  name: string
  email: string
  phone: string | null
  adminRole: string | null
  isSuperAdmin: boolean
  twoFactorEnabled: boolean
  isVerified: boolean
  isBanned: boolean
  mustChangePassword: boolean
  createdAt: string
  lastLogin: string | null
  lastLoginIp: string | null
  _count: { auditLogs: number; adminSessions: number }
}

interface PaymentItem {
  id: string
  userId: string
  amount: number
  paymentMethod: string
  paymentType: string
  utrNumber: string | null
  screenshotUrl: string | null
  upiId: string | null
  status: string
  uploadCredit: number
  expiresAt: string
  verifiedAt: string | null
  createdAt: string
  user: { id: string; name: string; email: string; college: string | null }
}

interface ListingEditForm {
  title: string
  description: string
  originalPrice: number
  sellingPrice: number
  category: string
  state: string
  district: string
  city: string
  condition: string
  isFeatured: boolean
  isVerified: boolean
  isSold: boolean
  isUrgent: boolean
  isDigital: boolean
}

interface UserEditForm {
  name: string
  email: string
  college: string
  city: string
  phone: string
  isVerified: boolean
  state: string
  district: string
}

// ─── Role Badge ───────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    super_admin: { label: 'Super Admin', icon: Crown, className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
    moderator: { label: 'Moderator', icon: Shield, className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
    support_admin: { label: 'Support', icon: HeadphonesIcon, className: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30' },
  }
  const c = config[role] || config.support_admin
  const Icon = c.icon
  return (
    <Badge className={`${c.className} border text-[10px] font-semibold gap-1 rounded-full px-2 py-0.5`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </Badge>
  )
}

// ─── Session Timer ────────────────────────────────────────────────

function SessionTimer({ onExpire }: { onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState(4 * 60 * 60) // 4 hours in seconds

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onExpire()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onExpire])

  const hours = Math.floor(timeLeft / 3600)
  const minutes = Math.floor((timeLeft % 3600) / 60)
  const seconds = timeLeft % 60

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <Clock className="w-3.5 h-3.5" />
      <span className="font-mono">
        {hours}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────

export default function AdminClient({ admin: initialAdmin }: { admin: AdminInfo | null }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(initialAdmin)
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [listings, setListings] = useState<ListingItem[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [revenueData, setRevenueData] = useState<{ totalRevenue: number; uploadFeeRevenue: number; premiumRevenue: number; premiumUsers: number; pendingPayments: number } | null>(null)

  // Admin accounts state (Super Admin only)
  const [adminAccounts, setAdminAccounts] = useState<AdminAccountItem[]>([])
  const [adminAccountsLoading, setAdminAccountsLoading] = useState(false)
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false)
  const [createAdminForm, setCreateAdminForm] = useState({ name: '', email: '', phone: '', password: '', role: 'support_admin' })
  const [createAdminLoading, setCreateAdminLoading] = useState(false)
  const isSuperAdmin = admin?.isSuperAdmin || admin?.role === 'super_admin'

  // Modal states
  const [showListingModal, setShowListingModal] = useState(false)
  const [selectedListing, setSelectedListing] = useState<ListingDetail | null>(null)
  const [listingEditMode, setListingEditMode] = useState(false)
  const [listingEditForm, setListingEditForm] = useState<ListingEditForm | null>(null)
  const [listingLoading, setListingLoading] = useState(false)

  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [userDetail, setUserDetail] = useState<UserDetailData | null>(null)
  const [userEditMode, setUserEditMode] = useState(false)
  const [userEditForm, setUserEditForm] = useState<UserEditForm | null>(null)
  const [userListings, setUserListings] = useState<ListingItem[]>([])
  const [userListingsLoading, setUserListingsLoading] = useState(false)
  const [deleteSummary, setDeleteSummary] = useState<DeleteSummary | null>(null)
  const [deleteSummaryLoading, setDeleteSummaryLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingUser, setDeletingUser] = useState(false)

  // Fetch data from protected admin API
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Add timeout to prevent infinite loading
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

      try {
        const [statsRes, usersRes, reportsRes, listingsRes] = await Promise.all([
          fetch('/api/cnx-admin?type=stats', { signal: controller.signal }),
          fetch('/api/cnx-admin?type=users', { signal: controller.signal }),
          fetch('/api/cnx-admin?type=reports', { signal: controller.signal }),
          fetch('/api/cnx-admin?type=listings', { signal: controller.signal }),
        ])
        
        clearTimeout(timeoutId)

        // If any returns 401, session is invalid - force re-login
        if (statsRes.status === 401 || usersRes.status === 401) {
          toast.error('Session expired. Please log in again.')
          setAdmin(null)
          return
        }
        
        if (statsRes.ok) setStats(await statsRes.json())
        else console.error('Stats fetch error:', statsRes.status)
        
        if (usersRes.ok) { const d = await usersRes.json(); setUsers(d.users || []) }
        else console.error('Users fetch error:', usersRes.status)
        
        if (reportsRes.ok) { const d = await reportsRes.json(); setReports(d.reports || []) }
        else console.error('Reports fetch error:', reportsRes.status)
        
        if (listingsRes.ok) { const d = await listingsRes.json(); setListings(d.listings || []) }
        else console.error('Listings fetch error:', listingsRes.status)
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId)
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          toast.error('Request timed out. Please check your connection and refresh.')
        } else {
          throw fetchErr
        }
      }
    } catch (err) {
      console.error('Admin fetch error:', err)
      toast.error('Failed to load data. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/cnx-admin?type=audit-logs')
      if (res.ok) { const d = await res.json(); setAuditLogs(d.logs || []) }
    } catch (err) {
      console.error('Audit logs error:', err)
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/cnx-admin?type=payments')
      if (res.ok) { const d = await res.json(); setPayments(d.payments || []) }
    } catch (err) {
      console.error('Payments fetch error:', err)
    }
  }, [])

  const fetchAdminAccounts = useCallback(async () => {
    setAdminAccountsLoading(true)
    try {
      const res = await fetch('/api/cnx-admin?type=admin-accounts')
      if (res.ok) { const d = await res.json(); setAdminAccounts(d.admins || []) }
      else { setAdminAccounts([]) }
    } catch (err) {
      console.error('Admin accounts fetch error:', err)
      setAdminAccounts([])
    } finally {
      setAdminAccountsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (admin) fetchData()
  }, [admin, fetchData])

  useEffect(() => {
    if (admin && activeTab === 'audit') fetchAuditLogs()
  }, [admin, activeTab, fetchAuditLogs])

  useEffect(() => {
    if (admin && activeTab === 'payments') {
      fetchPayments()
      // Fetch revenue analytics
      fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revenue_analytics', targetId: 'default' }),
      }).then(res => res.json()).then(data => {
        if (data.totalRevenue !== undefined) setRevenueData(data)
      }).catch(() => {})
    }
  }, [admin, activeTab, fetchPayments])

  useEffect(() => {
    if (admin && activeTab === 'admins' && isSuperAdmin) {
      fetchAdminAccounts()
    }
  }, [admin, activeTab, isSuperAdmin, fetchAdminAccounts])

  // Admin actions
  const adminAction = async (action: string, targetId: string, details?: string) => {
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, details }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Action completed: ${action.replace(/_/g, ' ')}`)
        fetchData()
        if (activeTab === 'audit') fetchAuditLogs()
        if (activeTab === 'payments') fetchPayments()
        // Close modals if action affects current selection
        if (selectedListing && (action === 'delete_listing' || targetId === selectedListing.id)) {
          refreshListingDetail(targetId)
        }
        if (selectedUser && (action.startsWith('delete_user') || targetId === selectedUser.id)) {
          refreshUserDetail(targetId)
        }
      } else {
        toast.error(data.error || 'Action failed')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // Admin action with updates object (for edit operations)
  const adminActionWithUpdates = async (action: string, targetId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId, updates }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Action completed: ${action.replace(/_/g, ' ')}`)
        fetchData()
        if (activeTab === 'audit') fetchAuditLogs()
        return true
      } else {
        toast.error(data.error || 'Action failed')
        return false
      }
    } catch {
      toast.error('Network error')
      return false
    }
  }

  // Refresh listing detail after actions
  const refreshListingDetail = async (listingId: string) => {
    try {
      const res = await fetch(`/api/cnx-admin?type=listing-detail&id=${listingId}`)
      if (res.ok) {
        const d = await res.json()
        setSelectedListing(d.listing)
        if (listingEditMode && listingEditForm) {
          setListingEditForm({
            title: d.listing.title,
            description: d.listing.description,
            originalPrice: d.listing.originalPrice,
            sellingPrice: d.listing.sellingPrice,
            category: d.listing.category,
            state: d.listing.state || '',
            district: d.listing.district || '',
            city: d.listing.city,
            condition: d.listing.condition,
            isFeatured: d.listing.isFeatured,
            isVerified: d.listing.isVerified,
            isSold: d.listing.isSold,
            isUrgent: d.listing.isUrgent,
            isDigital: d.listing.isDigital,
          })
        }
      }
    } catch { /* ignore */ }
  }

  // Refresh user detail after actions
  const refreshUserDetail = async (userId: string) => {
    try {
      const res = await fetch(`/api/cnx-admin?type=users`)
      if (res.ok) {
        const d = await res.json()
        const updated = (d.users || []).find((u: UserItem) => u.id === userId)
        if (updated) setSelectedUser(updated)
      }
    } catch { /* ignore */ }
  }

  // Open listing detail modal
  const openListingModal = async (listingId: string) => {
    setListingLoading(true)
    setShowListingModal(true)
    setListingEditMode(false)
    try {
      const res = await fetch(`/api/cnx-admin?type=listing-detail&id=${listingId}`)
      if (res.ok) {
        const d = await res.json()
        const listing = d.listing as ListingDetail
        setSelectedListing(listing)
        setListingEditForm({
          title: listing.title,
          description: listing.description,
          originalPrice: listing.originalPrice,
          sellingPrice: listing.sellingPrice,
          category: listing.category,
          state: listing.state || '',
          district: listing.district || '',
          city: listing.city,
          condition: listing.condition,
          isFeatured: listing.isFeatured,
          isVerified: listing.isVerified,
          isSold: listing.isSold,
          isUrgent: listing.isUrgent,
          isDigital: listing.isDigital,
        })
      }
    } catch {
      toast.error('Failed to load listing details')
    } finally {
      setListingLoading(false)
    }
  }

  // Open user detail modal
  const openUserModal = async (user: UserItem) => {
    setSelectedUser(user)
    setShowUserModal(true)
    setUserEditMode(false)
    setUserDetail(null)
    setUserEditForm({
      name: user.name,
      email: user.email,
      college: user.college || '',
      city: user.city || '',
      phone: user.phone || '',
      isVerified: user.isVerified,
      state: user.state || '',
      district: user.district || '',
    })
    // Fetch user's detailed data
    setUserListingsLoading(true)
    try {
      const [detailRes, listingsRes] = await Promise.all([
        fetch(`/api/cnx-admin?type=user-detail&id=${user.id}`),
        fetch(`/api/cnx-admin?type=user-listings&id=${user.id}`),
      ])
      if (detailRes.ok) {
        const d = await detailRes.json()
        setUserDetail(d.user)
        // Also update edit form with detail data
        if (d.user) {
          setUserEditForm({
            name: d.user.name,
            email: d.user.email,
            college: d.user.college || '',
            city: d.user.city || '',
            phone: d.user.phone || '',
            isVerified: d.user.isVerified,
            state: d.user.state || '',
            district: d.user.district || '',
          })
        }
      }
      if (listingsRes.ok) {
        const d = await listingsRes.json()
        setUserListings(d.listings || [])
      }
    } catch {
      /* ignore */
    } finally {
      setUserListingsLoading(false)
    }
  }

  // Save listing edits
  const saveListingEdits = async () => {
    if (!selectedListing || !listingEditForm) return
    const success = await adminActionWithUpdates('edit_listing', selectedListing.id, listingEditForm as unknown as Record<string, unknown>)
    if (success) {
      setListingEditMode(false)
      refreshListingDetail(selectedListing.id)
    }
  }

  // Save user edits
  const saveUserEdits = async () => {
    if (!selectedUser || !userEditForm) return
    const success = await adminActionWithUpdates('edit_user', selectedUser.id, userEditForm as unknown as Record<string, unknown>)
    if (success) {
      setUserEditMode(false)
      refreshUserDetail(selectedUser.id)
    }
  }

  // Fetch delete user summary before confirming deletion
  const fetchDeleteSummary = async (userId: string) => {
    // ⚠️ Self-delete prevention — never even fetch the summary for own account
    if (admin && userId === admin.id) {
      toast.error('You cannot delete your own admin account')
      return
    }
    setDeleteSummaryLoading(true)
    setDeleteSummary(null)
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_user_summary', targetId: userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.user) {
        // ─── Sanitize: ensure all resource counts are valid numbers (NaN-safe) ───
        // Backend should already return numbers, but defensive coercion protects
        // against any future field additions or partial responses.
        const num = (v: unknown): number => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : 0
        }
        const sanitized: DeleteSummary = {
          user: {
            id: data.user.id,
            name: data.user.name || '—',
            email: data.user.email || '—',
            college: data.user.college ?? null,
            phone: data.user.phone ?? null,
            state: data.user.state || '',
            district: data.user.district || '',
            planType: data.user.planType || 'normal',
            premiumActive: !!data.user.premiumActive,
            isVerified: !!data.user.isVerified,
            createdAt: data.user.createdAt || new Date(0).toISOString(),
          },
          resources: {
            listings: num(data.resources?.listings),
            activeListings: num(data.resources?.activeListings),
            soldListings: num(data.resources?.soldListings),
            premiumListings: num(data.resources?.premiumListings),
            featuredListings: num(data.resources?.featuredListings),
            totalViews: num(data.resources?.totalViews),
            totalSaves: num(data.resources?.totalSaves),
            totalSpentOnPlatform: num(data.resources?.totalSpentOnPlatform),
            payments: num(data.resources?.payments),
            verifiedPayments: num(data.resources?.verifiedPayments),
            wishlistItems: num(data.resources?.wishlistItems),
            reportsFiled: num(data.resources?.reportsFiled),
            reportsOnListings: num(data.resources?.reportsOnListings),
            wishlistsOnListings: num(data.resources?.wishlistsOnListings),
            sessions: num(data.resources?.sessions),
            userSessions: num(data.resources?.userSessions),
            auditLogs: num(data.resources?.auditLogs),
          },
          listingTitles: Array.isArray(data.listingTitles) ? data.listingTitles : [],
        }
        setDeleteSummary(sanitized)
        setShowDeleteConfirm(true)
      } else {
        toast.error(data.error || 'Failed to load delete summary')
      }
    } catch {
      toast.error('Failed to load delete summary — check your connection')
    } finally {
      setDeleteSummaryLoading(false)
    }
  }

  // Confirm and execute user deletion
  const confirmDeleteUser = async (userId: string) => {
    // ⚠️ Double-click prevention: if already deleting, bail out immediately
    if (deletingUser) return
    // ⚠️ Self-delete prevention (defense in depth — backend also enforces this)
    if (admin && userId === admin.id) {
      toast.error('You cannot delete your own admin account')
      return
    }
    setDeletingUser(true)
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_user', targetId: userId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // Use breakdown info in success message if available
        const affected = typeof data.affectedRecords === 'number' ? data.affectedRecords : 0
        const bd = data.breakdown || {}
        const parts: string[] = []
        if (bd.listings) parts.push(`${bd.listings} listing${bd.listings > 1 ? 's' : ''}`)
        if (bd.payments) parts.push(`${bd.payments} payment${bd.payments > 1 ? 's' : ''}`)
        if (bd.books) parts.push(`${bd.books} book${bd.books > 1 ? 's' : ''}`)
        const detail = parts.length > 0 ? ` (${parts.join(', ')} removed)` : ''
        toast.success(`User permanently deleted${affected > 0 ? ` · ${affected} record${affected > 1 ? 's' : ''} cleaned up${detail}` : ''}`)
        // Close modals + clear state
        setShowDeleteConfirm(false)
        setShowUserModal(false)
        setSelectedUser(null)
        setUserDetail(null)
        setDeleteSummary(null)
        // Refresh all data so user list / stats / payments reflect the deletion
        fetchData()
        if (activeTab === 'payments') fetchPayments()
        if (activeTab === 'audit') fetchAuditLogs()
      } else {
        // Distinguish common errors for clearer feedback
        if (res.status === 400) {
          toast.error(data.error || 'Invalid request')
        } else if (res.status === 403) {
          toast.error(data.error || 'You do not have permission to delete this user')
        } else if (res.status === 404) {
          toast.error(data.error || 'User not found (may have already been deleted)')
          // Close modals because the user no longer exists
          setShowDeleteConfirm(false)
          setShowUserModal(false)
          setSelectedUser(null)
          setUserDetail(null)
          setDeleteSummary(null)
          fetchData()
        } else if (res.status === 401) {
          toast.error('Your admin session has expired. Please log in again.')
        } else {
          toast.error(data.error || `Delete failed (HTTP ${res.status})`)
        }
      }
    } catch {
      toast.error('Network error during deletion — check your connection and try again')
    } finally {
      setDeletingUser(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/cnx-admin', { method: 'DELETE' })
    } catch { /* ignore */ }
    setAdmin(null)
  }

  const handleSessionExpire = () => {
    toast.error('Session expired. Please log in again.')
    setAdmin(null)
  }

  const handleLogin = (loggedInAdmin: AdminInfo) => {
    setAdmin(loggedInAdmin)
  }

  // Show login if not authenticated on client side
  if (!admin) {
    return <AdminLogin onLogin={handleLogin} />
  }

  // Sidebar navigation items
  const sidebarItems: { id: AdminTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    ...(isSuperAdmin ? [{ id: 'admins' as AdminTab, label: 'Admins', icon: UserCog, count: adminAccounts.length }] : []),
    { id: 'users', label: 'Users', icon: Users, count: stats?.totalUsers },
    { id: 'listings', label: 'Listings', icon: BookOpen, count: stats?.totalListings },
    { id: 'reports', label: 'Reports', icon: AlertTriangle, count: stats?.unresolvedReports },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.filter(p => p.status === 'pending' || p.status === 'pending_verification').length },
  ]

  // Filter helpers
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredListings = listings.filter(l =>
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.seller.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredReports = reports.filter(r =>
    r.listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.reason.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredPayments = payments.filter(p =>
    p.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.utrNumber && p.utrNumber.includes(searchTerm))
  )

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed md:relative z-50 w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col shrink-0"
      >
        {/* Logo area */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/logo-512x512.webp" alt="EduCampusHub" className="w-9 h-9 rounded-xl object-cover" />
            <div>
              <p className="text-sm font-bold text-slate-100">EduCampusHub</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Control Panel</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSearchTerm('') }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-brand/10 text-brand'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <Badge className={`h-5 min-w-[20px] px-1.5 text-[10px] rounded-full border-0 ${
                  activeTab === item.id ? 'bg-brand text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.count}
                </Badge>
              )}
            </button>
          ))}
        </nav>

        {/* Admin info */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
              {admin.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate">{admin.name}</p>
              <RoleBadge role={admin.role} />
            </div>
          </div>
          <SessionTimer onExpire={handleSessionExpire} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full mt-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-2 rounded-xl"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-14 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 flex items-center px-4 md:px-6 gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-slate-400 hover:text-slate-200"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>

          <h2 className="text-sm font-semibold text-slate-200 capitalize">
            {activeTab === 'audit' ? 'Audit Logs' : activeTab === 'payments' ? 'Payments' : activeTab === 'admins' ? 'Admin Management' : activeTab}
          </h2>

          <div className="flex-1" />

          {activeTab !== 'overview' && (
            <div className="relative max-w-xs w-full hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="h-8 pl-9 text-sm bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 rounded-lg"
              />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={fetchData}
            className="text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </header>

        {/* Content */}
        <main className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && (
                <OverviewTab stats={stats} loading={loading} onAction={adminAction} onOpenListing={openListingModal} />
              )}
              {activeTab === 'users' && (
                <UsersTab users={filteredUsers} loading={loading} onAction={adminAction} onOpenUser={openUserModal} adminId={admin.id} onDeleteUser={fetchDeleteSummary} deleteSummaryLoading={deleteSummaryLoading} />
              )}
              {activeTab === 'listings' && (
                <ListingsTab listings={filteredListings} loading={loading} onAction={adminAction} onOpenListing={openListingModal} />
              )}
              {activeTab === 'reports' && (
                <ReportsTab reports={filteredReports} loading={loading} onAction={adminAction} />
              )}
              {activeTab === 'audit' && (
                <AuditTab logs={auditLogs} loading={loading} />
              )}
              {activeTab === 'payments' && (
                <PaymentsTab payments={filteredPayments} loading={loading} onAction={adminAction} revenueData={revenueData} />
              )}
              {activeTab === 'admins' && isSuperAdmin && (
                <AdminsTab
                  admins={adminAccounts}
                  loading={adminAccountsLoading}
                  currentAdminId={admin.id}
                  onRefresh={fetchAdminAccounts}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Listing Detail/Edit Modal */}
      <AnimatePresence>
        {showListingModal && (
          <ListingDetailModal
            listing={selectedListing}
            editMode={listingEditMode}
            editForm={listingEditForm}
            loading={listingLoading}
            onSetEditMode={setListingEditMode}
            onSetEditForm={setListingEditForm}
            onSave={saveListingEdits}
            onAction={adminAction}
            onClose={() => { setShowListingModal(false); setSelectedListing(null); setListingEditMode(false) }}
            onRefresh={() => selectedListing && refreshListingDetail(selectedListing.id)}
          />
        )}
      </AnimatePresence>

      {/* User Detail/Edit Modal */}
      <AnimatePresence>
        {showUserModal && selectedUser && (
          <UserDetailModal
            user={selectedUser}
            userDetail={userDetail}
            editMode={userEditMode}
            editForm={userEditForm}
            userListings={userListings}
            userListingsLoading={userListingsLoading}
            onSetEditMode={setUserEditMode}
            onSetEditForm={setUserEditForm}
            onSave={saveUserEdits}
            onAction={adminAction}
            onOpenListing={openListingModal}
            onDeleteUser={fetchDeleteSummary}
            deleteSummaryLoading={deleteSummaryLoading}
            onClose={() => { setShowUserModal(false); setSelectedUser(null); setUserDetail(null); setUserEditMode(false) }}
            onRefresh={() => refreshUserDetail(selectedUser.id)}
            adminId={admin.id}
          />
        )}
      </AnimatePresence>

      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && deleteSummary && (
          <DeleteUserConfirmModal
            summary={deleteSummary}
            deleting={deletingUser}
            onConfirm={() => confirmDeleteUser(deleteSummary.user.id)}
            onCancel={() => { setShowDeleteConfirm(false); setDeleteSummary(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Listing Detail Modal ─────────────────────────────────────────

function ListingDetailModal({
  listing, editMode, editForm, loading, onSetEditMode, onSetEditForm, onSave, onAction, onClose, onRefresh
}: {
  listing: ListingDetail | null
  editMode: boolean
  editForm: ListingEditForm | null
  loading: boolean
  onSetEditMode: (v: boolean) => void
  onSetEditForm: (v: ListingEditForm) => void
  onSave: () => void
  onAction: (a: string, t: string) => void
  onClose: () => void
  onRefresh: () => void
}) {
  if (loading || !listing || !editForm) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl p-6 animate-pulse" onClick={e => e.stopPropagation()}>
          <div className="h-8 bg-slate-800 rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  const parsedImages: string[] = (() => {
    try {
      return JSON.parse(listing.images || '[]')
    } catch {
      return []
    }
  })()

  const conditionOptions = ['New', 'Like New', 'Good', 'Fair', 'Poor']
  const categoryOptions = CATEGORIES.map(c => ({ id: c.id, name: c.name }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-100 truncate">{editMode ? 'Edit Listing' : listing.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">ID: {listing.id} · by {listing.seller.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editMode ? (
              <Button size="sm" onClick={() => onSetEditMode(true)} className="gap-1.5 rounded-xl bg-brand hover:bg-brand/90 text-white">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => onSetEditMode(false)} className="text-slate-400 hover:text-slate-200">
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
              </>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-slate-200 shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[calc(90vh-180px)] overflow-y-auto custom-scrollbar">
          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            {listing.isSold && <Badge className="bg-slate-700 text-slate-300 border-0 text-xs rounded-full">Sold</Badge>}
            {listing.isFeatured && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs rounded-full">Featured</Badge>}
            {listing.isVerified && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs rounded-full">Verified</Badge>}
            {listing.isUrgent && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs rounded-full">Urgent</Badge>}
            {listing.isDigital && <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-xs rounded-full">Digital</Badge>}
          </div>

          {/* Image Gallery */}
          {parsedImages.length > 0 && (
            <div>
              <Label className="text-slate-400 text-xs mb-2 block">Images ({parsedImages.length})</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {parsedImages.map((img, i) => (
                  <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-800 border border-slate-700 hover:border-slate-500 transition-colors">
                      <img src={img} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Digital file link */}
          {listing.isDigital && listing.fileUrl && (
            <div>
              <Label className="text-slate-400 text-xs mb-1 block">Digital File</Label>
              <a href={listing.fileUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 text-sm underline break-all">
                {listing.fileUrl}
              </a>
            </div>
          )}

          <Separator className="bg-slate-800" />

          {editMode ? (
            /* Edit Mode Fields */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-slate-400 text-xs mb-1 block">Title</Label>
                <Input
                  value={editForm.title}
                  onChange={e => onSetEditForm({ ...editForm, title: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-slate-400 text-xs mb-1 block">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={e => onSetEditForm({ ...editForm, description: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-slate-200 min-h-24"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Original Price (₹)</Label>
                <Input
                  type="number"
                  value={editForm.originalPrice}
                  onChange={e => onSetEditForm({ ...editForm, originalPrice: Number(e.target.value) })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Selling Price (₹)</Label>
                <Input
                  type="number"
                  value={editForm.sellingPrice}
                  onChange={e => onSetEditForm({ ...editForm, sellingPrice: Number(e.target.value) })}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Category</Label>
                <Select value={editForm.category} onValueChange={v => onSetEditForm({ ...editForm, category: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {categoryOptions.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">State</Label>
                <Select
                  value={editForm.state || undefined}
                  onValueChange={v => onSetEditForm({ ...editForm, state: v, district: '' })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                    {INDIAN_STATES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">District</Label>
                <Select
                  key={`admin-district-${editForm.state}`}
                  value={editForm.district && (INDIAN_DISTRICTS[editForm.state] || []).includes(editForm.district) ? editForm.district : undefined}
                  onValueChange={v => onSetEditForm({ ...editForm, district: v, city: v })}
                  disabled={!editForm.state}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 w-full">
                    <SelectValue placeholder={editForm.state ? 'Select district' : 'Select state first'} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                    {(INDIAN_DISTRICTS[editForm.state] || []).map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Condition</Label>
                <Select value={editForm.condition} onValueChange={v => onSetEditForm({ ...editForm, condition: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {conditionOptions.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm">Featured</Label>
                  <Switch checked={editForm.isFeatured} onCheckedChange={v => onSetEditForm({ ...editForm, isFeatured: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm">Verified</Label>
                  <Switch checked={editForm.isVerified} onCheckedChange={v => onSetEditForm({ ...editForm, isVerified: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm">Sold</Label>
                  <Switch checked={editForm.isSold} onCheckedChange={v => onSetEditForm({ ...editForm, isSold: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm">Urgent</Label>
                  <Switch checked={editForm.isUrgent} onCheckedChange={v => onSetEditForm({ ...editForm, isUrgent: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300 text-sm">Digital</Label>
                  <Switch checked={editForm.isDigital} onCheckedChange={v => onSetEditForm({ ...editForm, isDigital: v })} />
                </div>
              </div>
            </div>
          ) : (
            /* Read Mode Fields */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="sm:col-span-2">
                <p className="text-slate-500 text-xs mb-1">Description</p>
                <p className="text-slate-200 whitespace-pre-wrap">{listing.description || 'No description'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Original Price</p>
                <p className="text-slate-200 font-mono">{formatINR(listing.originalPrice)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Selling Price</p>
                <p className="text-slate-200 font-mono font-bold">{formatINR(listing.sellingPrice)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Category</p>
                <p className="text-slate-200">{CATEGORIES.find(c => c.id === listing.category)?.name || listing.category}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">State</p>
                <p className="text-slate-200">{listing.state || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">District</p>
                <p className="text-slate-200">{listing.district || listing.city || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Condition</p>
                <p className="text-slate-200">{listing.condition}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Views / Saves</p>
                <p className="text-slate-200">{listing.views} / {listing.saves}</p>
              </div>
              {listing.subcategory && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Subcategory</p>
                  <p className="text-slate-200">{listing.subcategory}</p>
                </div>
              )}
              {listing.course && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Course</p>
                  <p className="text-slate-200">{listing.course}</p>
                </div>
              )}
              {listing.semester && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Semester</p>
                  <p className="text-slate-200">{listing.semester}</p>
                </div>
              )}
              {listing.whatsappNumber && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">WhatsApp</p>
                  <p className="text-slate-200">{listing.whatsappNumber}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 text-xs mb-1">Created</p>
                <p className="text-slate-300">{new Date(listing.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Updated</p>
                <p className="text-slate-300">{new Date(listing.updatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Seller</p>
                <p className="text-slate-200">{listing.seller.name} <span className="text-slate-500">({listing.seller.email})</span></p>
              </div>
            </div>
          )}

          <Separator className="bg-slate-800" />

          {/* Action buttons */}
          <div>
            <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wider">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {listing.isSold ? (
                <Button size="sm" variant="outline" onClick={() => { onAction('mark_unsold', listing.id); onRefresh() }} className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 rounded-xl text-xs">
                  <PackageX className="w-3.5 h-3.5" /> Mark Unsold
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { onAction('mark_sold', listing.id); onRefresh() }} className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 rounded-xl text-xs">
                  <PackageCheck className="w-3.5 h-3.5" /> Mark Sold
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { onAction('toggle_urgent', listing.id); onRefresh() }} className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 rounded-xl text-xs">
                <Zap className="w-3.5 h-3.5" /> {listing.isUrgent ? 'Remove Urgent' : 'Mark Urgent'}
              </Button>
              {listing.isVerified ? (
                <Button size="sm" variant="outline" onClick={() => { onAction('unverify_listing', listing.id); onRefresh() }} className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 rounded-xl text-xs">
                  <EyeOff className="w-3.5 h-3.5" /> Unverify
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { onAction('verify_listing', listing.id); onRefresh() }} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5 rounded-xl text-xs">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verify
                </Button>
              )}
              {listing.isFeatured ? (
                <Button size="sm" variant="outline" onClick={() => { onAction('unfeature_listing', listing.id); onRefresh() }} className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 rounded-xl text-xs">
                  <Star className="w-3.5 h-3.5" /> Unfeature
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { onAction('feature_listing', listing.id); onRefresh() }} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1.5 rounded-xl text-xs">
                  <Star className="w-3.5 h-3.5" /> Feature
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 rounded-xl text-xs">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-900 border-slate-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-slate-100">Delete Listing</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Are you sure you want to permanently delete &quot;{listing.title}&quot;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { onAction('delete_listing', listing.id); onClose() }} className="bg-red-600 hover:bg-red-700 text-white">
                      Delete Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── User Detail Modal ────────────────────────────────────────────

function UserDetailModal({
  user, userDetail, editMode, editForm, userListings, userListingsLoading, onSetEditMode, onSetEditForm, onSave, onAction, onOpenListing, onDeleteUser, deleteSummaryLoading, onClose, onRefresh, adminId
}: {
  user: UserItem
  userDetail: UserDetailData | null
  editMode: boolean
  editForm: UserEditForm | null
  userListings: ListingItem[]
  userListingsLoading: boolean
  onSetEditMode: (v: boolean) => void
  onSetEditForm: (v: UserEditForm) => void
  onSave: () => void
  onAction: (a: string, t: string) => void
  onOpenListing: (id: string) => void
  onDeleteUser: (id: string) => void
  deleteSummaryLoading: boolean
  onClose: () => void
  onRefresh: () => void
  adminId: string
}) {
  if (!editForm) return null

  const isSelf = user.id === adminId
  const detail = userDetail

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${user.premiumActive ? 'bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-amber-400/30' : 'bg-gradient-to-br from-brand to-accent'}`}>
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 truncate">{editMode ? 'Edit User' : user.name}</h2>
                {user.premiumActive && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-xs text-slate-500">{user.email}</p>
                {user.isAdmin && <RoleBadge role={user.adminRole || 'support_admin'} />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editMode ? (
              <Button size="sm" onClick={() => onSetEditMode(true)} className="gap-1.5 rounded-xl bg-brand hover:bg-brand/90 text-white">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => onSetEditMode(false)} className="text-slate-400 hover:text-slate-200">
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
              </>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-slate-200 shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[calc(90vh-180px)] overflow-y-auto custom-scrollbar">
          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            {user.premiumActive && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 border text-xs rounded-full gap-1"><Crown className="w-3 h-3" />Premium</Badge>}
            {user.isVerified && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs rounded-full"><BadgeCheck className="w-3 h-3 inline mr-0.5" />Verified</Badge>}
            {user.isBanned && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs rounded-full">Banned</Badge>}
            {user.isAdmin && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs rounded-full">Admin</Badge>}
            {!user.isBanned && !user.isAdmin && !user.premiumActive && <Badge className="bg-slate-700/50 text-slate-400 border-slate-700 text-xs rounded-full">Active</Badge>}
            <Badge className={`text-xs rounded-full ${user.planType === 'premium' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 border' : 'bg-slate-700/30 text-slate-400 border-slate-700'}`}>
              {(user.planType || 'normal').charAt(0).toUpperCase() + (user.planType || 'normal').slice(1)} Plan
            </Badge>
          </div>

          {editMode ? (
            /* Edit Mode Fields */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Name</Label>
                <Input value={editForm.name} onChange={e => onSetEditForm({ ...editForm, name: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Email</Label>
                <Input value={editForm.email} onChange={e => onSetEditForm({ ...editForm, email: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">College</Label>
                <Input value={editForm.college} onChange={e => onSetEditForm({ ...editForm, college: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">Phone</Label>
                <Input value={editForm.phone} onChange={e => onSetEditForm({ ...editForm, phone: e.target.value })} className="bg-slate-800 border-slate-700 text-slate-200" />
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">State</Label>
                <Select value={editForm.state || undefined} onValueChange={v => onSetEditForm({ ...editForm, state: v, district: '' })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                    {INDIAN_STATES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400 text-xs mb-1 block">District</Label>
                <Select
                  key={`user-edit-district-${editForm.state}`}
                  value={editForm.district && (INDIAN_DISTRICTS[editForm.state] || []).includes(editForm.district) ? editForm.district : undefined}
                  onValueChange={v => onSetEditForm({ ...editForm, district: v, city: v })}
                  disabled={!editForm.state}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 w-full">
                    <SelectValue placeholder={editForm.state ? 'Select district' : 'Select state first'} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                    {(INDIAN_DISTRICTS[editForm.state] || []).map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-5 sm:col-span-2">
                <Label className="text-slate-300 text-sm">Verified</Label>
                <Switch checked={editForm.isVerified} onCheckedChange={v => onSetEditForm({ ...editForm, isVerified: v })} />
              </div>
            </div>
          ) : (
            /* Read Mode - Comprehensive User Info */
            <>
              {/* Profile Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-1">College</p>
                  <p className="text-slate-200">{user.college || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Phone</p>
                  <p className="text-slate-200">{user.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">State / District</p>
                  <p className="text-slate-200">{user.state || user.city || '—'}{user.district ? `, ${user.district}` : ''}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Rating</p>
                  <p className="text-slate-200">{user.rating.toFixed(1)} / 5.0</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Total Sales</p>
                  <p className="text-slate-200">{user.totalSales}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Joined</p>
                  <p className="text-slate-300">{new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>

              {/* Upload & Plan Info */}
              {detail && (
                <>
                  <Separator className="bg-slate-800" />
                  <div>
                    <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wider">Upload & Plan Details</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-slate-100">{detail.freeUploadUsed ?? 0}<span className="text-xs text-slate-500">/5</span></p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Free Uploads Used</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-slate-100">{detail.paidUploadCredits ?? 0}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Paid Credits</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-slate-100">{detail.totalBooksUploaded ?? 0}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Total Books</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-slate-100">{detail.premiumActive ? `${detail.premiumBooksUsed ?? 0}/${detail.premiumBookLimit ?? 29}` : '—'}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Premium Quota</p>
                      </div>
                    </div>
                    {detail.premiumActive && detail.premiumExpiryDate && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300">Premium expires: {new Date(detail.premiumExpiryDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator className="bg-slate-800" />

              {/* User's Listings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                    Assigned Listings ({detail?.listings?.length ?? userListings.length})
                  </p>
                  {detail && detail.listings.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-orange-400 hover:bg-orange-500/10 gap-1">
                          <ListX className="w-3 h-3" /> Remove All
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">Remove All Listings</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Permanently delete all {detail.listings.length} listing(s) by {user.name}? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { onAction('delete_user_listings', user.id); onRefresh() }} className="bg-orange-600 hover:bg-orange-700 text-white">
                            Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {userListingsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-10 bg-slate-800 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (detail?.listings ?? userListings).length === 0 ? (
                  <p className="text-slate-500 text-sm py-4 text-center">No listings assigned</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                    {(detail?.listings ?? userListings).map(l => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors group"
                        onClick={() => { onClose(); onOpenListing(l.id) }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-200 truncate">{l.title}</p>
                          <div className="flex gap-1 mt-0.5">
                            {l.isSold && <Badge className="bg-slate-700 text-slate-300 border-0 text-[9px] rounded-full px-1.5">Sold</Badge>}
                            {l.isFeatured && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[9px] rounded-full px-1.5">Featured</Badge>}
                            {l.isVerified && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] rounded-full px-1.5">Verified</Badge>}
                            {l.uploadType === 'premium' && <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[9px] rounded-full px-1.5">Premium</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-sm text-slate-300 font-mono">{formatINR(l.sellingPrice)}</span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-700" onClick={e => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-slate-100">Remove Listing</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-400">
                                  Permanently delete &quot;{l.title}&quot;? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { onAction('delete_listing', l.id); onRefresh() }} className="bg-red-600 hover:bg-red-700 text-white">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment History */}
              {detail && detail.payments.length > 0 && (
                <>
                  <Separator className="bg-slate-800" />
                  <div>
                    <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wider">Payment History ({detail.payments.length})</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                      {detail.payments.slice(0, 10).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg text-xs">
                          <div className="flex items-center gap-2">
                            <Badge className={`${p.status === 'verified' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : p.status === 'rejected' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'} border text-[9px] rounded-full`}>
                              {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </Badge>
                            <span className="text-slate-400">{p.paymentType === 'premium_plan' ? 'Premium Plan' : 'Upload Fee'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 font-mono">{formatINR(p.amount)}</span>
                            <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Reports by User */}
              {detail && detail.reports.length > 0 && (
                <>
                  <Separator className="bg-slate-800" />
                  <div>
                    <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wider">Reports Filed ({detail.reports.length})</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {detail.reports.slice(0, 5).map(r => (
                        <div key={r.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg text-xs">
                          <div className="min-w-0 flex-1">
                            <span className="text-slate-300 truncate block">{r.reason}</span>
                            <span className="text-slate-500">on: {r.listing.title}</span>
                          </div>
                          <Badge className={`${r.isResolved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'} border-0 text-[9px] rounded-full ml-2`}>
                            {r.isResolved ? 'Resolved' : 'Open'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Wishlist */}
              {detail && detail.wishlistItems.length > 0 && (
                <>
                  <Separator className="bg-slate-800" />
                  <div>
                    <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wider">Wishlist ({detail.wishlistItems.length})</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {detail.wishlistItems.slice(0, 5).map(w => (
                        <div key={w.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg text-xs">
                          <span className="text-slate-300 truncate">{w.listing.title}</span>
                          <span className="text-slate-400 font-mono">{formatINR(w.listing.sellingPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator className="bg-slate-800" />

              {/* Action buttons */}
              <div>
                <p className="text-slate-400 text-xs font-medium mb-3 uppercase tracking-wider">Admin Actions</p>
                <div className="flex flex-wrap gap-2">
                  {!user.isVerified && (
                    <Button size="sm" variant="outline" onClick={() => { onAction('verify_seller', user.id); onRefresh() }} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5 rounded-xl text-xs">
                      <BadgeCheck className="w-3.5 h-3.5" /> Verify
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className={`gap-1.5 rounded-xl text-xs ${user.isBanned ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'}`}>
                        <Ban className="w-3.5 h-3.5" /> {user.isBanned ? 'Unban' : 'Ban'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">{user.isBanned ? 'Unban User' : 'Ban User'}</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          {user.isBanned
                            ? `Are you sure you want to unban ${user.name}?`
                            : `Are you sure you want to ban ${user.name}? They will lose access to their account.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => { onAction(user.isBanned ? 'unban_user' : 'ban_user', user.id); onRefresh() }}
                          className={user.isBanned ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                        >
                          {user.isBanned ? 'Unban' : 'Ban'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className={`gap-1.5 rounded-xl text-xs ${user.premiumActive ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}`}>
                        <Crown className="w-3.5 h-3.5" /> {user.premiumActive ? 'Deactivate Premium' : 'Activate Premium'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">{user.premiumActive ? 'Deactivate Premium' : 'Activate Premium'}</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          {user.premiumActive
                            ? `Remove Premium status from ${user.name}? They will lose premium features.`
                            : `Manually activate Premium for ${user.name}? They will get 29 book uploads for 30 days.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => { onAction('toggle_premium', user.id); onRefresh() }}
                          className={user.premiumActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
                        >
                          {user.premiumActive ? 'Deactivate' : 'Activate'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {!isSelf && !user.isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-600/50 text-red-500 hover:bg-red-500/10 gap-1.5 rounded-xl text-xs"
                      onClick={() => onDeleteUser(user.id)}
                      disabled={deleteSummaryLoading}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      {deleteSummaryLoading ? 'Loading...' : 'Delete User Account'}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Delete User Confirmation Modal ─────────────────────────────────

function DeleteUserConfirmModal({
  summary, deleting, onConfirm, onCancel
}: {
  summary: DeleteSummary
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // ─── NaN FIX: coerce every count to a valid number (default 0) ───
  // The backend may legitimately return undefined/null for some fields
  // (e.g. when no listings exist), which would cause `+` to produce NaN
  // and "Total affected records: NaN" to render in the modal.
  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const r = {
    listings: num(summary.resources?.listings),
    activeListings: num(summary.resources?.activeListings),
    soldListings: num(summary.resources?.soldListings),
    premiumListings: num(summary.resources?.premiumListings),
    featuredListings: num(summary.resources?.featuredListings),
    totalViews: num(summary.resources?.totalViews),
    totalSaves: num(summary.resources?.totalSaves),
    totalSpentOnPlatform: num(summary.resources?.totalSpentOnPlatform),
    payments: num(summary.resources?.payments),
    verifiedPayments: num(summary.resources?.verifiedPayments),
    wishlistItems: num(summary.resources?.wishlistItems),
    reportsFiled: num(summary.resources?.reportsFiled),
    reportsOnListings: num(summary.resources?.reportsOnListings),
    wishlistsOnListings: num(summary.resources?.wishlistsOnListings),
    sessions: num(summary.resources?.sessions),
    userSessions: num(summary.resources?.userSessions),
    auditLogs: num(summary.resources?.auditLogs),
  }
  const listingTitles = summary.listingTitles || []
  const totalAffected =
    r.listings +
    r.payments +
    r.wishlistItems +
    r.reportsFiled +
    r.wishlistsOnListings +
    r.reportsOnListings +
    r.sessions +
    r.userSessions +
    r.auditLogs

  // Mobile-friendly card data
  const resourceCards = [
    { label: 'Listings', value: r.listings, sub: `${r.activeListings} active, ${r.soldListings} sold` },
    { label: 'Premium Listings', value: r.premiumListings, sub: r.featuredListings > 0 ? `${r.featuredListings} featured` : undefined },
    { label: 'Total Views Lost', value: r.totalViews, sub: `${r.totalSaves} saves` },
    { label: 'Payments', value: r.payments, sub: `${r.verifiedPayments} verified` },
    { label: 'Spent on Platform', value: formatINR(r.totalSpentOnPlatform), sub: 'total verified' },
    { label: 'Wishlist Items', value: r.wishlistItems, sub: 'saved by user' },
    { label: 'Reports Filed', value: r.reportsFiled, sub: 'by this user' },
    { label: 'Reports on Listings', value: r.reportsOnListings, sub: 'on their listings' },
    { label: 'Wishlists on Listings', value: r.wishlistsOnListings, sub: 'by other users' },
  ].filter(item => typeof item.value === 'string' || item.value > 0)

  // Format joined date safely (defensive against invalid date strings)
  const joinedDate = (() => {
    try {
      const d = new Date(summary.user.createdAt)
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return '—'
    }
  })()

  const locationParts = [summary.user.district, summary.user.state].filter(Boolean)
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : '—'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-user-title"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        // Mobile: full-width sheet anchored to bottom; Desktop: centered modal max-w-2xl
        className="w-full max-w-2xl max-h-[100vh] sm:max-h-[90vh] bg-slate-900 border border-red-500/30 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="delete-user-title" className="text-base sm:text-lg font-bold text-red-400 truncate">
                Permanently Delete User Account
              </h2>
              <p className="text-xs text-slate-500">This action is IRREVERSIBLE. Review the data that will be destroyed.</p>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Account Details */}
          <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Account Details</p>
            {/* Mobile: 1 column; sm+: 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <div className="flex justify-between sm:block">
                <span className="text-slate-500">Name:</span>{' '}
                <span className="text-slate-200 font-medium truncate">{summary.user.name || '—'}</span>
              </div>
              <div className="flex justify-between sm:block min-w-0">
                <span className="text-slate-500">Email:</span>{' '}
                <span className="text-slate-200 truncate inline-block max-w-full align-bottom">{summary.user.email || '—'}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-slate-500">Phone:</span>{' '}
                <span className="text-slate-200">{summary.user.phone || '—'}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-slate-500">College:</span>{' '}
                <span className="text-slate-200 truncate">{summary.user.college || '—'}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-slate-500">Location:</span>{' '}
                <span className="text-slate-200">{locationStr}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-slate-500">Joined:</span>{' '}
                <span className="text-slate-200">{joinedDate}</span>
              </div>
            </div>
          </div>

          {/* Resources Affected */}
          <div className="bg-red-500/5 rounded-xl p-3 sm:p-4 border border-red-500/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm font-semibold text-red-400">Resources That Will Be Destroyed</p>
            </div>
            {/* Mobile: 2 columns; sm+: 3 columns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {resourceCards.length === 0 ? (
                <div className="col-span-full text-xs text-slate-500 italic py-2">
                  No related resources — only the user account will be deleted.
                </div>
              ) : resourceCards.map(item => (
                <div key={item.label} className="bg-slate-800/50 rounded-lg p-2 sm:p-2.5">
                  <p className="text-sm font-bold text-slate-200 break-words">{item.value}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{item.label}</p>
                  {item.sub && <p className="text-[9px] text-slate-600 mt-0.5 leading-tight">{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Listing Titles That Will Be Deleted */}
          {listingTitles.length > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-3 sm:p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                Listings to be deleted ({listingTitles.length}{r.listings > 10 ? ` of ${r.listings}` : ''})
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                {listingTitles.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-xs py-1 gap-2">
                    <span className="text-slate-300 truncate flex-1 min-w-0">{l.title}</span>
                    <span className="text-slate-400 font-mono shrink-0">{formatINR(l.price)}</span>
                  </div>
                ))}
                {r.listings > 10 && (
                  <p className="text-xs text-slate-500 mt-1">+ {r.listings - 10} more listings</p>
                )}
              </div>
            </div>
          )}

          {/* Irreversible Warning */}
          <div className="flex items-start gap-2 bg-amber-500/5 rounded-xl p-3 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300">
              <span className="font-semibold">Warning:</span> This action is{' '}
              <span className="font-bold text-amber-200">irreversible</span>. All associated data
              (listings, payments, wishlists, reports, sessions) will be permanently removed.
              The user will need to register a new account to use the platform again.
            </div>
          </div>

          {/* Total Impact */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-red-500/10 rounded-xl p-3 border border-red-500/20">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm font-medium text-red-300">
                Total affected records: <span className="font-bold">{totalAffected}</span>
              </span>
            </div>
            {summary.user.premiumActive && (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 border text-xs rounded-full shrink-0">
                Premium User
              </Badge>
            )}
          </div>
        </div>

        {/* Footer — buttons stack on mobile, row on desktop */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-5 border-t border-slate-800 shrink-0">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 w-full sm:w-auto"
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white gap-2 w-full sm:w-auto"
          >
            {deleting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <UserX className="w-4 h-4" />
                Permanently Delete Account
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Overview Tab ──────────────────────────────────────────────────

function OverviewTab({ stats, loading, onAction, onOpenListing }: { stats: Stats | null; loading: boolean; onAction: (a: string, t: string) => void; onOpenListing: (id: string) => void }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-5 bg-slate-900/50 border-slate-800 animate-pulse">
            <div className="h-20 bg-slate-800 rounded" />
          </Card>
        ))}
      </div>
    )
  }

  const statCards = [
    { icon: Users, label: 'Total Users', value: stats.totalUsers, color: 'from-brand to-accent' },
    { icon: BookOpen, label: 'Active Listings', value: stats.activeListings, color: 'from-accent to-purple-light' },
    { icon: AlertTriangle, label: 'Open Reports', value: stats.unresolvedReports, color: 'from-red-500 to-rose-600' },
    { icon: Eye, label: 'Total Views', value: stats.totalViews, color: 'from-cyan-500 to-brand' },
    { icon: Star, label: 'Featured', value: stats.featuredListings, color: 'from-amber-500 to-orange-500' },
    { icon: TrendingUp, label: 'Total Listings', value: stats.totalListings, color: 'from-emerald-500 to-green-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card className="p-4 bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-100 font-heading">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className="p-5 bg-slate-900/50 border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Listings by Category</h3>
          <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
            {stats.categoryStats.map((c, i) => {
              const catInfo = CATEGORIES.find(cat => cat.id === c.category)
              const maxCount = Math.max(...stats.categoryStats.map(s => s.count))
              const pct = maxCount > 0 ? (c.count / maxCount) * 100 : 0
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-28 truncate shrink-0">
                    {catInfo?.name || c.category}
                  </span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.05, duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-brand to-accent rounded-full"
                    />
                  </div>
                  <span className="text-xs text-slate-300 font-mono w-8 text-right">{c.count}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* City Breakdown */}
        <Card className="p-5 bg-slate-900/50 border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Top Cities</h3>
          <div className="space-y-3">
            {stats.cityStats.map((c, i) => {
              const maxCount = Math.max(...stats.cityStats.map(s => s.count))
              const pct = maxCount > 0 ? (c.count / maxCount) * 100 : 0
              return (
                <div key={c.city} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 w-20 shrink-0">{c.city}</span>
                  <div className="flex-1 h-6 bg-slate-800 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.08, duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-brand rounded-lg"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-300 font-medium">{c.count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Recent Listings */}
      <Card className="p-5 bg-slate-900/50 border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Recent Listings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Title</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Seller</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Price</th>
                <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Status</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentListings.map(listing => (
                <tr key={listing.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2.5 px-3">
                    <button onClick={() => onOpenListing(listing.id)} className="text-slate-200 max-w-[200px] truncate hover:text-brand transition-colors text-left">
                      {listing.title}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{listing.seller.name}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono">{formatINR(listing.sellingPrice)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex gap-1">
                      {listing.isSold && <Badge className="bg-slate-700 text-slate-300 border-0 text-[10px] rounded-full">Sold</Badge>}
                      {listing.isFeatured && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] rounded-full">Featured</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onAction('verify_listing', listing.id)} className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                        <BadgeCheck className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onAction('feature_listing', listing.id)} className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                        <Star className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-900 border-slate-700">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-slate-100">Delete Listing</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">
                              Are you sure you want to delete &quot;{listing.title}&quot;? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onAction('delete_listing', listing.id)} className="bg-red-600 hover:bg-red-700 text-white">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────

function UsersTab({ users, loading, onAction, onOpenUser, adminId, onDeleteUser, deleteSummaryLoading }: { users: UserItem[]; loading: boolean; onAction: (a: string, t: string, d?: string) => void; onOpenUser: (u: UserItem) => void; adminId: string; onDeleteUser: (id: string) => void; deleteSummaryLoading: boolean }) {
  if (loading) {
    return <LoadingSkeleton />
  }

  const normalUsers = users.filter(u => !u.isAdmin)
  const adminUsers = users.filter(u => u.isAdmin)
  const premiumCount = users.filter(u => u.premiumActive).length
  const bannedCount = users.filter(u => u.isBanned).length
  const verifiedCount = users.filter(u => u.isVerified).length

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 bg-slate-900/50 border-slate-800">
          <p className="text-xl font-bold text-slate-100">{users.length}</p>
          <p className="text-[10px] text-slate-500">Total Users</p>
        </Card>
        <Card className="p-3 bg-slate-900/50 border-slate-800">
          <p className="text-xl font-bold text-amber-400">{premiumCount}</p>
          <p className="text-[10px] text-slate-500">Premium</p>
        </Card>
        <Card className="p-3 bg-slate-900/50 border-slate-800">
          <p className="text-xl font-bold text-emerald-400">{verifiedCount}</p>
          <p className="text-[10px] text-slate-500">Verified</p>
        </Card>
        <Card className="p-3 bg-slate-900/50 border-slate-800">
          <p className="text-xl font-bold text-red-400">{bannedCount}</p>
          <p className="text-[10px] text-slate-500">Banned</p>
        </Card>
        <Card className="p-3 bg-slate-900/50 border-slate-800">
          <p className="text-xl font-bold text-slate-300">{adminUsers.length}</p>
          <p className="text-[10px] text-slate-500">Admins</p>
        </Card>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs">User</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs hidden md:table-cell">Location / College</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs hidden lg:table-cell">Listings</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs hidden sm:table-cell">Plan</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs">Status / Role</th>
              <th className="text-right py-2.5 px-3 text-slate-500 font-medium text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${user.isBanned ? 'opacity-60' : ''}`}>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${user.premiumActive ? 'bg-gradient-to-br from-amber-400 to-orange-500' : user.isAdmin ? 'bg-gradient-to-br from-amber-500 to-red-500' : 'bg-gradient-to-br from-brand to-accent'}`}>
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-medium truncate max-w-[140px]">{user.name}</span>
                        {user.premiumActive && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        {user.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">{user.email}</p>
                      {user.phone && <p className="text-[10px] text-slate-600 truncate">{user.phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 hidden md:table-cell">
                  <p className="text-slate-400 text-xs truncate max-w-[150px]">{user.college || '—'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.district ? `${user.district}, ${user.state || ''}` : user.city || '—'}</p>
                </td>
                <td className="py-2.5 px-3 text-slate-300 font-mono hidden lg:table-cell">{user._count.listings}</td>
                <td className="py-2.5 px-3 hidden sm:table-cell">
                  <Badge className={`text-[10px] rounded-full ${user.planType === 'premium' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 border' : 'bg-slate-700/30 text-slate-400 border-slate-700'}`}>
                    {(user.planType || 'normal').charAt(0).toUpperCase() + (user.planType || 'normal').slice(1)}
                  </Badge>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex gap-1 flex-wrap">
                    {user.isAdmin && <RoleBadge role={user.adminRole || 'support_admin'} />}
                    {user.premiumActive && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 border text-[10px] rounded-full gap-0.5"><Crown className="w-2.5 h-2.5" />Pro</Badge>}
                    {user.isBanned && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] rounded-full">Banned</Badge>}
                    {!user.isBanned && !user.isAdmin && !user.premiumActive && <Badge className="bg-slate-700/50 text-slate-400 border-slate-700 text-[10px] rounded-full">Active</Badge>}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex justify-end gap-1">
                    {/* View / Select button */}
                    <Button size="sm" variant="ghost" onClick={() => onOpenUser(user)} className="h-7 text-xs text-cyan-400 hover:bg-cyan-500/10 gap-1">
                      <Eye className="w-3 h-3" /> View
                    </Button>
                    {!user.isVerified && (
                      <Button size="sm" variant="ghost" onClick={() => onAction('verify_seller', user.id)} className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1" title="Verify">
                        <BadgeCheck className="w-3 h-3" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className={`h-7 text-xs gap-1 ${user.isBanned ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-red-400 hover:bg-red-500/10'}`} title={user.isBanned ? 'Unban' : 'Ban'}>
                          <Ban className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">{user.isBanned ? 'Unban User' : 'Ban User'}</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            {user.isBanned
                              ? `Are you sure you want to unban ${user.name}?`
                              : `Are you sure you want to ban ${user.name}? They will lose access to their account.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onAction(user.isBanned ? 'unban_user' : 'ban_user', user.id)}
                            className={user.isBanned ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                          >
                            {user.isBanned ? 'Unban' : 'Ban'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {/* Toggle Premium */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className={`h-7 text-xs gap-1 ${user.premiumActive ? 'text-amber-400 hover:bg-amber-500/10' : 'text-slate-400 hover:bg-slate-700/50'}`} title={user.premiumActive ? 'Deactivate Premium' : 'Activate Premium'}>
                          <Crown className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">{user.premiumActive ? 'Deactivate Premium' : 'Activate Premium'}</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            {user.premiumActive
                              ? `Remove Premium status from ${user.name}? They will lose premium features.`
                              : `Manually activate Premium for ${user.name}? They will get 29 book uploads for 30 days.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onAction('toggle_premium', user.id)}
                            className={user.premiumActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
                          >
                            {user.premiumActive ? 'Deactivate' : 'Activate'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {/* Delete user - not for admins or self - uses delete summary flow */}
                    {!user.isAdmin && user.id !== adminId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500 hover:bg-red-500/10"
                        title="Delete User Account"
                        onClick={() => onDeleteUser(user.id)}
                        disabled={deleteSummaryLoading}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Listings Tab ─────────────────────────────────────────────────

function ListingsTab({ listings, loading, onAction, onOpenListing }: { listings: ListingItem[]; loading: boolean; onAction: (a: string, t: string) => void; onOpenListing: (id: string) => void }) {
  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{listings.length} listings</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs">Listing</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs hidden md:table-cell">Seller</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs">Price</th>
              <th className="text-left py-2.5 px-3 text-slate-500 font-medium text-xs">Status</th>
              <th className="text-right py-2.5 px-3 text-slate-500 font-medium text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map(listing => (
              <tr key={listing.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2.5 px-3">
                  <div className="min-w-0">
                    <button onClick={() => onOpenListing(listing.id)} className="text-slate-200 font-medium truncate max-w-[200px] hover:text-brand transition-colors text-left block">
                      {listing.title}
                    </button>
                    <p className="text-xs text-slate-500">{CATEGORIES.find(c => c.id === listing.category)?.name || listing.category} · {listing.district || listing.city}{listing.state ? `, ${listing.state}` : ''}</p>
                  </div>
                </td>
                <td className="py-2.5 px-3 hidden md:table-cell">
                  <p className="text-slate-400">{listing.seller.name}</p>
                  <p className="text-xs text-slate-500">{listing.seller.college || ''}</p>
                </td>
                <td className="py-2.5 px-3 text-slate-300 font-mono">{formatINR(listing.sellingPrice)}</td>
                <td className="py-2.5 px-3">
                  <div className="flex gap-1 flex-wrap">
                    {listing.isSold && <Badge className="bg-slate-700 text-slate-300 border-0 text-[10px] rounded-full">Sold</Badge>}
                    {listing.isFeatured && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] rounded-full">Featured</Badge>}
                    {listing.isVerified && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] rounded-full">Verified</Badge>}
                    {listing.isUrgent && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] rounded-full">Urgent</Badge>}
                    {listing.isDigital && <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-[10px] rounded-full">Digital</Badge>}
                    {!listing.isSold && !listing.isFeatured && !listing.isVerified && (
                      <Badge className="bg-slate-700/50 text-slate-400 border-slate-700 text-[10px] rounded-full">Active</Badge>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex justify-end gap-1">
                    {/* Edit button */}
                    <Button size="sm" variant="ghost" onClick={() => onOpenListing(listing.id)} className="h-7 text-xs text-cyan-400 hover:bg-cyan-500/10" title="Edit listing">
                      <Pencil className="w-3 h-3" />
                    </Button>
                    {/* Sold/Unsold toggle */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAction(listing.isSold ? 'mark_unsold' : 'mark_sold', listing.id)}
                      className={`h-7 text-xs ${listing.isSold ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-500/10'}`}
                      title={listing.isSold ? 'Mark unsold' : 'Mark sold'}
                    >
                      {listing.isSold ? <PackageX className="w-3 h-3" /> : <PackageCheck className="w-3 h-3" />}
                    </Button>
                    {/* Urgent toggle */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAction('toggle_urgent', listing.id)}
                      className={`h-7 text-xs ${listing.isUrgent ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:bg-slate-500/10'}`}
                      title={listing.isUrgent ? 'Remove urgent' : 'Mark urgent'}
                    >
                      <Zap className="w-3 h-3" />
                    </Button>
                    {/* Verify/Unverify */}
                    {listing.isVerified ? (
                      <Button size="sm" variant="ghost" onClick={() => onAction('unverify_listing', listing.id)} className="h-7 text-xs text-slate-400 hover:bg-slate-500/10" title="Unverify">
                        <EyeOff className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => onAction('verify_listing', listing.id)} className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10" title="Verify">
                        <BadgeCheck className="w-3 h-3" />
                      </Button>
                    )}
                    {/* Feature/Unfeature */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAction(listing.isFeatured ? 'unfeature_listing' : 'feature_listing', listing.id)}
                      className={`h-7 text-xs ${listing.isFeatured ? 'text-slate-400 hover:bg-slate-500/10' : 'text-amber-400 hover:bg-amber-500/10'}`}
                      title={listing.isFeatured ? 'Unfeature' : 'Feature'}
                    >
                      <Star className="w-3 h-3" />
                    </Button>
                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-red-500/10" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">Delete Listing</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Are you sure you want to delete &quot;{listing.title}&quot;? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onAction('delete_listing', listing.id)} className="bg-red-600 hover:bg-red-700 text-white">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────

function ReportsTab({ reports, loading, onAction }: { reports: ReportItem[]; loading: boolean; onAction: (a: string, t: string) => void }) {
  if (loading) return <LoadingSkeleton />

  const unresolved = reports.filter(r => !r.isResolved)
  const resolved = reports.filter(r => r.isResolved)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">Unresolved</span>
          </div>
          <p className="text-2xl font-bold text-red-300 mt-1">{unresolved.length}</p>
        </Card>
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Resolved</span>
          </div>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{resolved.length}</p>
        </Card>
      </div>

      <div className="space-y-2">
        {reports.map(report => (
          <Card key={report.id} className={`p-4 bg-slate-900/50 border-slate-800 ${report.isResolved ? 'opacity-50' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200 truncate">{report.listing.title}</span>
                  {report.isResolved ? (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] rounded-full shrink-0">Resolved</Badge>
                  ) : (
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] rounded-full shrink-0">Open</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">{report.reason}</p>
                <p className="text-xs text-slate-500 mt-1">By {report.reporter.name} · {new Date(report.createdAt).toLocaleDateString()}</p>
              </div>
              {!report.isResolved && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="shrink-0 border-slate-700 text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 rounded-xl gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-100">Resolve Report</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        Mark this report as resolved? The report for &quot;{report.listing.title}&quot; will be closed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onAction('resolve_report', report.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        Resolve
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Audit Tab ────────────────────────────────────────────────────

function AuditTab({ logs, loading }: { logs: AuditLogItem[]; loading: boolean }) {
  if (loading) return <LoadingSkeleton />

  const actionIcons: Record<string, React.ElementType> = {
    delete_listing: Trash2,
    ban_user: Ban,
    unban_user: CheckCircle2,
    verify_seller: BadgeCheck,
    verify_listing: BadgeCheck,
    unverify_listing: EyeOff,
    feature_listing: Star,
    unfeature_listing: Star,
    resolve_report: CheckCircle2,
    mark_sold: PackageCheck,
    mark_unsold: PackageX,
    mark_urgent: Zap,
    unmark_urgent: Zap,
    edit_listing: Pencil,
    edit_user: UserCog,
    delete_user: UserX,
    delete_user_listings: ListX,
  }
  const actionColors: Record<string, string> = {
    delete_listing: 'text-red-400 bg-red-500/10',
    ban_user: 'text-red-400 bg-red-500/10',
    unban_user: 'text-emerald-400 bg-emerald-500/10',
    verify_seller: 'text-emerald-400 bg-emerald-500/10',
    verify_listing: 'text-emerald-400 bg-emerald-500/10',
    unverify_listing: 'text-slate-400 bg-slate-500/10',
    feature_listing: 'text-amber-400 bg-amber-500/10',
    unfeature_listing: 'text-slate-400 bg-slate-500/10',
    resolve_report: 'text-emerald-400 bg-emerald-500/10',
    mark_sold: 'text-cyan-400 bg-cyan-500/10',
    mark_unsold: 'text-slate-400 bg-slate-500/10',
    mark_urgent: 'text-red-400 bg-red-500/10',
    unmark_urgent: 'text-slate-400 bg-slate-500/10',
    edit_listing: 'text-cyan-400 bg-cyan-500/10',
    edit_user: 'text-cyan-400 bg-cyan-500/10',
    delete_user: 'text-red-400 bg-red-500/10',
    delete_user_listings: 'text-orange-400 bg-orange-500/10',
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400 mb-4">{logs.length} log entries</p>
      {logs.map(log => {
        const Icon = actionIcons[log.action] || FileText
        const color = actionColors[log.action] || 'text-slate-400 bg-slate-500/10'
        return (
          <Card key={log.id} className="p-3 bg-slate-900/50 border-slate-800 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-200 font-medium">{log.action.replace(/_/g, ' ')}</span>
                <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] rounded-full">{log.targetType}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                by {log.actor.name} · {new Date(log.createdAt).toLocaleString()}
                {log.ipAddress && ` · IP: ${log.ipAddress}`}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
          </Card>
        )
      })}
    </div>
  )
}

// ─── UPI Config Section ────────────────────────────────────────────

function UPIConfigSection() {
  const [upiId, setUpiId] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentUpi, setCurrentUpi] = useState('')

  useEffect(() => {
    // Fetch current UPI from existing payments
    const fetchUpi = async () => {
      try {
        const res = await fetch('/api/cnx-admin?type=payments')
        if (res.ok) {
          const d = await res.json()
          const lastPayment = (d.payments || []).find((p: PaymentItem) => p.upiId)
          if (lastPayment?.upiId) setCurrentUpi(lastPayment.upiId)
          else setCurrentUpi('sagathiyapradip1137-3@oksbi')
        }
      } catch {
        setCurrentUpi('sagathiyapradip1137-3@oksbi')
      }
    }
    fetchUpi()
  }, [])

  const saveUpi = async () => {
    if (!upiId.trim()) {
      toast.error('UPI ID is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_upi', targetId: 'default', details: { upiId: upiId.trim() } }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('UPI ID updated successfully')
        setCurrentUpi(upiId.trim())
        setUpiId('')
      } else {
        toast.error(data.error || 'Failed to update UPI ID')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5 bg-slate-900/50 border-slate-800">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-slate-200">UPI Configuration</h3>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <p className="text-xs text-slate-500 mb-1">Current UPI ID</p>
          <p className="text-sm text-brand font-mono font-semibold">{currentUpi || 'Not configured'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Input
          value={upiId}
          onChange={e => setUpiId(e.target.value)}
          placeholder="Enter new UPI ID (e.g., name@oksbi)"
          className="flex-1 bg-slate-800 border-slate-700 text-slate-200 h-9 text-sm"
        />
        <Button
          size="sm"
          onClick={saveUpi}
          disabled={saving || !upiId.trim()}
          className="gap-1.5 rounded-xl bg-brand hover:bg-brand/90 text-white"
        >
          {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Update
        </Button>
      </div>
      <p className="text-xs text-slate-500 mt-2">This UPI ID will be used for all payment QR codes across the platform</p>
    </Card>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────

function PaymentsTab({ payments, loading, onAction, revenueData }: { payments: PaymentItem[]; loading: boolean; onAction: (a: string, t: string, d?: string) => void; revenueData?: { totalRevenue: number; uploadFeeRevenue: number; premiumRevenue: number; premiumUsers: number; pendingPayments: number } | null }) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null)

  if (loading) return <LoadingSkeleton />

  const pending = payments.filter(p => p.status === 'pending' || p.status === 'pending_verification')
  const verified = payments.filter(p => p.status === 'verified')
  const rejected = payments.filter(p => p.status === 'rejected')
  const expired = payments.filter(p => p.status === 'expired')

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    pending_verification: { label: 'Awaiting Review', className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    verified: { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    rejected: { label: 'Rejected', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
    expired: { label: 'Expired', className: 'bg-slate-700/50 text-slate-400 border-slate-700' },
  }

  return (
    <div className="space-y-4">
      {/* Revenue Analytics Cards */}
      {revenueData && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-amber-300 mt-1">{formatINR(revenueData.totalRevenue)}</p>
          </Card>
          <Card className="p-4 bg-brand/5 border-brand/20">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand" />
              <span className="text-sm text-brand font-medium">Upload Fees</span>
            </div>
            <p className="text-2xl font-bold text-brand mt-1">{formatINR(revenueData.uploadFeeRevenue)}</p>
          </Card>
          <Card className="p-4 bg-amber-500/5 border-amber-500/20">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">Premium Revenue</span>
            </div>
            <p className="text-2xl font-bold text-amber-300 mt-1">{formatINR(revenueData.premiumRevenue)}</p>
          </Card>
          <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Premium Users</span>
            </div>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{revenueData.premiumUsers}</p>
          </Card>
          <Card className="p-4 bg-cyan-500/5 border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-400 font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-cyan-300 mt-1">{pending.length}</p>
          </Card>
        </div>
      )}

      {/* UPI Config Section */}
      <UPIConfigSection />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-amber-500/5 border-amber-500/20">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400 font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-1">{pending.length}</p>
        </Card>
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Verified</span>
          </div>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{verified.length}</p>
        </Card>
        <Card className="p-4 bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-300 mt-1">{rejected.length}</p>
        </Card>
        <Card className="p-4 bg-slate-500/5 border-slate-500/20">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400 font-medium">Expired</span>
          </div>
          <p className="text-2xl font-bold text-slate-300 mt-1">{expired.length}</p>
        </Card>
      </div>

      {/* Payment Detail Dialog */}
      {selectedPayment && (
        <Card className="p-5 bg-slate-900/50 border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Payment Details</h3>
            <Button size="sm" variant="ghost" onClick={() => setSelectedPayment(null)} className="h-7 text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">User</p>
              <p className="text-slate-200 font-medium">{selectedPayment.user.name}</p>
              <p className="text-slate-400 text-xs">{selectedPayment.user.email}</p>
              {selectedPayment.user.college && <p className="text-slate-500 text-xs">{selectedPayment.user.college}</p>}
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Amount</p>
              <p className="text-slate-200 font-bold text-lg flex items-center gap-1">
                <IndianRupee className="w-4 h-4" />{selectedPayment.amount}
              </p>
              <p className="text-slate-500 text-xs">
                {selectedPayment.paymentType === 'premium_plan' ? (
                  <span className="flex items-center gap-1 text-amber-400"><Crown className="w-3 h-3" /> Premium Plan</span>
                ) : (
                  <span>Upload Credit: {selectedPayment.uploadCredit}</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">UTR Number</p>
              <p className="text-slate-200 font-mono">{selectedPayment.utrNumber || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Payment Method</p>
              <p className="text-slate-200">{selectedPayment.paymentMethod === 'upi_qr' ? 'UPI QR' : selectedPayment.paymentMethod}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Status</p>
              <Badge className={`${statusConfig[selectedPayment.status]?.className || ''} border text-xs rounded-full`}>
                {statusConfig[selectedPayment.status]?.label || selectedPayment.status}
              </Badge>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Created</p>
              <p className="text-slate-300">{new Date(selectedPayment.createdAt).toLocaleString()}</p>
            </div>
            {selectedPayment.screenshotUrl && (
              <div className="sm:col-span-2">
                <p className="text-slate-500 text-xs mb-2">Payment Screenshot</p>
                <div className="inline-block p-2 bg-white rounded-lg border border-slate-700">
                  <img
                    src={selectedPayment.screenshotUrl}
                    alt="Payment proof"
                    className="max-w-[300px] max-h-[300px] object-contain rounded"
                  />
                </div>
              </div>
            )}
          </div>
          {(selectedPayment.status === 'pending' || selectedPayment.status === 'pending_verification') && (
            <div className="flex gap-3 mt-5 pt-4 border-t border-slate-800">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" /> Approve & Grant Credits
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-900 border-slate-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-slate-100">Approve Payment</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Approve this payment from {selectedPayment.user.name}? {selectedPayment.uploadCredit} upload credit(s) will be granted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { onAction('approve_payment', selectedPayment.id); setSelectedPayment(null) }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Approve
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5 rounded-xl">
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-900 border-slate-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-slate-100">Reject Payment</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Reject this payment from {selectedPayment.user.name}? They will need to submit a new payment.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { onAction('reject_payment', selectedPayment.id); setSelectedPayment(null) }} className="bg-red-600 hover:bg-red-700 text-white">
                      Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </Card>
      )}

      {/* Payments List */}
      <div className="space-y-2">
        <p className="text-sm text-slate-400 mb-3">{payments.length} payments</p>
        {payments.map(payment => {
          const sc = statusConfig[payment.status] || statusConfig.expired
          return (
            <Card
              key={payment.id}
              className={`p-4 bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer ${
                (payment.status === 'pending' || payment.status === 'pending_verification') ? 'border-l-2 border-l-amber-500' : ''
              }`}
              onClick={() => setSelectedPayment(payment)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200 truncate">{payment.user.name}</span>
                    {payment.paymentType === 'premium_plan' && (
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 border text-[10px] rounded-full shrink-0 gap-0.5">
                        <Crown className="w-2.5 h-2.5" /> Premium
                      </Badge>
                    )}
                    <Badge className={`${sc.className} border text-[10px] rounded-full shrink-0`}>{sc.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" />{payment.amount}
                    </span>
                    {payment.utrNumber && (
                      <span className="font-mono">UTR: {payment.utrNumber}</span>
                    )}
                    {payment.screenshotUrl && (
                      <span className="flex items-center gap-1 text-cyan-400">
                        <ImageIcon className="w-3 h-3" /> Screenshot
                      </span>
                    )}
                    <span>{new Date(payment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{payment.user.email}</p>
                </div>
                {(payment.status === 'pending' || payment.status === 'pending_verification') ? (
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-lg">
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">Approve Payment</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Approve payment from {payment.user.name}? {payment.paymentType === 'premium_plan' ? 'Premium plan (29 uploads) will be activated.' : `${payment.uploadCredit} credit(s) will be granted.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onAction('approve_payment', payment.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Approve
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1 rounded-lg">
                          <XCircle className="w-3 h-3" /> Reject
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">Reject Payment</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Reject payment from {payment.user.name}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-700">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onAction('reject_payment', payment.id)} className="bg-red-600 hover:bg-red-700 text-white">
                            Reject
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-4 bg-slate-900/50 border-slate-800 animate-pulse">
          <div className="h-10 bg-slate-800 rounded" />
        </Card>
      ))}
    </div>
  )
}

// ─── Admins Tab (Super Admin Only) ──────────────────────────────────

function AdminsTab({ admins, loading, currentAdminId, onRefresh }: {
  admins: AdminAccountItem[]
  loading: boolean
  currentAdminId: string
  onRefresh: () => void
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', password: '', role: 'support_admin' })
  const [creating, setCreating] = useState(false)
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_admin', targetId: 'new', updates: createForm }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Admin account created successfully')
        setShowCreateModal(false)
        setCreateForm({ name: '', email: '', phone: '', password: '', role: 'support_admin' })
        onRefresh()
      } else {
        toast.error(data.error || 'Failed to create admin')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setCreating(false)
    }
  }

  const handleRemoveAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(`Remove admin access from ${adminName}? They will be demoted to a regular user.`)) return
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_admin', targetId: adminId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Admin access removed from ${adminName}`)
        onRefresh()
      } else {
        toast.error(data.error || 'Failed to remove admin')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleUpdateRole = async (adminId: string, newRole: string) => {
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_admin_role', targetId: adminId, updates: { role: newRole } }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Role updated successfully')
        onRefresh()
      } else {
        toast.error(data.error || 'Failed to update role')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordId) return
    setResetting(true)
    try {
      const res = await fetch('/api/cnx-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_admin_password', targetId: resetPasswordId, updates: { password: resetPassword } }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Password reset successfully. Admin must change it on next login.')
        setResetPasswordId(null)
        setResetPassword('')
        onRefresh()
      } else {
        toast.error(data.error || 'Failed to reset password')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-9 w-36 bg-slate-800 rounded-xl animate-pulse" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-900/50 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Admin Account Management
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Create, edit, and manage admin accounts. Only Super Admin can access this section.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="gap-2 rounded-xl bg-[#FF6600] hover:bg-[#FF8533] text-white"
        >
          <UserPlus className="w-4 h-4" /> Create Admin
        </Button>
      </div>

      {/* Admin cards */}
      <div className="space-y-3">
        {admins.map(admin => (
          <Card key={admin.id} className="p-4 bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Avatar */}
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                admin.isSuperAdmin
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : 'bg-gradient-to-br from-slate-600 to-slate-700'
              }`}>
                {admin.isSuperAdmin ? <Crown className="w-5 h-5" /> : admin.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-200 truncate">{admin.name}</p>
                  <RoleBadge role={admin.adminRole || 'support_admin'} />
                  {admin.twoFactorEnabled && (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border text-[10px] gap-1 rounded-full px-2 py-0.5">
                      <Fingerprint className="w-3 h-3" /> 2FA
                    </Badge>
                  )}
                  {admin.isSuperAdmin && (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 border text-[10px] gap-1 rounded-full px-2 py-0.5">
                      <Shield className="w-3 h-3" /> Protected
                    </Badge>
                  )}
                  {admin.mustChangePassword && (
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 border text-[10px] gap-1 rounded-full px-2 py-0.5">
                      <KeyRound className="w-3 h-3" /> Must Change PW
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {admin.phone && <span>{admin.phone}</span>}
                  {admin.lastLogin && (
                    <span>Last login: {new Date(admin.lastLogin).toLocaleDateString()}</span>
                  )}
                  {admin.lastLoginIp && <span>IP: {admin.lastLoginIp}</span>}
                  <span>Actions: {admin._count.auditLogs}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Role selector (not for Super Admin) */}
                {!admin.isSuperAdmin && admin.id !== currentAdminId && (
                  <Select
                    value={admin.adminRole || 'support_admin'}
                    onValueChange={(role) => handleUpdateRole(admin.id, role)}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs bg-slate-800 border-slate-700 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="support_admin">Support</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Reset password */}
                {!admin.isSuperAdmin && admin.id !== currentAdminId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setResetPasswordId(admin.id); setResetPassword('') }}
                    className="text-slate-400 hover:text-amber-400 gap-1 rounded-lg"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </Button>
                )}

                {/* Remove admin */}
                {!admin.isSuperAdmin && admin.id !== currentAdminId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-400 gap-1 rounded-lg">
                        <UserX className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">Remove Admin Access</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          Remove admin access from <strong className="text-slate-200">{admin.name}</strong>? They will be demoted to a regular user. All their admin sessions will be revoked.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveAdmin(admin.id, admin.name)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Remove Admin
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </Card>
        ))}

        {admins.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <UserCog className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No admin accounts found</p>
          </div>
        )}
      </div>

      {/* Create Admin Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#FF6600]" /> Create Admin Account
              </h3>

              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <Label className="text-slate-400 text-xs mb-1 block">Full Name</Label>
                  <Input
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                    className="bg-slate-800 border-slate-700 text-slate-200"
                    placeholder="Admin name"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs mb-1 block">Email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                    className="bg-slate-800 border-slate-700 text-slate-200"
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs mb-1 block">Phone (optional)</Label>
                  <Input
                    value={createForm.phone}
                    onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-slate-200"
                    placeholder="99XXXXXXXX"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs mb-1 block">Password</Label>
                  <Input
                    type="password"
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                    className="bg-slate-800 border-slate-700 text-slate-200"
                    placeholder="Strong password"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Min 8 chars, uppercase, lowercase, number, special char</p>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs mb-1 block">Role</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(role) => setCreateForm({ ...createForm, role })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="support_admin">Support Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)} className="flex-1 text-slate-400">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating} className="flex-1 bg-[#FF6600] hover:bg-[#FF8533] text-white">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Admin'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetPasswordId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { setResetPasswordId(null); setResetPassword('') }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" /> Reset Admin Password
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                The admin must change their password on next login.
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  placeholder="New password"
                />
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => { setResetPasswordId(null); setResetPassword('') }} className="flex-1 text-slate-400">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={resetting} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white">
                    {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
