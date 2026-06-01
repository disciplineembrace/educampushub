'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff, ArrowLeft, KeyRound, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AuthTab = 'login' | 'register'
type ForgotPasswordStep = 'none' | 'email' | 'otp' | 'reset' | 'success'

export default function LoginPage() {
  const { setCurrentPage, setCurrentUser } = useAppStore()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<AuthTab>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  // Forgot Password state
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>('none')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotShowNewPassword, setForgotShowNewPassword] = useState(false)
  const [forgotShowConfirmPassword, setForgotShowConfirmPassword] = useState(false)
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('')
  const [forgotVerificationToken, setForgotVerificationToken] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [otpResendTimer, setOtpResendTimer] = useState(0)

  // OTP resend timer
  useEffect(() => {
    if (otpResendTimer > 0) {
      const timer = setTimeout(() => setOtpResendTimer(otpResendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpResendTimer])

  // ─── Login Handler ───

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!loginEmail) {
      setError(t('login.error.emailRequired'))
      return
    }
    if (!loginPassword) {
      setError(t('login.error.passwordRequired'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: loginEmail,
          password: loginPassword,
        })
      })
      const data = await res.json()

      if (!res.ok) {
        // Map server errors to translation keys
        if (data.error === 'Invalid email or password') {
          setError(t('login.error.invalidCredentials'))
        } else if (data.error === 'This account has been banned') {
          setError(t('login.error.accountBanned'))
        } else {
          setError(data.error || t('login.error.loginFailed'))
        }
        return
      }

      setCurrentUser(data.user)
      setCurrentPage('home')
    } catch {
      setError(t('login.error.wentWrong'))
    } finally {
      setLoading(false)
    }
  }

  // ─── Registration (Direct, No OTP) ───

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!regName) {
      setError(t('login.error.nameRequired'))
      return
    }
    if (regName.trim().length < 2) {
      setError(t('login.error.nameRequired'))
      return
    }
    if (!regEmail) {
      setError(t('login.error.emailRequired'))
      return
    }
    if (!regPassword) {
      setError(t('login.error.passwordRequired'))
      return
    }
    if (regPassword.length < 8) {
      setError(t('login.error.passwordTooShort'))
      return
    }
    // Check password strength
    const hasUppercase = /[A-Z]/.test(regPassword)
    const hasLowercase = /[a-z]/.test(regPassword)
    const hasDigit = /\d/.test(regPassword)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(regPassword)
    if (!(hasUppercase && hasLowercase && hasDigit && hasSpecial)) {
      setError(t('login.error.passwordWeak'))
      return
    }
    if (regPassword !== regConfirmPassword) {
      setError(t('login.error.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: regName,
          email: regEmail,
          password: regPassword,
          phone: regPhone || undefined,
        })
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'Email already registered') {
          setError(t('login.error.emailExists'))
        } else {
          setError(data.error || t('login.error.wentWrong'))
        }
        return
      }

      setCurrentUser(data.user)
      setCurrentPage('home')
    } catch {
      setError(t('login.error.wentWrong'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    // Redirect to our custom Google OAuth route
    window.location.href = '/api/auth/google'
  }

  // ─── Forgot Password Handlers ───

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')

    if (!forgotEmail) {
      setForgotError(t('login.error.emailRequired'))
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(forgotEmail)) {
      setForgotError(t('login.error.emailRequired'))
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', email: forgotEmail }),
      })
      const data = await res.json()

      if (!res.ok) {
        setForgotError(data.error || t('forgotPassword.error.sendFailed'))
        return
      }

      setForgotMaskedEmail(data.maskedEmail || '')
      setForgotStep('otp')
      setOtpResendTimer(60)
    } catch {
      setForgotError(t('forgotPassword.error.wentWrong'))
    } finally {
      setForgotLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')

    if (!forgotOtp) {
      setForgotError(t('forgotPassword.error.otpRequired'))
      return
    }

    if (forgotOtp.length !== 6) {
      setForgotError(t('forgotPassword.error.otpInvalid'))
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', email: forgotEmail, otp: forgotOtp }),
      })
      const data = await res.json()

      if (!res.ok) {
        setForgotError(data.error || t('forgotPassword.error.otpInvalid'))
        return
      }

      setForgotVerificationToken(data.verificationToken)
      setForgotStep('reset')
    } catch {
      setForgotError(t('forgotPassword.error.wentWrong'))
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')

    if (!forgotNewPassword) {
      setForgotError(t('forgotPassword.error.passwordRequired'))
      return
    }
    if (forgotNewPassword.length < 8) {
      setForgotError(t('login.error.passwordTooShort'))
      return
    }
    const hasUppercase = /[A-Z]/.test(forgotNewPassword)
    const hasLowercase = /[a-z]/.test(forgotNewPassword)
    const hasDigit = /\d/.test(forgotNewPassword)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(forgotNewPassword)
    if (!(hasUppercase && hasLowercase && hasDigit && hasSpecial)) {
      setForgotError(t('login.error.passwordWeak'))
      return
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError(t('login.error.passwordMismatch'))
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          email: forgotEmail,
          verificationToken: forgotVerificationToken,
          newPassword: forgotNewPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setForgotError(data.error || t('forgotPassword.error.resetFailed'))
        return
      }

      setForgotStep('success')
    } catch {
      setForgotError(t('forgotPassword.error.wentWrong'))
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (otpResendTimer > 0) return
    setForgotError('')
    setForgotOtp('')

    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', email: forgotEmail }),
      })
      const data = await res.json()

      if (!res.ok) {
        setForgotError(data.error || t('forgotPassword.error.sendFailed'))
        return
      }

      setOtpResendTimer(60)
    } catch {
      setForgotError(t('forgotPassword.error.wentWrong'))
    } finally {
      setForgotLoading(false)
    }
  }

  const resetForgotPassword = () => {
    setForgotStep('none')
    setForgotEmail('')
    setForgotOtp('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotMaskedEmail('')
    setForgotVerificationToken('')
    setForgotError('')
    setOtpResendTimer(0)
  }

  // ─── Forgot Password UI ───

  const renderForgotPassword = () => {
    return (
      <motion.div
        key="forgot-password"
        className="space-y-5"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div>
          <button
            type="button"
            onClick={() => {
              if (forgotStep === 'otp') {
                setForgotStep('email')
                setForgotOtp('')
                setForgotError('')
              } else if (forgotStep === 'reset') {
                setForgotStep('otp')
                setForgotError('')
              } else {
                resetForgotPassword()
              }
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('forgotPassword.backToLogin')}
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              {forgotStep === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : forgotStep === 'reset' ? (
                <ShieldCheck className="w-5 h-5 text-brand" />
              ) : (
                <KeyRound className="w-5 h-5 text-brand" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground font-heading">
                {forgotStep === 'email' && t('forgotPassword.title')}
                {forgotStep === 'otp' && t('forgotPassword.verifyTitle')}
                {forgotStep === 'reset' && t('forgotPassword.resetTitle')}
                {forgotStep === 'success' && t('forgotPassword.successTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {forgotStep === 'email' && t('forgotPassword.subtitle')}
                {forgotStep === 'otp' && t('forgotPassword.verifySubtitle', { phone: forgotMaskedEmail })}
                {forgotStep === 'reset' && t('forgotPassword.resetSubtitle')}
                {forgotStep === 'success' && t('forgotPassword.successSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        {forgotStep !== 'success' && (
          <div className="flex items-center gap-2">
            {['email', 'otp', 'reset'].map((step, i) => {
              const stepOrder = ['email', 'otp', 'reset']
              const currentIndex = stepOrder.indexOf(forgotStep)
              const stepIndex = i
              const isActive = stepIndex === currentIndex
              const isCompleted = stepIndex < currentIndex
              return (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted ? 'bg-emerald-500 text-white' :
                    isActive ? 'bg-brand text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {i === 0 && t('forgotPassword.step1')}
                    {i === 1 && t('forgotPassword.step2')}
                    {i === 2 && t('forgotPassword.step3')}
                  </span>
                  {i < 2 && (
                    <div className={`h-0.5 flex-1 rounded-full transition-all ${
                      isCompleted ? 'bg-emerald-500' : 'bg-muted'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Error Display */}
        {forgotError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 text-sm">
            {forgotError}
          </div>
        )}

        {/* Step 1: Email Input */}
        {forgotStep === 'email' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  className="h-12 pl-10 rounded-xl"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{t('forgotPassword.otpHint')}</p>
            </div>

            <Button
              type="submit"
              disabled={forgotLoading}
              className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
            >
              {forgotLoading ? t('forgotPassword.button.sending') : (
                <>{t('forgotPassword.button.sendOtp')} <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {forgotStep === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">{t('forgotPassword.label.otp')}</Label>
              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={forgotOtp[i] || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      if (val) {
                        const newOtp = forgotOtp.split('')
                        newOtp[i] = val[0]
                        setForgotOtp(newOtp.join(''))
                        // Auto-focus next input
                        const nextInput = document.getElementById(`otp-${i + 1}`)
                        if (nextInput) nextInput.focus()
                      } else {
                        const newOtp = forgotOtp.split('')
                        newOtp[i] = ''
                        setForgotOtp(newOtp.join(''))
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !forgotOtp[i]) {
                        const prevInput = document.getElementById(`otp-${i - 1}`)
                        if (prevInput) prevInput.focus()
                      }
                    }}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl"
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">{t('forgotPassword.otpHint')}</p>
            </div>

            {/* Resend OTP */}
            <div className="text-center">
              {otpResendTimer > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('forgotPassword.resendIn', { seconds: otpResendTimer })}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={forgotLoading}
                  className="text-sm text-brand hover:underline disabled:opacity-50"
                >
                  {t('forgotPassword.resendOtp')}
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={forgotLoading || forgotOtp.length !== 6}
              className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
            >
              {forgotLoading ? t('forgotPassword.button.verifying') : (
                <>{t('forgotPassword.button.verifyOtp')} <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        )}

        {/* Step 3: Reset Password */}
        {forgotStep === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">{t('forgotPassword.label.newPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={forgotShowNewPassword ? 'text' : 'password'}
                  value={forgotNewPassword}
                  onChange={e => setForgotNewPassword(e.target.value)}
                  placeholder={t('forgotPassword.placeholder.newPassword')}
                  required
                  className="h-12 pl-10 pr-10 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setForgotShowNewPassword(!forgotShowNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {forgotShowNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password strength indicator */}
            {forgotNewPassword && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[
                    forgotNewPassword.length >= 8,
                    /[A-Z]/.test(forgotNewPassword),
                    /[a-z]/.test(forgotNewPassword),
                    /\d/.test(forgotNewPassword),
                    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(forgotNewPassword),
                  ].map((met, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                      met ? 'bg-emerald-500' : 'bg-muted'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('forgotPassword.passwordStrength')}</p>
              </div>
            )}

            <div>
              <Label className="mb-1.5 block">{t('forgotPassword.label.confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={forgotShowConfirmPassword ? 'text' : 'password'}
                  value={forgotConfirmPassword}
                  onChange={e => setForgotConfirmPassword(e.target.value)}
                  placeholder={t('forgotPassword.placeholder.confirmPassword')}
                  required
                  className="h-12 pl-10 pr-10 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setForgotShowConfirmPassword(!forgotShowConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {forgotShowConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={forgotLoading}
              className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
            >
              {forgotLoading ? t('forgotPassword.button.resetting') : (
                <>{t('forgotPassword.button.resetPassword')} <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        )}

        {/* Success Step */}
        {forgotStep === 'success' && (
          <div className="text-center py-4 space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </motion.div>
            <p className="text-sm text-muted-foreground">{t('forgotPassword.successMessage')}</p>
            <Button
              onClick={() => {
                resetForgotPassword()
                setActiveTab('login')
              }}
              className="h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold px-8 gap-2"
            >
              {t('forgotPassword.button.goToLogin')} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="pt-16 min-h-screen flex">
      {/* Left side - Gradient branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand via-accent to-brand relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-pattern opacity-20" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-white/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-light/10 rounded-full blur-[100px]" />

        <div className="relative text-center px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-8"
            >
              <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto shadow-2xl">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-4 font-heading">{t('login.brand.welcome')}</h2>
            <p className="text-white/70 max-w-sm mx-auto mb-8 leading-relaxed">
              {t('login.brand.tagline')}
            </p>

            {/* Floating stats */}
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-white font-heading">{t('login.brand.0percent')}</p>
                <p className="text-xs text-white/60">{t('login.brand.commission')}</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white font-heading">{t('login.brand.direct')}</p>
                <p className="text-xs text-white/60">{t('login.brand.studentToStudent')}</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white font-heading">{t('login.brand.100percent')}</p>
                <p className="text-xs text-white/60">{t('login.brand.safeVerified')}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {/* Mobile header gradient bar */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold font-heading">
                Edu<span className="gradient-text">CampusHub</span>
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{t('login.mobileBrand.tagline')}</p>
          </div>

          {forgotStep !== 'none' ? (
            // ─── Forgot Password Flow ───
            renderForgotPassword()
          ) : (
            // ─── Normal Login/Register Flow ───
            <>
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-heading">
                  {t('login.heading.prefix')} <span className="gradient-text">{t('login.heading.highlight')}</span>
                </h1>
                <p className="text-muted-foreground">
                  {t('login.subheading')}
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="flex mb-6 bg-muted/50 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setError('') }}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    activeTab === 'login'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('login.tabs.login')}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setError('') }}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    activeTab === 'register'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('login.tabs.register')}
                </button>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'login' ? (
                  <motion.div
                    key="login"
                    className="space-y-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {error && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 text-sm">
                        {error}
                      </div>
                    )}

                    {/* ─── Email + Password Login ─── */}
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label className="mb-1.5 block">{t('login.label.collegeEmail')}</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="email"
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            placeholder={t('login.placeholder.email')}
                            required
                            className="h-12 pl-10 rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="mb-1.5 block">{t('login.label.password')}</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            placeholder={t('login.placeholder.password')}
                            required
                            className="h-12 pl-10 pr-10 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => { setError(''); resetForgotPassword(); setForgotStep('email') }}
                          className="text-sm text-brand hover:underline"
                        >
                          {t('login.forgotPassword')}
                        </button>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
                      >
                        <span className="flex items-center gap-2">
                          {loading ? t('login.button.loggingIn') : <>{t('login.button.login')} <ArrowRight className="w-4 h-4" /></>}
                        </span>
                      </Button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                      {t('login.noAccount')}{' '}
                      <button
                        type="button"
                        onClick={() => { setActiveTab('register'); setError('') }}
                        className="text-brand font-semibold hover:underline"
                      >
                        {t('login.tabs.register')}
                      </button>
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="register"
                    className="space-y-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {error && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 text-sm">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <Label className="mb-1.5 block">{t('login.label.name')}</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="text"
                            value={regName}
                            onChange={e => setRegName(e.target.value)}
                            placeholder={t('login.placeholder.name')}
                            required
                            className="h-12 pl-10 rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="mb-1.5 block">{t('login.label.collegeEmail')}</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="email"
                            value={regEmail}
                            onChange={e => setRegEmail(e.target.value)}
                            placeholder={t('login.placeholder.email')}
                            required
                            className="h-12 pl-10 rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="mb-1.5 block">{t('login.label.phone')}</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="tel"
                            value={regPhone}
                            onChange={e => setRegPhone(e.target.value)}
                            placeholder={t('login.placeholder.phone')}
                            className="h-12 pl-10 rounded-xl"
                            maxLength={14}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">Optional</p>
                      </div>

                      <div>
                        <Label className="mb-1.5 block">{t('login.label.password')}</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={regPassword}
                            onChange={e => setRegPassword(e.target.value)}
                            placeholder={t('login.placeholder.password')}
                            required
                            className="h-12 pl-10 pr-10 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label className="mb-1.5 block">{t('login.label.confirmPassword')}</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={regConfirmPassword}
                            onChange={e => setRegConfirmPassword(e.target.value)}
                            placeholder={t('login.placeholder.confirmPassword')}
                            required
                            className="h-12 pl-10 pr-10 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
                      >
                        <span className="flex items-center gap-2">
                          {loading ? t('login.button.registering') || 'Registering...' : <>{t('login.button.register')} <ArrowRight className="w-4 h-4" /></>}
                        </span>
                      </Button>

                      <p className="text-center text-sm text-muted-foreground">
                        {t('login.hasAccount')}{' '}
                        <button
                          type="button"
                          onClick={() => { setActiveTab('login'); setError('') }}
                          className="text-brand font-semibold hover:underline"
                        >
                          {t('login.tabs.login')}
                        </button>
                      </p>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Google Login */}
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('login.or')}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 mt-4 rounded-xl gap-3 font-medium border-2 hover:bg-muted/50 transition-colors"
                  type="button"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {t('login.continueWithGoogle')}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
