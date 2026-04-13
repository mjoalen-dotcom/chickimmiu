import type { MetadataRoute } from 'next'

/**
 * 動態生成 sitemap.xml
 * 包含靜態頁面 + 從 Payload 取得的商品與部落格文章
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

  // ── 靜態頁面 ──
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/membership-benefits`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/games`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]

  // ── 動態頁面：商品、部落格、Landing Pages ──
  let productPages: MetadataRoute.Sitemap = []
  let blogPages: MetadataRoute.Sitemap = []
  let landingPages: MetadataRoute.Sitemap = []

  if (process.env.DATABASE_URI) {
    try {
      const { getPayload } = await import('payload')
      const config = (await import('@payload-config')).default
      const payload = await getPayload({ config })

      // 商品
      const products = await payload.find({
        collection: 'products',
        where: { status: { equals: 'published' } },
        limit: 1000,
        depth: 0,
      })
      productPages = products.docs.map((p) => ({
        url: `${siteUrl}/products/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))

      // 部落格
      const posts = await payload.find({
        collection: 'blog-posts',
        where: { status: { equals: 'published' } },
        limit: 1000,
        depth: 0,
      })
      blogPages = posts.docs.map((p) => ({
        url: `${siteUrl}/blog/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))

      // Landing Pages
      const pages = await payload.find({
        collection: 'pages',
        where: { status: { equals: 'published' } },
        limit: 100,
        depth: 0,
      })
      landingPages = pages.docs.map((p) => ({
        url: `${siteUrl}/pages/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }))
    } catch {
      // DB not ready — only static pages
    }
  }

  return [...staticPages, ...productPages, ...blogPages, ...landingPages]
}
