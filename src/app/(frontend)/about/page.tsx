import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Heart, Sparkles, Globe2, Users, ShieldCheck, Truck, Star, Gift, Gem, Trophy } from 'lucide-react'
import { getMediaUrl } from '@/lib/media-url'

/* ── Icon Map ── */
const ICON_MAP: Record<string, React.ElementType> = {
  sparkles: Sparkles, globe: Globe2, heart: Heart, users: Users,
  shield: ShieldCheck, truck: Truck, star: Star, gift: Gift,
  gem: Gem, trophy: Trophy,
}

/* ── Fallback Data ── */
const DEFAULT_VALUES = [
  { icon: 'sparkles', title: '精選品質', description: '每一件商品皆經過嚴格篩選，與韓國及台灣優質廠商合作，確保質感與細節達到最高標準。' },
  { icon: 'globe', title: '韓國直送', description: '商品主要由韓國空運直送台灣，緊跟首爾最新流行趨勢，讓您第一時間穿上當季款式。' },
  { icon: 'heart', title: '貼心服務', description: '提供工作室預約試穿、專屬客服、LINE 即時諮詢，打造溫暖且專業的購物體驗。' },
  { icon: 'users', title: '會員經營', description: '六大會員等級制度，從購物金、生日禮到專屬優惠，每一位顧客都是我們珍視的家人。' },
  { icon: 'shield', title: '安心保障', description: '完善退換貨機制、電子發票系統、信用卡安全交易，讓您安心購物沒有後顧之憂。' },
  { icon: 'truck', title: '快速到貨', description: '現貨商品最快隔日出貨，預購商品清楚標示到貨時間，讓等待也成為期待的一部分。' },
]

const DEFAULT_TIMELINE = [
  { year: '2018', title: '品牌創立', description: '從一間小小的網路商店開始，以「讓每位女性都能輕鬆擁有韓系質感穿搭」為初心出發。' },
  { year: '2019', title: '工作室開設', description: '於台北開設品牌工作室，提供預約試穿服務，讓顧客親身感受衣物質感。' },
  { year: '2020', title: '品牌升級', description: '推出會員制度與訂閱方案，建立更完整的品牌體驗與顧客回饋系統。' },
  { year: '2022', title: '跨境合作', description: '與更多韓國設計師品牌及優質工廠建立直接合作關係，拓展商品線。' },
  { year: '2024', title: '全新官網', description: '全面升級官方網站，導入 AI 穿搭推薦、互動遊戲、CRM 會員經營等創新功能。' },
]

const DEFAULT_STORY = [
  'CHIC KIM & MIU（亦稱 CKMU）創立於對時尚與品質的熱情。品牌名稱蘊含三層意義：Chic（時尚優雅）、Kind（溫柔善良）、Mindful（用心講究），這正是我們希望傳遞給每一位女性的穿搭理念。',
  '我們的商品主要與韓國及台灣優質廠商合作，透過自製、採購、研發等方式，從首爾空運直送台灣。每一件服飾都經過嚴格篩選，確保版型、質感與細節能完美呈現韓系穿搭的精緻風格。',
  '從一間小小的網路商店到如今的品牌規模，CKMU 始終堅持初心 — 讓每位女性都能輕鬆擁有高品質的日韓時裝，在生活中展現專屬的自信與魅力。',
]

const DEFAULT_BUTTONS = [
  { label: 'LINE 客服 @ckmu', url: 'https://page.line.me/nqo0262k?openQrModal=true', style: 'line' as const, external: true },
  { label: '購物說明', url: '/shopping-guide', style: 'outline' as const, external: false },
  { label: 'Instagram', url: 'https://www.instagram.com/chickimmiu/', style: 'outline' as const, external: true },
]

/* getMediaUrl imported from @/lib/media-url */

/* ── Fetch CMS data ── */
async function getAboutSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'about-page-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAboutSettings()
  const seo = (settings?.seo || {}) as Record<string, unknown>
  return {
    title: (seo.title as string) || '商店介紹',
    description: (seo.description as string) || '認識 CHIC KIM & MIU — 源自韓國的精緻女裝品牌，為每位女性打造優雅與可愛兼具的穿搭風格。',
  }
}

export default async function AboutPage() {
  const settings = await getAboutSettings()

  const hero = (settings?.hero || {}) as Record<string, unknown>
  const brandStory = (settings?.brandStory || {}) as Record<string, unknown>
  const contactCta = (settings?.contactCta || {}) as Record<string, unknown>

  const heroImage = getMediaUrl(hero.image) || 'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png'
  const heroTitle = (hero.title as string) || '商店介紹'
  const heroSubtitle = (hero.subtitle as string) || 'About Us'
  const heroDesc = (hero.description as string) || 'Chic, Kind & Mindful — 為每位女性打造優雅與可愛兼具的穿搭風格'

  const brandValues = (settings?.brandValues as Array<Record<string, unknown>>) || DEFAULT_VALUES
  const timeline = (settings?.timeline as Array<Record<string, unknown>>) || DEFAULT_TIMELINE
  const storyText = (brandStory.contentFallback as string) || DEFAULT_STORY.join('\n\n')
  const storyParagraphs = storyText.split('\n\n').filter(Boolean)

  const ctaTitle = (contactCta.title as string) || '與我們聯繫'
  const ctaDesc = (contactCta.description as string) || '無論是商品諮詢、合作洽談、還是穿搭建議，歡迎隨時透過以下方式聯繫我們。'
  const ctaButtons = (contactCta.buttons as Array<Record<string, unknown>>) || DEFAULT_BUTTONS

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Hero Banner ── */}
      <section className="relative h-[360px] md:h-[480px] w-full overflow-hidden">
        <Image
          src={heroImage}
          alt={heroTitle}
          fill
          unoptimized
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-xs tracking-[0.4em] text-white/80 mb-3 uppercase">{heroSubtitle}</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-widest drop-shadow-lg">
              {heroTitle}
            </h1>
            <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
            <p className="mt-4 text-white/80 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              {heroDesc}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16 space-y-12">
        {/* ── Brand Story ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">Our Story</p>
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">
            {(brandStory.title as string) || '品牌故事'}
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <div className="text-[#2C2C2C]/80 leading-relaxed space-y-4 text-[15px]">
            {storyParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* ── Brand Values ── */}
        {brandValues.length > 0 && (
          <section>
            <div className="text-center mb-8">
              <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">Our Values</p>
              <h2 className="text-2xl font-bold text-[#2C2C2C]">品牌理念</h2>
              <div className="w-10 h-[2px] bg-[#C19A5B] mx-auto mt-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {brandValues.map((v) => {
                const IconComp = ICON_MAP[(v.icon as string) || 'sparkles'] || Sparkles
                return (
                  <div
                    key={v.title as string}
                    className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#C19A5B]/10 flex items-center justify-center mb-4">
                      <IconComp className="w-5 h-5 text-[#C19A5B]" />
                    </div>
                    <h3 className="text-base font-semibold text-[#2C2C2C] mb-2">{v.title as string}</h3>
                    <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">{v.description as string}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Brand Timeline ── */}
        {timeline.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
            <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">Milestones</p>
            <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">品牌歷程</h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mb-8" />
            <div className="space-y-0">
              {timeline.map((item, i) => (
                <div key={item.year as string} className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-[#C19A5B] ring-4 ring-[#C19A5B]/20 flex-shrink-0" />
                    {i < timeline.length - 1 && (
                      <div className="w-px flex-1 bg-[#C19A5B]/20 my-1" />
                    )}
                  </div>
                  <div className="pb-8">
                    <span className="text-xs font-bold text-[#C19A5B] tracking-wider">{item.year as string}</span>
                    <h3 className="text-base font-semibold text-[#2C2C2C] mt-0.5">{item.title as string}</h3>
                    <p className="text-sm text-[#2C2C2C]/70 mt-1 leading-relaxed">{item.description as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Contact / CTA ── */}
        <section className="bg-gradient-to-br from-[#2C2C2C] to-[#1a1a1a] rounded-2xl shadow-sm p-8 md:p-10 text-center">
          <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">Get in Touch</p>
          <h2 className="text-2xl font-bold text-white mb-3">{ctaTitle}</h2>
          <p className="text-white/70 text-sm max-w-lg mx-auto mb-6 leading-relaxed">
            {ctaDesc}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {ctaButtons.map((btn) => {
              const isLine = (btn.style as string) === 'line'
              const isExternal = Boolean(btn.external)
              const className = isLine
                ? 'inline-flex items-center gap-2 px-6 py-3 bg-[#06C755] hover:bg-[#05b14c] text-white rounded-xl text-sm font-medium transition-colors'
                : 'inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20'

              if (isExternal) {
                return (
                  <a
                    key={btn.label as string}
                    href={btn.url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {btn.label as string}
                  </a>
                )
              }
              return (
                <Link key={btn.label as string} href={btn.url as string} className={className}>
                  {btn.label as string}
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
