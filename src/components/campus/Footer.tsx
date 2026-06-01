'use client'

import { Sparkles, Instagram, Linkedin, Twitter, Mail, Heart } from 'lucide-react'
import { useAppStore, type PageType } from '@/lib/store'
import { useTranslation } from '@/lib/i18n/TranslationContext'

const FOOTER_LINKS = {
  about: [
    { labelKey: 'footer.link.browseBooks', page: 'explore' as PageType },
    { labelKey: 'footer.link.sellYourBooks', page: 'sell' as PageType },
    { labelKey: 'footer.link.wishlist', page: 'wishlist' as PageType },
    { labelKey: 'footer.link.login', page: 'login' as PageType },
  ],
  categories: [
    { labelKey: 'footer.link.medical', page: 'explore' as PageType, category: 'medical' },
    { labelKey: 'footer.link.engineering', page: 'explore' as PageType, category: 'engineering' },
    { labelKey: 'footer.link.neetJee', page: 'explore' as PageType, category: 'neet-jee' },
    { labelKey: 'footer.link.upscGpsc', page: 'explore' as PageType, category: 'upsc' },
  ],
  support: [
    { labelKey: 'footer.link.privacyPolicy', page: 'privacy' as PageType },
    { labelKey: 'footer.link.termsConditions', page: 'terms' as PageType },
  ],
  connect: [],
} as const

const SECTION_TITLE_KEYS: Record<string, string> = {
  about: 'footer.section.about',
  categories: 'footer.section.categories',
  support: 'footer.section.support',
  connect: 'footer.section.connect',
}

export default function Footer() {
  const { setCurrentPage, setSelectedCategory } = useAppStore()
  const { t } = useTranslation()

  const handleLinkClick = (page: PageType, category?: string) => {
    if (category) setSelectedCategory(category)
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="bg-navy dark:bg-navy-light text-white mt-auto relative">
      {/* Gradient top border */}
      <div className="h-1 bg-gradient-to-r from-brand via-accent to-cyan" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img 
                src="/logo.webp"
                alt="EduCampusHub" 
                className="w-9 h-9 rounded-xl object-cover"
              />
              <span className="text-xl font-bold font-heading">
                {t('footer.logo.brandPrefix')}<span className="gradient-text">{t('footer.logo.brandName')}</span>
              </span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed mb-6 max-w-sm">
              {t('footer.brand.tagline')}
            </p>
            <div className="flex items-center gap-3">
              <a href="https://www.instagram.com/educampushubofficial" target="_blank" rel="noopener noreferrer" title="Follow us on Instagram" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-brand/30 transition-all hover:shadow-lg hover:shadow-brand/10">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-brand/30 transition-all hover:shadow-lg hover:shadow-brand/10">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-brand/30 transition-all hover:shadow-lg hover:shadow-brand/10">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-brand/30 transition-all hover:shadow-lg hover:shadow-brand/10">
                <Mail className="w-4 h-4" />
              </a>
            </div>
            <a
              href="https://www.instagram.com/educampushubofficial"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity mt-4"
            >
              <Instagram className="w-4 h-4" />
              Follow @educampushubofficial
            </a>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([sectionKey, links]) => (
            <div key={sectionKey}>
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider font-heading">{t(SECTION_TITLE_KEYS[sectionKey])}</h3>
              {sectionKey === 'connect' ? (
                <div className="space-y-2.5">
                  <p className="text-sm text-white/70">{t('footer.connect.email')}</p>
                  <p className="text-sm text-white/70">{t('footer.connect.location')}</p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {links.map(link => (
                    <li key={link.labelKey}>
                      <button
                        onClick={() => handleLinkClick(link.page, 'category' in link ? link.category : undefined)}
                        className="text-sm text-white/70 hover:text-white transition-colors hover:translate-x-1 inline-block"
                      >
                        {t(link.labelKey)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/50">
            {t('footer.copyright')}
          </p>
          <p className="text-xs text-white/50 flex items-center gap-1">
            {t('footer.madeWith')} <Heart className="w-3 h-3 text-red-400 fill-red-400" /> {t('footer.inIndia')}
          </p>
        </div>
      </div>
    </footer>
  )
}
