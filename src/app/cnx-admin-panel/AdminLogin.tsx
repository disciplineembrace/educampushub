'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Mail, Shield, AlertCircle, Loader2, KeyRound, Eye, EyeOff,
  CheckCircle, ArrowLeft, Phone, MessageSquare, RotateCcw, CheckCircle2,
  Fingerprint
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import { Card } from '@/components/ui/card'

interface AdminLoginProps {
  onLogin: (admin: { id: string; name: string; email: string; role: string; isSuperAdmin?: boolean; twoFactorVerified?: boolean; mustChangePassword?: boolean }) => void
}

type Step = 'login' | 'two_factor' | 'forgot_email' | 'forgot_otp' | 'forgot_reset' | 'force_change_password'

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  // ─── Login State ───
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // ─── 2FA State ───
  const [step, setStep] = useState<Step>('login')
  const [twoFactorAdmin, setTwoFactorAdmin] = useState<{ id: string; name: string; email: string; role: string; isSuperAdmin: boolean; mustChangePassword: boolean } | null>(null)
  const [twoFactorOtpValue, setTwoFactorOtpValue] = useState('')
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorMaskedPhone, setTwoFactorMaskedPhone] = useState('')
  const [twoFactorOtpSent, setTwoFactorOtpSent] = useState(false)
  const [twoFactorResendTimer, setTwoFactorResendTimer] = useState(0)

  // ─── Forgot Password State ───
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [otpValue, setOtpValue] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpResendTimer, setOtpResendTimer] = useState(0)
  const [verificationToken, setVerificationToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  // ─── Force Password Change State ───
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [forceNewPassword, setForceNewPassword] = useState('')
  const [forceConfirmPassword, setForceConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')

  // ─── OTP Resend Timer ───
  useEffect(() => {
    if (otpResendTimer <= 0 && twoFactorResendTimer <= 0) return
    const interval = setInterval(() => {
      if (otpResendTimer > 0) {
        setOtpResendTimer(prev => {
          if (prev <= 1) { clearInterval(interval); return 0 }
          return prev - 1
        })
      }
      if (twoFactorResendTimer > 0) {
        setTwoFactorResendTimer(prev => {
          if (prev <= 1) { clearInterval(interval); return 0 }
          return prev - 1
        })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [otpResendTimer, twoFactorResendTimer])

  // ─── Login Handler ───
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/cnx-admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.status === 429) {
        setRateLimited(true)
        setError('Too many attempts. Please try again in 15 minutes.')
        return
      }

      if (!res.ok) {
        setError(data.error || 'Authentication failed')
        return
      }

      // Check if 2FA is required (Super Admin or 2FA-enabled account)
      if (data.requires2FA) {
        setTwoFactorAdmin(data.admin)
        setStep('two_factor')
        setTwoFactorOtpValue('')
        setTwoFactorError('')
        setTwoFactorOtpSent(false)
        // Automatically send OTP
        send2FAOTP(data.admin.email)
        return
      }

      if (data.admin?.mustChangePassword) {
        setMustChangePassword(true)
        setAdminEmail(email)
      } else {
        onLogin(data.admin)
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── 2FA: Send OTP ───
  const send2FAOTP = async (adminEmail: string) => {
    setTwoFactorLoading(true)
    setTwoFactorError('')
    try {
      const res = await fetch('/api/cnx-admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_login_otp', email: adminEmail }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.smsError && data.needsAccountSetup) {
          setTwoFactorError(`OTP service is currently unavailable. ${data.setupInstructions || 'Please contact support.'}`)
        } else {
          setTwoFactorError(data.error || 'Failed to send OTP')
        }
        return
      }

      setTwoFactorMaskedPhone(data.maskedPhone || '')
      setTwoFactorOtpSent(true)
      setTwoFactorResendTimer(60)
    } catch {
      setTwoFactorError('Failed to send OTP. Please try again.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  // ─── 2FA: Verify OTP ───
  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setTwoFactorError('')

    if (twoFactorOtpValue.length !== 6) {
      setTwoFactorError('Please enter the complete 6-digit OTP')
      return
    }

    setTwoFactorLoading(true)

    try {
      const res = await fetch('/api/cnx-admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_login_otp',
          email: twoFactorAdmin?.email,
          otp: twoFactorOtpValue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setTwoFactorError(data.error || 'Invalid OTP')
        return
      }

      // 2FA verified! Log in
      if (data.admin?.mustChangePassword) {
        setMustChangePassword(true)
        setAdminEmail(twoFactorAdmin?.email || '')
        setStep('force_change_password')
      } else {
        onLogin(data.admin)
      }
    } catch {
      setTwoFactorError('Connection error. Please try again.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  // ─── 2FA: Resend OTP ───
  const handle2FAResend = async () => {
    if (twoFactorResendTimer > 0 || !twoFactorAdmin) return
    setTwoFactorOtpValue('')
    setTwoFactorError('')
    await send2FAOTP(twoFactorAdmin.email)
  }

  // ─── Forgot Password: Send OTP ───
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotLoading(true)

    try {
      const res = await fetch('/api/cnx-admin-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', email: forgotEmail }),
      })

      const data = await res.json()

      if (res.status === 429) {
        setForgotError(data.error || 'Too many attempts. Try again later.')
        return
      }

      if (!res.ok) {
        if (data.smsError && data.needsAccountSetup) {
          setForgotError(`OTP service is currently unavailable. ${data.setupInstructions || 'Please contact support.'}`)
        } else {
          setForgotError(data.error || 'Failed to send OTP')
        }
        return
      }

      setMaskedPhone(data.maskedPhone || '')
      setOtpResendTimer(60) // 60-second cooldown
      setOtpValue('')
      setOtpError('')
      setStep('forgot_otp')
    } catch {
      setForgotError('Connection error. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  // ─── Forgot Password: Verify OTP ───
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setOtpError('')

    if (otpValue.length !== 6) {
      setOtpError('Please enter the complete 6-digit OTP')
      return
    }

    setOtpLoading(true)

    try {
      const res = await fetch('/api/cnx-admin-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', email: forgotEmail, otp: otpValue }),
      })

      const data = await res.json()

      if (!res.ok) {
        setOtpError(data.error || 'Invalid OTP')
        return
      }

      setVerificationToken(data.verificationToken)
      setStep('forgot_reset')
    } catch {
      setOtpError('Connection error. Please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  // ─── Forgot Password: Resend OTP ───
  const handleResendOTP = async () => {
    if (otpResendTimer > 0) return

    setOtpError('')
    setOtpValue('')

    try {
      const res = await fetch('/api/cnx-admin-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', email: forgotEmail }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.smsError && data.needsAccountSetup) {
          setOtpError(`OTP service is currently unavailable. ${data.setupInstructions || 'Please contact support.'}`)
        } else {
          setOtpError(data.error || 'Failed to resend OTP')
        }
        return
      }

      setOtpResendTimer(60)
    } catch {
      setOtpError('Connection error. Please try again.')
    }
  }

  // ─── Forgot Password: Reset Password ───
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')

    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters')
      return
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setResetError('Password must contain uppercase, lowercase, and number')
      return
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      setResetError('Password must contain at least one special character')
      return
    }

    setResetLoading(true)

    try {
      const res = await fetch('/api/cnx-admin-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          email: forgotEmail,
          verificationToken,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResetError(data.error || 'Failed to reset password')
        return
      }

      setResetSuccess(true)

      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        setStep('login')
        setResetSuccess(false)
        setForgotEmail('')
        setOtpValue('')
        setNewPassword('')
        setConfirmNewPassword('')
        setVerificationToken('')
      }, 3000)
    } catch {
      setResetError('Connection error. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  // ─── Force Password Change Handler ───
  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setChangingPassword(true)

    if (forceNewPassword !== forceConfirmPassword) {
      setError('Passwords do not match')
      setChangingPassword(false)
      return
    }

    if (forceNewPassword.length < 8) {
      setError('Password must be at least 8 characters')
      setChangingPassword(false)
      return
    }

    if (!/[A-Z]/.test(forceNewPassword) || !/[a-z]/.test(forceNewPassword) || !/[0-9]/.test(forceNewPassword)) {
      setError('Password must contain uppercase, lowercase, and number')
      setChangingPassword(false)
      return
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(forceNewPassword)) {
      setError('Password must contain at least one special character')
      setChangingPassword(false)
      return
    }

    try {
      const res = await fetch('/api/cnx-admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          email: adminEmail,
          currentPassword: password,
          newPassword: forceNewPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to change password')
        return
      }

      setMustChangePassword(false)

      // Re-login with new password
      const loginRes = await fetch('/api/cnx-admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: forceNewPassword }),
      })

      const loginData = await loginRes.json()

      if (loginRes.ok) {
        if (loginData.requires2FA) {
          // Need 2FA again after password change
          setTwoFactorAdmin(loginData.admin)
          setStep('two_factor')
          setTwoFactorOtpValue('')
          setTwoFactorError('')
          setTwoFactorOtpSent(false)
          send2FAOTP(loginData.admin.email)
        } else {
          onLogin(loginData.admin)
        }
      } else {
        setError('Password changed! Please login again.')
        setMustChangePassword(false)
        setPassword('')
        setForceNewPassword('')
        setForceConfirmPassword('')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setChangingPassword(false)
    }
  }

  // ─── Step Navigation Helper ───
  const goBackToLogin = () => {
    setStep('login')
    setForgotError('')
    setOtpError('')
    setResetError('')
    setTwoFactorError('')
    setOtpValue('')
    setTwoFactorOtpValue('')
    setTwoFactorAdmin(null)
  }

  // ═══════════════════════════════════════════════════
  // RENDER: Force Password Change Screen
  // ═══════════════════════════════════════════════════
  if (mustChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <Card className="p-8 bg-slate-900/80 border-slate-700/50 backdrop-blur-xl shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg">
                <KeyRound className="w-7 h-7 text-white" />
              </div>
            </div>

            <h1 className="text-xl font-semibold text-slate-100 text-center mb-1">
              Change Your Password
            </h1>
            <p className="text-sm text-slate-400 text-center mb-6">
              You must set a new password before continuing
            </p>

            <form onSubmit={handleForceChangePassword} className="space-y-4">
              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={forceNewPassword}
                    onChange={e => setForceNewPassword(e.target.value)}
                    placeholder="New password"
                    required
                    className="h-11 pl-10 pr-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="relative">
                  <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="password"
                    value={forceConfirmPassword}
                    onChange={e => setForceConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="h-11 pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl"
                  />
                </div>
              </div>

              {/* Password requirements */}
              <div className="text-xs text-slate-400 space-y-1 bg-slate-800/40 rounded-lg p-3">
                <p className="font-medium text-slate-300 mb-1.5">Password requirements:</p>
                <div className={`flex items-center gap-1.5 ${forceNewPassword.length >= 8 ? 'text-emerald-400' : ''}`}>
                  <span>{forceNewPassword.length >= 8 ? '✓' : '○'}</span> At least 8 characters
                </div>
                <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(forceNewPassword) ? 'text-emerald-400' : ''}`}>
                  <span>{/[A-Z]/.test(forceNewPassword) ? '✓' : '○'}</span> One uppercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${/[a-z]/.test(forceNewPassword) ? 'text-emerald-400' : ''}`}>
                  <span>{/[a-z]/.test(forceNewPassword) ? '✓' : '○'}</span> One lowercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${/[0-9]/.test(forceNewPassword) ? 'text-emerald-400' : ''}`}>
                  <span>{/[0-9]/.test(forceNewPassword) ? '✓' : '○'}</span> One number
                </div>
                <div className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(forceNewPassword) ? 'text-emerald-400' : ''}`}>
                  <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(forceNewPassword) ? '✓' : '○'}</span> One special character
                </div>
                <div className={`flex items-center gap-1.5 ${forceNewPassword === forceConfirmPassword && forceConfirmPassword.length > 0 ? 'text-emerald-400' : ''}`}>
                  <span>{forceNewPassword === forceConfirmPassword && forceConfirmPassword.length > 0 ? '✓' : '○'}</span> Passwords match
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={changingPassword}
                className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-colors"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  // RENDER: 2FA Verification Screen (Super Admin)
  // ═══════════════════════════════════════════════════
  if (step === 'two_factor' && twoFactorAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <Card className="p-8 bg-slate-900/80 border-slate-700/50 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#002868] to-[#FF6600] flex items-center justify-center shadow-lg">
                <Fingerprint className="w-7 h-7 text-white" />
              </div>
            </div>

            <h1 className="text-xl font-semibold text-slate-100 text-center mb-1">
              Two-Factor Authentication
            </h1>
            <p className="text-sm text-slate-400 text-center mb-2">
              {twoFactorAdmin.isSuperAdmin
                ? 'Super Admin requires OTP verification on every login'
                : 'OTP verification is required for your account'
              }
            </p>

            {twoFactorMaskedPhone && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <Phone className="w-3.5 h-3.5 text-[#FF6600]" />
                <span className="text-sm font-medium text-[#FF6600]">{twoFactorMaskedPhone}</span>
              </div>
            )}

            {!twoFactorOtpSent ? (
              <div className="text-center py-4">
                {twoFactorLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF6600] mx-auto mb-3" />
                ) : (
                  <Button
                    onClick={() => send2FAOTP(twoFactorAdmin.email)}
                    className="bg-[#FF6600] hover:bg-[#FF8533] text-white font-medium rounded-xl"
                  >
                    Send OTP to Registered Phone
                  </Button>
                )}
              </div>
            ) : (
              <form onSubmit={handle2FAVerify} className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={twoFactorOtpValue}
                    onChange={setTwoFactorOtpValue}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                      <InputOTPSlot index={1} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                      <InputOTPSlot index={2} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                    </InputOTPGroup>
                    <InputOTPSeparator className="mx-1" />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                      <InputOTPSlot index={4} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                      <InputOTPSlot index={5} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {/* Timer and Resend */}
                <div className="text-center">
                  {twoFactorResendTimer > 0 ? (
                    <p className="text-xs text-slate-500">
                      Resend OTP in <span className="text-[#FF6600] font-mono">{twoFactorResendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handle2FAResend}
                      className="text-xs text-[#FF6600] hover:text-[#FF8533] flex items-center gap-1 mx-auto"
                    >
                      <RotateCcw className="w-3 h-3" /> Resend OTP
                    </button>
                  )}
                </div>

                {twoFactorError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{twoFactorError}</span>
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={twoFactorLoading || twoFactorOtpValue.length !== 6}
                  className="w-full h-11 bg-[#FF6600] hover:bg-[#FF8533] text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {twoFactorLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Login'
                  )}
                </Button>
              </form>
            )}

            {/* Back to Login */}
            <button
              onClick={goBackToLogin}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mt-6 mx-auto transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Login
            </button>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  // RENDER: Forgot Password Flow
  // ═══════════════════════════════════════════════════
  if (step === 'forgot_email' || step === 'forgot_otp' || step === 'forgot_reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <Card className="p-8 bg-slate-900/80 border-slate-700/50 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#002868] to-[#FF6600] flex items-center justify-center shadow-lg">
                {step === 'forgot_email' && <Mail className="w-7 h-7 text-white" />}
                {step === 'forgot_otp' && <MessageSquare className="w-7 h-7 text-white" />}
                {step === 'forgot_reset' && <KeyRound className="w-7 h-7 text-white" />}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {/* ─── Step 1: Enter Email ─── */}
              {step === 'forgot_email' && (
                <motion.div
                  key="forgot_email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h1 className="text-xl font-semibold text-slate-100 text-center mb-1">
                    Forgot Password?
                  </h1>
                  <p className="text-sm text-slate-400 text-center mb-6">
                    Enter your admin email to receive an OTP on your registered phone
                  </p>

                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          type="email"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          placeholder="Admin email address"
                          required
                          className="h-11 pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-[#FF6600] focus:ring-[#FF6600]/20 rounded-xl"
                        />
                      </div>
                    </div>

                    {forgotError && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{forgotError}</span>
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full h-11 bg-[#FF6600] hover:bg-[#FF8533] text-white font-medium rounded-xl transition-colors"
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending OTP...
                        </>
                      ) : (
                        'Send OTP'
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* ─── Step 2: Verify OTP ─── */}
              {step === 'forgot_otp' && (
                <motion.div
                  key="forgot_otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h1 className="text-xl font-semibold text-slate-100 text-center mb-1">
                    Verify OTP
                  </h1>
                  <p className="text-sm text-slate-400 text-center mb-2">
                    Enter the 6-digit code sent to
                  </p>
                  <div className="flex items-center justify-center gap-1.5 mb-6">
                    <Phone className="w-3.5 h-3.5 text-[#FF6600]" />
                    <span className="text-sm font-medium text-[#FF6600]">{maskedPhone}</span>
                  </div>

                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otpValue}
                        onChange={setOtpValue}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                          <InputOTPSlot index={1} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                          <InputOTPSlot index={2} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                        </InputOTPGroup>
                        <InputOTPSeparator className="mx-1" />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                          <InputOTPSlot index={4} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                          <InputOTPSlot index={5} className="bg-slate-800/60 border-slate-600/50 text-slate-100 text-lg font-mono w-11 h-12" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    {/* Timer and Resend */}
                    <div className="text-center">
                      {otpResendTimer > 0 ? (
                        <p className="text-xs text-slate-500">
                          Resend OTP in <span className="text-[#FF6600] font-mono">{otpResendTimer}s</span>
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          className="text-xs text-[#FF6600] hover:text-[#FF8533] flex items-center gap-1 mx-auto"
                        >
                          <RotateCcw className="w-3 h-3" /> Resend OTP
                        </button>
                      )}
                    </div>

                    {otpError && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{otpError}</span>
                      </motion.div>
                    )}

                    <Button
                      type="submit"
                      disabled={otpLoading || otpValue.length !== 6}
                      className="w-full h-11 bg-[#FF6600] hover:bg-[#FF8533] text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                      {otpLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify OTP'
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* ─── Step 3: Reset Password ─── */}
              {step === 'forgot_reset' && (
                <motion.div
                  key="forgot_reset"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {resetSuccess ? (
                    <div className="text-center py-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', duration: 0.5 }}
                        className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4"
                      >
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </motion.div>
                      <h2 className="text-lg font-semibold text-slate-100 mb-2">Password Reset Successful!</h2>
                      <p className="text-sm text-slate-400">Redirecting to login...</p>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-xl font-semibold text-slate-100 text-center mb-1">
                        Set New Password
                      </h1>
                      <p className="text-sm text-slate-400 text-center mb-6">
                        Create a strong password for your admin account
                      </p>

                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              placeholder="New password"
                              required
                              className="h-11 pl-10 pr-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-[#FF6600] focus:ring-[#FF6600]/20 rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="relative">
                            <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                              type="password"
                              value={confirmNewPassword}
                              onChange={e => setConfirmNewPassword(e.target.value)}
                              placeholder="Confirm new password"
                              required
                              className="h-11 pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-[#FF6600] focus:ring-[#FF6600]/20 rounded-xl"
                            />
                          </div>
                        </div>

                        {/* Password requirements */}
                        <div className="text-xs text-slate-400 space-y-1 bg-slate-800/40 rounded-lg p-3">
                          <p className="font-medium text-slate-300 mb-1.5">Password requirements:</p>
                          <div className={`flex items-center gap-1.5 ${newPassword.length >= 8 ? 'text-emerald-400' : ''}`}>
                            <span>{newPassword.length >= 8 ? '✓' : '○'}</span> At least 8 characters
                          </div>
                          <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) ? 'text-emerald-400' : ''}`}>
                            <span>{/[A-Z]/.test(newPassword) ? '✓' : '○'}</span> One uppercase letter
                          </div>
                          <div className={`flex items-center gap-1.5 ${/[a-z]/.test(newPassword) ? 'text-emerald-400' : ''}`}>
                            <span>{/[a-z]/.test(newPassword) ? '✓' : '○'}</span> One lowercase letter
                          </div>
                          <div className={`flex items-center gap-1.5 ${/[0-9]/.test(newPassword) ? 'text-emerald-400' : ''}`}>
                            <span>{/[0-9]/.test(newPassword) ? '✓' : '○'}</span> One number
                          </div>
                          <div className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-emerald-400' : ''}`}>
                            <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? '✓' : '○'}</span> One special character
                          </div>
                          <div className={`flex items-center gap-1.5 ${newPassword === confirmNewPassword && confirmNewPassword.length > 0 ? 'text-emerald-400' : ''}`}>
                            <span>{newPassword === confirmNewPassword && confirmNewPassword.length > 0 ? '✓' : '○'}</span> Passwords match
                          </div>
                        </div>

                        {resetError && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{resetError}</span>
                          </motion.div>
                        )}

                        <Button
                          type="submit"
                          disabled={resetLoading}
                          className="w-full h-11 bg-[#FF6600] hover:bg-[#FF8533] text-white font-medium rounded-xl transition-colors"
                        >
                          {resetLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Resetting...
                            </>
                          ) : (
                            'Reset Password'
                          )}
                        </Button>
                      </form>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Back to Login */}
            {!resetSuccess && (
              <button
                onClick={goBackToLogin}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mt-6 mx-auto transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </button>
            )}
          </Card>
        </motion.div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  // RENDER: Login Screen
  // ═══════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <Card className="p-8 bg-slate-900/80 border-slate-700/50 backdrop-blur-xl shadow-2xl">
          {/* Minimal, no branding */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-slate-300" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-slate-100 text-center mb-1">
            Secure Access
          </h1>
          <p className="text-sm text-slate-400 text-center mb-8">
            Enter your credentials to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Admin email"
                  required
                  className="h-11 pl-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20 rounded-xl"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="h-11 pl-10 pr-10 bg-slate-800/60 border-slate-600/50 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {rateLimited && (
              <div className="text-amber-400 text-xs text-center bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                Account temporarily locked due to multiple failed attempts. Please wait 15 minutes.
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || rateLimited}
              className="w-full h-11 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium rounded-xl transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Authenticate'
              )}
            </Button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setStep('forgot_email')
                setForgotEmail(email) // Pre-fill with entered email
                setForgotError('')
              }}
              className="text-xs text-slate-500 hover:text-[#FF6600] transition-colors"
            >
              Forgot Password?
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
