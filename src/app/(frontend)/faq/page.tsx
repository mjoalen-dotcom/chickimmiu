import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { FAQPageClient } from './FAQPageClient'
import { getMediaUrl } from '@/lib/media-url'
import { FAQ_DEFAULT_CATEGORIES } from '@/lib/cs/faqDefaults'

async function getFAQSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'faq-page-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getFAQSettings()
  const seo = (settings?.seo || {}) as Record<string, unknown>
  return {
    title: (seo.title as string) || '常見問題 FAQ',
    description: (seo.description as string) || '關於 CHIC KIM & MIU 的訂購流程、付款方式、配送時間、退換貨政策等常見問題解答。',
  }
}

/* ── Default FAQ data ──
   單一事實來源在 lib/cs/faqDefaults；同一份也餵給 seed:faq 與 AI 客服知識庫，
   避免「FAQ 頁說一套、AI 客服說另一套」。此處只在 CMS 尚無資料時當 fallback。 */
const DEFAULT_CATEGORIES = FAQ_DEFAULT_CATEGORIES.map((cat) => ({
  icon: cat.icon,
  title: cat.title,
  items: cat.items.map((item) => ({ question: item.question, answer: item.answer })),
}))

export default async function FAQPage() {
  const settings = await getFAQSettings()

  const hero = (settings?.hero || {}) as Record<string, unknown>
  const contactCta = (settings?.contactCta || {}) as Record<string, unknown>

  const heroImage = getMediaUrl(hero.image) || 'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png'
  const heroTitle = (hero.title as string) || '常見問題'
  const heroDesc = (hero.description as string) || '快速找到您需要的答案'

  const categories = (settings?.categories as Array<Record<string, unknown>>) || DEFAULT_CATEGORIES
  const ctaTitle = (contactCta.title as string) || '還是找不到答案？'
  const ctaDesc = (contactCta.description as string) || '歡迎直接聯繫我們的客服團隊，我們很樂意為您解答任何問題。'

  return (
    <FAQPageClient
      heroImage={heroImage}
      heroTitle={heroTitle}
      heroDesc={heroDesc}
      categories={categories.map((cat) => ({
        icon: (cat.icon as string) || 'help-circle',
        title: (cat.title as string) || '',
        items: ((cat.items as Array<Record<string, unknown>>) || []).map((item) => ({
          q: (item.question as string) || (item.q as string) || '',
          a: (item.answer as string) || (item.a as string) || '',
        })),
      }))}
      ctaTitle={ctaTitle}
      ctaDesc={ctaDesc}
    />
  )
}
