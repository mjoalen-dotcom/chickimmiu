import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

  // LB-10：封測 / staging host 全站禁止索引，避免 pre.chickimmiu.com 被
  // 搜尋引擎收錄成正站的重複內容。切正式域名時 NEXT_PUBLIC_SITE_URL 一改
  // 即自動恢復下方 allow 規則；也可用 DISABLE_INDEXING=1 強制關閉索引。
  let host = ''
  try {
    host = new URL(siteUrl).hostname
  } catch {
    /* siteUrl 格式異常時保守走 allow 路徑（等同舊行為） */
  }
  const noIndex =
    process.env.DISABLE_INDEXING === '1' ||
    host.startsWith('pre.') ||
    host.startsWith('staging.')
  if (noIndex) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/account/', '/partner/', '/checkout/'],
      },
      // AI Crawlers — allow indexing for AI search engines
      {
        userAgent: 'GPTBot',
        allow: ['/', '/products/', '/blog/'],
        disallow: ['/admin/', '/api/', '/account/', '/partner/', '/checkout/'],
      },
      {
        userAgent: 'Google-Extended',
        allow: ['/', '/products/', '/blog/'],
        disallow: ['/admin/', '/api/', '/account/', '/partner/', '/checkout/'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: ['/', '/products/', '/blog/'],
        disallow: ['/admin/', '/api/', '/account/', '/partner/', '/checkout/'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/', '/products/', '/blog/'],
        disallow: ['/admin/', '/api/', '/account/', '/partner/', '/checkout/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/products/', '/blog/'],
        disallow: ['/admin/', '/api/', '/account/', '/checkout/'],
      },
      {
        userAgent: 'Bytespider',
        allow: ['/', '/products/', '/blog/'],
        disallow: ['/admin/', '/api/', '/account/', '/partner/', '/checkout/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
