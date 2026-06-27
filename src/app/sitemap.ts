import { MetadataRoute } from 'next'
import { db } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://educampushub.vercel.app'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sell`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Dynamic listing pages
  let listingPages: MetadataRoute.Sitemap = []
  try {
    const listings = await db.listing.findMany({
      where: { isSold: false },
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    listingPages = listings.map(listing => ({
      url: `${baseUrl}/listing/${listing.id}`,
      lastModified: listing.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  } catch {
    // If DB is unavailable, skip dynamic pages
  }

  // Category pages with exam-specific pages
  const categories = [
    'school-books', 'cbse', 'gseb', 'icse', 'college-books', 'medical',
    'engineering', 'commerce-law', 'competitive', 'notes-pdfs', 'handwritten',
    'ebooks', 'notebooks', 'study-kits'
  ]

  // Exam-specific category pages for better SEO targeting
  const examCategories = [
    'neet', 'jee', 'upsc', 'gate', 'cat', 'clat', 'gre', 'gmat',
    'ssc', 'banking', 'railways', 'defence',
  ]

  const categoryPages: MetadataRoute.Sitemap = [
    ...categories.map(category => ({
      url: `${baseUrl}/category/${category}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...examCategories.map(exam => ({
      url: `${baseUrl}/category/competitive/${exam}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]

  return [...staticPages, ...listingPages, ...categoryPages]
}
