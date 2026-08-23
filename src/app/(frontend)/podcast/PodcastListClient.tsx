'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Headphones, Calendar, Clock, Sparkles, Play, Mic, Instagram, ArrowRight } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  'new-arrivals': '新貨開箱',
  trends: '韓系趨勢',
  sourcing: '採購故事',
  marketing: '行銷洞察',
  'customer-stories': '客戶故事',
  'brand-story': '品牌故事',
}

const CATEGORY_FILTERS = ['全部', ...Object.values(CATEGORY_LABELS)]

// Subscribe platforms — 用 search/結果頁 fallback，admin 之後可在 PodcastSettings 接管。
const SUBSCRIBE_PLATFORMS = [
  {
    name: 'Apple Podcasts',
    url: 'https://podcasts.apple.com/tw/search?term=chic+kim+miu',
    bg: 'bg-[#7e44d6]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M11.999 1c5.522 0 9.999 4.477 9.999 9.999s-4.477 10-9.999 10-10-4.478-10-10S6.477 1 11.999 1zm0 5.5c-2.485 0-4.5 2.014-4.5 4.499s2.015 4.5 4.5 4.5c2.486 0 4.5-2.015 4.5-4.5S14.485 6.5 11.999 6.5zm0 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-.001 6c1.105 0 2 .671 2 1.5v2.5a2 2 0 11-4 0V17c0-.829.895-1.5 2-1.5z"/></svg>
    ),
  },
  {
    name: 'Spotify',
    url: 'https://open.spotify.com/search/chic%20kim%20miu',
    bg: 'bg-[#1DB954]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.94-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.342 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>
    ),
  },
  {
    name: 'KKBOX',
    url: 'https://www.kkbox.com/tw/tc/podcast/search?q=chic+kim+miu',
    bg: 'bg-[#00d8a1]',
    icon: <Headphones className="w-4 h-4" />,
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/@CKMU_',
    bg: 'bg-[#ff0000]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    ),
  },
]

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
  // 2026-08-23 修：不再 fallback DEMO_EPISODES — 後台刪光節目時前台曾顯示
  // 3 集假資料，看起來像「刪除沒同步」。空清單就老實顯示空狀態。
  const episodes = initialEpisodes
  const [activeCategory, setActiveCategory] = useState('全部')

  const filtered = useMemo(() => {
    if (activeCategory === '全部') return episodes
    return episodes.filter((e) => CATEGORY_LABELS[e.category as string] === activeCategory)
  }, [episodes, activeCategory])

  const usingDemo = initialEpisodes.length === 0
  const [latest, ...others] = filtered

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-foreground via-[#3a3530] to-foreground text-cream-50 border-b border-cream-200">
        {/* Vinyl-disc decoration */}
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full border-[40px] border-cream-50/5 pointer-events-none" />
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full border-[20px] border-gold-500/10 pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-80 h-80 rounded-full bg-gold-500/5 blur-3xl pointer-events-none" />

        <div className="container relative py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur border border-gold-400/30 text-[10px] tracking-[0.3em] text-gold-400 uppercase mb-5">
              <Mic size={12} />
              <span>CHIC KIM &amp; MIU Podcast</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif leading-tight mb-5">
              韓系<span className="text-gold-400">穿衣間</span>
            </h1>
            <p className="text-base md:text-lg text-cream-200/80 leading-relaxed max-w-2xl mb-7">
              東大門採購故事 · 韓系趨勢洞察 · AI 工具實戰 · 品牌幕後
              <br />
              <span className="text-cream-300/70">通勤 14 分鐘，掌握當週重點。</span>
            </p>

            {/* Subscribe chips */}
            <div className="flex flex-wrap gap-2.5">
              <span className="text-[10px] tracking-[0.3em] text-gold-400/80 self-center mr-2">SUBSCRIBE</span>
              {SUBSCRIBE_PLATFORMS.map((p) => (
                <a
                  key={p.name}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${p.bg} text-white inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium hover:opacity-90 transition-opacity shadow-md`}
                >
                  {p.icon}
                  {p.name}
                </a>
              ))}
            </div>

            {usingDemo && (
              <p className="text-[11px] text-gold-400/60 mt-6 italic">
                目前顯示示範集數，正式集數即將上架
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="container py-10 md:py-14">
        {/* ── Latest Episode Spotlight ── */}
        {latest && (
          <Link
            href={`/podcast/${latest.slug as string}`}
            className="group block mb-12 bg-gradient-to-br from-white to-cream-100 rounded-3xl overflow-hidden border border-cream-200 hover:shadow-2xl transition-all duration-300"
          >
            <div className="grid md:grid-cols-5 gap-0">
              <div className="md:col-span-2 aspect-square md:aspect-auto relative bg-gradient-to-br from-gold-200 via-blush-100 to-cream-200 overflow-hidden">
                {(latest.coverImage as { url?: string } | null)?.url ? (
                  <Image
                    src={(latest.coverImage as { url?: string }).url!}
                    alt={latest.title as string}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 40vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gold-800/40">
                    <Headphones size={56} className="mb-3" />
                    <p className="text-xs tracking-[0.3em]">EP{String(latest.episodeNumber as number).padStart(2, '0')}</p>
                  </div>
                )}
                {/* Play overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 group-hover:bg-foreground/20 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-white text-foreground flex items-center justify-center shadow-2xl translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </div>
                </div>
                <span className="absolute top-5 left-5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-foreground/85 backdrop-blur text-cream-50 text-[10px] tracking-[0.2em]">
                  <Sparkles size={10} /> LATEST
                </span>
              </div>
              <div className="md:col-span-3 p-6 md:p-10 lg:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] tracking-widest text-gold-500 uppercase">
                    EP{String(latest.episodeNumber as number).padStart(2, '0')} · {CATEGORY_LABELS[latest.category as string] || ''}
                  </span>
                  {(latest.aiGenerated as boolean) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/70 text-[10px]">
                      <Sparkles size={10} /> AI 生成
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-serif leading-tight mb-4 group-hover:text-gold-700 transition-colors">
                  {latest.title as string}
                </h2>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-3 mb-6">
                  {(latest.excerpt as string) || ''}
                </p>
                <div className="flex items-center gap-5 text-xs text-muted-foreground mb-6">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} />
                    {formatDuration(latest.duration as number)}
                  </span>
                  {latest.publishedAt ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {formatDate(latest.publishedAt as string)}
                    </span>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-2 text-sm text-gold-600 font-medium group-hover:gap-3 transition-all">
                  立即收聽 <ArrowRight size={16} />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* Category tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto scrollbar-hide">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-foreground text-cream-50 shadow-md'
                  : 'bg-white border border-cream-200 text-foreground/70 hover:border-gold-400 hover:text-gold-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Episodes grid */}
        {others.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {others.map((ep) => {
              const cover = ep.coverImage as { url?: string; alt?: string } | null
              const epNum = ep.episodeNumber as number
              const catLabel = CATEGORY_LABELS[ep.category as string] || ''
              return (
                <Link
                  key={ep.id as unknown as string}
                  href={`/podcast/${ep.slug as string}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-cream-200 hover:shadow-lg hover:border-gold-200 transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-square bg-gradient-to-br from-gold-100 via-cream-100 to-blush-100 relative overflow-hidden">
                    {cover?.url ? (
                      <Image
                        src={cover.url}
                        alt={cover.alt || (ep.title as string)}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gold-700/50">
                        <Headphones size={40} />
                        <p className="text-xs mt-2 tracking-[0.3em]">EP{String(epNum).padStart(2, '0')}</p>
                      </div>
                    )}
                    {/* Play hover */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/95 text-foreground flex items-center justify-center shadow-xl scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all">
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      </div>
                    </div>
                    {(ep.aiGenerated as boolean) && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/85 backdrop-blur text-cream-50 text-[10px] tracking-wider">
                        <Sparkles size={10} /> AI
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <span className="text-[10px] tracking-widest text-gold-500 uppercase mb-2">
                      EP{String(epNum).padStart(2, '0')} · {catLabel}
                    </span>
                    <h3 className="font-serif text-lg leading-snug mb-2 group-hover:text-gold-600 transition-colors line-clamp-2">
                      {ep.title as string}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                      {(ep.excerpt as string) || ''}
                    </p>
                    <div className="mt-auto flex items-center gap-4 text-[11px] text-muted-foreground pt-3 border-t border-cream-100">
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
          !latest && (
            <div className="text-center py-16 bg-white rounded-2xl border border-cream-200">
              <Headphones size={36} className="mx-auto text-cream-300 mb-3" />
              <p className="text-muted-foreground">這個分類目前沒有節目</p>
            </div>
          )
        )}

        {/* ── Host Bio ── */}
        <section className="mt-16 md:mt-24 bg-white rounded-3xl border border-cream-200 overflow-hidden">
          <div className="grid md:grid-cols-5 gap-0">
            <div className="md:col-span-2 bg-gradient-to-br from-gold-100 via-cream-100 to-blush-100 p-8 md:p-12 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-foreground to-[#3a3530] text-cream-50 flex items-center justify-center mb-4">
                <span className="text-3xl md:text-4xl font-serif">金</span>
              </div>
              <p className="text-base md:text-lg font-serif">金老佛爺</p>
              <p className="text-xs text-muted-foreground mt-1">主持人 · 主理人</p>
              <a
                href="https://www.instagram.com/kimlafayette/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-cream-50 text-xs hover:bg-foreground/90 transition-colors"
              >
                <Instagram size={12} /> @kimlafayette
              </a>
            </div>
            <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
              <p className="text-[10px] tracking-[0.4em] text-gold-500 uppercase mb-3">About The Host</p>
              <h3 className="text-xl md:text-2xl font-serif mb-4">關於主持人</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3">
                CHIC KIM &amp; MIU 主理人，10 年以上韓國服飾選品經驗。從東大門夜市批發到 Sinsang Market 跨境採購，
                親自走訪上百個品牌與供應商。
              </p>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
                Podcast 每集 12-18 分鐘，分享第一線採購故事、韓系時尚產業洞察、品牌經營的真實困境與解法。
                適合想更懂韓系時尚、想學跨境經營、或單純喜歡聽行業故事的聽眾。
              </p>
              <div className="flex flex-wrap gap-2">
                {['韓系時尚', '東大門', '電商實戰', 'AI 工具', '品牌經營'].map((tag) => (
                  <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full bg-cream-50 border border-cream-200 text-xs text-foreground/70">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
