'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Upload, Check, ArrowLeft, Eye, X, ImagePlus,
  Loader2, AlertCircle, Camera, Sparkles, Trash2,
  Stethoscope, Wrench, GraduationCap, Target,
  Scale, FileText, ChevronRight, Shield,
  ChevronLeft, RotateCcw, Info, CreditCard, Zap,
  PenTool, Tablet, Notebook, Package, BookMarked
} from 'lucide-react'
import { useAppStore, CATEGORIES, CONDITIONS, SEMESTERS, BOARDS, STANDARDS, LISTING_TYPES, formatINR, getCategoryTranslationKey } from '@/lib/store'
import { INDIAN_STATES, INDIAN_DISTRICTS } from '@/lib/indian-states-districts'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import PaymentModal from '@/components/campus/PaymentModal'

const ICON_MAP: Record<string, React.ElementType> = {
  Stethoscope, Wrench, GraduationCap, Target, Scale, FileText, PenTool, Tablet, Notebook, Package, BookOpen, BookMarked,
}

const MAX_IMAGES = 6
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

interface UploadedImage {
  id: string
  file: File
  preview: string
  compressed?: Blob
  serverUrl?: string
  uploading: boolean
  progress: number
  error?: string
}

interface ValidationErrors {
  [key: string]: string
}

// Client-side image compression using Canvas
function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Compression failed'))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function validateFileType(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return ALLOWED_EXTENSIONS.includes(ext)
}

// Sanitize text input to prevent XSS
function sanitizeInput(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 2000) // hard limit
}

export default function SellProductPage() {
  const { currentUser, setCurrentPage, setSelectedProductId } = useAppStore()
  const { t } = useTranslation()
  const [uploadCredits, setUploadCredits] = useState<{ freeRemaining: number; paidCredits: number; totalCredits: number; canUpload: boolean; freeUploadLimit: number; paidUploadCredits: number } | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [form, setForm] = useState({
    title: '',
    description: '',
    originalPrice: '',
    sellingPrice: '',
    category: '',
    listingType: 'sell',
    course: '',
    semester: '',
    standard: '',
    board: '',
    college: '',
    state: '',
    district: '',
    condition: '',
    whatsappNumber: currentUser?.whatsapp || '',
  })
  const [images, setImages] = useState<UploadedImage[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [success, setSuccess] = useState(false)
  const [createdListingId, setCreatedListingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [dragActive, setDragActive] = useState(false)
  const [step, setStep] = useState(1) // 1: Details, 2: Images, 3: Review
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSubmitRef = useRef<number>(0)
  const formRef = useRef<HTMLFormElement>(null)

  // Use useMemo for computed values to ensure reactive updates
  const cat = useMemo(() => CATEGORIES.find(c => c.id === form.category), [form.category])
  const savings = useMemo(() => {
    if (!form.originalPrice || !form.sellingPrice) return 0
    const orig = Number(form.originalPrice)
    const sell = Number(form.sellingPrice)
    if (orig <= 0 || sell <= 0) return 0
    return Math.round(((orig - sell) / orig) * 100)
  }, [form.originalPrice, form.sellingPrice])

  const listingTypeLabel = useMemo(() => {
    return LISTING_TYPES.find(lt => lt.value === form.listingType)?.label || 'Sell'
  }, [form.listingType])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)
      })
    }
  }, [])

  // Fetch upload credits on mount
  useEffect(() => {
    if (!currentUser) return
    const fetchCredits = async () => {
      setCreditsLoading(true)
      try {
        const res = await fetch(`/api/payment?userId=${currentUser.id}`)
        if (res.ok) {
          const data = await res.json()
          setUploadCredits(data)
        }
      } catch {
        // ignore
      } finally {
        setCreditsLoading(false)
      }
    }
    fetchCredits()
  }, [currentUser])

  const refreshCredits = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await fetch(`/api/payment?userId=${currentUser.id}`)
      if (res.ok) {
        const data = await res.json()
        setUploadCredits(data)
      }
    } catch {
      // ignore
    }
  }, [currentUser])

  // Update whatsapp when user changes
  useEffect(() => {
    if (currentUser?.whatsapp && !form.whatsappNumber) {
      setForm(prev => ({ ...prev, whatsappNumber: currentUser.whatsapp || '' }))
    }
  }, [currentUser])

  const handleChange = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    // Clear validation error for this field
    setValidationErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  // Image handling - FIXED: Use functional state update to avoid stale closure
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    const newImages: UploadedImage[] = []
    const errors: string[] = []

    // Check total count using current state
    let currentCount = 0
    setImages(prev => {
      currentCount = prev.length
      return prev // don't modify, just read
    })

    // Small delay to ensure state is read
    await new Promise(r => setTimeout(r, 0))

    if (currentCount + files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed. You already have ${currentCount}.`)
      return
    }

    for (const file of files) {
      if (!validateFileType(file)) {
        errors.push(`"${file.name}" is not supported. Use JPG, PNG, or WEBP.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" exceeds 5MB limit.`)
        continue
      }

      try {
        const preview = URL.createObjectURL(file)
        const compressed = await compressImage(file)

        newImages.push({
          id: generateId(),
          file,
          preview,
          compressed,
          uploading: false,
          progress: 0,
        })
      } catch {
        errors.push(`Failed to process "${file.name}".`)
      }
    }

    if (errors.length > 0) {
      toast.error(errors[0])
    }

    if (newImages.length > 0) {
      setImages(prev => {
        // Double check count at update time
        if (prev.length + newImages.length > MAX_IMAGES) {
          toast.error(`Maximum ${MAX_IMAGES} images allowed`)
          return prev
        }
        // Check duplicates
        const nonDupes = newImages.filter(ni =>
          !prev.some(existing => existing.file.name === ni.file.name && existing.file.size === ni.file.size)
        )
        return [...prev, ...nonDupes]
      })
      toast.success(`${newImages.length} image${newImages.length > 1 ? 's' : ''} added`)
      // Clear image validation error
      setValidationErrors(prev => {
        if (!prev.images) return prev
        const next = { ...prev }
        delete next.images
        return next
      })
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
      e.target.value = ''
    }
  }, [processFiles])

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img && img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)
      return prev.filter(i => i.id !== id)
    })
  }, [])

  const moveImage = useCallback((id: string, direction: 'left' | 'right') => {
    setImages(prev => {
      const idx = prev.findIndex(i => i.id === id)
      if (idx < 0) return prev
      const newIdx = direction === 'left' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const newArr = [...prev]
      ;[newArr[idx], newArr[newIdx]] = [newArr[newIdx], newArr[idx]]
      return newArr
    })
  }, [])

  // Upload images to server
  const uploadImagesToServer = async (currentImages: UploadedImage[]): Promise<string[]> => {
    if (currentImages.length === 0) return []

    setUploadingImages(true)
    const uploadedUrls: string[] = []

    try {
      setImages(prev => prev.map(img => ({ ...img, uploading: true, progress: 10 })))

      const formData = new FormData()
      for (const img of currentImages) {
        const fileToUpload = img.compressed
          ? new File([img.compressed], img.file.name, { type: 'image/jpeg' })
          : img.file
        formData.append('files', fileToUpload)
      }

      setImages(prev => prev.map(img => ({ ...img, progress: 30 })))

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setImages(prev => prev.map(img => ({ ...img, progress: 80 })))

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      const urls: string[] = data.urls || []

      setImages(prev => prev.map((img, idx) => ({
        ...img,
        serverUrl: urls[idx] || '',
        uploading: false,
        progress: 100,
      })))

      uploadedUrls.push(...urls)

      if (data.errors && data.errors.length > 0) {
        toast.warning(data.errors[0])
      }
    } catch {
      setImages(prev => prev.map(img => ({
        ...img,
        uploading: false,
        progress: 0,
        error: 'Upload failed',
      })))
      throw new Error('Image upload failed')
    } finally {
      setUploadingImages(false)
    }

    return uploadedUrls
  }

  // Save listing locally as fallback (when API is unreachable)
  const saveListingLocally = (listingData: Record<string, unknown>) => {
    try {
      const localListings = JSON.parse(localStorage.getItem('educampushub-pending-listings') || '[]')
      localListings.push({
        ...listingData,
        id: listingData.id || generateId(),
        createdAt: new Date().toISOString(),
        pendingSync: true,
      })
      localStorage.setItem('educampushub-pending-listings', JSON.stringify(localListings))
    } catch {
      // Silently fail
    }
  }

  // Validation
  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {}

    if (!form.title.trim()) errors.title = 'Product name is required'
    else if (form.title.trim().length < 5) errors.title = 'Name must be at least 5 characters'

    if (!form.description.trim()) errors.description = 'Description is required'
    else if (form.description.trim().length < 10) errors.description = 'Description must be at least 10 characters'

    if (!form.sellingPrice || Number(form.sellingPrice) <= 0) {
      errors.sellingPrice = 'Valid selling price is required'
    } else if (Number(form.sellingPrice) > 100000) {
      errors.sellingPrice = 'Price cannot exceed 1,00,000'
    }

    if (form.originalPrice && Number(form.originalPrice) > 100000) {
      errors.originalPrice = 'Price cannot exceed 1,00,000'
    }

    if (form.originalPrice && form.sellingPrice && Number(form.sellingPrice) > Number(form.originalPrice)) {
      errors.sellingPrice = 'Selling price cannot be more than original price'
    }

    if (!form.category) errors.category = 'Category is required'
    if (!form.condition) errors.condition = 'Condition is required'
    if (!form.state) errors.state = 'State is required'
    if (!form.district) errors.district = 'District is required'

    if (!form.whatsappNumber.trim()) {
      errors.whatsappNumber = 'WhatsApp number is required'
    } else if (!/^[6-9]\d{9}$/.test(form.whatsappNumber.trim())) {
      errors.whatsappNumber = 'Enter valid 10-digit Indian mobile number'
    }

    if (images.length === 0) {
      errors.images = 'At least one image is required'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [form, images])

  // Validate step 1 only
  const validateStep1 = useCallback((): boolean => {
    const errors: ValidationErrors = {}
    if (!form.title.trim()) errors.title = 'Product name is required'
    else if (form.title.trim().length < 5) errors.title = 'Name must be at least 5 characters'
    if (!form.description.trim()) errors.description = 'Description is required'
    else if (form.description.trim().length < 10) errors.description = 'Description must be at least 10 characters'
    if (!form.sellingPrice || Number(form.sellingPrice) <= 0) errors.sellingPrice = 'Valid selling price is required'
    if (form.originalPrice && Number(form.originalPrice) > 100000) errors.originalPrice = 'Price cannot exceed 1,00,000'
    if (form.originalPrice && form.sellingPrice && Number(form.sellingPrice) > Number(form.originalPrice)) errors.sellingPrice = 'Selling price cannot exceed original'
    if (!form.category) errors.category = 'Category is required'
    if (!form.condition) errors.condition = 'Condition is required'
    if (!form.state) errors.state = 'State is required'
    if (!form.district) errors.district = 'District is required'
    if (!form.whatsappNumber.trim()) errors.whatsappNumber = 'WhatsApp number is required'
    else if (!/^[6-9]\d{9}$/.test(form.whatsappNumber.trim())) errors.whatsappNumber = 'Enter valid 10-digit number'

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [form])

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Anti-spam: prevent double submission
    const now = Date.now()
    if (now - lastSubmitRef.current < 3000) {
      toast.error('Please wait before submitting again')
      return
    }
    lastSubmitRef.current = now

    if (!currentUser) {
      toast.error('Please login to create a listing')
      setCurrentPage('login')
      return
    }

    // Validate form
    if (!validateForm()) {
      toast.error('Please fix the errors below')
      const firstErrorEl = document.querySelector('[data-error="true"]')
      if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setError('')
    setSubmitting(true)

    try {
      // Step 1: Upload images
      toast.loading('Uploading images...', { id: 'upload-status' })
      let imageUrls: string[] = []
      try {
        imageUrls = await uploadImagesToServer(images)
        toast.success('Images uploaded!', { id: 'upload-status' })
      } catch {
        // Fallback: use local blob URLs for preview (won't persist but allows listing creation)
        toast.warning('Image upload to server failed. Saving with local previews.', { id: 'upload-status' })
        imageUrls = images.map(img => img.preview)
      }

      // Step 2: Create listing via API
      toast.loading('Creating your listing...', { id: 'listing-status' })

      const listingPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        originalPrice: Number(form.originalPrice) || 0,
        sellingPrice: Number(form.sellingPrice),
        category: form.category,
        listingType: form.listingType,
        course: form.course || null,
        semester: form.semester || null,
        standard: form.standard || null,
        board: form.board || null,
        college: form.college || null,
        state: form.state,
        district: form.district,
        city: form.district, // backward compat
        condition: form.condition,
        whatsappNumber: form.whatsappNumber.trim(),
        sellerId: currentUser.id,
        images: JSON.stringify(imageUrls),
      }

      const listingId = generateId()
      let serverListingId: string | null = null

      try {
        const res = await fetch('/api/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(listingPayload),
        })

        const data = await res.json()

        if (res.ok && data.listing?.id) {
          serverListingId = data.listing.id
        } else if (data.code === 'UPLOAD_LIMIT_REACHED') {
          // Upload limit reached - show payment modal
          toast.error('Upload limit reached. Please buy more credits.', { id: 'listing-status' })
          refreshCredits()
          setShowPaymentModal(true)
          setSubmitting(false)
          return
        } else {
          // API failed - save locally as fallback
          saveListingLocally({ ...listingPayload, id: listingId })
        }
      } catch {
        // Network error - save locally as fallback
        saveListingLocally({ ...listingPayload, id: listingId })
      }

      toast.success('Listing created successfully!', { id: 'listing-status' })
      setCreatedListingId(serverListingId || listingId)
      setSuccess(true)

      // Reset form
      setForm({
        title: '', description: '', originalPrice: '', sellingPrice: '',
        category: '', listingType: 'sell', course: '', semester: '', standard: '',
        board: '', college: '', state: '', district: '', condition: '',
        whatsappNumber: currentUser?.whatsapp || '',
      })
      // Cleanup image previews
      images.forEach(img => {
        if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)
      })
      setImages([])
      setValidationErrors({})
    } catch (err) {
      toast.error('Something went wrong. Please try again.', { id: 'listing-status' })
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset form completely
  const resetForm = useCallback(() => {
    setForm({
      title: '', description: '', originalPrice: '', sellingPrice: '',
      category: '', listingType: 'sell', course: '', semester: '', standard: '',
      board: '', college: '', state: '', district: '', condition: '',
      whatsappNumber: currentUser?.whatsapp || '',
    })
    images.forEach(img => {
      if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)
    })
    setImages([])
    setValidationErrors({})
    setError('')
    setStep(1)
    setSuccess(false)
    setCreatedListingId(null)
  }, [currentUser, images])

  // Success screen
  if (success) {
    return (
      <div className="pt-20 pb-10 min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30"
          >
            <Check className="w-12 h-12 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-3 font-heading">Listing Created!</h2>
          <p className="text-muted-foreground mb-6">
            Your product is now live on EduCampusHub. Students across India can find and contact you on WhatsApp.
          </p>
          <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-brand" />
              <span className="font-medium text-sm">What happens next?</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 ml-8">
              <li>Your listing will be reviewed within 24 hours</li>
              <li>Verified sellers get more visibility</li>
              <li>Share your listing on WhatsApp for faster sales</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                if (createdListingId) {
                  setSelectedProductId(createdListingId)
                  setCurrentPage('product')
                } else {
                  setCurrentPage('explore')
                }
              }}
              className="btn-gradient text-white border-0 rounded-xl px-6"
            >
              <span className="flex items-center gap-2">View Listing <ChevronRight className="w-4 h-4" /></span>
            </Button>
            <Button variant="outline" onClick={resetForm} className="rounded-xl">
              List Another
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  // Not logged in
  if (!currentUser) {
    return (
      <div className="pt-20 pb-10 min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Login to Sell</h3>
          <p className="text-muted-foreground mb-6">You need to be logged in to list your products</p>
          <Button onClick={() => setCurrentPage('login')} className="btn-gradient text-white border-0 rounded-xl px-8">
            <span>Login Now</span>
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="pt-20 pb-10 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <Button variant="ghost" onClick={() => setCurrentPage('home')} className="gap-2 -ml-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-heading">
            Sell on <span className="gradient-text">EduCampusHub</span>
          </h1>
          <p className="text-muted-foreground">List your product in under 2 minutes and reach thousands of students across India</p>

          {/* Upload Credits Banner */}
          {uploadCredits && !creditsLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-4 rounded-2xl border-2 ${
                uploadCredits.canUpload 
                  ? 'bg-brand/5 border-brand/20' 
                  : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    uploadCredits.canUpload 
                      ? 'bg-brand/10 text-brand' 
                      : 'bg-red-100 dark:bg-red-900/30 text-red-500'
                  }`}>
                    {uploadCredits.canUpload ? <Zap className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {uploadCredits.canUpload 
                        ? `${uploadCredits.totalCredits} Upload Credit${uploadCredits.totalCredits > 1 ? 's' : ''} Available`
                        : 'Upload Limit Reached'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uploadCredits.freeRemaining > 0 
                        ? `${uploadCredits.freeRemaining} free · ${uploadCredits.paidUploadCredits} paid`
                        : uploadCredits.paidUploadCredits > 0 
                          ? `${uploadCredits.paidUploadCredits} paid credit${uploadCredits.paidUploadCredits > 1 ? 's' : ''}`
                          : 'Buy credits to upload more books'
                      }
                    </p>
                  </div>
                </div>
                {!uploadCredits.canUpload && (
                  <Button
                    size="sm"
                    onClick={() => setShowPaymentModal(true)}
                    className="btn-gradient text-white border-0 rounded-xl gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Buy ₹10
                  </Button>
                )}
              </div>
              {uploadCredits.canUpload && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Free uploads used</span>
                    <span className="font-medium">{uploadCredits.freeRemaining}/{uploadCredits.freeUploadLimit}</span>
                  </div>
                  <Progress value={(1 - uploadCredits.freeRemaining / uploadCredits.freeUploadLimit) * 100} className="h-1.5" />
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 sm:gap-4 mb-2">
            {[
              { num: 1, label: 'Details' },
              { num: 2, label: 'Photos' },
              { num: 3, label: 'Review' },
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center gap-2 sm:gap-4 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < step) {
                      setStep(s.num)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                  className={`flex items-center gap-2 shrink-0 ${s.num <= step ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    s.num < step
                      ? 'bg-emerald-500 text-white'
                      : s.num === step
                        ? 'bg-brand text-white shadow-lg shadow-brand/30'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {s.num < step ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:inline ${s.num <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </button>
                {idx < 2 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all ${s.num < step ? 'bg-emerald-500' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <motion.form
            ref={formRef}
            onSubmit={handleSubmit}
            className="lg:col-span-3 space-y-5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Global Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  data-error="true"
                  className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Something went wrong</p>
                    <p className="mt-0.5">{error}</p>
                  </div>
                  <button type="button" onClick={() => setError('')} className="ml-auto shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ===== STEP 1: Details ===== */}
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  {/* Listing Type */}
                  <div>
                    <Label className="mb-1.5 block">Listing Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {LISTING_TYPES.map(lt => (
                        <button
                          key={lt.value}
                          type="button"
                          onClick={() => handleChange('listingType', lt.value)}
                          className={`p-3 rounded-xl border-2 transition-all text-center text-sm font-medium ${
                            form.listingType === lt.value
                              ? 'border-brand bg-brand/5 text-brand'
                              : 'border-border hover:border-brand/30 text-muted-foreground'
                          }`}
                        >
                          {lt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product Name */}
                  <div data-error={!!validationErrors.title}>
                    <Label className="mb-1.5 block">Product Name *</Label>
                    <Input
                      value={form.title}
                      onChange={e => handleChange('title', e.target.value)}
                      placeholder="e.g., HC Verma Concepts of Physics Vol 1"
                      className={`h-11 rounded-xl ${validationErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      maxLength={100}
                      autoComplete="off"
                    />
                    <div className="flex justify-between mt-1">
                      {validationErrors.title && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.title}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{form.title.length}/100</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div data-error={!!validationErrors.description}>
                    <Label className="mb-1.5 block">Description *</Label>
                    <Textarea
                      value={form.description}
                      onChange={e => handleChange('description', e.target.value)}
                      placeholder="Describe the product condition, edition, any highlights, cover condition, page quality..."
                      className={`min-h-[120px] rounded-xl ${validationErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      maxLength={2000}
                    />
                    <div className="flex justify-between mt-1">
                      {validationErrors.description && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.description}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{form.description.length}/2000</span>
                    </div>
                  </div>

                  {/* Prices */}
                  <div className="grid grid-cols-2 gap-4">
                    <div data-error={!!validationErrors.originalPrice}>
                      <Label className="mb-1.5 block">Original Price</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">&#8377;</span>
                        <Input
                          type="number"
                          value={form.originalPrice}
                          onChange={e => handleChange('originalPrice', e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g., 750"
                          className={`h-11 rounded-xl pl-7 ${validationErrors.originalPrice ? 'border-red-500' : ''}`}
                          min="0"
                          max="100000"
                        />
                      </div>
                      {validationErrors.originalPrice && (
                        <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.originalPrice}
                        </span>
                      )}
                    </div>
                    <div data-error={!!validationErrors.sellingPrice}>
                      <Label className="mb-1.5 block">Selling Price *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">&#8377;</span>
                        <Input
                          type="number"
                          value={form.sellingPrice}
                          onChange={e => handleChange('sellingPrice', e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g., 350"
                          className={`h-11 rounded-xl pl-7 ${validationErrors.sellingPrice ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          min="0"
                          max="100000"
                        />
                      </div>
                      {validationErrors.sellingPrice && (
                        <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.sellingPrice}
                        </span>
                      )}
                      {savings > 0 && (
                        <span className="text-xs text-emerald-500 font-medium mt-1 block">
                          Students save {savings}%!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category Grid */}
                  <div data-error={!!validationErrors.category}>
                    <Label className="mb-1.5 block">Category *</Label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-hide">
                      {CATEGORIES.map(c => {
                        const Icon = ICON_MAP[c.icon] || FileText
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleChange('category', c.id)}
                            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-center ${
                              form.category === c.id
                                ? 'border-brand bg-brand/5 text-brand shadow-md shadow-brand/10'
                                : 'border-border hover:border-brand/30 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                              <Icon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-[9px] font-medium leading-tight">{t(`categories.${c.translationKey}.name`)}</span>
                          </button>
                        )
                      })}
                    </div>
                    {validationErrors.category && (
                      <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" /> {validationErrors.category}
                      </span>
                    )}
                  </div>

                  {/* Condition & Semester */}
                  <div className="grid grid-cols-2 gap-4">
                    <div data-error={!!validationErrors.condition}>
                      <Label className="mb-1.5 block">Condition *</Label>
                      <Select
                        value={form.condition || undefined}
                        onValueChange={v => handleChange('condition', v)}
                      >
                        <SelectTrigger className={`h-11 rounded-xl ${validationErrors.condition ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {validationErrors.condition && (
                        <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.condition}
                        </span>
                      )}
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Semester</Label>
                      <Select
                        value={form.semester || undefined}
                        onValueChange={v => handleChange('semester', v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEMESTERS.map(s => <SelectItem key={s} value={s}>{s} Semester</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Standard & Board */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-1.5 block">Standard / Class</Label>
                      <Select
                        value={form.standard || undefined}
                        onValueChange={v => handleChange('standard', v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {STANDARDS.map(s => <SelectItem key={s} value={s}>Class {s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Board</Label>
                      <Select
                        value={form.board || undefined}
                        onValueChange={v => handleChange('board', v)}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select board" />
                        </SelectTrigger>
                        <SelectContent>
                          {BOARDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Course */}
                  <div>
                    <Label className="mb-1.5 block">Course</Label>
                    <Input
                      value={form.course}
                      onChange={e => handleChange('course', e.target.value)}
                      placeholder="e.g., Physics, CSE, MBBS, JEE"
                      className="h-11 rounded-xl"
                      autoComplete="off"
                    />
                  </div>

                  {/* College */}
                  <div>
                    <Label className="mb-1.5 block">College Name</Label>
                    <Input
                      value={form.college}
                      onChange={e => handleChange('college', e.target.value)}
                      placeholder="e.g., IIT Delhi, AIIMS, BITS Pilani"
                      className="h-11 rounded-xl"
                      autoComplete="off"
                    />
                  </div>

                  {/* State, District & WhatsApp */}
                  <div className="grid grid-cols-2 gap-4">
                    <div data-error={!!validationErrors.state}>
                      <Label className="mb-1.5 block">State *</Label>
                      <Select
                        value={form.state || undefined}
                        onValueChange={v => {
                          handleChange('state', v)
                          handleChange('district', '') // reset district when state changes
                        }}
                      >
                        <SelectTrigger className={`h-11 rounded-xl ${validationErrors.state ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {validationErrors.state && (
                        <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.state}
                        </span>
                      )}
                    </div>
                    <div data-error={!!validationErrors.district}>
                      <Label className="mb-1.5 block">District *</Label>
                      <Select
                        key={`district-select-${form.state}`}
                        value={form.district && (INDIAN_DISTRICTS[form.state] || []).includes(form.district) ? form.district : undefined}
                        onValueChange={v => handleChange('district', v)}
                        disabled={!form.state}
                      >
                        <SelectTrigger className={`h-11 rounded-xl ${validationErrors.district ? 'border-red-500' : ''}`}>
                          <SelectValue placeholder={form.state ? 'Select district' : 'Select state first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {(INDIAN_DISTRICTS[form.state] || []).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {validationErrors.district && (
                        <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.district}
                        </span>
                      )}
                    </div>
                    <div data-error={!!validationErrors.whatsappNumber}>
                      <Label className="mb-1.5 block">WhatsApp Number *</Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-input bg-muted text-sm text-muted-foreground h-11">
                          +91
                        </span>
                        <Input
                          value={form.whatsappNumber}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                            handleChange('whatsappNumber', val)
                          }}
                          placeholder="9876543210"
                          className={`h-11 rounded-l-none rounded-r-xl ${validationErrors.whatsappNumber ? 'border-red-500' : ''}`}
                          inputMode="numeric"
                        />
                      </div>
                      {validationErrors.whatsappNumber && (
                        <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" /> {validationErrors.whatsappNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Step 1 Next Button */}
                  <Button
                    type="button"
                    onClick={() => {
                      if (validateStep1()) {
                        setStep(2)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      } else {
                        toast.error('Please fill all required fields')
                        const firstErrorEl = document.querySelector('[data-error="true"]')
                        if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    }}
                    className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold"
                  >
                    <span className="flex items-center gap-2 justify-center">
                      Next: Add Photos <ChevronRight className="w-5 h-5" />
                    </span>
                  </Button>
                </motion.div>
              )}

              {/* ===== STEP 2: Photos ===== */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div data-error={!!validationErrors.images}>
                    <Label className="mb-1.5 block text-base">Product Photos *</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add up to {MAX_IMAGES} photos. First photo will be the cover image. Images are automatically compressed for fast loading.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group ${
                        dragActive
                          ? 'border-brand bg-brand/5 scale-[1.01]'
                          : validationErrors.images
                            ? 'border-red-400 hover:border-red-500'
                            : 'border-border hover:border-brand/40'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleFileInput}
                        className="hidden"
                      />

                      <motion.div
                        animate={dragActive ? { scale: 1.05 } : { scale: 1 }}
                        className="flex flex-col items-center"
                      >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
                          dragActive ? 'bg-brand/10' : 'bg-muted'
                        }`}>
                          {dragActive ? (
                            <ImagePlus className="w-8 h-8 text-brand" />
                          ) : (
                            <Upload className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">
                          {dragActive ? 'Drop images here' : 'Click to upload or drag & drop'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, WEBP up to 5MB each
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Camera className="w-3.5 h-3.5" />
                            <span>{images.length}/{MAX_IMAGES} photos</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Auto-compressed</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {validationErrors.images && (
                      <span className="text-xs text-red-500 flex items-center gap-1 mt-2">
                        <AlertCircle className="w-3 h-3" /> {validationErrors.images}
                      </span>
                    )}
                  </div>

                  {/* Image Previews */}
                  {images.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm">
                        Uploaded Photos ({images.length}/{MAX_IMAGES})
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <AnimatePresence>
                          {images.map((img, idx) => (
                            <motion.div
                              key={img.id}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="relative group"
                            >
                              <div className={`aspect-square rounded-xl overflow-hidden border-2 relative ${
                                idx === 0 ? 'border-brand shadow-md shadow-brand/20' : 'border-border'
                              }`}>
                                <img
                                  src={img.preview}
                                  alt={`Upload ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />

                                {/* Cover badge */}
                                {idx === 0 && (
                                  <div className="absolute top-2 left-2">
                                    <Badge className="bg-brand text-white border-0 text-[10px] rounded-full px-2 py-0.5">
                                      Cover
                                    </Badge>
                                  </div>
                                )}

                                {/* Uploading overlay */}
                                {img.uploading && (
                                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
                                    <span className="text-white text-xs">Uploading...</span>
                                    <div className="w-16 mt-1">
                                      <Progress value={img.progress} className="h-1" />
                                    </div>
                                  </div>
                                )}

                                {/* Error overlay */}
                                {img.error && (
                                  <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
                                    <span className="text-white text-xs text-center px-2">{img.error}</span>
                                  </div>
                                )}

                                {/* Hover actions */}
                                {!img.uploading && (
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                                    <div className="flex gap-1">
                                      {idx > 0 && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); moveImage(img.id, 'left') }}
                                          className="w-7 h-7 rounded-full bg-white/90 text-foreground flex items-center justify-center hover:bg-white transition-colors"
                                          title="Move left"
                                        >
                                          <ChevronLeft className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                                        className="w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                                        title="Remove"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                      {idx < images.length - 1 && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); moveImage(img.id, 'right') }}
                                          className="w-7 h-7 rounded-full bg-white/90 text-foreground flex items-center justify-center hover:bg-white transition-colors"
                                          title="Move right"
                                        >
                                          <ChevronRight className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Image number */}
                              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* Add more button */}
                        {images.length < MAX_IMAGES && (
                          <motion.button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-brand/40 flex flex-col items-center justify-center gap-1 transition-colors"
                          >
                            <ImagePlus className="w-6 h-6 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground font-medium">Add More</span>
                          </motion.button>
                        )}
                      </div>

                      {/* Upload progress */}
                      {uploadingImages && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Uploading images...</span>
                            <span className="text-brand font-medium">
                              {images.filter(i => i.progress === 100).length}/{images.length}
                            </span>
                          </div>
                          <Progress value={(images.filter(i => i.progress === 100).length / images.length) * 100} className="h-2" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tips */}
                  <div className="bg-brand/5 dark:bg-brand/10 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand" /> Photo Tips
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>Use good lighting and clean background</li>
                      <li>Show the product from multiple angles</li>
                      <li>Include close-ups of any wear or damage</li>
                      <li>First photo becomes the cover image</li>
                    </ul>
                  </div>

                  {/* Step 2 Navigation */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="flex-1 h-12 rounded-xl"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (images.length === 0) {
                          setValidationErrors({ images: 'At least one image is required' })
                          toast.error('Please add at least one photo')
                          return
                        }
                        setValidationErrors({})
                        setStep(3)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="flex-[2] h-12 btn-gradient text-white border-0 rounded-xl font-semibold"
                    >
                      <span className="flex items-center gap-2 justify-center">
                        Next: Review & Post <ChevronRight className="w-5 h-5" />
                      </span>
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ===== STEP 3: Review & Post ===== */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/30">
                      <h3 className="font-semibold font-heading flex items-center gap-2">
                        <Eye className="w-4 h-4 text-brand" /> Review Your Listing
                      </h3>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Images Preview */}
                      {images.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {images.map((img, idx) => (
                            <div
                              key={img.id}
                              className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                                idx === 0 ? 'border-brand' : 'border-border'
                              }`}
                            >
                              <img src={img.preview} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Product</span>
                          <p className="font-medium mt-0.5">{form.title || 'Untitled'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Category</span>
                          <p className="font-medium mt-0.5">{cat?.name || form.category}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Selling Price</span>
                          <p className="font-semibold text-brand text-lg mt-0.5">
                            {form.sellingPrice ? formatINR(Number(form.sellingPrice)) : '\u20B90'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Original Price</span>
                          <p className="mt-0.5">
                            {form.originalPrice ? (
                              <span className="line-through text-muted-foreground">
                                {formatINR(Number(form.originalPrice))}
                              </span>
                            ) : '\u2014'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Condition</span>
                          <p className="font-medium mt-0.5">{form.condition}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Location</span>
                          <p className="font-medium mt-0.5">{form.district}{form.state ? `, ${form.state}` : ''}</p>
                        </div>
                        {form.course && (
                          <div>
                            <span className="text-muted-foreground">Course</span>
                            <p className="font-medium mt-0.5">{form.course}</p>
                          </div>
                        )}
                        {form.semester && (
                          <div>
                            <span className="text-muted-foreground">Semester</span>
                            <p className="font-medium mt-0.5">{form.semester}</p>
                          </div>
                        )}
                        {form.college && (
                          <div>
                            <span className="text-muted-foreground">College</span>
                            <p className="font-medium mt-0.5">{form.college}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">WhatsApp</span>
                          <p className="font-medium mt-0.5">+91 {form.whatsappNumber}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Listing Type</span>
                          <p className="font-medium mt-0.5 capitalize">{form.listingType}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <span className="text-sm text-muted-foreground">Description</span>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{form.description}</p>
                      </div>

                      {savings > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                            Students save {savings}% on this deal!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3 Navigation */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="flex-1 h-12 rounded-xl"
                      disabled={submitting}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting || uploadingImages}
                      className="flex-[2] h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold relative overflow-hidden"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2 justify-center">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {uploadingImages ? 'Uploading Images...' : 'Publishing Listing...'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 justify-center">
                          <Sparkles className="w-5 h-5" /> Post Listing
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Submit note */}
                  <p className="text-xs text-muted-foreground text-center">
                    By posting, you agree to EduCampusHub&apos;s Terms of Service and that your listing is authentic.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>

          {/* ===== Live Preview Card ===== */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="sticky top-24 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 font-heading">
                <Eye className="w-4 h-4" /> Live Preview
              </h3>
              <Card className="overflow-hidden card-premium">
                {/* Image area */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {images.length > 0 ? (
                    <div className="relative w-full h-full">
                      <img
                        src={images[0]?.preview}
                        alt="Cover"
                        className="w-full h-full object-cover"
                      />
                      {images.length > 1 && (
                        <Badge className="absolute bottom-3 right-3 bg-black/70 text-white border-0 rounded-full text-[10px]">
                          +{images.length - 1} more
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${cat?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center`}>
                      <BookOpen className="w-16 h-16 text-white/50" />
                    </div>
                  )}
                  {savings > 0 && (
                    <Badge className="absolute bottom-3 left-3 bg-emerald-500 text-white border-0 font-bold rounded-full">
                      Save {savings}%
                    </Badge>
                  )}
                  {form.listingType === 'exchange' && (
                    <Badge className="absolute top-3 left-3 bg-accent text-white border-0 rounded-full">Exchange</Badge>
                  )}
                  {form.listingType === 'giveaway' && (
                    <Badge className="absolute top-3 left-3 bg-emerald-500 text-white border-0 rounded-full">FREE</Badge>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h4 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                    {form.title || 'Product Title'}
                  </h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-brand">
                      {form.sellingPrice ? formatINR(Number(form.sellingPrice)) : '\u20B90'}
                    </span>
                    {form.originalPrice && Number(form.originalPrice) > 0 && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatINR(Number(form.originalPrice))}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {form.condition && (
                      <Badge variant="secondary" className="text-[10px] rounded-full">{form.condition}</Badge>
                    )}
                    {form.district && (
                      <Badge variant="secondary" className="text-[10px] rounded-full">{form.district}, {form.state}</Badge>
                    )}
                    {cat && (
                      <Badge variant="secondary" className="text-[10px] rounded-full bg-brand/10 text-brand">
                        {cat ? t(`categories.${cat.translationKey}.name`) : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="pt-2 border-t border-border flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-[10px] font-bold">
                      {currentUser?.name?.charAt(0) || '?'}
                    </div>
                    <span className="text-xs font-medium">{currentUser?.name || 'You'}</span>
                    {currentUser?.isVerified && (
                      <Badge className="bg-brand/10 text-brand border-0 text-[9px] rounded-full px-1.5 py-0">Verified</Badge>
                    )}
                  </div>
                </div>
              </Card>

              {/* Quick tips */}
              <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Quick Tips</h4>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    Clear photos sell 3x faster
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    Competitive pricing attracts buyers
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    Be honest about product condition
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    Mention edition/year in description
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Payment Modal */}
      {currentUser && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          userId={currentUser.id}
          onPaymentSuccess={refreshCredits}
        />
      )}
    </div>
  )
}
