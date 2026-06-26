'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff, ArrowLeft, KeyRound, ShieldCheck, CheckCircle2, ShieldQuestion, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ─── Security Questions (mirrors src/lib/security-question.ts) ───
// Duplicated here so the client bundle doesn't need to import server-side bcrypt.
const SECURITY_QUESTIONS = [
  'What is your favorite book?',
  'What was your childhood nickname?',
  'What was the name of your first teacher?',
  'What is your favorite movie?',
  'What is your favorite place?',
  'What was the name of your childhood best friend?',
  'What is your favorite color?',
]

type AuthTab = 'login' | 'register'
type ForgotPasswordStep = 'none' | 'email' | 'security' | 'reset' | 'success'

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
  // ─── Security question state (registration) ───
  const [regSecurityQuestionIdx, setRegSecurityQuestionIdx] = useState<number | ''>('')
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('')

  // Forgot Password state
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>('none')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSecurityQuestion, setForgotSecurityQuestion] = useState('')
  const [forgotSecurityAnswer, setForgotSecurityAnswer] = useState('')
  const [forgotRemainingAttempts, setForgotRemainingAttempts] = useState<number | null>(null)
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotShowNewPassword, setForgotShowNewPassword] = useState(false)
  const [forgotShowConfirmPassword, setForgotShowConfirmPassword] = useState(false)
  const [forgotVerificationToken, setForgotVerificationToken] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')

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

    // ─── Security question validation ───
    if (regSecurityQuestionIdx === '' || regSecurityQuestionIdx === null || regSecurityQuestionIdx === undefined) {
      setError('Please select a security question')
      return
    }
    if (!regSecurityAnswer.trim()) {
      setError('Please enter an answer to your security question')
      return
    }
    if (regSecurityAnswer.trim().length < 2) {
      setError('Security answer must be at least 2 characters')
      return
    }
    if (regSecurityAnswer.trim().length > 100) {
      setError('Security answer must be at most 100 characters')
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
          securityQuestionIdx: regSecurityQuestionIdx,
          securityAnswer: regSecurityAnswer,
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

  // ─── Forgot Password Handlers ───

  const handleVerifyEmail = async (e: React.FormEvent) => {
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
        body: JSON.stringify({ action: 'verify_email', email: forgotEmail }),
      })
      const data = await res.json()

      if (!res.ok) {
        setForgotError(data.error || 'Failed to verify email')
        return
      }

      // If user has no security question set, show a notice
      if (data.needsSetup) {
        setForgotError(data.message || 'No security question is set. Please log in and set one from your profile.')
        return
      }

      // If account is temporarily locked
      if (data.locked) {
        setForgotError(data.message || 'Account temporarily locked. Try again later.')
        return
      }

      // Move to the security-question step
      setForgotSecurityQuestion(data.securityQuestion || '')
      setForgotSecurityAnswer('')
      setForgotRemainingAttempts(null)
      setForgotStep('security')
    } catch {
      setForgotError(t('forgotPassword.error.wentWrong'))
    } finally {
      setForgotLoading(false)
    }
  }

  // ─── Verify Security Answer ───

  const handleVerifySecurityAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')

    if (!forgotSecurityAnswer.trim()) {
      setForgotError('Please enter your security answer')
      return
    }
    if (forgotSecurityAnswer.trim().length < 2) {
      setForgotError('Security answer must be at least 2 characters')
      return
    }
    if (forgotSecurityAnswer.trim().length > 100) {
      setForgotError('Security answer must be at most 100 characters')
      return
    }

    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_answer',
          email: forgotEmail,
          securityAnswer: forgotSecurityAnswer,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        // If account is locked, show lockout message
        if (data.locked) {
          setForgotError(data.error || 'Too many incorrect attempts. Account temporarily locked.')
          return
        }
        // Otherwise: wrong answer. Show generic error (server returns the same string
        // for any wrong/missing case to avoid revealing which part is wrong).
        if (typeof data.remainingAttempts === 'number') {
          setForgotRemainingAttempts(data.remainingAttempts)
        } else {
          setForgotRemainingAttempts(null)
        }
        setForgotError(data.error || 'Invalid security answer.')
        return
      }

      // Answer verified — store the reset token and proceed to password reset
      setForgotVerificationToken(data.resetToken || '')
      setForgotRemainingAttempts(null)
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
          resetToken: forgotVerificationToken,
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

  const resetForgotPassword = () => {
    setForgotStep('none')
    setForgotEmail('')
    setForgotSecurityQuestion('')
    setForgotSecurityAnswer('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotVerificationToken('')
    setForgotRemainingAttempts(null)
    setForgotError('')
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
              if (forgotStep === 'reset' || forgotStep === 'security') {
                // Go back one step (reset → security → email → none)
                if (forgotStep === 'reset') {
                  setForgotStep('security')
                  setForgotError('')
                } else {
                  setForgotStep('email')
                  setForgotError('')
                }
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
              ) : forgotStep === 'security' ? (
                <ShieldQuestion className="w-5 h-5 text-brand" />
              ) : (
                <KeyRound className="w-5 h-5 text-brand" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground font-heading">
                {forgotStep === 'email' && t('forgotPassword.title')}
                {forgotStep === 'security' && 'Security Question'}
                {forgotStep === 'reset' && t('forgotPassword.resetTitle')}
                {forgotStep === 'success' && t('forgotPassword.successTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {forgotStep === 'email' && 'Enter your registered email to recover your account.'}
                {forgotStep === 'security' && 'Answer your security question to verify your identity.'}
                {forgotStep === 'reset' && t('forgotPassword.resetSubtitle')}
                {forgotStep === 'success' && t('forgotPassword.successSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps — 3 steps now: Email → Security → Reset */}
        {forgotStep !== 'success' && (
          <div className="flex items-center gap-2">
            {['email', 'security', 'reset'].map((step, i) => {
              const stepOrder = ['email', 'security', 'reset']
              const currentIndex = stepOrder.indexOf(forgotStep)
              const stepIndex = i
              const isActive = stepIndex === currentIndex
              const isCompleted = stepIndex < currentIndex
              return (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
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
                    {i === 1 && 'Security'}
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
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{forgotError}</span>
          </div>
        )}

        {/* Step 1: Email Input */}
        {forgotStep === 'email' && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
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
            </div>

            <Button
              type="submit"
              disabled={forgotLoading}
              className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
            >
              {forgotLoading ? 'Verifying email...' : (
                <>Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>
        )}

        {/* Step 2: Security Question */}
        {forgotStep === 'security' && (
          <form onSubmit={handleVerifySecurityAnswer} className="space-y-4">
            <div className="p-4 rounded-xl bg-brand/5 border border-brand/20">
              <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">
                Your Security Question
              </p>
              <p className="text-sm text-foreground font-medium leading-relaxed">
                {forgotSecurityQuestion}
              </p>
            </div>

            <div>
              <Label className="mb-1.5 block">Your Answer</Label>
              <div className="relative">
                <ShieldQuestion className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={forgotSecurityAnswer}
                  onChange={e => setForgotSecurityAnswer(e.target.value)}
                  placeholder="Enter your answer"
                  required
                  autoFocus
                  maxLength={100}
                  className="h-12 pl-10 rounded-xl"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Answer exactly as you did when setting up the question. Case-insensitive.
              </p>
              {typeof forgotRemainingAttempts === 'number' && forgotRemainingAttempts > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {forgotRemainingAttempts} attempt{forgotRemainingAttempts === 1 ? '' : 's'} remaining before temporary lockout.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={forgotLoading}
              className="w-full h-12 btn-gradient text-white border-0 rounded-xl text-base font-semibold gap-2"
            >
              {forgotLoading ? 'Verifying answer...' : (
                <>Verify Answer <ArrowRight className="w-4 h-4" /></>
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

                      {/* ─── Security Question (required for registration) ─── */}
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldQuestion className="w-4 h-4 text-brand" />
                          <p className="text-sm font-semibold text-foreground">
                            Security Question
                          </p>
                          <span className="text-xs text-muted-foreground">
                            (for password recovery)
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label className="mb-1.5 block text-xs">Select a question</Label>
                            <Select
                              value={regSecurityQuestionIdx === '' ? '' : String(regSecurityQuestionIdx)}
                              onValueChange={v => setRegSecurityQuestionIdx(v === '' ? '' : Number(v))}
                            >
                              <SelectTrigger className="h-12 rounded-xl">
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
                            <Label className="mb-1.5 block text-xs">Your answer</Label>
                            <div className="relative">
                              <ShieldQuestion className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                type="text"
                                value={regSecurityAnswer}
                                onChange={e => setRegSecurityAnswer(e.target.value)}
                                placeholder="Enter your answer"
                                maxLength={100}
                                className="h-12 pl-10 rounded-xl"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              You&apos;ll need to answer this exactly to reset your password. Case-insensitive.
                            </p>
                          </div>
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
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
