import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

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
