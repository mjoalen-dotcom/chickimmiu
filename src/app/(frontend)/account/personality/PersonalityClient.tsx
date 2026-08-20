'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sparkles,
  Sun,
  Compass,
  Heart,
  ArrowRight,
  ChevronRight,
  Crown,
} from 'lucide-react'
import type { OccasionMode } from '@/lib/games/mbtiOccasions'
import { PersonalityAvatar } from '@/components/personality/PersonalityAvatar'

export type ProductLite = {
  id: number
  slug: string
  name: string
  price: number | null
  salePrice: number | null
  imgUrl: string | null
  imgAlt: string | null
}

export type ModeTabKey = 'per-personality' | 'lucky-daily' | 'break-self'

const MODE_TABS: Array<{
  key: ModeTabKey
  label: string
  shortLabel: string
  icon: typeof Sparkles
  description: string
  accent: string
}> = [
  {
    key: 'per-personality',
    label: '按我個性推薦',
    shortLabel: '按個性',
    icon: Crown,
    description: '依你的 MBTI64 sub-personality 主場合對應的商品類別',
    accent: 'from-indigo-500 to-purple-600',
  },
  {
    key: 'lucky-daily',
    label: '平日好運穿搭',
    shortLabel: '平日好運',
    icon: Sun,
    description: '居家 + 都會場合的穩定日常選品，今天穿這套不會錯',
    accent: 'from-amber-400 to-orange-500',
  },
  {
    key: 'break-self',
    label: '今天想突破自己',
    shortLabel: '突破自己',
    icon: Compass,
    description: '對立場合的選品 — 推你跳出舒適圈試試新風格',
    accent: 'from-rose-500 to-fuchsia-600',
  },
]

interface OccasionCard {
  occasion: OccasionMode
  label: string
  icon: string
  accent: string
  description: string
  subTagline: string
  outfitTips: string[]
  keyItems: string[]
  paletteHint: string
  collectionTags: string[]
  isPrimary: boolean
}

interface Props {
  mbtiType: string
  nickname: string
  tagline: string
  personality: string
  styleAnalysis: string
  styleKeywords: string[]
  primaryOccasion: OccasionMode
  primaryOccasionLabel: string
  primaryOccasionIcon: string
  oppositeOccasion: OccasionMode
  oppositeOccasionLabel: string
  oppositeOccasionIcon: string
  fourOccasions: OccasionCard[]
  occasionScores: Record<string, number> | null
  productsByMode: Record<ModeTabKey, ProductLite[]>
  gender: string | null
  personalityIndex: number | null
  personalityName: string | null
}

export default function PersonalityClient({
  mbtiType,
  nickname,
  tagline,
  personality,
  styleAnalysis,
  styleKeywords,
  primaryOccasion: _primaryOccasion,
  primaryOccasionLabel,
  primaryOccasionIcon,
  oppositeOccasion: _oppositeOccasion,
  oppositeOccasionLabel,
  oppositeOccasionIcon,
  fourOccasions,
  occasionScores,
  productsByMode,
  gender,
  personalityIndex,
  personalityName,
}: Props) {
  const [tab, setTab] = useState<ModeTabKey>('per-personality')
  const products = productsByMode[tab] ?? []
  const activeMeta = MODE_TABS.find((m) => m.key === tab) ?? MODE_TABS[0]

  return (
    <main className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[2rem] border border-[#ddc59f] bg-[linear-gradient(135deg,#fffaf5_0%,#f9eee8_58%,#f6e3e3_100%)] p-6 shadow-[0_20px_55px_rgba(78,48,38,0.12)] md:p-10">
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-[#d7b679]/30" />
        <span className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-white/40" />
        <div className="relative grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_220px] md:gap-10">
          <div className="min-w-0">
            <p className="mb-3 text-[11px] tracking-[0.28em] text-[#9b7543]">
              YOUR MBTI64 PERSONALITY
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="font-serif text-5xl tracking-wider text-[#3f2b24] md:text-6xl">
                {mbtiType}
              </p>
              <div className="rounded-full border border-[#d7b679]/60 bg-white/65 px-3 py-1.5 text-sm text-[#6a493c] backdrop-blur">
                {primaryOccasionIcon} {primaryOccasionLabel}場合
              </div>
            </div>
            <p className="mb-1 font-serif text-xl text-[#4c342b] md:text-2xl">
              {personalityName ?? nickname}
            </p>
            <p className="mb-2 text-sm font-medium text-[#8d604f]">{nickname}</p>
            <p className="max-w-xl text-sm leading-relaxed text-[#664b40]">{tagline}</p>

            {Array.isArray(styleKeywords) && styleKeywords.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {styleKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full border border-[#d9b982]/50 bg-white/65 px-3 py-1 text-xs text-[#765244]"
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto flex flex-col items-center md:mx-0">
            <PersonalityAvatar
              gender={gender}
              personalityIndex={personalityIndex}
              size={220}
              priority
              className="max-w-full"
            />
            <div className="mt-3 rounded-full border border-[#d7b679]/50 bg-white/75 px-3 py-1 text-[11px] tracking-[0.12em] text-[#755746]">
              {personalityIndex == null
                ? 'NEUTRAL · DEFAULT'
                : `TYPE ${String(personalityIndex).padStart(2, '0')} / 64`}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 場合 sub-personality 卡片 ── */}
      <section>
        <h2 className="text-base font-serif mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-gold-500" />
          你的 4 種場合 sub-personality
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          16 MBTI 型 × 4 場合 = 64 sub-personality；以下是
          <strong className="text-foreground/80"> {mbtiType}</strong>{' '}
          在 4 種場合的對應穿搭風格。標記
          <span className="inline-flex items-center gap-1 mx-1 text-gold-600">
            <Crown size={12} />
            主場合
          </span>
          的是測驗推算的你的主要場合。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fourOccasions.map((card) => {
            const score = occasionScores?.[card.occasion] ?? null
            return (
              <div
                key={card.occasion}
                className={`rounded-2xl p-5 border bg-white relative overflow-hidden ${
                  card.isPrimary
                    ? 'border-gold-500 shadow-md'
                    : 'border-cream-200'
                }`}
              >
                {card.isPrimary && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gold-500 text-white">
                    <Crown size={10} />
                    主場合
                  </span>
                )}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl">{card.icon}</span>
                  <h3 className="text-base font-serif">{card.label}場合</h3>
                  {score !== null && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {score}/4 票
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{card.description}</p>
                <p className="text-sm font-medium text-foreground/85 mb-2">
                  {card.subTagline}
                </p>
                <ul className="space-y-1 mb-3">
                  {card.outfitTips.map((t, i) => (
                    <li key={i} className="text-xs text-foreground/75 flex gap-1.5">
                      <span className="text-gold-500">·</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-cream-50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground mb-1">配色：{card.paletteHint}</p>
                  <p className="text-[10px] text-muted-foreground">
                    重點單品：{card.keyItems.slice(0, 4).join('、')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 個性分析 + 穿搭風格分析 ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <h3 className="text-sm font-serif mb-3 flex items-center gap-2">
            <Heart size={14} className="text-pink-500" />
            你的個性
          </h3>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {personality}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <h3 className="text-sm font-serif mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-gold-500" />
            你的穿搭風格
          </h3>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {styleAnalysis}
          </p>
        </div>
      </section>

      {/* ── 3 模式商品推薦切換 ── */}
      <section>
        <h2 className="text-base font-serif mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-gold-500" />
          為你精選 — 3 種模式切換推薦
        </h2>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {MODE_TABS.map((m) => {
            const Icon = m.icon
            const active = m.key === tab
            return (
              <button
                key={m.key}
                onClick={() => setTab(m.key)}
                className={`px-3 py-3 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                  active
                    ? `bg-gradient-to-br ${m.accent} text-white shadow-md`
                    : 'bg-white border border-cream-200 text-foreground/70 hover:bg-cream-50'
                }`}
              >
                <Icon size={18} />
                <span className="hidden sm:block">{m.label}</span>
                <span className="sm:hidden">{m.shortLabel}</span>
              </button>
            )
          })}
        </div>

        <div className="bg-white rounded-2xl border border-cream-200 p-4 mb-4">
          <div className="flex items-start gap-2">
            <activeMeta.icon size={16} className="text-gold-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{activeMeta.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{activeMeta.description}</p>
              {tab === 'break-self' && (
                <p className="text-[11px] text-rose-600 mt-1.5">
                  {oppositeOccasionIcon} {oppositeOccasionLabel}
                  場合的選品 — 跳出
                  {primaryOccasionIcon}
                  {primaryOccasionLabel}
                  舒適圈試試！
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Products */}
        {products.length === 0 ? (
          <div className="bg-cream-50 rounded-2xl p-12 text-center border border-cream-200">
            <p className="text-sm text-muted-foreground mb-3">
              這個模式目前還沒有對應商品。
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs text-gold-600 hover:underline"
            >
              逛全部商品
              <ChevronRight size={12} />
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {products.slice(0, 8).map((p) => {
                const price = p.salePrice ?? p.price
                return (
                  <Link
                    key={p.id}
                    href={p.slug ? `/products/${p.slug}` : '/products'}
                    className="group block"
                  >
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-cream-100 mb-2 relative">
                      {p.imgUrl ? (
                        <Image
                          src={p.imgUrl}
                          alt={p.imgAlt || p.name}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          無圖片
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 line-clamp-2 mb-1">{p.name}</p>
                    {price != null && (
                      <p className="text-sm text-gold-600 font-medium">NT$ {price.toLocaleString()}</p>
                    )}
                  </Link>
                )
              })}
            </div>
            <div className="text-center mt-5">
              <Link
                href={`/products?personalityType=${mbtiType}`}
                className="inline-flex items-center gap-1 text-sm text-gold-600 hover:underline"
              >
                看全部 {mbtiType} 推薦商品
                <ArrowRight size={14} />
              </Link>
            </div>
          </>
        )}
      </section>

      {/* ── footer nav ── */}
      <div className="text-center pt-4">
        <Link
          href="/account"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          ← 回會員中心
        </Link>
      </div>
    </main>
  )
}
