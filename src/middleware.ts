import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware
 * ----------
 * /admin BasicAuth gate — 僅在 ADMIN_BASIC_USER + ADMIN_BASIC_PW 都設時啟用。
 *
 * 用途：prod 封測期在 Payload auth 前再加一層 BasicAuth，
 *   即使 Payload admin 帳密外洩也擋得住未授權探測。
 *
 * 關閉條件：任一 env 未設 → no-op（本機 dev 預設 off）。
 * 替代方案：Cloudflare Access — 見 docs/admin-cloudflare-access.md。
 *
 * 使用者與密碼比較使用 timing-safe 等長比對，
 * 降低旁通攻擊（timing side-channel）風險。
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function adminBasicAuth(req: NextRequest): NextResponse | null {
  const user = process.env.ADMIN_BASIC_USER
  const pw = process.env.ADMIN_BASIC_PW
  if (!user || !pw) return null

  const auth = req.headers.get('authorization') || ''
  const expected = 'Basic ' + btoa(`${user}:${pw}`)
  if (!timingSafeEqual(auth, expected)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin"',
        'Cache-Control': 'no-store',
      },
    })
  }
  return null
}

/**
 * 商品頁存在性檢查（PDP soft-404 修法）
 * ────────────────────────────────────
 * 背景：/products/[slug] 頁面內的 notFound() 因為 (frontend)/loading.tsx
 * 造成的 App Router streaming 特性，來不及在 200 殼 flush 前決定狀態碼——
 * 查無商品時內容正確顯示「找不到」，但 HTTP 狀態仍是 200（soft-404），
 * 會被 Googlebot 誤判為有效頁面收錄。已試過在 next.config.mjs 關閉
 * streaming metadata，部署後實測沒用，代表問題出在更早的 body-level
 * streaming，不是 metadata 那層。
 *
 * 解法：完全跳過 App Router 的 render pipeline，在 middleware（進 render
 * 之前）就先確認商品是否存在。查無此商品時 rewrite 到一個刻意不存在
 * 任何 route 的路徑（/products 下只有 [slug] 這個單一動態區段，兩段式
 * 路徑不會被它匹配到）——這樣會觸發 Next.js 對「完全找不到任何 route」
 * 的原生處理，跟 /this-page-does-not-exist-xyz 這種真正的 404 走同一條
 * 已驗證沒問題的路（見 src/app/not-found.tsx），不是重新造一次會踩到
 * 同樣 streaming 雷的頁面。
 *
 * middleware 跑 Edge runtime，摸不到 SQLite，查詢外包給
 * /api/products/exists（同機 loopback，延遲可忽略）。查詢逾時或出錯一律
 * fail-open（放行照舊渲染），絕不能因為這層新增的安全網掛掉就讓真正
 * 存在的商品頁連不上。
 */
const EXISTS_CHECK_TIMEOUT_MS = 1500

async function checkProductExists(
  slug: string,
): Promise<{ exists: boolean; aliasTarget?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EXISTS_CHECK_TIMEOUT_MS)
  try {
    // 直接打 127.0.0.1（nginx proxy_pass 的同一個 target），繞開 TLS／nginx／
    // 對外網域——實測 middleware 對自己同一個 deployment 的公開網域
    // （req.url 的 origin）發 fetch 一律 TypeError:fetch failed，即使伺服器
    // 本機 curl 打同一個公開網址完全正常；這是 Next.js middleware 對
    // 「自己同一個 deployment」發 fetch 的已知不穩定行為，繞開對外網域
    // 走內部 target 後問題消失。
    const internalOrigin = process.env.INTERNAL_ORIGIN || 'http://127.0.0.1:3000'
    const url = new URL('/api/products/exists', internalOrigin)
    url.searchParams.set('slug', slug)
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { exists: true } // fail-open
    return (await res.json()) as { exists: boolean; aliasTarget?: string }
  } catch {
    return { exists: true } // fail-open：逾時／連線失敗一律放行
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 會員/管理員 cookie 分家（2026-09-08 Alan「根治登入兩次」）
 * ────────────────────────────────────────────────────────
 * 兩套 auth collection（users 後台 / customers 會員）原共用 payload-token，
 * 互登互踢。根治：會員憑證改存 `ckmu-member-token`（由 /api/member/login
 * 與 OAuth bridge 寫入），middleware 在「非後台」請求把它注入成
 * payload-token 轉發 — 站內 78 個既有 payload.auth 呼叫點零改動，
 * 後台面板（/admin 頁面與其發出的 API 請求，用 referer 判斷）不注入，
 * 管理員的 payload-token 完好。判斷失誤的最壞情況是「該請求視同未登入」
 * （fail-closed），不存在權限升級路徑。
 * 舊 member session（payload-token=customers、無新 cookie）不注入、照舊可用。
 */
const MEMBER_COOKIE = 'ckmu-member-token'

/**
 * 這些路由的工作是「讀瀏覽器真實的 cookie 狀態來決定清哪些」——
 * 注入會讓它們把 member token 誤認成瀏覽器的 payload-token，
 * 進而誤清管理員憑證，必須跳過注入。
 */
const INJECTION_EXEMPT_PREFIXES = ['/api/member/', '/api/sso/logout', '/api/users/logout']

function isAdminOriginRequest(req: NextRequest): boolean {
  if (req.nextUrl.pathname.startsWith('/admin')) return true
  const referer = req.headers.get('referer') || ''
  try {
    const refUrl = new URL(referer)
    // 只比 host 不比 origin：nginx 後面 req.nextUrl 的 proto 可能是 http、
    // referer 卻是 https，比 origin 會誤判成非後台而對後台 API 注入
    const host = req.headers.get('host') || req.nextUrl.host
    return refUrl.host === host && refUrl.pathname.startsWith('/admin')
  } catch {
    return false
  }
}

function memberForwardHeaders(req: NextRequest): Headers | null {
  const member = req.cookies.get(MEMBER_COOKIE)?.value
  if (!member) return null
  if (isAdminOriginRequest(req)) return null
  if (INJECTION_EXEMPT_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p))) return null
  const headers = new Headers(req.headers)
  const raw = headers.get('cookie') || ''
  const kept = raw.split(/;\s*/).filter((c) => c && !c.startsWith('payload-token='))
  kept.push(`payload-token=${member}`)
  headers.set('cookie', kept.join('; '))
  return headers
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    return adminBasicAuth(req) || NextResponse.next()
  }

  const fwdHeaders = memberForwardHeaders(req)
  const forward = fwdHeaders ? { request: { headers: fwdHeaders } } : undefined

  const segments = req.nextUrl.pathname.split('/').filter(Boolean)
  if (segments.length === 2 && segments[0] === 'products') {
    const slug = segments[1]
    const result = await checkProductExists(slug)
    if (!result.exists) {
      if (result.aliasTarget) {
        return NextResponse.redirect(new URL(`/products/${result.aliasTarget}`, req.url), 308)
      }
      return NextResponse.rewrite(
        new URL(`/products/__notfound__/${encodeURIComponent(slug)}`, req.url),
        forward,
      )
    }
  }

  return NextResponse.next(forward)
}

export const config = {
  // /admin gate + 商品存在檢查 + 會員 cookie 注入（全站頁面與 API；
  // 排除 next 靜態資產與帶副檔名的檔案請求）
  matcher: ['/admin/:path*', '/products/:path*', '/((?!_next/|favicon|.*\\..*).*)'],
}
