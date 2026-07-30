import type { Metadata } from 'next'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  Package,
  Sparkles,
  Leaf,
  Gift,
  ShieldCheck,
  Recycle,
  Heart,
  Star,
} from 'lucide-react'
import type React from 'react'

/**
 * /packaging（商品包裝）— 內容由後台 global「商品包裝頁」(packaging-page-settings)
 * 管理。global 每個欄位都有 defaultValue = 原本文案，所以沒存過也呈現現有內容；
 * 若 global table 尚未 migrate，getPackagingSettings 回 null → 用以下 DEFAULT_* fallback，
 * 畫面零退化。
 */

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  ShieldCheck,
  Leaf,
  Gift,
  Package,
  Recycle,
  Heart,
  Star,
}

const DEFAULT_HERO_IMAGE =
  'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png'

const DEFAULT_FEATURES = [
  { icon: 'Sparkles', title: '品牌專屬包裝', description: '每件商品均使用 CKMU 品牌專屬包裝袋/盒，燙金 Logo 設計，從拆封的第一刻起就感受品牌質感。' },
  { icon: 'ShieldCheck', title: '防護與保護', description: '服飾以獨立防塵袋包裝，搭配防潮紙、氣泡袋等保護材料，確保商品在運送過程中不受損傷。' },
  { icon: 'Leaf', title: '環保材質', description: '包裝材料優先選用可回收、可分解的環保材質，減少塑膠使用量，為地球盡一份心力。' },
  { icon: 'Gift', title: '禮物包裝服務', description: '提供加購禮物包裝服務，精美禮盒搭配緞帶與小卡，送禮更有心意。下單時備註即可。' },
  { icon: 'Package', title: '出貨檢查', description: '每筆訂單出貨前均經過品質檢查，確認商品完整性、尺寸正確性，附上出貨明細與售後說明卡。' },
  { icon: 'Recycle', title: '包裝回收', description: '鼓勵顧客將包裝材料回收再利用。品牌包裝袋可作為日常收納使用，延續它的生命週期。' },
]

const DEFAULT_STEPS = [
  { step: '01', title: '品質檢查', description: '專員逐件檢查商品品質、顏色、尺寸是否與訂單一致。' },
  { step: '02', title: '獨立包裝', description: '每件服飾以防塵袋獨立包裝，避免交叉染色與摩擦。' },
  { step: '03', title: '保護填充', description: '使用環保填充材料固定商品位置，防止運送中碰撞。' },
  { step: '04', title: '品牌封裝', description: 'CKMU 品牌包裝袋/盒封裝，附上出貨明細與感謝卡。' },
  { step: '05', title: '安心出貨', description: '交由合作物流，提供即時追蹤碼，讓您掌握包裹動態。' },
]

const DEFAULT_PHILOSOPHY =
  '在 CKMU，我們相信包裝不只是保護商品的外衣，更是品牌與顧客之間的第一次觸感溝通。從包裝設計、材質選擇到封裝流程，每一個環節都經過用心規劃，希望您收到包裹時，能感受到我們對品質的堅持與對您的重視。\n\n同時，我們持續優化包裝方式，在維持商品保護力的前提下，盡可能減少不必要的包材，選用環保可回收材質，為永續發展盡一份心力。'

async function getPackagingSettings(): Promise<Record<string, unknown> | null> {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({
      slug: 'packaging-page-settings',
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPackagingSettings()
  const seo = (settings?.seo || {}) as Record<string, unknown>
  return {
    title: (seo.metaTitle as string) || '商品包裝',
    description:
      (seo.metaDescription as string) ||
      'CHIC KIM & MIU 商品包裝說明 — 了解我們精心設計的包裝細節與環保理念。',
  }
}

export default async function PackagingPage() {
  const settings = await getPackagingSettings()

  const hero = (settings?.hero || {}) as Record<string, unknown>
  const philosophy = (settings?.philosophy || {}) as Record<string, unknown>
  const featuresGroup = (settings?.features || {}) as Record<string, unknown>
  const processGroup = (settings?.process || {}) as Record<string, unknown>
  const giftCta = (settings?.giftCta || {}) as Record<string, unknown>

  const heroImage = (hero.backgroundImageUrl as string) || DEFAULT_HERO_IMAGE
  const heroEyebrow = (hero.eyebrow as string) || 'Packaging'
  const heroTitle = (hero.title as string) || '商品包裝'
  const heroSubtitle = (hero.subtitle as string) || '精心包裝每一份心意，從拆封的那一刻開始享受'

  const philoEyebrow = (philosophy.eyebrow as string) || 'Philosophy'
  const philoHeading = (philosophy.heading as string) || '包裝理念'
  const philoParagraphs = ((philosophy.body as string) || DEFAULT_PHILOSOPHY)
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)

  const featuresEyebrow = (featuresGroup.eyebrow as string) || 'Features'
  const featuresHeading = (featuresGroup.heading as string) || '包裝特色'
  const features = ((featuresGroup.items as Array<Record<string, unknown>>) || DEFAULT_FEATURES).filter(
    Boolean,
  )

  const processEyebrow = (processGroup.eyebrow as string) || 'Process'
  const processHeading = (processGroup.heading as string) || '出貨流程'
  const steps = ((processGroup.steps as Array<Record<string, unknown>>) || DEFAULT_STEPS).filter(Boolean)

  const giftHeading = (giftCta.heading as string) || '禮物包裝服務'
  const giftDescription =
    (giftCta.description as string) ||
    '送禮給重要的人？我們提供精美禮物包裝加購服務。結帳時於備註欄填寫「禮物包裝」，我們將為您的商品換上專屬禮盒、緞帶與祝福小卡。'
  const giftBadge = (giftCta.badgeText as string) || '加購禮物包裝 NT$ 80 / 件'

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Hero Banner ── */}
      <section className="relative h-[320px] md:h-[420px] w-full overflow-hidden">
        <Image src={heroImage} alt={heroTitle} fill unoptimized className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-xs tracking-[0.4em] text-white/80 mb-3 uppercase">{heroEyebrow}</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-widest drop-shadow-lg">
              {heroTitle}
            </h1>
            <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
            <p className="mt-4 text-white/80 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              {heroSubtitle}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16 space-y-12">
        {/* ── Packaging Philosophy ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">{philoEyebrow}</p>
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">{philoHeading}</h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <div className="text-[#2C2C2C]/80 leading-relaxed space-y-4 text-[15px]">
            {philoParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* ── Packaging Features ── */}
        <section>
          <div className="text-center mb-8">
            <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">{featuresEyebrow}</p>
            <h2 className="text-2xl font-bold text-[#2C2C2C]">{featuresHeading}</h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mx-auto mt-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => {
              const Icon = ICON_MAP[(f.icon as string) || 'Sparkles'] || Sparkles
              return (
                <div
                  key={(f.title as string) || i}
                  className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#C19A5B]/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#C19A5B]" />
                  </div>
                  <h3 className="text-base font-semibold text-[#2C2C2C] mb-2">{f.title as string}</h3>
                  <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">{f.description as string}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Packaging Process ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">{processEyebrow}</p>
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">{processHeading}</h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-8" />
          <div className="space-y-6">
            {steps.map((s, i) => (
              <div key={(s.step as string) || i} className="flex items-start gap-4 md:gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#C19A5B]/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-[#C19A5B]">{s.step as string}</span>
                </div>
                <div className="flex-1 pb-6 border-b border-[#F0E6D6] last:border-0">
                  <h3 className="text-base font-semibold text-[#2C2C2C]">{s.title as string}</h3>
                  <p className="text-sm text-[#2C2C2C]/70 mt-1 leading-relaxed">{s.description as string}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Gift Packaging CTA ── */}
        <section className="bg-gradient-to-br from-[#C19A5B] to-[#A07B3F] rounded-2xl shadow-sm p-8 md:p-10 text-center">
          <Gift className="w-10 h-10 text-white/90 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">{giftHeading}</h2>
          <p className="text-white/80 text-sm max-w-lg mx-auto mb-6 leading-relaxed">{giftDescription}</p>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 rounded-xl text-white text-sm border border-white/30">
            <span>{giftBadge}</span>
          </div>
        </section>
      </div>
    </main>
  )
}
