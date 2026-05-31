'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Search, Sun, Moon, Menu, X, Heart, User, LogOut, ChevronDown, Home, Compass, PlusCircle, LayoutGrid, BookOpen, Brain, Crown } from 'lucide-react'
import { useAppStore, type PageType } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import LanguageSwitcher from '@/components/campus/LanguageSwitcher'

// Nav items are now built dynamically using translations inside the component

export default function Navbar() {
  const { currentPage, setCurrentPage, darkMode, toggleDarkMode, currentUser, setCurrentUser, wishlist, mobileMenuOpen, setMobileMenuOpen, searchQuery, setSearchQuery, setSelectedCategory } = useAppStore()
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // Build nav items with translated labels
  const NAV_ITEMS: { label: string; page: PageType; icon: React.ElementType }[] = [
    { label: t('nav.item.home'), page: 'home', icon: Home },
    { label: t('nav.item.explore'), page: 'explore', icon: Compass },
    { label: t('nav.item.categories'), page: 'categories', icon: LayoutGrid },
    { label: t('nav.item.reader'), page: 'reader', icon: BookOpen },
    { label: t('nav.item.dashboard'), page: 'dashboard', icon: Brain },
    { label: t('nav.item.sell'), page: 'sell', icon: PlusCircle },
    { label: 'Pricing', page: 'pricing', icon: Crown },
  ]

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSelectedCategory(null)
      setCurrentPage('explore')
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setProfileOpen(false)
    setCurrentPage('home')
  }

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'glass border-b border-border/50 shadow-sm'
            : 'bg-transparent'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => setCurrentPage('home')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <img 
                src="/logo.jpeg" 
                alt="EduCampusHub" 
                className="w-9 h-9 rounded-xl object-cover shadow-md dark:hidden"
              />
              <img 
                src="/logo-dark.jpeg" 
                alt="EduCampusHub" 
                className="w-9 h-9 rounded-xl object-cover shadow-md hidden dark:block"
              />
              <span className="text-xl font-bold text-foreground font-heading">
                {t('nav.logo.brandPrefix')}<span className="gradient-text">{t('nav.logo.brandName')}</span>
              </span>
            </motion.div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.page}
                  onClick={() => setCurrentPage(item.page)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                    currentPage === item.page
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Desktop Right Section */}
            <div className="hidden md:flex items-center gap-2">
              {/* Search */}
              <form onSubmit={handleSearch} className="relative">
                {searchOpen ? (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 240, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="flex items-center search-modern rounded-xl"
                  >
                    <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('nav.search.placeholder')}
                      className="h-9 pl-9 pr-8 text-sm border-0 bg-transparent focus-visible:ring-0"
                      autoFocus
                      onBlur={() => { if (!searchQuery) setSearchOpen(false) }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="h-9 w-9 rounded-xl" aria-label="Search">
                    <Search className="w-4 h-4" />
                  </Button>
                )}
              </form>

              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Dark Mode Toggle */}
              <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="h-9 w-9 rounded-full" aria-label="Toggle dark mode">
                <AnimatePresence mode="wait">
                  {darkMode ? (
                    <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <Sun className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <Moon className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>

              {/* Wishlist */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage('wishlist')}
                className="h-9 w-9 rounded-xl relative"
                aria-label="Wishlist"
              >
                <Heart className="w-4 h-4" />
                {wishlist.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-brand text-white border-0">
                    {wishlist.length}
                  </Badge>
                )}
              </Button>

              {/* Profile / Login */}
              {currentUser ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="h-9 gap-2 px-2 rounded-xl"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-xs font-bold ring-2 ring-brand/20">
                      {currentUser.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium max-w-[80px] truncate hidden lg:block">{currentUser.name.split(' ')[0]}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute right-0 mt-1 w-56 rounded-2xl bg-card border border-border shadow-xl overflow-hidden z-50"
                      >
                        <div className="p-4 border-b border-border bg-gradient-to-r from-brand/5 to-accent/5">
                          <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
                          <p className="text-xs text-muted-foreground">{currentUser.college || currentUser.email}</p>
                        </div>
                        <div className="p-1.5">
                          <button
                            onClick={() => { setCurrentPage('profile'); setProfileOpen(false) }}
                            className="w-full text-left px-3 py-2.5 text-sm rounded-xl hover:bg-muted flex items-center gap-2.5 transition-colors"
                          >
                            <User className="w-4 h-4" /> {t('nav.profile.myProfile')}
                          </button>
                          <button
                            onClick={() => { setCurrentPage('wishlist'); setProfileOpen(false) }}
                            className="w-full text-left px-3 py-2.5 text-sm rounded-xl hover:bg-muted flex items-center gap-2.5 transition-colors"
                          >
                            <Heart className="w-4 h-4" /> {t('nav.profile.wishlist')}
                          </button>

                          <button
                            onClick={handleLogout}
                            className="w-full text-left px-3 py-2.5 text-sm rounded-xl hover:bg-muted text-destructive flex items-center gap-2.5 transition-colors"
                          >
                            <LogOut className="w-4 h-4" /> {t('nav.profile.logout')}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Button
                  onClick={() => setCurrentPage('login')}
                  className="h-9 btn-gradient text-white border-0 text-sm rounded-xl"
                  size="sm"
                >
                  <span>{t('nav.loginButton')}</span>
                </Button>
              )}
            </div>

            {/* Mobile Right Section */}
            <div className="flex md:hidden items-center gap-1">
              <LanguageSwitcher />
              <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="h-9 w-9" aria-label="Toggle dark mode">
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-card shadow-2xl"
            >
              <div className="pt-20 px-4">
                {/* Mobile Search */}
                <form onSubmit={handleSearch} className="mb-5">
                  <div className="search-modern rounded-xl flex items-center">
                    <Search className="ml-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={t('nav.search.placeholder')}
                      className="h-10 border-0 bg-transparent focus-visible:ring-0"
                    />
                  </div>
                </form>

                {/* Mobile Nav Links */}
                <div className="space-y-1">
                  {NAV_ITEMS.map(item => (
                    <button
                      key={item.page}
                      onClick={() => setCurrentPage(item.page)}
                      className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all flex items-center gap-3 ${
                        currentPage === item.page
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 pt-5 border-t border-border space-y-1">
                  {currentUser ? (
                    <>
                      <div className="px-4 py-3 mb-2 rounded-2xl bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center text-white text-sm font-bold ring-2 ring-brand/20">
                            {currentUser.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{currentUser.name}</p>
                            <p className="text-xs text-muted-foreground">{currentUser.college || currentUser.email}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setCurrentPage('profile')}
                        className="w-full text-left px-4 py-3 rounded-2xl text-sm hover:bg-muted flex items-center gap-3"
                      >
                        <User className="w-4 h-4" /> {t('nav.profile.myProfile')}
                      </button>
                      <button
                        onClick={() => setCurrentPage('wishlist')}
                        className="w-full text-left px-4 py-3 rounded-2xl text-sm hover:bg-muted flex items-center gap-3"
                      >
                        <Heart className="w-4 h-4" /> {t('nav.profile.wishlist')}
                        {wishlist.length > 0 && <Badge className="bg-brand text-white border-0 text-[10px] ml-auto">{wishlist.length}</Badge>}
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 rounded-2xl text-sm text-destructive hover:bg-muted flex items-center gap-3"
                      >
                        <LogOut className="w-4 h-4" /> {t('nav.profile.logout')}
                      </button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setCurrentPage('login')}
                      className="w-full btn-gradient text-white border-0 rounded-xl"
                    >
                      <span>{t('nav.loginButtonMobile')}</span>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away for profile dropdown */}
      {profileOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
      )}
    </>
  )
}
