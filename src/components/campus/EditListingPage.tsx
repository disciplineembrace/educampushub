'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Upload, Check, ArrowLeft, Eye, X, ImagePlus,
  Loader2, AlertCircle, Camera, Sparkles, Trash2,
  Stethoscope, Wrench, GraduationCap, Target,
  Scale, FileText, ChevronRight, Shield,
  ChevronLeft, RotateCcw, Info, CreditCard, Zap,
  PenTool, Tablet, Notebook, Package, BookMarked, Pencil
} from 'lucide-react'
import { useAppStore, CATEGORIES, INDIAN_CITIES, CONDITIONS, SEMESTERS, BOARDS, STANDARDS, LISTING_TYPES, formatINR, parseListingImages, getCategoryTranslationKey } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const ICON_MAP: Record<string, React.ElementType> = {
  Stethoscope, Wrench, GraduationCap, Target, Scale, FileText, PenTool, Tablet, Notebook, Package, BookOpen, BookMarked,
}

interface UploadedImage {
  id: string
  file?: File
  preview: string
  compressed?: Blob
  serverUrl?: string
  uploading: boolean
  progress: number
  error?: string
  isExisting?: boolean // flag for images already on server
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
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
  if (ALLOWED_TYPES.includes(file.type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return ALLOWED_EXTENSIONS.includes(ext)
}

const MAX_IMAGES = 6
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function EditListingPage() {
  const { currentUser, setCurrentPage, setSelectedProductId, editingListing, setEditingListing } = useAppStore()
  const { t } = useTranslation()

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
    city: '',
    condition: '',
    whatsappNumber: '',
  })
  const [images, setImages] = useState<UploadedImage[]>([])
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]) // Track existing images to preserve
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [dragActive, setDragActive] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastSubmitRef = useRef<number>(0)

  // Use useMemo for computed values
  const cat = useMemo(() => CATEGORIES.find(c => c.id === form.category), [form.category])
  const savings = useMemo(() => {
    if (!form.originalPrice || !form.sellingPrice) return 0
    const orig = Number(form.originalPrice)
    const sell = Number(form.sellingPrice)
    if (orig <= 0 || sell <= 0) return 0
    return Math.round(((orig - sell) / orig) * 100)
  }, [form.originalPrice, form.sellingPrice])

  // Pre-populate form with editing listing data
  useEffect(() => {
    if (!editingListing) {
      // No listing to edit, redirect
      setCurrentPage('profile')
      return
    }

    setForm({
      title: editingListing.title || '',
      description: editingListing.description || '',
      originalPrice: editingListing.originalPrice ? String(editingListing.originalPrice) : '',
      sellingPrice: editingListing.sellingPrice ? String(editingListing.sellingPrice) : '',
      category: editingListing.category || '',
      listingType: editingListing.listingType || 'sell',
      course: editingListing.course || '',
      semester: editingListing.semester || '',
      standard: editingListing.standard || '',
      board: editingListing.board || '',
      college: editingListing.college || '',
      city: editingListing.city || '',
      condition: editingListing.condition || '',
      whatsappNumber: editingListing.whatsappNumber || '',
    })

    // Load existing images
    const parsedImages = parseListingImages(editingListing.images)
    setExistingImageUrls(parsedImages)
    const existingImgObjects: UploadedImage[] = parsedImages.map((url, idx) => ({
      id: `existing-${idx}`,
      preview: url,
      uploading: false,
      progress: 100,
      isExisting: true,
      serverUrl: url,
    }))
    setImages(existingImgObjects)
  }, [editingListing])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)
      })
    }
  }, [])

  const handleChange = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setValidationErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  // Image handling
  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    const newImages: UploadedImage[] = []
    const errors: string[] = []

    let currentCount = 0
    setImages(prev => {
      currentCount = prev.length
      return prev
    })

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
        if (prev.length + newImages.length > MAX_IMAGES) {
          toast.error(`Maximum ${MAX_IMAGES} images allowed`)
          return prev
        }
        const nonDupes = newImages.filter(ni =>
          !prev.some(existing => existing.file && ni.file && existing.file.name === ni.file.name && existing.file.size === ni.file.size)
        )
        return [...prev, ...nonDupes]
      })
      toast.success(`${newImages.length} image${newImages.length > 1 ? 's' : ''} added`)
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

  // Upload new images to server
  const uploadImagesToServer = async (currentImages: UploadedImage[]): Promise<string[]> => {
    const newImagesToUpload = currentImages.filter(img => !img.isExisting && img.file)
    const existingUrls = currentImages.filter(img => img.isExisting && img.serverUrl).map(img => img.serverUrl!)

    if (newImagesToUpload.length === 0) return existingUrls

    setUploadingImages(true)
    const uploadedUrls: string[] = []

    try {
      const formData = new FormData()
      for (const img of newImagesToUpload) {
        const fileToUpload = img.compressed
          ? new File([img.compressed], img.file!.name, { type: 'image/jpeg' })
          : img.file!
        formData.append('files', fileToUpload)
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      const urls: string[] = data.urls || []
      uploadedUrls.push(...existingUrls, ...urls)
    } catch {
      // Fallback: keep existing URLs + blob URLs for new
      const fallbackUrls = newImagesToUpload.map(img => img.preview)
      uploadedUrls.push(...existingUrls, ...fallbackUrls)
      toast.warning('Some new images may not persist. Please re-upload if needed.')
    } finally {
      setUploadingImages(false)
    }

    return uploadedUrls
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
      errors.sellingPrice = 'Price cannot exceed ₹1,00,000'
    }

    if (form.originalPrice && Number(form.originalPrice) > 100000) {
      errors.originalPrice = 'Price cannot exceed ₹1,00,000'
    }

    if (!form.category) errors.category = 'Category is required'
    if (!form.condition) errors.condition = 'Condition is required'
    if (!form.city) errors.city = 'City is required'

    if (!form.whatsappNumber.trim()) {
      errors.whatsappNumber = 'WhatsApp number is required'
    } else if (!/^[6-9]\d{9}$/.test(form.whatsappNumber.trim())) {
      errors.whatsappNumber = 'Enter valid 10-digit Indian mobile number'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [form])

  // Submit handler for EDIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const now = Date.now()
    if (now - lastSubmitRef.current < 3000) {
      toast.error('Please wait before submitting again')
      return
    }
    lastSubmitRef.current = now

    if (!currentUser || !editingListing) {
      toast.error('Please login to edit a listing')
      setCurrentPage('login')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the errors below')
      const firstErrorEl = document.querySelector('[data-error="true"]')
      if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setError('')
    setSubmitting(true)

    try {
      // Step 1: Upload new images
      toast.loading('Processing images...', { id: 'upload-status' })
      let imageUrls: string[] = []
      try {
        imageUrls = await uploadImagesToServer(images)
        toast.success('Images processed!', { id: 'upload-status' })
      } catch {
        toast.warning('Image upload issue. Saving with available images.', { id: 'upload-status' })
        imageUrls = images.map(img => img.serverUrl || img.preview)
      }

      // Step 2: Update listing via PATCH
      toast.loading('Updating your listing...', { id: 'listing-status' })

      const updatePayload = {
        id: editingListing.id,
        sellerId: currentUser.id,
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
        city: form.city,
        condition: form.condition,
        whatsappNumber: form.whatsappNumber.trim(),
        images: JSON.stringify(imageUrls),
      }

      const res = await fetch('/api/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update listing')
      }

      toast.success('Listing updated successfully!', { id: 'listing-status' })
      setSuccess(true)
    } catch (err) {
      toast.error('Failed to update listing.', { id: 'listing-status' })
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete handler
  const handleDelete = async () => {
    if (!currentUser || !editingListing) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/listings?id=${editingListing.id}&sellerId=${currentUser.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Listing deleted successfully!')
        setEditingListing(null)
        setCurrentPage('profile')
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

  // Not logged in or no editing listing
  if (!currentUser || !editingListing) {
    return (
      <div className="pt-20 pb-10 min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">No Listing Selected</h3>
          <p className="text-muted-foreground mb-6">Select a listing from your profile to edit</p>
          <Button onClick={() => setCurrentPage('profile')} className="btn-gradient text-white border-0 rounded-xl px-8">
            Go to Profile
          </Button>
        </div>
      </div>
    )
  }

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
          <h2 className="text-2xl font-bold text-foreground mb-3 font-heading">Listing Updated!</h2>
          <p className="text-muted-foreground mb-6">
            Your listing has been updated successfully. The changes are now live on EduCampusHub.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                setSelectedProductId(editingListing.id)
                setEditingListing(null)
                setCurrentPage('product')
              }}
              className="btn-gradient text-white border-0 rounded-xl px-6"
            >
              View Listing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingListing(null)
                setCurrentPage('profile')
              }}
              className="rounded-xl"
            >
              Back to Profile
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="pt-20 pb-10 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              setEditingListing(null)
              setCurrentPage('profile')
            }}
            className="gap-2 -ml-2 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Profile
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-heading">
                Edit <span className="gradient-text">Listing</span>
              </h1>
              <p className="text-muted-foreground text-sm">Update your product details below</p>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-5"
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
              placeholder="Describe the product condition, edition, any highlights..."
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

          {/* Condition & City */}
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
                  {CONDITIONS.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.condition && (
                <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {validationErrors.condition}
                </span>
              )}
            </div>
            <div data-error={!!validationErrors.city}>
              <Label className="mb-1.5 block">City *</Label>
              <Select
                value={form.city || undefined}
                onValueChange={v => handleChange('city', v)}
              >
                <SelectTrigger className={`h-11 rounded-xl ${validationErrors.city ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_CITIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.city && (
                <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {validationErrors.city}
                </span>
              )}
            </div>
          </div>

          {/* Course & Semester */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Course</Label>
              <Input
                value={form.course}
                onChange={e => handleChange('course', e.target.value)}
                placeholder="e.g., B.Tech CSE"
                className="h-11 rounded-xl"
                maxLength={100}
              />
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
                  {SEMESTERS.map(s => (
                    <SelectItem key={s} value={s}>{s} Semester</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Board & Standard */}
          <div className="grid grid-cols-2 gap-4">
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
                  {BOARDS.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Standard</Label>
              <Select
                value={form.standard || undefined}
                onValueChange={v => handleChange('standard', v)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select standard" />
                </SelectTrigger>
                <SelectContent>
                  {STANDARDS.map(s => (
                    <SelectItem key={s} value={s}>Std {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* College */}
          <div>
            <Label className="mb-1.5 block">College</Label>
            <Input
              value={form.college}
              onChange={e => handleChange('college', e.target.value)}
              placeholder="e.g., IIT Bombay"
              className="h-11 rounded-xl"
              maxLength={150}
            />
          </div>

          {/* WhatsApp Number */}
          <div data-error={!!validationErrors.whatsappNumber}>
            <Label className="mb-1.5 block">WhatsApp Number *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">+91</span>
              <Input
                type="tel"
                value={form.whatsappNumber}
                onChange={e => handleChange('whatsappNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="9876543210"
                className={`h-11 rounded-xl pl-12 ${validationErrors.whatsappNumber ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                maxLength={10}
              />
            </div>
            {validationErrors.whatsappNumber && (
              <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {validationErrors.whatsappNumber}
              </span>
            )}
          </div>

          {/* Images Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Product Images</Label>
              <span className="text-xs text-muted-foreground">{images.length}/{MAX_IMAGES}</span>
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {images.map(img => (
                <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border-2 border-border group">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {img.isExisting && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-brand/80 text-white text-[9px] rounded-md font-medium">
                      Existing
                    </div>
                  )}
                </div>
              ))}

              {/* Add Image Button */}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDrag}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
                    dragActive
                      ? 'border-brand bg-brand/5 text-brand'
                      : 'border-border hover:border-brand/40 text-muted-foreground hover:text-brand'
                  }`}
                >
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-xs font-medium">Add Image</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />

            {validationErrors.images && (
              <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {validationErrors.images}
              </span>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, or WEBP. Max 5MB each. Remove existing images and add new ones to replace.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" /> Update Listing
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-12 rounded-xl text-base font-semibold gap-2 sm:w-auto"
            >
              <Trash2 className="w-5 h-5" /> Delete Listing
            </Button>
          </div>
        </motion.form>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Listing</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{editingListing?.title}&quot;? This action cannot be undone. All data including images, views, and wishlist entries will be permanently removed.
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
    </div>
  )
}
