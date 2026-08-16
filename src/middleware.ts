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
  req: NextRequest,
  slug: string,
): Promise<{ exists: boolean; aliasTarget?: string; debug?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EXISTS_CHECK_TIMEOUT_MS)
  try {
    const url = new URL('/api/products/exists', req.url)
    url.searchParams.set('slug', slug)
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { exists: true, debug: `not-ok:${res.status}:${url.toString()}` }
    const data = (await res.json()) as { exists: boolean; aliasTarget?: string }
    return { ...data, debug: `ok:${url.toString()}` }
  } catch (err) {
    return { exists: true, debug: `catch:${String((err as Error)?.name)}:${String((err as Error)?.message)}` }
  } finally {
    clearTimeout(timer)
  }
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    return adminBasicAuth(req) || NextResponse.next()
  }

  const segments = req.nextUrl.pathname.split('/').filter(Boolean)
  if (segments.length === 2 && segments[0] === 'products') {
    const slug = segments[1]
    let debugInfo = 'checked'
    try {
      const result = await checkProductExists(req, slug)
      debugInfo = JSON.stringify(result)
      if (!result.exists) {
        if (result.aliasTarget) {
          const res = NextResponse.redirect(
            new URL(`/products/${result.aliasTarget}`, req.url),
            308,
          )
          res.headers.set('x-ckmu-mw-debug', debugInfo)
          return res
        }
        const res = NextResponse.rewrite(
          new URL(`/products/__notfound__/${encodeURIComponent(slug)}`, req.url),
        )
        res.headers.set('x-ckmu-mw-debug', `rewrite:${debugInfo}`)
        return res
      }
    } catch (err) {
      debugInfo = `threw:${String((err as Error)?.message || err)}`
    }
    const res = NextResponse.next()
    res.headers.set('x-ckmu-mw-debug', debugInfo)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/products/:path*'],
}
