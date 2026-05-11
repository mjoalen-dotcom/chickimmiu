import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  Smartphone, Sparkles, Bell, Gift, ShoppingBag, Zap,
  Apple, Download, CheckCircle2, Star, ChevronRight, QrCode,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '下載 CKMU APP | CHIC KIM & MIU',
  description: '下載 CKMU 韓國服飾 APP — 專屬優惠、新品推播、互動遊戲、訂單追蹤一機掌握。iOS / Android 雙版本。',
  openGraph: {
    title: '下載 CKMU APP',
    description: 'CHIC KIM & MIU 官方 APP — 韓國服飾隨身逛',
    type: 'website',
  },
}

type LooseRecord = Record<string, unknown>

interface AppFeature {
  icon: string
  title: string
  description: string
}

interface AppLinksConfig {
  enabled: boolean
  iosUrl: string
  androidUrl: string
  apkUrl: string
  tagline: string
  subtagline: string
  features: AppFeature[]
  qrCodeImageUrl: string | null
  comingSoonNote: string
}

const FEATURE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Sparkles, Bell, Gift, ShoppingBag, Zap, Smartphone,
}

async function loadAppLinks(): Promise<AppLinksConfig | null> {
  // 包整段 try：dev 環境 PAYLOAD_SECRET 沒設 getPayload init 會 throw，
  // 走 hardcoded fallback 仍能渲染頁面（公開靜態內容、不依賴 CMS）。
  let settings: LooseRecord = {}
  let qrCodeImageUrl: string | null = null
  try {
    const payload = await getPayload({ config })
    try {
      settings = (await payload.findGlobal({ slug: 'global-settings' })) as unknown as LooseRecord
    } catch {
      // global 不存在 — 用空物件走 fallback
    }
    const a0 = (settings.appLinks as LooseRecord | undefined) || {}
    // QR code image upload (relation media) → resolve URL
    if (a0.qrCodeImage && typeof a0.qrCodeImage === 'object') {
      const img = a0.qrCodeImage as LooseRecord
      qrCodeImageUrl = (img.url as string) || (img.thumbnailURL as string) || null
    } else if (typeof a0.qrCodeImage === 'number' || typeof a0.qrCodeImage === 'string') {
      try {
        const m = await payload.findByID({ collection: 'media', id: a0.qrCodeImage as never })
        const md = m as unknown as LooseRecord
        qrCodeImageUrl = (md.url as string) || null
      } catch { /* ignore */ }
    }
  } catch {
    // Payload init 失敗（dev 缺 secret / 連不上 DB）— 用 hardcoded fallback 渲染
  }
  const a = (settings.appLinks as LooseRecord | undefined) || {}
  const enabled = a.enabled !== false
  if (!enabled) return null

  return {
    enabled: true,
    // 2026-05-11 預設 iOS URL fallback：chickimmiu.com 已上架 App Store
    iosUrl: (a.iosUrl as string) || 'https://apps.apple.com/tw/app/ckmu-%E9%9F%93%E5%9C%8B%E6%9C%8D%E9%A3%BE/id6740013272',
    androidUrl: (a.androidUrl as string) || '',
    apkUrl: (a.apkUrl as string) || '',
    tagline: (a.tagline as string) || '下載 CKMU APP，韓國服飾隨身逛',
    subtagline: (a.subtagline as string) || '推播新品、會員專屬優惠、互動遊戲與訂單即時追蹤 — 一機掌握你的韓系衣櫃。',
    features: Array.isArray(a.features) && (a.features as unknown[]).length > 0
      ? (a.features as AppFeature[])
      : [
          { icon: 'Bell', title: '新品推播', description: '限量單品上架第一時間通知，秒搶不再 miss' },
          { icon: 'Gift', title: '會員專屬', description: '專屬會員價、生日禮、APP-only 折扣碼' },
          { icon: 'Sparkles', title: '寶物箱遊戲', description: '每日簽到拿點數，連續登入抽限定商品' },
          { icon: 'ShoppingBag', title: '一鍵下單', description: '收藏夾、地址、發票記住一切，結帳 30 秒搞定' },
          { icon: 'Zap', title: '訂單追蹤', description: '從備貨、出貨到送達即時推播，不再追問客服' },
          { icon: 'Smartphone', title: '離線瀏覽', description: '通勤地下道也能逛 — 商品快取智慧載入' },
        ],
    qrCodeImageUrl,
    comingSoonNote: (a.comingSoonNote as string) || '即將上線',
  }
}

export default async function AppDownloadPage() {
  const cfg = await loadAppLinks()
  if (!cfg) notFound()

  const hasIos = Boolean(cfg.iosUrl)
  const hasAndroid = Boolean(cfg.androidUrl)
  const hasApk = Boolean(cfg.apkUrl)

  return (
    <main className="bg-cream-50">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cream-100 via-white to-gold-50/60 border-b border-cream-200">
        {/* Decorative orbs */}
        <div className="absolute top-20 left-12 w-64 h-64 rounded-full bg-gold-200/30 blur-3xl pointer-events-none" />
        <div className="absolute bottom-12 right-16 w-72 h-72 rounded-full bg-blush-200/30 blur-3xl pointer-events-none" />

        <div className="container relative py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur border border-gold-200/60 text-[10px] tracking-[0.3em] text-gold-600 uppercase mb-5">
                <Smartphone size={12} />
                <span>CHIC KIM &amp; MIU APP</span>
              </div>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif leading-[1.1] mb-5">
                你的<span className="text-gold-600">韓系衣櫃</span>
                <br />
                帶在口袋裡
              </h1>
              <p className="text-base md:text-lg text-foreground/70 leading-relaxed mb-8 max-w-lg">
                {cfg.subtagline}
              </p>

              {/* Store badges */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {hasIos ? (
                  <a
                    href={cfg.iosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-3 px-6 py-3.5 bg-foreground text-cream-50 rounded-2xl hover:bg-foreground/90 transition-all hover:-translate-y-0.5 shadow-md hover:shadow-xl"
                  >
                    <Apple size={28} />
                    <div className="text-left">
                      <div className="text-[10px] opacity-70">下載自</div>
                      <div className="text-base font-semibold">App Store</div>
                    </div>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-3 px-6 py-3.5 bg-cream-200 text-muted-foreground rounded-2xl">
                    <Apple size={28} />
                    <div className="text-left">
                      <div className="text-[10px]">App Store</div>
                      <div className="text-base font-semibold">{cfg.comingSoonNote}</div>
                    </div>
                  </div>
                )}

                {hasAndroid ? (
                  <a
                    href={cfg.androidUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-3 px-6 py-3.5 bg-foreground text-cream-50 rounded-2xl hover:bg-foreground/90 transition-all hover:-translate-y-0.5 shadow-md hover:shadow-xl"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.523 15.341c-.516 0-.937-.421-.937-.937s.421-.937.937-.937.937.421.937.937-.421.937-.937.937m-11.046 0c-.516 0-.937-.421-.937-.937s.421-.937.937-.937.937.421.937.937-.421.937-.937.937m11.382-6.054l1.871-3.241a.39.39 0 0 0-.143-.532.39.39 0 0 0-.532.143l-1.895 3.282a11.69 11.69 0 0 0-4.16-.737c-1.477 0-2.876.265-4.16.737L6.945 5.657a.39.39 0 0 0-.532-.143.39.39 0 0 0-.143.532l1.871 3.241C4.916 11.063 2.997 14.114 2.694 17.7h18.612c-.303-3.586-2.222-6.637-5.447-8.413"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[10px] opacity-70">下載自</div>
                      <div className="text-base font-semibold">Google Play</div>
                    </div>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-3 px-6 py-3.5 bg-cream-200 text-muted-foreground rounded-2xl">
                    <Download size={28} />
                    <div className="text-left">
                      <div className="text-[10px]">Google Play</div>
                      <div className="text-base font-semibold">{cfg.comingSoonNote}</div>
                    </div>
                  </div>
                )}
              </div>

              {hasApk && (
                <a
                  href={cfg.apkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-gold-700 hover:text-gold-800 underline underline-offset-4"
                >
                  <Download size={14} />
                  或下載 APK 安裝檔
                </a>
              )}

              {/* Trust row */}
              <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={12} fill="#d4af37" className="text-gold-500" />
                    ))}
                  </div>
                  <span className="font-medium">4.8</span>
                </div>
                <span>·</span>
                <span>已被 5,000+ 會員下載</span>
              </div>
            </div>

            {/* Right: Phone Mockup */}
            <div className="relative flex justify-center md:justify-end">
              <div className="relative">
                {/* Phone frame */}
                <div className="relative w-[280px] md:w-[320px] aspect-[9/19] bg-foreground rounded-[3rem] p-3 shadow-2xl">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground rounded-b-2xl z-10" />
                  <div className="w-full h-full rounded-[2.5rem] bg-gradient-to-br from-cream-50 to-cream-100 overflow-hidden relative">
                    {/* Mock app UI */}
                    <div className="absolute inset-0 p-5 flex flex-col">
                      <div className="text-center mb-5 pt-4">
                        <p className="text-[8px] tracking-[0.3em] text-gold-600 uppercase">CHIC KIM &amp; MIU</p>
                        <p className="text-lg font-serif mt-1">韓系衣櫃</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-blush-200 to-blush-100" />
                        <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-gold-200 to-gold-100" />
                        <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-cream-200 to-blush-100" />
                        <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-cream-300 to-gold-100" />
                      </div>
                      <div className="mt-auto bg-foreground text-cream-50 text-[10px] text-center py-2 rounded-xl">
                        立即購買 →
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating notification card */}
                <div className="absolute -left-8 top-16 bg-white rounded-2xl shadow-xl px-4 py-3 border border-cream-200 hidden md:flex items-center gap-3 max-w-[200px]">
                  <div className="w-9 h-9 rounded-lg bg-gold-100 flex items-center justify-center text-gold-600 shrink-0">
                    <Bell size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold leading-tight">新品上架</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">韓系針織 限量 30 件</p>
                  </div>
                </div>
                {/* Floating reward card */}
                <div className="absolute -right-6 bottom-24 bg-white rounded-2xl shadow-xl px-4 py-3 border border-cream-200 hidden md:flex items-center gap-3 max-w-[180px]">
                  <div className="w-9 h-9 rounded-lg bg-blush-100 flex items-center justify-center text-rose-500 shrink-0">
                    <Gift size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold leading-tight">+ 50 點</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">今日簽到獎勵</p>
                  </div>
                </div>
              </div>

              {/* QR Code beside phone */}
              {cfg.qrCodeImageUrl && (
                <div className="absolute -bottom-6 left-0 bg-white rounded-2xl p-3 shadow-lg border border-cream-200 hidden lg:block">
                  <Image
                    src={cfg.qrCodeImageUrl}
                    alt="掃描下載 CKMU APP"
                    width={100}
                    height={100}
                    className="rounded-lg"
                  />
                  <p className="text-[10px] text-center text-muted-foreground mt-1">手機掃描下載</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      {cfg.features.length > 0 && (
        <section className="py-16 md:py-24 bg-white">
          <div className="container max-w-6xl">
            <div className="text-center mb-12">
              <p className="text-[10px] tracking-[0.4em] text-gold-500 uppercase mb-3">App Exclusive</p>
              <h2 className="text-2xl md:text-4xl font-serif mb-3">APP 才有的 6 件事</h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
                網頁瀏覽已經很流暢，但 APP 提供的這些功能 — 只在手機上才有
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {cfg.features.map((f, i) => {
                const IconComp = FEATURE_ICON_MAP[f.icon] || Sparkles
                return (
                  <div
                    key={i}
                    className="group bg-gradient-to-br from-cream-50 to-white border border-cream-200 rounded-2xl p-6 hover:shadow-lg hover:border-gold-200 transition-all hover:-translate-y-0.5"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gold-100 group-hover:bg-gold-200 flex items-center justify-center text-gold-700 mb-4 transition-colors">
                      <IconComp size={22} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                    {f.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── How to download ── */}
      <section className="py-16 md:py-24 bg-cream-50 border-y border-cream-200">
        <div className="container max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-[10px] tracking-[0.4em] text-gold-500 uppercase mb-3">3 Steps</p>
            <h2 className="text-2xl md:text-4xl font-serif mb-3">3 步驟開始你的 APP 衣櫃</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', icon: QrCode, title: '掃描下載', desc: '相機掃描頁面上的 QR Code，或點擊 App Store / Google Play 按鈕' },
              { step: '02', icon: CheckCircle2, title: '登入會員', desc: '已是會員？輸入信箱密碼或 LINE 登入即可同步點數與訂單' },
              { step: '03', icon: Sparkles, title: '開始享受', desc: '立即啟用每日簽到獎勵、新品推播、APP 專屬優惠碼' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative bg-white rounded-2xl p-6 border border-cream-200">
                <div className="absolute -top-4 -left-2 text-5xl md:text-6xl font-serif text-gold-200 leading-none select-none">
                  {step}
                </div>
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-foreground text-cream-50 flex items-center justify-center mb-4">
                    <Icon size={18} />
                  </div>
                  <h3 className="text-base font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Web vs APP comparison ── */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-[10px] tracking-[0.4em] text-gold-500 uppercase mb-3">Web vs App</p>
            <h2 className="text-2xl md:text-3xl font-serif mb-3">為什麼還要下載 APP？</h2>
          </div>
          <div className="bg-cream-50 rounded-3xl border border-cream-200 overflow-hidden">
            <div className="grid grid-cols-3 text-sm">
              <div className="px-4 py-4 md:px-6 md:py-5 bg-cream-100 font-medium text-muted-foreground">功能</div>
              <div className="px-4 py-4 md:px-6 md:py-5 bg-cream-100 font-medium text-center text-muted-foreground">網頁版</div>
              <div className="px-4 py-4 md:px-6 md:py-5 bg-gold-100/60 font-medium text-center text-gold-800">APP</div>
              {[
                ['購物與下單', '✓', '✓'],
                ['訂單追蹤', '需登入查看', '推播即時通知'],
                ['每日簽到獎勵', '—', '✓ +點數'],
                ['新品上架推播', '—', '✓ 第一時間'],
                ['APP 專屬優惠碼', '—', '✓'],
                ['互動寶物箱遊戲', '—', '✓'],
                ['離線瀏覽收藏夾', '—', '✓'],
              ].map(([feat, web, app], i) => (
                <div key={feat} className="contents">
                  <div className={`px-4 py-3.5 md:px-6 ${i % 2 === 0 ? 'bg-white' : 'bg-cream-50'}`}>{feat}</div>
                  <div className={`px-4 py-3.5 md:px-6 text-center text-muted-foreground ${i % 2 === 0 ? 'bg-white' : 'bg-cream-50'}`}>{web}</div>
                  <div className={`px-4 py-3.5 md:px-6 text-center font-medium ${app === '✓' || app.startsWith('✓') ? 'text-gold-700' : 'text-muted-foreground'} ${i % 2 === 0 ? 'bg-gold-50/30' : 'bg-gold-50/60'}`}>{app}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="py-12 md:py-16 bg-cream-50 border-t border-cream-200">
        <div className="container max-w-3xl text-center text-sm text-muted-foreground space-y-2">
          <p>已是會員？登入 APP 即可同步點數、購物金、寶物箱所有資料。</p>
          <p className="flex items-center justify-center gap-2 flex-wrap">
            <span>有問題請至</span>
            <Link href="/policy/contact" className="text-gold-700 hover:text-gold-800 underline underline-offset-2 inline-flex items-center gap-1">
              客服中心 <ChevronRight size={12} />
            </Link>
            <span>·</span>
            <Link href="/games/terms" className="text-gold-700 hover:text-gold-800 underline underline-offset-2 inline-flex items-center gap-1">
              遊戲規範 <ChevronRight size={12} />
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
