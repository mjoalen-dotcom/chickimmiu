export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Noto_Sans_TC, Noto_Serif_TC } from 'next/font/google'
import { getPayload } from 'payload'
import config from '@payload-config'
import './globals.css'

import { getMediaUrl } from '@/lib/media-url'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { Providers } from '@/components/layout/Providers'
import { BootBeaconCleanup } from '@/components/layout/BootBeaconCleanup'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { FloatingChatButton } from '@/components/ui/FloatingChatButton'
import { FloatingQuickMenu } from '@/components/ui/FloatingQuickMenu'
import { CookieConsentBanner } from '@/components/ui/CookieConsentBanner'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ExitIntentPopup } from '@/components/recommendation/ExitIntentPopup'
import { GTMScript } from '@/components/tracking/GTMScript'
import { TrackingProvider } from '@/components/tracking/TrackingProvider'
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd'
import { ThemeStyles } from '@/components/layout/ThemeStyles'

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-tc',
  display: 'swap',
})

const notoSerifTC = Noto_Serif_TC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-serif-tc',
  display: 'swap',
})

/* getMediaUrl imported from @/lib/media-url */

/* ── Build metadata from CMS settings ── */
async function getGlobalSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'global-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

async function getNavigationSettings() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    return (await payload.findGlobal({ slug: 'navigation-settings', depth: 1 })) as unknown as Record<string, unknown>
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const settings = await getGlobalSettings()

  const site = (settings?.site || {}) as Record<string, unknown>
  const seo = (settings?.seo || {}) as Record<string, unknown>

  const siteName = (site.siteName as string) || 'CHIC KIM & MIU'
  const defaultTitle = (seo.defaultTitle as string) || 'CHIC KIM & MIU｜韓系質感女裝｜靚秀國際'
  const titleTemplate = (seo.titleTemplate as string) || '%s｜CHIC KIM & MIU'
  const description = (seo.metaDescription as string) || '融合高級極簡優雅與韓系可愛活力的台灣女裝品牌，米白／米杏／金色調，包容性尺碼，打造每一位女性的日常優雅。'
  const keywords = (seo.keywords as string) || '韓系女裝,質感穿搭,韓國女裝,名媛風洋裝,CHIC KIM & MIU'
  const author = (seo.author as string) || 'CHIC KIM & MIU｜靚秀國際有限公司'

  const faviconUrl = getMediaUrl(site.favicon) || '/favicon.ico'
  const appleTouchIconUrl = getMediaUrl(site.appleTouchIcon) || '/apple-touch-icon.png'
  const ogImageUrl = getMediaUrl(site.ogImage) || `${siteUrl}/og-image.png`

  const googleVerification = (seo.googleSiteVerification as string) || undefined
  const bingVerification = (seo.bingSiteVerification as string) || undefined

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: titleTemplate,
    },
    description,
    keywords: keywords.split(',').map((k: string) => k.trim()),
    authors: [{ name: author, url: siteUrl }],
    creator: siteName,
    publisher: siteName,
    applicationName: siteName,
    generator: 'Next.js',
    referrer: 'strict-origin-when-cross-origin',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
      },
    },
    icons: {
      icon: faviconUrl,
      apple: appleTouchIconUrl,
    },
    manifest: '/manifest.webmanifest',
    openGraph: {
      type: 'website',
      locale: 'zh_TW',
      url: siteUrl,
      siteName,
      title: defaultTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: siteUrl,
    },
    verification: {
      google: googleVerification,
      other: {
        ...(bingVerification ? { 'msvalidate.01': bingVerification } : {}),
      },
    },
    category: 'fashion',
    other: {
      'theme-color': '#C19A5B',
      // Chrome 108+ deprecation: prefer the standard mobile-web-app-capable.
      // Keep the Apple-prefixed sibling for older iOS Safari that still reads it.
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
      'apple-mobile-web-app-title': siteName,
      'format-detection': 'telephone=no',
    },
  }
}

export default async function FrontendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [globalSettings, navSettings, currentUser] = await Promise.all([
    getGlobalSettings(),
    getNavigationSettings(),
    getCurrentUser(),
  ])

  const cs = (globalSettings?.customerService || {}) as unknown as Record<string, unknown>
  const cc = (globalSettings?.cookieConsent || {}) as unknown as Record<string, unknown>
  const tracking = (globalSettings?.tracking || {}) as unknown as Record<string, unknown>
  const socialLinks = (globalSettings?.socialLinks || {}) as unknown as Record<string, unknown>
  const businessInfo = (globalSettings?.businessInfo || {}) as unknown as Record<string, unknown>
  const site = (globalSettings?.site || {}) as unknown as Record<string, unknown>

  // Navigation settings
  const announcementBar = (navSettings?.announcementBar || {}) as unknown as Record<string, unknown>
  const mainMenu = (navSettings?.mainMenu || null) as unknown as Array<{ label: string; href: string; children?: Array<{ label: string; href: string }> }> | null
  const footerSections = (navSettings?.footerSections || null) as unknown as Array<{ title: string; links: Array<{ label: string; href: string }> }> | null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const siteName = (site.siteName as string) || 'CHIC KIM & MIU'
  const logoUrl = getMediaUrl(site.logo) || '/images/logo-ckmu.svg'

  // Collect social URLs for Organization schema
  const sameAs: string[] = []
  if (socialLinks.instagram) sameAs.push(socialLinks.instagram as string)
  if (socialLinks.facebook) sameAs.push(socialLinks.facebook as string)
  if (socialLinks.youtube) sameAs.push(socialLinks.youtube as string)
  if (socialLinks.tiktok) sameAs.push(socialLinks.tiktok as string)
  if (socialLinks.line) sameAs.push(socialLinks.line as string)

  return (
    <html lang="zh-Hant-TW" className={`${notoSansTC.variable} ${notoSerifTC.variable}`}>
      <head>
        {/* Active SiteThemes preset → :root CSS variables. Sits at the very
            top of <head> so the rest of the page renders with the right
            tokens; falls back to globals.css :root values when no active
            theme exists. */}
        <ThemeStyles />
        {/* iOS Safari / iPad privacy hardening — MUST run before ANY other JS
            that touches storage. When the user enables "Block All Cookies",
            "Prevent Cross-Site Tracking", Lockdown Mode, or Private Browsing,
            Safari makes window.localStorage / sessionStorage / document.cookie
            / indexedDB throw SecurityError synchronously. Any third-party
            script that touches them (GTM, fbq, GA4, next-auth, zustand)
            crashes the React tree on first mount → blank white screen.

            We use an inline <script dangerouslySetInnerHTML> here on purpose
            (instead of next/script beforeInteractive) because in the App
            Router beforeInteractive does NOT actually load the file before
            chunks — it just adds a <link rel=preload> and queues the script
            in self.__next_s for the Next.js runtime to process AFTER chunks
            execute. An inline script, on the other hand, blocks parsing and
            runs synchronously when the parser hits it, which is guaranteed
            to be before React hydration starts. After execution, every later
            access to localStorage / sessionStorage / cookie / indexedDB
            silently falls back to an in-memory shim instead of throwing.

            We also expose window.__ckmuPriv = { ls, ss, ck, idb } so the
            global-error fallback (and any future debug overlay) can show
            the user which APIs were blocked, without needing devtools on
            their iPad. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d={ls:0,ss:0,ck:0,idb:0,err:''};try{function mk(){var x={},a={getItem:function(k){return Object.prototype.hasOwnProperty.call(x,k)?x[k]:null},setItem:function(k,v){x[k]=String(v)},removeItem:function(k){delete x[k]},clear:function(){x={}},key:function(i){return Object.keys(x)[i]||null}};try{Object.defineProperty(a,'length',{get:function(){return Object.keys(x).length}})}catch(_){a.length=0}return a}var t='__ckmu_priv_probe__';try{window.localStorage.setItem(t,'1');window.localStorage.removeItem(t)}catch(e){d.ls=1;var s=mk();try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return s}})}catch(_){d.ls=2;try{if(typeof Storage!=='undefined'&&Storage.prototype){Storage.prototype.getItem=function(){return null};Storage.prototype.setItem=function(){};Storage.prototype.removeItem=function(){};Storage.prototype.clear=function(){};Storage.prototype.key=function(){return null}}}catch(_){d.ls=3}}}try{window.sessionStorage.setItem(t,'1');window.sessionStorage.removeItem(t)}catch(e){d.ss=1;var s2=mk();try{Object.defineProperty(window,'sessionStorage',{configurable:true,get:function(){return s2}})}catch(_){d.ss=2}}try{var c=document.cookie;void c}catch(e){d.ck=1;try{var mc='';Object.defineProperty(document,'cookie',{configurable:true,get:function(){return mc},set:function(v){mc=String(v).split(';')[0]||''}})}catch(_){d.ck=2}}try{if(window.indexedDB&&window.indexedDB.open){var op=window.indexedDB.open;window.indexedDB.open=function(){try{return op.apply(window.indexedDB,arguments)}catch(e){d.idb=1;var stub={result:null,error:new Error('blocked'),readyState:'done',onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null,addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return false}};setTimeout(function(){if(typeof stub.onerror==='function'){try{stub.onerror({target:stub})}catch(_){}}},0);return stub}}}}catch(_){}}catch(e){d.err=String(e&&e.message||e)}window.__ckmuPriv=d})();`,
          }}
        />
        <GTMScript
          gtmId={(tracking.gtmId as string) || process.env.NEXT_PUBLIC_GTM_ID || null}
          metaPixelId={(tracking.metaPixelId as string) || process.env.NEXT_PUBLIC_META_PIXEL_ID || null}
          ga4Id={(tracking.ga4Id as string) || process.env.NEXT_PUBLIC_GA4_ID || null}
        />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Belt-and-suspenders: stop iPad/Safari from caching HTML so it
            never references stale webpack chunk hashes (white-screen bug). */}
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* Auto-recover from stale chunk loads (#1 cause of cross-device
            white screen): if a JS or CSS chunk fails to load — typically
            because the user has cached HTML from a previous build that
            references chunk hashes that no longer exist — reload the page
            once with cache-busting so they land on the current build.

            Catches four failure modes:
            1. Resource load failures: <script src="/_next/static/chunks/...">
               or <link rel=stylesheet/preload> firing 'error' events
            2. Promise rejections containing "ChunkLoadError", "Loading
               chunk", "Loading CSS chunk", "Failed to fetch dynamically
               imported module", or "Importing a module script failed"
            3. Synchronous errors with the same patterns (some browsers
               throw rather than rejecting promises)
            4. Webpack factory-undefined crashes: "Cannot read properties
               of undefined (reading 'call')" / "Cannot read property
               'call' of undefined" — Phase 5.5.5 addition. When a
               browser-cached non-versioned chunk (e.g. app-pages-internals.js,
               layout.js) holds stale module IDs that don't match the
               refreshed webpack.js runtime, __webpack_require__ tries
               factory.call() on undefined. Classic Next.js dev-mode bug,
               but can also bite prod if a CDN serves stale chunks.

            Cooldown uses a 30-second timestamp window stored in
            sessionStorage so we never reload twice for the same incident,
            but recoveries from genuinely separate page loads (>30s apart)
            are always allowed. If sessionStorage itself is broken we fall
            back to a window-scoped flag so we still avoid loops within
            a single page lifetime. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var KEY='__ckmu_chunk_reload_ts__';var WINDOW_FLAG=false;function inCooldown(){try{var v=sessionStorage.getItem(KEY);if(!v)return false;var t=parseInt(v,10);if(isNaN(t))return false;return((new Date()).getTime()-t)<30000}catch(_){return WINDOW_FLAG}}function setCooldown(){try{sessionStorage.setItem(KEY,String((new Date()).getTime()))}catch(_){WINDOW_FLAG=true}}function recover(reason){try{if(inCooldown())return;setCooldown();try{if(window.console&&console.warn)console.warn('[ckmu-recover]',reason)}catch(_){}var u;try{u=new URL(location.href);u.searchParams.set('_r',(new Date()).getTime().toString(36));location.replace(u.toString())}catch(_){location.reload()}}catch(_){}}function isChunkErr(m){return/ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|reading 'call'|'call' of undefined/i.test(String(m||''))}window.addEventListener('error',function(e){try{var t=e&&e.target;if(t&&(t.tagName==='SCRIPT'||t.tagName==='LINK')){var s=t.src||t.href||'';if(s.indexOf('/_next/static/')>-1){recover('resource: '+s);return}}if(e&&e.message&&isChunkErr(e.message)){recover('error: '+e.message)}}catch(_){}},true);window.addEventListener('unhandledrejection',function(e){try{var r=e&&e.reason;var m=r&&(r.message||String(r))||'';if(isChunkErr(m))recover('rejection: '+m)}catch(_){}})}catch(_){}})();`,
          }}
        />
        {/* Boot beacon error capture — registers BEFORE any other JS runs so
            we catch errors from React hydration, third-party scripts, or
            any vendor chunk that crashes on iPad Safari.

            CRITICAL: The beacon DOM node is created BY THIS SCRIPT (not as
            part of the React tree). React 19 will throw away the SSR HTML
            and client-render from scratch when a hydration error is
            unrecoverable — that would delete a beacon node we put in the
            React tree before our 4-second timer ever fires. By creating
            the beacon imperatively via document.body.appendChild AFTER
            React has had its chance, the beacon is owned by us, not React,
            so React's reconciliation can never destroy it.

            BootBeaconCleanup (mounted via React) sets window.__ckmuMounted = 1
            on successful hydration. The 4-second timer checks that flag
            and bails out if React mounted, otherwise creates and shows
            the beacon.

            PHASE 5.5.6 — gated to production only. In next dev the React
            Refresh / HMR runtime occasionally throws factory-undefined
            TypeErrors from webpack.js (confirmed dev-only per HANDOFF_B5_DIAGNOSIS.md).
            The beacon was firing as a false positive, causing devs to
            think pages were broken when they just needed a Ctrl+Shift+R.
            Gating via process.env.NODE_ENV (inlined at build time by Next.js)
            means dev renders no <script> at all — zero beacon risk, zero
            error-capture runtime cost. Prod unchanged.

            Defense-in-depth: rec() also filters errors sourced from
            /_next/static/chunks/webpack*.js so that if this gate ever
            comes off (or a future build slips into dev mode), webpack
            runtime noise still doesn't pollute __ckmuBootErr. */}
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{window.__ckmuBootErr=[];window.__ckmuMounted=0;window.__ckmuBootStart=(new Date()).getTime();function rec(m,s){try{var ss=String(s||'');if(ss.indexOf('/chunks/webpack-')>-1)return;window.__ckmuBootErr.push({m:String(m||''),s:ss,t:(new Date()).getTime()})}catch(_){}}try{window.addEventListener('error',function(e){try{if(e&&e.message)rec(e.message,(e.filename||'')+':'+(e.lineno||''))}catch(_){}},true)}catch(_){}try{window.addEventListener('unhandledrejection',function(e){try{var r=e&&e.reason;rec(r&&(r.message||r)||'unhandledrejection',r&&r.stack||'')}catch(_){}})}catch(_){}function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}window.__ckmuBootRender=function(){try{if(document.getElementById('__ckmu_boot_beacon__'))return;var d=window.__ckmuPriv||{};var errs=window.__ckmuBootErr||[];var lines=[];lines.push('CKMU 啟動診斷');lines.push('─────────────');lines.push('時間：'+((new Date()).getTime()-window.__ckmuBootStart)+'ms');lines.push('localStorage：'+(d.ls?'阻擋'+d.ls:'OK'));lines.push('sessionStorage：'+(d.ss?'阻擋'+d.ss:'OK'));lines.push('cookie：'+(d.ck?'阻擋'+d.ck:'OK'));lines.push('indexedDB：'+(d.idb?'阻擋'+d.idb:'OK'));lines.push('shim 錯誤：'+(d.err||'無'));lines.push('React mounted：'+(window.__ckmuMounted?'YES':'NO'));lines.push('');var n=errs.length<8?errs.length:8;lines.push('擷取到 '+errs.length+' 個錯誤：');for(var i=0;i<n;i++){lines.push((i+1)+'. '+errs[i].m);if(errs[i].s)lines.push('   @ '+errs[i].s)}lines.push('');var ua=(navigator&&navigator.userAgent)||'';if(ua.length>200)ua=ua.substring(0,200);lines.push('UA: '+ua);var b=document.createElement('div');b.id='__ckmu_boot_beacon__';b.style.position='fixed';b.style.top='0';b.style.left='0';b.style.right='0';b.style.bottom='0';b.style.width='100%';b.style.height='100%';b.style.zIndex='2147483647';b.style.background='#FDF8F3';b.style.overflow='auto';b.style.WebkitOverflowScrolling='touch';var html='<div style="padding:24px;font:13px/1.7 -apple-system,BlinkMacSystemFont,sans-serif;color:#2C2C2C;min-height:100vh;box-sizing:border-box">';html+='<h2 style="margin:0 0 12px;font-size:18px;font-weight:600">頁面載入失敗</h2>';html+='<p style="margin:0 0 16px;color:#6B6B6B">請截圖整頁傳給客服。可前往 <a href="/diag" style="color:#C19A5B">/diag</a> 看更多診斷。</p>';html+='<pre style="background:#fff;border:1px solid #E5DED4;border-radius:8px;padding:12px;margin:0 0 16px;font:11px/1.6 ui-monospace,Menlo,Monaco,Consolas,monospace;white-space:pre-wrap;word-break:break-all">';var pre='';for(var j=0;j<lines.length;j++){pre+=esc(lines[j]);if(j<lines.length-1)pre+='\\n'}html+=pre;html+='</pre>';html+='<div style="text-align:center"><a href="/diag" style="display:inline-block;padding:10px 24px;background:#C19A5B;color:#fff;border-radius:999px;text-decoration:none;font-size:13px">前往診斷頁</a></div>';html+='</div>';b.innerHTML=html;function appendBeacon(){try{if(document.body&&!document.getElementById('__ckmu_boot_beacon__'))document.body.appendChild(b)}catch(_){}}if(document.body){appendBeacon()}else{try{document.addEventListener('DOMContentLoaded',appendBeacon)}catch(_){}}}catch(_){}};try{setTimeout(function(){try{if(!window.__ckmuMounted)window.__ckmuBootRender()}catch(_){}},4000)}catch(_){}}catch(_){}})();`,
            }}
          />
        )}
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>
          <BootBeaconCleanup />
          {/* Previously this subtree was wrapped in <Suspense fallback={null}>
              because TrackingProvider calls useSearchParams() and the comment
              claimed the boundary "contains the CSR bailout to just the
              tracking subtree".
              Removed (2026-04-19) — that boundary was the root cause of
              /cart and /checkout staying stuck on "購物車是空的" even when
              localStorage had items. In Next.js 15.5 + React 19 streaming
              SSR the boundary's content was streamed into a <div id="S:0">
              and the matching <template id="B:0">, but $RC() never fired on
              the client (window.$RB.length stayed at 2 forever). The whole
              wrapped subtree (Navbar + main + Footer) had no React fiber
              attached, so the cart store's rehydrate setState never
              triggered a re-render of CheckoutPage and the empty-cart UI
              stayed frozen. Floating UI outside the boundary hydrated
              fine, which is why the bug looked cart-specific.
              The CSR-bailout concern from useSearchParams is moot here:
              this layout already declares `dynamic = 'force-dynamic'` at
              the top, so there's nothing to bail out from. */}
            <TrackingProvider>
            {/* Global JSON-LD */}
            <OrganizationJsonLd
              name={siteName}
              legalName={(businessInfo.legalName as string) || '靚秀國際有限公司'}
              url={siteUrl}
              logo={`${siteUrl}${logoUrl}`}
              phone={(businessInfo.phone as string) || undefined}
              email={(businessInfo.email as string) || undefined}
              address={(businessInfo.address as string) || undefined}
              sameAs={sameAs}
            />
            <WebSiteJsonLd
              name={siteName}
              url={siteUrl}
            />

            <Navbar
              announcementText={(announcementBar.enabled !== false && announcementBar.text) ? (announcementBar.text as string) : undefined}
              announcementLink={announcementBar.link as string | undefined}
              announcementStyle={(announcementBar.style as string) || 'default'}
              menuItems={mainMenu || undefined}
              logoUrl={logoUrl}
              currentUser={currentUser}
            />
            <div className="min-h-screen">{children}</div>
            <Footer
              businessInfo={{
                legalName: (businessInfo.legalName as string) || '靚秀國際有限公司',
                taxId: (businessInfo.taxId as string) || '24540533',
                phone: (businessInfo.phone as string) || '02-2718-9488',
                email: (businessInfo.email as string) || undefined,
                address: (businessInfo.address as string) || '台北市基隆路一段68號9樓',
                businessHours: (businessInfo.businessHours as string) || '週一至週五 09:30-18:00',
              }}
              socialLinks={{
                instagram: (socialLinks.instagram as string) || undefined,
                facebook: (socialLinks.facebook as string) || undefined,
                line: (socialLinks.line as string) || undefined,
              }}
              footerSections={footerSections || undefined}
            />
            </TrackingProvider>

          <CartDrawer />
          <ExitIntentPopup />
          <FloatingQuickMenu />
          <FloatingChatButton
            lineOaUrl={cs.lineOaUrl as string | undefined}
            metaPageId={cs.metaPageId as string | undefined}
            enableLine={(cs.enableLineWidget as boolean) ?? true}
            enableMessenger={(cs.enableMessenger as boolean) ?? true}
          />
          <CookieConsentBanner
            enabled={(cc.enabled as boolean) ?? true}
            bannerText={cc.bannerText as string | undefined}
            privacyPolicyUrl={cc.privacyPolicyUrl as string | undefined}
            acceptButtonText={cc.acceptButtonText as string | undefined}
          />
        </Providers>
      </body>
    </html>
  )
}
