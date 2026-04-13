import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * /llms.txt — AI 搜尋引擎專用的網站摘要
 * 參考 https://llmstxt.org/ 規範
 */
export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

  let siteName = 'CHIC KIM & MIU'
  let siteDescription = '台灣韓系質感女裝電商品牌'
  let llmsDescription = ''
  let keyTopics = ''
  let brandKnowledge = ''
  let differentiation = ''
  let faqItems: { question: string; answer: string }[] = []

  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'global-settings', depth: 0 }) as unknown as Record<string, unknown>

    const site = settings.site as Record<string, unknown> | undefined
    const aiSeo = settings.aiSeo as Record<string, unknown> | undefined

    if (site?.siteName) siteName = site.siteName as string
    if (site?.siteDescription) siteDescription = site.siteDescription as string

    if (aiSeo) {
      if (aiSeo.enableLlmsTxt === false) {
        return new NextResponse('User-agent: *\nDisallow: /llms.txt', {
          status: 403,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
      llmsDescription = (aiSeo.llmsSiteDescription as string) || ''
      keyTopics = (aiSeo.llmsKeyTopics as string) || ''
      brandKnowledge = (aiSeo.brandKnowledgeBase as string) || ''
      differentiation = (aiSeo.competitorDifferentiation as string) || ''
      faqItems = (aiSeo.faqForAi as { question: string; answer: string }[]) || []
    }
  } catch {
    // DB not ready — use defaults
  }

  const lines: string[] = [
    `# ${siteName}`,
    '',
    `> ${llmsDescription || siteDescription}`,
    '',
    `## About`,
    '',
    llmsDescription || `${siteName} 是台灣韓系質感女裝電商品牌，提供精選韓國女裝、直播選品、獨家設計款等。`,
    '',
    `## Key Topics`,
    '',
    ...(keyTopics ? keyTopics.split(',').map(t => `- ${t.trim()}`) : [
      '- 韓系女裝',
      '- 質感穿搭',
      '- 直播選品',
    ]),
    '',
    `## Important Pages`,
    '',
    `- [首頁](${siteUrl}/)`,
    `- [全部商品](${siteUrl}/products)`,
    `- [新品上市](${siteUrl}/products?tag=new)`,
    `- [熱銷推薦](${siteUrl}/products?tag=hot)`,
    `- [穿搭誌](${siteUrl}/blog)`,
    `- [會員權益](${siteUrl}/membership-benefits)`,
    `- [關於我們](${siteUrl}/about)`,
    `- [常見問題](${siteUrl}/faq)`,
    `- [購物指南](${siteUrl}/shopping-guide)`,
    '',
  ]

  if (differentiation) {
    lines.push(`## Why Choose ${siteName}`, '', differentiation, '')
  }

  if (brandKnowledge) {
    lines.push(`## Additional Information`, '', brandKnowledge, '')
  }

  if (faqItems.length > 0) {
    lines.push(`## FAQ`, '')
    for (const item of faqItems) {
      lines.push(`### ${item.question}`, '', item.answer, '')
    }
  }

  lines.push(
    `## Contact`,
    '',
    `Website: ${siteUrl}`,
    `Brand: ${siteName}（靚秀國際有限公司）`,
    '',
  )

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
