export function OrganizationJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'EduCampusHub',
    url: 'https://educampushub.vercel.app',
    logo: 'https://educampushub.vercel.app/logo-512x512.webp',
    description: "India's trusted student marketplace for books, notes, and study essentials. Buy, sell, and exchange textbooks directly with students.",
    sameAs: [
      'https://www.instagram.com/educampushubofficial',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'disciplineembrace@gmail.com',
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi', 'Gujarati'],
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
    },
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

export function WebSiteJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EduCampusHub',
    url: 'https://educampushub.vercel.app',
    description: "India's trusted student marketplace for books, notes, and study essentials.",
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://educampushub.vercel.app/?search={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
    inLanguage: ['en', 'hi', 'gu'],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}

export function MarketplaceJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'EduCampusHub — Buy • Sell • Exchange',
    description: "India's trusted student marketplace for books, notes, and study essentials. Save up to 70% on textbooks for NEET, JEE, UPSC, and more.",
    url: 'https://educampushub.vercel.app',
    isPartOf: {
      '@type': 'WebSite',
      name: 'EduCampusHub',
      url: 'https://educampushub.vercel.app',
    },
    about: {
      '@type': 'Thing',
      name: 'Student Marketplace',
      description: 'Platform for buying, selling, and exchanging academic materials between students in India.',
    },
    offers: {
      '@type': 'Offer',
      description: 'Save up to 70% on textbooks',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
}
