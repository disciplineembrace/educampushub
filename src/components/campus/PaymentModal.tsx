'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Upload, CheckCircle, AlertCircle, QrCode, Copy, ArrowRight, Shield, CreditCard, Smartphone, Image as ImageIcon, Loader2, Crown, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onPaymentSuccess: () => void
  paymentType?: 'upload_fee' | 'premium_plan'
}

interface PaymentSession {
  paymentId: string
  amount: number
  upiId: string
  upiUrl: string
  qrCode: string
  expiresAt: string
  createdAt: string
  status: string
  paymentType: string
}

type PaymentStep = 'initiating' | 'qr_payment' | 'submit_proof' | 'verifying' | 'success' | 'expired' | 'error'

export default function PaymentModal({ isOpen, onClose, userId, onPaymentSuccess, paymentType = 'upload_fee' }: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('initiating')
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null)
  const [utrNumber, setUtrNumber] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const isPremium = paymentType === 'premium_plan'
  const amount = isPremium ? 149 : 10
  const title = isPremium ? 'Premium Plan' : 'Upload Credit'
  const subtitle = isPremium ? '29 Book Uploads for ₹149' : '1 Book Upload for ₹10'

  // Create payment session
  useEffect(() => {
    if (!isOpen || !userId) return

    const createPayment = async () => {
      setStep('initiating')
      setError('')
      try {
        const res = await fetch('/api/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, paymentType })
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to create payment session')
          setStep('error')
          return
        }

        setPaymentSession(data)
        setStep('qr_payment')
      } catch {
        setError('Network error. Please try again.')
        setStep('error')
      }
    }

    createPayment()
  }, [isOpen, userId, paymentType])

  // Countdown timer
  useEffect(() => {
    if (step !== 'qr_payment' && step !== 'submit_proof') return
    if (!paymentSession) return

    const expiresAt = new Date(paymentSession.expiresAt).getTime()

    const timer = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))

      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(timer)
        setStep('expired')
        // Auto-expire on backend
        fetch('/api/payment/expire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: paymentSession.paymentId })
        }).catch(() => {})
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [step, paymentSession])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get UPI ID from payment session or fallback
  const UPI_ID = paymentSession?.upiId || 'sagathiyapradip1137-3@oksbi'

  const copyUpiId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = UPI_ID
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [UPI_ID])

  const handleScreenshotUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot must be less than 5MB')
      return
    }

    setScreenshotFile(file)
    setScreenshotPreview(URL.createObjectURL(file))
    setError('')
  }

  const handleSubmitProof = async () => {
    if (!utrNumber.trim() && !screenshotFile) {
      setError('Please enter your UTR/Reference number or upload a screenshot')
      return
    }

    if (utrNumber.trim() && utrNumber.trim().length < 6) {
      setError('UTR number must be at least 6 digits')
      return
    }

    setStep('verifying')
    setError('')

    try {
      // Upload screenshot if provided
      let uploadedScreenshotUrl: string | null = null
      if (screenshotFile) {
        setUploading(true)
        const formData = new FormData()
        formData.append('files', screenshotFile)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json()
        if (uploadRes.ok && uploadData.urls?.length > 0) {
          uploadedScreenshotUrl = uploadData.urls[0]
          setScreenshotUrl(uploadedScreenshotUrl)
        }
        setUploading(false)
      }

      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentSession?.paymentId,
          userId,
          utrNumber: utrNumber.trim() || undefined,
          screenshotUrl: uploadedScreenshotUrl || undefined,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Payment verification failed')
        setStep('submit_proof')
        return
      }

      setStep('success')
      onPaymentSuccess()
    } catch {
      setError('Network error. Please try again.')
      setStep('submit_proof')
    }
  }

  const handleClose = () => {
    if (step === 'success') {
      onClose()
      resetState()
      return
    }
    onClose()
    resetState()
  }

  const resetState = () => {
    setStep('initiating')
    setPaymentSession(null)
    setUtrNumber('')
    setScreenshotFile(null)
    setScreenshotPreview(null)
    setScreenshotUrl(null)
    setUploading(false)
    setTimeLeft(300)
    setError('')
    setCopied(false)
  }

  const timerColor = timeLeft > 120 ? 'text-emerald-500' : timeLeft > 60 ? 'text-amber-500' : 'text-red-500'
  const timerBg = timeLeft > 120 ? 'bg-emerald-50 dark:bg-emerald-950/30' : timeLeft > 60 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-red-50 dark:bg-red-950/30'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`relative p-6 text-white ${
              isPremium
                ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600'
                : 'bg-gradient-to-br from-brand via-accent to-brand'
            }`}>
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  {isPremium ? <Crown className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold font-heading">{title}</h2>
                  <p className="text-white/70 text-xs">{subtitle}</p>
                </div>
              </div>

              {/* Timer */}
              {(step === 'qr_payment' || step === 'submit_proof') && (
                <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl ${timerBg} ${timerColor} text-sm font-medium`}>
                  <Clock className="w-4 h-4" />
                  <span>Time remaining: {formatTime(timeLeft)}</span>
                  {timeLeft <= 60 && (
                    <span className="text-xs animate-pulse">Hurry!</span>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Step: Initiating */}
              {step === 'initiating' && (
                <div className="text-center py-8">
                  <div className={`w-16 h-16 rounded-2xl ${isPremium ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-brand/10'} flex items-center justify-center mx-auto mb-4 animate-pulse`}>
                    <QrCode className={`w-8 h-8 ${isPremium ? 'text-amber-500' : 'text-brand'}`} />
                  </div>
                  <p className="text-muted-foreground">Creating payment session...</p>
                </div>
              )}

              {/* Step: QR Payment */}
              {step === 'qr_payment' && paymentSession && (
                <div className="space-y-5">
                  {/* QR Code */}
                  <div className="text-center">
                    <div className="inline-block p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
                      <img
                        src={paymentSession.qrCode}
                        alt="UPI QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Scan with any UPI app (GPay, PhonePe, Paytm, etc.)
                    </p>
                  </div>

                  {/* UPI ID Copy */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1.5">Or pay to UPI ID:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono font-semibold text-foreground bg-white dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                        {UPI_ID}
                      </code>
                      <Button
                        size="sm"
                        variant={copied ? 'default' : 'outline'}
                        onClick={copyUpiId}
                        className="shrink-0 rounded-lg gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className={`flex items-center justify-between rounded-xl p-4 ${
                    isPremium ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-brand/5 dark:bg-brand/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Smartphone className={`w-5 h-5 ${isPremium ? 'text-amber-500' : 'text-brand'}`} />
                      <span className="text-sm font-medium text-foreground">Amount to Pay</span>
                    </div>
                    <span className={`text-xl font-bold font-heading ${isPremium ? 'text-amber-600 dark:text-amber-400' : 'text-brand'}`}>
                      ₹{amount}
                    </span>
                  </div>

                  {/* What you get */}
                  <div className={`rounded-xl p-4 border ${
                    isPremium ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                  }`}>
                    <p className="text-xs font-semibold text-foreground mb-2">What you get:</p>
                    <ul className="space-y-1">
                      {isPremium ? (
                        <>
                          <li className="text-xs text-muted-foreground flex items-center gap-2"><Crown className="w-3 h-3 text-amber-500" /> 29 Book Uploads</li>
                          <li className="text-xs text-muted-foreground flex items-center gap-2"><Zap className="w-3 h-3 text-amber-500" /> Premium Badge & Search Priority</li>
                          <li className="text-xs text-muted-foreground flex items-center gap-2"><Shield className="w-3 h-3 text-amber-500" /> Featured Seller Section</li>
                        </>
                      ) : (
                        <li className="text-xs text-muted-foreground flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-500" /> 1 Upload Credit</li>
                      )}
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button
                      onClick={() => setStep('submit_proof')}
                      className={`w-full h-12 text-white border-0 rounded-xl text-base font-semibold gap-2 ${
                        isPremium
                          ? 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/30'
                          : 'btn-gradient'
                      }`}
                    >
                      I&apos;ve Made the Payment
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      After paying, click above to submit your payment proof
                    </p>
                  </div>
                </div>
              )}

              {/* Step: Submit Proof */}
              {step === 'submit_proof' && (
                <div className="space-y-5">
                  <div className={`rounded-xl p-4 border ${
                    isPremium ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-brand/5 dark:bg-brand/10 border-brand/20 dark:border-brand/30'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Shield className={`w-5 h-5 shrink-0 mt-0.5 ${isPremium ? 'text-amber-500' : 'text-brand'}`} />
                      <div className="text-sm">
                        <p className={`font-medium mb-1 ${isPremium ? 'text-amber-600 dark:text-amber-400' : 'text-brand dark:text-brand-light'}`}>Payment Proof Required</p>
                        <p className="text-xs opacity-80 text-muted-foreground">Enter the UTR/Reference number from your UPI payment. This is a 12-digit number found in your payment receipt.</p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 text-sm p-3 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      UTR / Reference Number
                    </label>
                    <Input
                      value={utrNumber}
                      onChange={e => {
                        setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))
                        setError('')
                      }}
                      placeholder="Enter 12-digit UTR number"
                      className="h-12 rounded-xl text-base font-mono tracking-wider"
                      maxLength={12}
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Find this in your UPI app payment receipt
                    </p>
                  </div>

                  {/* Screenshot Upload */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      Payment Screenshot (Optional)
                    </label>
                    {screenshotPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        <img src={screenshotPreview} alt="Payment screenshot" className="w-full max-h-48 object-contain bg-gray-50 dark:bg-gray-800" />
                        <button
                          onClick={() => { setScreenshotFile(null); setScreenshotPreview(null) }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors">
                        <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload screenshot</span>
                        <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP (max 5MB)</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) handleScreenshotUpload(f)
                          }}
                        />
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Upload a screenshot of your completed payment for faster verification
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('qr_payment')}
                      className="flex-1 h-11 rounded-xl"
                    >
                      Back to QR
                    </Button>
                    <Button
                      onClick={handleSubmitProof}
                      disabled={utrNumber.trim().length < 6 && !screenshotFile}
                      className={`flex-1 h-11 text-white border-0 rounded-xl font-semibold gap-2 ${
                        isPremium ? 'bg-amber-500 hover:bg-amber-600' : 'btn-gradient'
                      }`}
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Submit Proof
                    </Button>
                  </div>
                </div>
              )}

              {/* Step: Verifying */}
              {step === 'verifying' && (
                <div className="text-center py-8">
                  <div className={`w-16 h-16 rounded-2xl ${isPremium ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-brand/10'} flex items-center justify-center mx-auto mb-4`}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Shield className={`w-8 h-8 ${isPremium ? 'text-amber-500' : 'text-brand'}`} />
                    </motion.div>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Submitting Proof</h3>
                  <p className="text-sm text-muted-foreground">Please wait while we submit your payment proof...</p>
                </div>
              )}

              {/* Step: Success */}
              {step === 'success' && (
                <div className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                    </div>
                  </motion.div>
                  <h3 className="text-xl font-bold text-foreground mb-2 font-heading">Proof Submitted!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Payment proof submitted! Admin will verify within 24 hours. {isPremium ? 'Your Premium plan will be activated once verified.' : 'Upload credits will be added once verified.'}
                  </p>
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-sm px-4 py-1.5 rounded-full">
                    <Clock className="w-3.5 h-3.5 mr-1" /> Pending Verification
                  </Badge>
                  <div className="mt-6">
                    <Button
                      onClick={handleClose}
                      className={`text-white border-0 rounded-xl h-11 px-8 font-semibold ${
                        isPremium ? 'bg-amber-500 hover:bg-amber-600' : 'btn-gradient'
                      }`}
                    >
                      {isPremium ? 'Continue to Dashboard' : 'Continue to Upload'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step: Expired */}
              {step === 'expired' && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-10 h-10 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2 font-heading">Session Expired</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your payment session has expired after 5 minutes. Please try again.
                  </p>
                  <Button
                    onClick={() => {
                      resetState()
                      // Re-trigger payment creation
                      setStep('initiating')
                      const createPayment = async () => {
                        try {
                          const res = await fetch('/api/payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId, paymentType })
                          })
                          const data = await res.json()
                          if (res.ok) {
                            setPaymentSession(data)
                            setStep('qr_payment')
                          } else {
                            setError(data.error)
                            setStep('error')
                          }
                        } catch {
                          setError('Network error')
                          setStep('error')
                        }
                      }
                      createPayment()
                    }}
                    className={`text-white border-0 rounded-xl h-11 px-8 font-semibold ${
                      isPremium ? 'bg-amber-500 hover:bg-amber-600' : 'btn-gradient'
                    }`}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {/* Step: Error */}
              {step === 'error' && (
                <div className="text-center py-6">
                  <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2 font-heading">Something Went Wrong</h3>
                  <p className="text-sm text-muted-foreground mb-4">{error || 'An unexpected error occurred.'}</p>
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="rounded-xl h-11 px-8"
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>

            {/* Footer */}
            {(step === 'qr_payment' || step === 'submit_proof') && (
              <div className="px-6 pb-5">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3 h-3" />
                  <span>Secure payment powered by UPI</span>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
