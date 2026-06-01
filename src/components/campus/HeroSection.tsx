'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Rocket, BookOpen, Users, Library, GraduationCap, Instagram } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'

interface PlatformStats {
  userCount: number
  listingCount: number
  collegeCount: number
}

export default function HeroSection() {
  const { setCurrentPage } = useAppStore()
  const { t } = useTranslation()
  const [stats, setStats] = useState<PlatformStats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        // Stats not available
      }
    }
    fetchStats()
  }, [])

  const STATS = [
    { icon: Users, label: 'Students', value: stats?.userCount ? `${stats.userCount.toLocaleString()}+` : 'Join Now' },
    { icon: Library, label: 'Books Listed', value: stats?.listingCount ? `${stats.listingCount.toLocaleString()}+` : 'Start Listing' },
    { icon: GraduationCap, label: 'Colleges', value: stats?.collegeCount ? `${stats.collegeCount}+` : 'All India' },
  ]

  return (
    <section className="relative overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-white to-brand/5 dark:from-navy dark:via-background dark:to-navy-light" />
      <div className="absolute inset-0 bg-pattern opacity-40" />

      {/* Decorative gradient orbs */}
      <div className="absolute top-20 left-[10%] w-72 h-72 bg-brand/10 rounded-full blur-[100px] dark:bg-brand/5" />
      <div className="absolute bottom-20 right-[10%] w-96 h-96 bg-accent/10 rounded-full blur-[120px] dark:bg-accent/5" />

      {/* Floating elements */}
      <motion.div
        className="absolute top-28 left-[8%] hidden lg:block"
        animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-16 h-20 rounded-2xl bg-gradient-to-br from-brand to-brand-light dark:from-brand dark:to-accent flex items-center justify-center shadow-xl shadow-brand/20 animate-pulse-glow">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </motion.div>

      <motion.div
        className="absolute top-44 right-[8%] hidden lg:block"
        animate={{ y: [0, -20, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <div className="w-14 h-18 rounded-2xl bg-gradient-to-br from-accent to-purple-light dark:from-accent dark:to-purple-light flex items-center justify-center shadow-xl shadow-accent/20 p-3">
          <Rocket className="w-8 h-8 text-white" />
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-32 left-[15%] hidden lg:block"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan to-cyan-light flex items-center justify-center shadow-xl shadow-cyan/20">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
      </motion.div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-brand/10 text-brand text-sm font-medium mb-6 border border-brand/20">
              <Sparkles className="w-4 h-4" />
              Buy • Sell • Exchange
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 font-heading"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
          >
            {t('hero.heading.line1')}{' '}
            <br className="hidden sm:block" />
            <span className="gradient-text">{t('hero.heading.line2')}</span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          >
            {t('hero.description')}
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
          >
            <Button
              onClick={() => setCurrentPage('sell')}
              className="btn-gradient text-white border-0 h-12 px-8 text-base font-semibold rounded-xl w-full sm:w-auto"
            >
              <span className="flex items-center gap-2">
                {t('hero.startSelling')}
                <ArrowRight className="w-4 h-4" />
              </span>
            </Button>
            <Button
              onClick={() => setCurrentPage('explore')}
              variant="outline"
              className="h-12 px-8 text-base font-semibold rounded-xl border-2 border-brand/30 text-brand hover:bg-brand/5 w-full sm:w-auto"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              {t('hero.exploreBooks')}
            </Button>
          </motion.div>

          {/* Instagram CTA */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
          >
            <a
              href="https://www.instagram.com/educampushubofficial"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-purple-500/40 transition-all"
            >
              <Instagram className="w-4 h-4 text-pink-500" />
              {t('hero.followInstagram')}
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mt-12 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: 'easeOut' }}
          >
            {STATS.map(stat => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand/10 to-accent/10 flex items-center justify-center border border-brand/10">
                  <stat.icon className="w-5 h-5 text-brand" />
                </div>
                <div className="text-left">
                  <p className="text-xl font-bold text-foreground font-heading">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
