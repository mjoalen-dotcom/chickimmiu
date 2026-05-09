import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@payload-config'

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

async function loadAppLinks(): Promise<AppLinksConfig | null> {
  const payload = await getPayload({ config })
  let settings: LooseRecord
  try {
    settings = (await payload.findGlobal({ slug: 'global-settings' })) as unknown as LooseRecord
  } catch {
    return null
  }
  const a = (settings.appLinks as LooseRecord | undefined) || {}
  const enabled = a.enabled !== false
  if (!enabled) return null

  // QR code image upload (relation media) → resolve URL
  let qrCodeImageUrl: string | null = null
  if (a.qrCodeImage && typeof a.qrCodeImage === 'object') {
    const img = a.qrCodeImage as LooseRecord
    qrCodeImageUrl = (img.url as string) || (img.thumbnailURL as string) || null
  } else if (typeof a.qrCodeImage === 'number' || typeof a.qrCodeImage === 'string') {
    try {
      const m = await payload.findByID({ collection: 'media', id: a.qrCodeImage as never })
      const md = m as unknown as LooseRecord
      qrCodeImageUrl = (md.url as string) || null
    } catch { /* ignore */ }
  }

  return {
    enabled: true,
    iosUrl: (a.iosUrl as string) || '',
    androidUrl: (a.androidUrl as string) || '',
    apkUrl: (a.apkUrl as string) || '',
    tagline: (a.tagline as string) || '下載 CKMU APP，韓國服飾隨身逛',
    subtagline: (a.subtagline as string) || '',
    features: Array.isArray(a.features) ? (a.features as AppFeature[]) : [],
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
    <main className="min-h-screen bg-gradient-to-br from-cream-50 via-white to-gold-50">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <p className="text-xs tracking-[0.4em] text-gold-600 mb-3">CHIC KIM &amp; MIU APP</p>
        <h1 className="text-3xl md:text-5xl font-serif mb-5 leading-tight">{cfg.tagline}</h1>
        {cfg.subtagline && (
          <p className="max-w-2xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed">
            {cfg.subtagline}
          </p>
        )}

        {/* Store badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {/* iOS */}
          {hasIos ? (
            <a
              href={cfg.iosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 px-5 py-3 bg-black text-white rounded-2xl hover:bg-neutral-800 transition-colors min-w-[180px]"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px] opacity-80">下載自</div>
                <div className="text-sm font-semibold">App Store</div>
              </div>
            </a>
          ) : (
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-cream-200 text-muted-foreground rounded-2xl min-w-[180px]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px]">App Store</div>
                <div className="text-sm font-semibold">{cfg.comingSoonNote}</div>
              </div>
            </div>
          )}

          {/* Android */}
          {hasAndroid ? (
            <a
              href={cfg.androidUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 px-5 py-3 bg-black text-white rounded-2xl hover:bg-neutral-800 transition-colors min-w-[180px]"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 20.5V3.5c0-.31.26-.61.59-.83L13.55 12l-9.96 9.33c-.33-.22-.59-.51-.59-.83zm10.81-7.74l2.91 2.91-9.93 5.66 7.02-8.57zm-7.02-8.57l9.93 5.66-2.91 2.91-7.02-8.57zm10.95 6.7l3.07 1.75c.5.28.5.97 0 1.25l-3.07 1.75-3.06-3.13 3.06-3.62z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px] opacity-80">下載自</div>
                <div className="text-sm font-semibold">Google Play</div>
              </div>
            </a>
          ) : (
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-cream-200 text-muted-foreground rounded-2xl min-w-[180px]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 20.5V3.5c0-.31.26-.61.59-.83L13.55 12l-9.96 9.33c-.33-.22-.59-.51-.59-.83zm10.81-7.74l2.91 2.91-9.93 5.66 7.02-8.57zm-7.02-8.57l9.93 5.66-2.91 2.91-7.02-8.57zm10.95 6.7l3.07 1.75c.5.28.5.97 0 1.25l-3.07 1.75-3.06-3.13 3.06-3.62z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px]">Google Play</div>
                <div className="text-sm font-semibold">{cfg.comingSoonNote}</div>
              </div>
            </div>
          )}

          {hasApk && (
            <a
              href={cfg.apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 border border-cream-300 rounded-2xl text-sm hover:bg-cream-50 transition-colors"
            >
              <span>📦</span>
              <span>下載 APK 安裝檔</span>
            </a>
          )}
        </div>

        {/* QR Code */}
        {cfg.qrCodeImageUrl && (
          <div className="mt-10 inline-block bg-white rounded-2xl p-4 shadow-md border border-cream-200">
            <Image
              src={cfg.qrCodeImageUrl}
              alt="掃描下載 CKMU APP"
              width={200}
              height={200}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">手機相機掃描下載</p>
          </div>
        )}
      </section>

      {/* Features */}
      {cfg.features.length > 0 && (
        <section className="bg-white border-y border-cream-200 py-12">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-center text-xl md:text-2xl font-serif mb-2">APP 獨家功能</h2>
            <p className="text-center text-sm text-muted-foreground mb-8">桌機網站體驗已豐富，APP 還有這些只在手機上才有的功能</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cfg.features.map((f, i) => (
                <div
                  key={i}
                  className="bg-cream-50 border border-cream-200 rounded-2xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-2">{f.icon}</div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  {f.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <section className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-muted-foreground">
        <p className="mb-2">已是會員？登入 APP 即可同步點數、購物金、寶物箱所有資料。</p>
        <p>
          有問題請至{' '}
          <a href="/policy/contact" className="text-gold-600 underline">客服中心</a>{' '}
          ｜ APP 串接技術文件請見{' '}
          <a href="/games/terms" className="text-gold-600 underline">遊戲規範與獎項公示</a>
        </p>
      </section>
    </main>
  )
}
