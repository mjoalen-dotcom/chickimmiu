/**
 * Schema.org JSON-LD 結構化資料元件
 * ─────────────────────────────────
 * Product、Article、BreadcrumbList、Organization、WebSite、FAQPage
 */

// ── Product ──

interface ProductJsonLdProps {
  name: string
  description?: string
  image?: string
  price: number
  salePrice?: number
  currency?: string
  sku?: string
  slug: string
  brand?: string
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder'
}

export function ProductJsonLd({
  name,
  description,
  image,
  price,
  salePrice,
  currency = 'TWD',
  sku,
  slug,
  brand = 'CHIC KIM & MIU',
  availability = 'InStock',
}: ProductJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: image ? [image] : undefined,
    sku,
    brand: { '@type': 'Brand', name: brand },
    url: `${siteUrl}/products/${slug}`,
    offers: {
      '@type': 'Offer',
      price: salePrice ?? price,
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
      seller: { '@type': 'Organization', name: brand },
      ...(salePrice && salePrice < price
        ? {
            priceValidUntil: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString().slice(0, 10),
          }
        : {}),
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── Article ──

interface ArticleJsonLdProps {
  title: string
  description?: string
  image?: string
  publishedAt: string
  authorName?: string
  slug: string
}

export function ArticleJsonLd({
  title,
  description,
  image,
  publishedAt,
  authorName = 'CHIC KIM & MIU 編輯部',
  slug,
}: ArticleJsonLdProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: image ? [image] : undefined,
    datePublished: publishedAt,
    author: { '@type': 'Person', name: authorName },
    publisher: { '@type': 'Organization', name: 'CHIC KIM & MIU', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/blog/${slug}`,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── Breadcrumb ──

interface BreadcrumbItem {
  name: string
  href: string
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.href.startsWith('http') ? item.href : `${siteUrl}${item.href}`,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── Organization（全站共用，放在 layout）──

interface OrganizationJsonLdProps {
  name: string
  legalName?: string
  url: string
  logo: string
  phone?: string
  email?: string
  address?: string
  sameAs?: string[]
}

export function OrganizationJsonLd({
  name,
  legalName,
  url,
  logo,
  phone,
  email,
  address,
  sameAs = [],
}: OrganizationJsonLdProps) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    ...(legalName ? { legalName } : {}),
    url,
    logo,
    ...(sameAs.length ? { sameAs } : {}),
    ...(phone || email
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            ...(phone ? { telephone: phone } : {}),
            ...(email ? { email } : {}),
            availableLanguage: ['zh-TW'],
          },
        }
      : {}),
    ...(address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: address,
            addressLocality: '台北市',
            addressCountry: 'TW',
          },
        }
      : {}),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── WebSite + SearchAction（Google Sitelinks 搜尋框）──

interface WebSiteJsonLdProps {
  name: string
  url: string
}

export function WebSiteJsonLd({ name, url }: WebSiteJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${url}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

// ── FAQPage（用於 /faq 頁面）──

interface FAQItem {
  question: string
  answer: string
}

export function FAQPageJsonLd({ items }: { items: FAQItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
