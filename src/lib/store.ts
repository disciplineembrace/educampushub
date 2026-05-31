import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  name: string
  phone?: string | null
  college?: string | null
  city?: string | null
  avatar?: string | null
  isVerified: boolean
  isAdmin: boolean
  isBanned: boolean
  rating: number
  totalSales: number
  whatsapp?: string | null
  freeUploadUsed?: number
  paidUploadCredits?: number
  totalBooksUploaded?: number
  mustChangePassword?: boolean
  adminRole?: string | null
}

export type PageType = 'home' | 'explore' | 'product' | 'sell' | 'login' | 'profile' | 'wishlist' | 'terms' | 'privacy' | 'reader' | 'dashboard' | 'saved' | 'categories' | 'editListing'

export interface EditingListingData {
  id: string
  title: string
  description: string
  originalPrice: number
  sellingPrice: number
  category: string
  subcategory: string | null
  listingType: string
  course: string | null
  semester: string | null
  standard: string | null
  board: string | null
  college: string | null
  city: string
  condition: string
  whatsappNumber: string
  images: string
  isDigital: boolean
  fileUrl: string | null
}

interface AppState {
  currentPage: PageType
  setCurrentPage: (page: PageType) => void
  selectedProductId: string | null
  setSelectedProductId: (id: string | null) => void
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  editingListing: EditingListingData | null
  setEditingListing: (listing: EditingListingData | null) => void
  darkMode: boolean
  toggleDarkMode: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  selectedCategory: string | null
  setSelectedCategory: (cat: string | null) => void
  wishlist: string[]
  toggleWishlist: (id: string) => void
  setWishlist: (ids: string[]) => void
  notifications: number
  mobileMenuOpen: boolean
  setMobileMenuOpen: (val: boolean) => void
  recentlyViewed: string[]
  addRecentlyViewed: (id: string) => void
  savedMaterials: string[]
  toggleSavedMaterial: (id: string) => void
  bookmarks: string[]
  toggleBookmark: (id: string) => void
  readingProgress: Record<string, number>
  setReadingProgress: (id: string, page: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentPage: 'home' as PageType,
      setCurrentPage: (page: PageType) => set({ currentPage: page, mobileMenuOpen: false }),
      selectedProductId: null,
      setSelectedProductId: (id: string | null) => set({ selectedProductId: id }),
      currentUser: null,
      setCurrentUser: (user: User | null) => set({ currentUser: user }),
      editingListing: null,
      setEditingListing: (listing: EditingListingData | null) => set({ editingListing: listing }),
      darkMode: false,
      toggleDarkMode: () => {
        const newMode = !get().darkMode
        set({ darkMode: newMode })
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', newMode)
        }
      },
      searchQuery: '',
      setSearchQuery: (query: string) => set({ searchQuery: query }),
      selectedCategory: null,
      setSelectedCategory: (cat: string | null) => set({ selectedCategory: cat }),
      wishlist: [],
      toggleWishlist: (id: string) => {
        const current = get().wishlist
        if (current.includes(id)) {
          set({ wishlist: current.filter(wid => wid !== id) })
        } else {
          set({ wishlist: [...current, id] })
        }
      },
      setWishlist: (ids: string[]) => set({ wishlist: ids }),
      notifications: 0,
      mobileMenuOpen: false,
      setMobileMenuOpen: (val: boolean) => set({ mobileMenuOpen: val }),
      recentlyViewed: [],
      addRecentlyViewed: (id: string) => {
        const current = get().recentlyViewed
        const filtered = current.filter(rid => rid !== id)
        set({ recentlyViewed: [id, ...filtered].slice(0, 10) })
      },
      savedMaterials: [],
      toggleSavedMaterial: (id: string) => {
        const current = get().savedMaterials
        if (current.includes(id)) {
          set({ savedMaterials: current.filter(sid => sid !== id) })
        } else {
          set({ savedMaterials: [...current, id] })
        }
      },
      bookmarks: [],
      toggleBookmark: (id: string) => {
        const current = get().bookmarks
        if (current.includes(id)) {
          set({ bookmarks: current.filter(bid => bid !== id) })
        } else {
          set({ bookmarks: [...current, id] })
        }
      },
      readingProgress: {},
      setReadingProgress: (id: string, page: number) => {
        set({ readingProgress: { ...get().readingProgress, [id]: page } })
      },
    }),
    {
      name: 'educampushub-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        darkMode: state.darkMode,
        wishlist: state.wishlist,
        recentlyViewed: state.recentlyViewed,
        savedMaterials: state.savedMaterials,
        bookmarks: state.bookmarks,
        readingProgress: state.readingProgress,
        // Note: editingListing is NOT persisted - it's transient navigation state
      }),
    }
  )
)

export const CATEGORIES = [
  { id: 'school-books', name: 'School Books', icon: 'BookOpen', color: 'from-brand to-brand-light', description: 'Std 1–12 textbooks', translationKey: 'schoolBooks' },
  { id: 'cbse', name: 'CBSE Books', icon: 'BookMarked', color: 'from-brand-light to-brand', description: 'CBSE board textbooks', translationKey: 'cbse' },
  { id: 'gseb', name: 'GSEB Books', icon: 'BookMarked', color: 'from-orange-500 to-amber-500', description: 'Gujarat Board textbooks', translationKey: 'gseb' },
  { id: 'icse', name: 'ICSE Books', icon: 'BookMarked', color: 'from-teal-500 to-cyan-500', description: 'ICSE board textbooks', translationKey: 'icse' },
  { id: 'college-books', name: 'College Books', icon: 'GraduationCap', color: 'from-accent to-purple-light', description: 'All semester textbooks', translationKey: 'collegeBooks' },
  { id: 'medical', name: 'Medical Books', icon: 'Stethoscope', color: 'from-rose-500 to-pink-500', description: 'MBBS, BDS, Pharmacy', translationKey: 'medical' },
  { id: 'engineering', name: 'Engineering Books', icon: 'Wrench', color: 'from-brand to-cyan', description: 'All branches', translationKey: 'engineering' },
  { id: 'commerce-law', name: 'Commerce & Law', icon: 'Scale', color: 'from-emerald-500 to-green-600', description: 'BCom, CA, LLB', translationKey: 'commerceLaw' },
  { id: 'competitive', name: 'UPSC / NEET / JEE', icon: 'Target', color: 'from-amber-500 to-orange-500', description: 'Competitive exam prep', translationKey: 'competitive' },
  { id: 'notes-pdfs', name: 'Notes & PDFs', icon: 'FileText', color: 'from-cyan to-brand', description: 'Study notes & guides', translationKey: 'notesPdfs' },
  { id: 'handwritten', name: 'Handwritten Notes', icon: 'PenTool', color: 'from-pink-500 to-rose-500', description: 'Topper notes', translationKey: 'handwritten' },
  { id: 'ebooks', name: 'E-books', icon: 'Tablet', color: 'from-accent to-purple-light', description: 'Digital books', translationKey: 'ebooks' },
  { id: 'notebooks', name: 'Used Notebooks', icon: 'Notebook', color: 'from-yellow-500 to-amber-500', description: 'Bind, ruled, plain', translationKey: 'notebooks' },
  { id: 'study-kits', name: 'Study Kits', icon: 'Package', color: 'from-brand to-accent', description: 'Bundled essentials', translationKey: 'studyKits' },
] as const

/**
 * Get the translation key for a category name.
 * Usage: t(`categories.${getCategoryTranslationKey(catId)}.name`)
 */
export function getCategoryTranslationKey(categoryId: string): string {
  const cat = CATEGORIES.find(c => c.id === categoryId)
  return cat?.translationKey || categoryId
}

export const INDIAN_CITIES = [
  'Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata',
  'Hyderabad', 'Pune', 'Jaipur', 'Lucknow', 'Ahmedabad',
  'Chandigarh', 'Bhopal', 'Indore', 'Nagpur', 'Kochi',
  'Coimbatore', 'Vizag', 'Surat', 'Varanasi', 'Guwahati'
] as const

export const CONDITIONS = ['Like New', 'Good', 'Fair', 'Poor'] as const

export const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'] as const

export const BOARDS = ['CBSE', 'GSEB', 'ICSE', 'ISC', 'State Board', 'Other'] as const

export const STANDARDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const

export const LISTING_TYPES = [
  { value: 'sell', label: 'Sell', icon: 'IndianRupee' },
  { value: 'exchange', label: 'Exchange', icon: 'ArrowLeftRight' },
  { value: 'giveaway', label: 'Give Away', icon: 'Gift' },
] as const

export function formatINR(amount: number): string {
  const numStr = amount.toString()
  let lastThree = numStr.substring(numStr.length - 3)
  const otherNumbers = numStr.substring(0, numStr.length - 3)
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree
  }
  const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree
  return '₹' + formatted
}

/** Parse the images JSON string from a listing. Returns string[] of image URLs. */
export function parseListingImages(imagesJson: string | null | undefined): string[] {
  if (!imagesJson) return []
  try {
    const parsed = JSON.parse(imagesJson)
    return Array.isArray(parsed) ? parsed.filter((url: unknown) => typeof url === 'string') : []
  } catch {
    return []
  }
}
