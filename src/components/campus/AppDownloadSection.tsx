'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Smartphone, Bell, ArrowRight, Sparkles } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AppDownloadSection() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setSubscribed(true)
      setEmail('')
    }
  }

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-br from-brand via-accent to-brand relative overflow-hidden">
      <div className="absolute inset-0 bg-pattern opacity-20" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 text-sm font-medium mb-6 border border-white/20">
                <Smartphone className="w-4 h-4" /> {t('appDownload.comingSoon')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 font-heading text-white">
                {t('appDownload.heading')}
              </h2>
              <p className="text-white/70 max-w-lg mb-8 leading-relaxed">
                {t('appDownload.description')}
              </p>

              {subscribed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                >
                  <Bell className="w-5 h-5" /> {t('appDownload.onTheList')}
                </motion.div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0">
                  <Input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('appDownload.enterEmail')}
                    type="email"
                    required
                    className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-brand"
                  />
                  <Button type="submit" className="h-12 bg-white text-brand hover:bg-white/90 px-6 font-semibold whitespace-nowrap rounded-xl">
                    {t('appDownload.notifyMe')} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </form>
              )}
            </motion.div>
          </div>

          {/* Phone mockup */}
          <motion.div
            className="flex-shrink-0"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative w-56 sm:w-64">
              <div className="w-full aspect-[9/18] rounded-[2.5rem] border-4 border-white/20 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm overflow-hidden p-3">
                <div className="w-full h-full rounded-[2rem] bg-navy/80 flex flex-col items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-accent flex items-center justify-center shadow-lg shadow-brand/30">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-sm font-bold text-white font-heading">EduCampusHub</p>
                  <p className="text-[10px] text-white/60">Coming to Play Store</p>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-brand animate-pulse" style={{ animationDelay: '0.5s' }} />
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '1s' }} />
                  </div>
                </div>
              </div>
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-navy rounded-b-2xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
