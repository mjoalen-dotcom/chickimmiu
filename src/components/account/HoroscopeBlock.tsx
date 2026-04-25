'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Briefcase, Heart, Coins, AlertTriangle, Shirt, ArrowRight } from 'lucide-react'

interface ProductRec {
  id: string | number
  name: string
  slug: string
  price: number
  salePrice: number | null
  imageUrl: string | null
}

interface HoroscopeData {
  needsBirthday?: boolean
  sign?: string
  signLabel?: string
  signEmoji?: string
  gender?: 'female' | 'male'
  date?: string
  workFortune?: string
  relationshipFortune?: string
  moneyFortune?: string
  cautionFortune?: string
  outfitAdvice?: string
  luckyColors?: string[]
  styleKeywords?: string[]
  generatedBy?: string
  products?: ProductRec[]
}

const STYLE_KEYWORD_LABEL: Record<string, string> = {
  'jin-live': '金老佛爺直播',
  'jin-style': '金金同款',
  'host-style': '主播同款',
  'brand-custom': '品牌自訂',
  'formal-dresses': '正式洋裝',
  rush: '現貨速到',
  'celebrity-style': '藝人穿搭',
}

function colorSwatchHex(name: string): string | null {
  // 站內 6 個常見 colorName 對 hex；其他名稱回 null（顯示文字 chip）
  const map: Record<string, string> = {
    黑色: '#1a1a1a',
    白色: '#fafafa',
    象牙白: '#f5f0e6',
    粉色: '#f7c6d4',
    磚紅: '#a8453a',
    深海藍: '#2a4a6f',
  }
  return map[name] ?? null
}

export function HoroscopeBlock() {
  const [data, setData] = useState<HoroscopeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/horoscope/today', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as HoroscopeData
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '無法取得運勢')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blush-50 to-cream-100 rounded-2xl p-6 md:p-8 border border-cream-200">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="text-gold-500" size={20} />
          <p className="text-xs tracking-widest text-gold-500">DAILY HOROSCOPE</p>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-cream-200/60 rounded animate-pulse" />
          <div className="h-4 bg-cream-200/60 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-cream-200/60 rounded w-2/3 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return null // 失敗時隱藏整個 block，不要影響主 dashboard
  }

  if (data.needsBirthday) {
    return (
      <div className="bg-gradient-to-br from-blush-50 to-cream-100 rounded-2xl p-6 md:p-8 border border-cream-200">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="text-gold-500" size={20} />
          <p className="text-xs tracking-widest text-gold-500">DAILY HOROSCOPE</p>
        </div>
        <h3 className="text-lg font-serif mb-2">完善資料解鎖每日運勢</h3>
        <p className="text-sm text-foreground/70 leading-relaxed mb-4">
          填寫生日（必填）與出生時間（選填）後，每天進到會員中心都能看到專屬於你的星座運勢與穿搭建議。
        </p>
        <Link
          href="/account/settings"
          className="inline-flex items-center gap-1.5 text-sm text-gold-600 hover:text-gold-700 font-medium"
        >
          前往設定
          <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const fortuneCards = [
    { icon: Briefcase, title: '工作運', text: data.workFortune ?? '', accent: 'text-blue-600' },
    { icon: Heart,     title: '人際關係', text: data.relationshipFortune ?? '', accent: 'text-rose-500' },
    { icon: Coins,     title: '財運',     text: data.moneyFortune ?? '',         accent: 'text-amber-600' },
    { icon: AlertTriangle, title: '注意事項', text: data.cautionFortune ?? '',   accent: 'text-orange-600' },
  ]

  return (
    <div className="bg-gradient-to-br from-blush-50 to-cream-100 rounded-2xl p-6 md:p-8 border border-cream-200">
      {/* 標題列 */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="text-gold-500" size={16} />
            <p className="text-xs tracking-widest text-gold-500">DAILY HOROSCOPE</p>
          </div>
          <h3 className="text-xl font-serif">
            <span className="mr-2">{data.signEmoji}</span>
            {data.signLabel}今日運勢
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{data.date}</p>
        </div>
        {/* 幸運色 swatches */}
        {data.luckyColors && data.luckyColors.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1.5">今日幸運色</p>
            <div className="flex items-center gap-1.5 justify-end">
              {data.luckyColors.map((c) => {
                const hex = colorSwatchHex(c)
                return hex ? (
                  <div
                    key={c}
                    className="w-6 h-6 rounded-full border border-cream-200 shadow-sm"
                    style={{ backgroundColor: hex }}
                    title={c}
                  />
                ) : (
                  <span
                    key={c}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-cream-50 border border-cream-200 text-foreground/70"
                  >
                    {c}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4 運勢卡 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {fortuneCards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.title} className="bg-white/60 rounded-xl p-4 border border-cream-200/60">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} className={c.accent} />
                <p className="text-xs font-medium text-foreground/80">{c.title}</p>
              </div>
              <p className="text-xs text-foreground/70 leading-relaxed">{c.text}</p>
            </div>
          )
        })}
      </div>

      {/* 穿搭建議卡（橫跨整列） */}
      <div className="bg-white/60 rounded-xl p-4 border border-cream-200/60 mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Shirt size={14} className="text-gold-600" />
          <p className="text-xs font-medium text-foreground/80">今日穿搭建議</p>
          {data.gender && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blush-100 text-foreground/60">
              {data.gender === 'male' ? '男士' : '女士'}款
            </span>
          )}
        </div>
        <p className="text-xs text-foreground/70 leading-relaxed">{data.outfitAdvice}</p>

        {/* 商品推薦 */}
        {data.products && data.products.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cream-200/60">
            <p className="text-xs text-muted-foreground mb-2.5">為你挑選</p>
            <div className="grid grid-cols-3 gap-2.5">
              {data.products.map((p) => (
                <Link
                  key={String(p.id)}
                  href={`/products/${p.slug}`}
                  className="group block"
                >
                  <div className="aspect-[3/4] bg-cream-50 rounded-lg overflow-hidden border border-cream-200 mb-2">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-cream-300">
                        <Shirt size={28} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] leading-tight text-foreground/80 line-clamp-2 mb-0.5">
                    {p.name}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    {p.salePrice != null ? (
                      <>
                        <span className="text-[11px] font-medium text-rose-600">
                          NT${p.salePrice.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-through">
                          NT${p.price.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-medium text-foreground/80">
                        NT${p.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 風格關鍵字 + 免責 */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5 flex-wrap">
          {data.styleKeywords && data.styleKeywords.length > 0 && (
            <>
              <span>風格 /</span>
              {data.styleKeywords.map((k) => (
                <span
                  key={k}
                  className="px-1.5 py-0.5 rounded bg-cream-50 border border-cream-200/60 text-foreground/60"
                >
                  {STYLE_KEYWORD_LABEL[k] ?? k}
                </span>
              ))}
            </>
          )}
        </div>
        <span className="italic">僅供娛樂參考，請勿過度依賴運勢做重要決定</span>
      </div>
    </div>
  )
}
