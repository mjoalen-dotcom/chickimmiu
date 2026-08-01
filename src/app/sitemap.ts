import type { MetadataRoute } from 'next'

/**
 * 動態生成 sitemap.xml
 * 包含靜態頁面 + 從 Payload 取得的商品與部落格文章
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

  const now = new Date()
  // ── 靜態頁面 ──
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/collections`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/membership-benefits`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/shopping-guide`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/packaging`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/games`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/privacy-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/return-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/size-guide`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/podcast`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${siteUrl}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // ── 動態頁面：商品、分類、部落格、Landing Pages ──
  let productPages: MetadataRoute.Sitemap = []
  let categoryPages: MetadataRoute.Sitemap = []
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

      // 分類頁（PR-ε 建立的 /category/[slug] 路由）
      const categories = await payload.find({
        collection: 'categories',
        where: { isActive: { not_equals: false } },
        limit: 500,
        depth: 0,
      })
      categoryPages = categories.docs.map((c) => ({
        url: `${siteUrl}/category/${c.slug}`,
        lastModified: new Date(c.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))

      // 部落格
      const posts = await payload.find({
        collection: 'blog-posts',
        where: {
          status: { equals: 'published' },
          visibility: { equals: 'public' },
        },
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

  return [...staticPages, ...productPages, ...categoryPages, ...blogPages, ...landingPages]
}
