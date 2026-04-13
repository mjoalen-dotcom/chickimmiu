export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Noto_Sans_TC, Noto_Serif_TC } from 'next/font/google'
import { getPayload } from 'payload'
import config from '@payload-config'
import './globals.css'

import { Providers } from '@/components/layout/Providers'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { FloatingChatButton } from '@/components/ui/FloatingChatButton'
import { FloatingQuickMenu } from '@/components/ui/FloatingQuickMenu'
import { CookieConsentBanner } from '@/components/ui/CookieConsentBanner'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ExitIntentPopup } from '@/components/recommendation/ExitIntentPopup'
import { GTMScript } from '@/components/tracking/GTMScript'
import { TrackingProvider } from '@/components/tracking/TrackingProvider'
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd'

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-tc',
  display: 'swap',
})

const notoSerifTC = Noto_Serif_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-serif-tc',
  display: 'swap',
})

/* ── Helper: extract media URL ── */
function getMediaUrl(field: unknown): string | undefined {
  if (!field) return undefined
  if (typeof field === 'object' && field !== null && 'url' in field) {
    return (field as { url?: string }).url ?? undefined
  }
  return undefined
}

/* ── Build metadata from CMS settings ── */
async function getGlobalSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'global-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

async function getNavigationSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'navigation-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const settings = await getGlobalSettings()

  const site = (settings?.site || {}) as Record<string, unknown>
  const seo = (settings?.seo || {}) as Record<string, unknown>

  const siteName = (site.siteName as string) || 'CHIC KIM & MIU'
  const defaultTitle = (seo.defaultTitle as string) || 'CHIC KIM & MIU｜韓系質感女裝｜靚秀國際'
  const titleTemplate = (seo.titleTemplate as string) || '%s｜CHIC KIM & MIU'
  const description = (seo.metaDescription as string) || '融合高級極簡優雅與韓系可愛活力的台灣女裝品牌，米白／米杏／金色調，包容性尺碼，打造每一位女性的日常優雅。'
  const keywords = (seo.keywords as string) || '韓系女裝,質感穿搭,韓國女裝,名媛風洋裝,CHIC KIM & MIU'
  const author = (seo.author as string) || 'CHIC KIM & MIU｜靚秀國際有限公司'

  const faviconUrl = getMediaUrl(site.favicon) || '/favicon.ico'
  const appleTouchIconUrl = getMediaUrl(site.appleTouchIcon) || '/apple-touch-icon.png'
  const ogImageUrl = getMediaUrl(site.ogImage) || `${siteUrl}/og-image.png`

  const googleVerification = (seo.googleSiteVerification as string) || undefined
  const bingVerification = (seo.bingSiteVerification as string) || undefined

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: titleTemplate,
    },
    description,
    keywords: keywords.split(',').map((k: string) => k.trim()),
    authors: [{ name: author, url: siteUrl }],
    creator: siteName,
    publisher: siteName,
    applicationName: siteName,
    generator: 'Next.js',
    referrer: 'strict-origin-when-cross-origin',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
      },
    },
    icons: {
      icon: faviconUrl,
      apple: appleTouchIconUrl,
    },
    manifest: '/manifest.webmanifest',
    openGraph: {
      type: 'website',
      locale: 'zh_TW',
      url: siteUrl,
      siteName,
      title: defaultTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: siteUrl,
    },
    verification: {
      google: googleVerification,
      other: {
        ...(bingVerification ? { 'msvalidate.01': bingVerification } : {}),
      },
    },
    category: 'fashion',
    other: {
      'theme-color': '#C19A5B',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
      'apple-mobile-web-app-title': siteName,
      'format-detection': 'telephone=no',
    },
  }
}

export default async function FrontendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [globalSettings, navSettings] = await Promise.all([
    getGlobalSettings(),
    getNavigationSettings(),
  ])

  const cs = (globalSettings?.customerService || {}) as unknown as Record<string, unknown>
  const cc = (globalSettings?.cookieConsent || {}) as unknown as Record<string, unknown>
  const tracking = (globalSettings?.tracking || {}) as unknown as Record<string, unknown>
  const socialLinks = (globalSettings?.socialLinks || {}) as unknown as Record<string, unknown>
  const businessInfo = (globalSettings?.businessInfo || {}) as unknown as Record<string, unknown>
  const site = (globalSettings?.site || {}) as unknown as Record<string, unknown>

  // Navigation settings
  const announcementBar = (navSettings?.announcementBar || {}) as unknown as Record<string, unknown>
  const mainMenu = (navSettings?.mainMenu || null) as unknown as Array<{ label: string; href: string; children?: Array<{ label: string; href: string }> }> | null
  const footerSections = (navSettings?.footerSections || null) as unknown as Array<{ title: string; links: Array<{ label: string; href: string }> }> | null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const siteName = (site.siteName as string) || 'CHIC KIM & MIU'
  const logoUrl = getMediaUrl(site.logo) || '/images/logo-ckmu.svg'

  // Collect social URLs for Organization schema
  const sameAs: string[] = []
  if (socialLinks.instagram) sameAs.push(socialLinks.instagram as string)
  if (socialLinks.facebook) sameAs.push(socialLinks.facebook as string)
  if (socialLinks.youtube) sameAs.push(socialLinks.youtube as string)
  if (socialLinks.tiktok) sameAs.push(socialLinks.tiktok as string)
  if (socialLinks.line) sameAs.push(socialLinks.line as string)

  return (
    <html lang="zh-Hant-TW" className={`${notoSansTC.variable} ${notoSerifTC.variable}`}>
      <head>
        <GTMScript
          gtmId={(tracking.gtmId as string) || process.env.NEXT_PUBLIC_GTM_ID || null}
          metaPixelId={(tracking.metaPixelId as string) || process.env.NEXT_PUBLIC_META_PIXEL_ID || null}
          ga4Id={(tracking.ga4Id as string) || process.env.NEXT_PUBLIC_GA4_ID || null}
        />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>
          <TrackingProvider>
            {/* Global JSON-LD */}
            <OrganizationJsonLd
              name={siteName}
              legalName={(businessInfo.legalName as string) || '靚秀國際有限公司'}
              url={siteUrl}
              logo={`${siteUrl}${logoUrl}`}
              phone={(businessInfo.phone as string) || undefined}
              email={(businessInfo.email as string) || undefined}
              address={(businessInfo.address as string) || undefined}
              sameAs={sameAs}
            />
            <WebSiteJsonLd
              name={siteName}
              url={siteUrl}
            />

            <Navbar
              announcementText={(announcementBar.enabled !== false && announcementBar.text) ? (announcementBar.text as string) : undefined}
              announcementLink={announcementBar.link as string | undefined}
              announcementStyle={(announcementBar.style as string) || 'default'}
              menuItems={mainMenu || undefined}
              logoUrl={logoUrl}
            />
            <div className="min-h-screen">{children}</div>
            <Footer
              businessInfo={{
                legalName: (businessInfo.legalName as string) || '靚秀國際有限公司',
                taxId: (businessInfo.taxId as string) || '24540533',
                phone: (businessInfo.phone as string) || '02-2718-9488',
                email: (businessInfo.email as string) || undefined,
                address: (businessInfo.address as string) || '台北市基隆路一段68號9樓',
                businessHours: (businessInfo.businessHours as string) || '週一至週五 09:30-18:00',
              }}
              socialLinks={{
                instagram: (socialLinks.instagram as string) || undefined,
                facebook: (socialLinks.facebook as string) || undefined,
                line: (socialLinks.line as string) || undefined,
              }}
              footerSections={footerSections || undefined}
            />
          </TrackingProvider>

          <CartDrawer />
          <ExitIntentPopup />
          <FloatingQuickMenu />
          <FloatingChatButton
            lineOaUrl={cs.lineOaUrl as string | undefined}
            metaPageId={cs.metaPageId as string | undefined}
            enableLine={(cs.enableLineWidget as boolean) ?? true}
            enableMessenger={(cs.enableMessenger as boolean) ?? true}
          />
          <CookieConsentBanner
            enabled={(cc.enabled as boolean) ?? true}
            bannerText={cc.bannerText as string | undefined}
            privacyPolicyUrl={cc.privacyPolicyUrl as string | undefined}
            acceptButtonText={cc.acceptButtonText as string | undefined}
          />
        </Providers>
      </body>
    </html>
  )
}
