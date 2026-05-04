'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Headphones, Calendar, Clock, Sparkles } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  'new-arrivals': '新貨開箱',
  trends: '韓系趨勢',
  sourcing: '採購故事',
  marketing: '行銷洞察',
  'customer-stories': '客戶故事',
  'brand-story': '品牌故事',
}

const CATEGORY_FILTERS = ['全部', ...Object.values(CATEGORY_LABELS)]

const DEMO_EPISODES = [
  {
    id: 'demo-1',
    slug: 'dongdaemun-2026-structural',
    title: '東大門 2026 結構轉型 — 為什麼夜市批發崩了？',
    episodeNumber: 1,
    excerpt: '32 商城 14 家空置率雙位數、Maxtyle 86%。流量遷到 Sinsang Market + Musinsa。台灣女裝電商面對的 game change。',
    category: 'trends',
    duration: 832,
    publishedAt: '2026-05-04',
    aiGenerated: true,
    coverImage: null,
  },
  {
    id: 'demo-2',
    slug: 'sinsang-market-onboarding',
    title: 'Sinsang Market 開戶實錄：第一次跨境採購 vlog',
    episodeNumber: 2,
    excerpt: '11k 批發商 / 24k 筆/天 / 自動品檢 + 跨境物流一條龍。NT$30-50k 試訂、5-7 天看實效。',
    category: 'sourcing',
    duration: 720,
    publishedAt: '2026-05-11',
    aiGenerated: true,
    coverImage: null,
  },
  {
    id: 'demo-3',
    slug: 'ai-content-stack-30k-saved',
    title: 'AI 替我們省了 NT$80k/月：chickimmiu 工具實戰',
    episodeNumber: 3,
    excerpt: '虛擬模特、AI 庫存、AI 文案翻譯。3 個工具月費 NT$3-7k 替代外包。',
    category: 'marketing',
    duration: 905,
    publishedAt: '2026-05-18',
    aiGenerated: true,
    coverImage: null,
  },
]

interface Props {
  initialEpisodes: Record<string, unknown>[]
}

function formatDuration(secs?: number): string {
  if (!secs || secs < 0) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDate(d?: string): string {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return dt.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return ''
  }
}

export function PodcastListClient({ initialEpisodes }: Props) {
  const episodes = initialEpisodes.length > 0 ? initialEpisodes : DEMO_EPISODES
  const [activeCategory, setActiveCategory] = useState('全部')

  const filtered = useMemo(() => {
    if (activeCategory === '全部') return episodes
    return episodes.filter((e) => CATEGORY_LABELS[e.category as string] === activeCategory)
  }, [episodes, activeCategory])

  const usingDemo = initialEpisodes.length === 0

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-10 md:py-14 text-center">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2 flex items-center justify-center gap-2">
            <Headphones size={14} />
            CHIC KIM & MIU PODCAST
          </p>
          <h1 className="text-3xl md:text-4xl font-serif mb-3">韓系穿衣間</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            東大門採購故事、韓系趨勢洞察、AI 工具實戰、品牌幕後 — 通勤 14 分鐘掌握當週重點
          </p>
          {usingDemo && (
            <p className="text-[10px] text-gold-600/70 mt-4 italic">
              （目前顯示示範集數，正式集數即將上架）
            </p>
          )}
        </div>
      </div>

      <div className="container py-8 md:py-12">
        {/* Category tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto scrollbar-hide">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-foreground text-cream-50'
                  : 'bg-white border border-cream-200 text-foreground/70 hover:border-gold-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Episodes grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((ep) => {
              const cover = ep.coverImage as { url?: string; alt?: string } | null
              const epNum = ep.episodeNumber as number
              const catLabel = CATEGORY_LABELS[ep.category as string] || ''
              return (
                <Link
                  key={ep.id as unknown as string}
                  href={`/podcast/${ep.slug as string}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-cream-200 hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="aspect-square bg-cream-100 relative overflow-hidden">
                    {cover?.url ? (
                      <Image
                        src={cover.url}
                        alt={cover.alt || (ep.title as string)}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gold-100 via-cream-100 to-cream-200 text-gold-700/60">
                        <Headphones size={36} />
                        <p className="text-xs mt-2 tracking-widest">EP{String(epNum).padStart(2, '0')}</p>
                      </div>
                    )}
                    {(ep.aiGenerated as boolean) && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/80 text-cream-50 text-[10px] tracking-wider">
                        <Sparkles size={10} /> AI 生成
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] tracking-widest text-gold-500 uppercase">
                        EP{String(epNum).padStart(2, '0')} · {catLabel}
                      </span>
                    </div>
                    <h3 className="font-serif text-lg leading-snug mb-2 group-hover:text-gold-600 transition-colors">
                      {ep.title as string}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {(ep.excerpt as string) || ''}
                    </p>
                    <div className="mt-auto flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {formatDuration(ep.duration as number | undefined)}
                      </span>
                      {ep.publishedAt ? (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDate(ep.publishedAt as string)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            這個分類目前沒有節目，請選其他分類。
          </div>
        )}
      </div>
    </main>
  )
}
