'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, LayoutGrid, PlusCircle, BookOpen, Brain } from 'lucide-react'
import { useAppStore, type PageType } from '@/lib/store'
import Navbar from '@/components/campus/Navbar'
import Footer from '@/components/campus/Footer'
import HeroSection from '@/components/campus/HeroSection'
import CategoriesSection from '@/components/campus/CategoriesSection'
import FeaturedListings from '@/components/campus/FeaturedListings'
import ToasterProvider from '@/components/ToasterProvider'
import WhyChooseSection from '@/components/campus/WhyChooseSection'
import TestimonialsSection from '@/components/campus/TestimonialsSection'
import AppDownloadSection from '@/components/campus/AppDownloadSection'
import InstagramFeed from '@/components/campus/InstagramFeed'
import ExplorePage from '@/components/campus/ExplorePage'
import ProductDetailPage from '@/components/campus/ProductDetailPage'
import SellProductPage from '@/components/campus/SellProductPage'
import LoginPage from '@/components/campus/LoginPage'
import ProfilePage from '@/components/campus/ProfilePage'
import WishlistPage from '@/components/campus/WishlistPage'
import TermsPage from '@/components/campus/TermsPage'
import PrivacyPage from '@/components/campus/PrivacyPage'
import BookReaderPage from '@/components/campus/BookReaderPage'
import LearningDashboard from '@/components/campus/LearningDashboard'
import SavedMaterialsPage from '@/components/campus/SavedMaterialsPage'
import EditListingPage from '@/components/campus/EditListingPage'
import CategoryExplorerPage from '@/components/campus/CategoryExplorerPage'
import PricingPage from '@/components/campus/PricingPage'
import PremiumDashboard from '@/components/campus/PremiumDashboard'
import FeaturedSellerCarousel from '@/components/campus/FeaturedSellerCarousel'
import { useTranslation } from '@/lib/i18n/TranslationContext'

function HomePage() {
  return (
    <div>
      <HeroSection />
      <CategoriesSection />
      <FeaturedSellerCarousel />
      <FeaturedListings />
      <WhyChooseSection />
      <TestimonialsSection />
      <InstagramFeed />
      <AppDownloadSection />
    </div>
  )
}

const PAGE_COMPONENTS: Record<PageType, React.ComponentType> = {
  home: HomePage,
  explore: ExplorePage,
  product: ProductDetailPage,
  sell: SellProductPage,
  login: LoginPage,
  profile: ProfilePage,
  wishlist: WishlistPage,
  terms: TermsPage,
  privacy: PrivacyPage,
  reader: BookReaderPage,
  dashboard: PremiumDashboard,
  saved: SavedMaterialsPage,
  categories: CategoryExplorerPage,
  editListing: EditListingPage,
  pricing: PricingPage,
}

function MobileBottomNav({ navItems }: { navItems: { icon: React.ElementType; label: string; page: PageType; isCenter?: boolean }[] }) {
  const { currentPage, setCurrentPage, currentUser } = useAppStore()
  const { t } = useTranslation()

  if (currentPage === 'reader') return null

  const handleNavClick = (page: PageType) => {
    if (page === 'dashboard' && !currentUser) {
      setCurrentPage('login')
    } else {
      setCurrentPage(page)
    }
  }

  const getActivePage = (page: PageType) => {
    const p = page as string
    const c = currentPage as string
    if (p === 'home') return c === 'home'
    if (p === 'categories') return c === 'categories' || c === 'explore'
    if (p === 'reader') return c === 'reader'
    if (p === 'dashboard') return c === 'dashboard' || c === 'profile' || c === 'saved' || c === 'wishlist'
    return c === p
  }

  return (
    <div className="mobile-nav fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => {
          const isActive = getActivePage(item.page)

          if (item.isCenter) {
            return (
              <button
                key={item.page}
                onClick={() => handleNavClick(item.page)}
                className="relative -mt-6 flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-full btn-gradient flex items-center justify-center shadow-lg shadow-brand/30">
                  <PlusCircle className="w-7 h-7 text-white" />
                </div>
                <span className="text-[10px] font-medium text-brand mt-1">{t('mobileNav.sell')}</span>
              </button>
            )
          }

          return (
            <button
              key={item.page}
              onClick={() => handleNavClick(item.page)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[48px]"
            >
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'}`} />
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-brand mt-0.5" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function EduCampusHub() {
  const { currentPage, darkMode } = useAppStore()
  const { t } = useTranslation()

  const MOBILE_NAV_ITEMS: { icon: React.ElementType; label: string; page: PageType; isCenter?: boolean }[] = [
    { icon: Home, label: t('mobileNav.home'), page: 'home' },
    { icon: LayoutGrid, label: t('mobileNav.categories'), page: 'categories' },
    { icon: PlusCircle, label: t('mobileNav.sell'), page: 'sell', isCenter: true },
    { icon: BookOpen, label: t('mobileNav.reader'), page: 'reader' },
    { icon: Brain, label: t('mobileNav.dashboard'), page: 'dashboard' },
  ]

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const PageComponent = PAGE_COMPONENTS[currentPage] || HomePage

  // Hide navbar and footer in reader mode for immersive reading
  const isReaderMode = currentPage === 'reader'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!isReaderMode && <Navbar />}
      <main className="flex-1 pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <PageComponent />
          </motion.div>
        </AnimatePresence>
      </main>
      {!isReaderMode && <Footer />}
      <MobileBottomNav navItems={MOBILE_NAV_ITEMS} />
      <ToasterProvider />
    </div>
  )
}
