import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { TranslationProvider } from "@/lib/i18n/TranslationContext";
import { OrganizationJsonLd, WebSiteJsonLd, MarketplaceJsonLd } from "@/components/seo/JsonLd";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#002868",
};

export const metadata: Metadata = {
  title: {
    default: "EduCampusHub — Buy • Sell • Exchange",
    template: "%s | EduCampusHub",
  },
  description:
    "Buy • Sell • Exchange — India's trusted student marketplace for books, notes, and study essentials. Save up to 70% on textbooks for NEET, JEE, UPSC, and more.",
  keywords: [
    "EduCampusHub",
    "student marketplace",
    "buy books",
    "sell books",
    "old books",
    "second hand books",
    "India",
    "college books",
    "NEET books",
    "JEE books",
    "UPSC books",
    "student platform",
    "campus marketplace",
    "university books",
    "textbook exchange",
    "study materials",
    "engineering books",
    "medical books",
    "law books",
    "CBSE books",
    "ICSE books",
    "competitive exam books",
    "used textbooks",
    "book exchange",
    "student community",
  ],
  authors: [{ name: "EduCampusHub Team", url: "https://educampushub.vercel.app" }],
  creator: "EduCampusHub",
  publisher: "EduCampusHub",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://educampushub.vercel.app"),
  alternates: {
    canonical: "/",
    languages: {
      'en': '/',
      'gu': '/?lang=gu',
      'hi': '/?lang=hi',
    },
  },
  openGraph: {
    title: "EduCampusHub — Buy • Sell • Exchange",
    description:
      "Buy & sell old books directly with students. Save up to 70% on textbooks for NEET, JEE, UPSC & more.",
    url: "https://educampushub.vercel.app",
    siteName: "EduCampusHub",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "EduCampusHub - Student Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EduCampusHub — Buy • Sell • Exchange",
    description:
      "Buy & sell old books directly with students. Save up to 70% on textbooks.",
    images: ["/og-image.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo-32x32.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  verification: {
    // google: "google-site-verification=ACTUAL_CODE_HERE",
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${poppins.variable} antialiased bg-background text-foreground font-sans`}
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <MarketplaceJsonLd />
        <TranslationProvider>
          {children}
        </TranslationProvider>
        <Analytics />
      </body>
    </html>
  );
}
