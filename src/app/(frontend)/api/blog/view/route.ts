/**
 * POST /api/blog/view — 部落格文章閱讀次數 +1
 *
 * 由 <BlogViewBeacon /> 在使用者「真的讀了一段時間」之後才呼叫，不是一開頁就打，
 * 所以計到的是閱讀而不是曝光（爬蟲與秒退的跳出不會計入）。
 *
 * 不做的事：
 *  - 不寫任何識別碼、不設 cookie、不碰 client 端儲存。去重完全在伺服器端用
 *    記憶體桶做（key = IP + slug），所以這支端點不蒐集個資、也不需要 cookie 同意，
 *    這是刻意跟 /api/behavior/track 分開的原因——那支被 cookie consent 擋著，
 *    沒同意的訪客一律不記錄，拿來當閱讀次數會嚴重低估。
 *  - 不回傳目前計數（避免被當成可枚舉的資料端點）。
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse, type NextRequest } from 'next/server'

import {
  extractBlogSlug,
  incrementBlogViewCount,
  shouldCountView,
} from '@/lib/blog/viewCount'
import { checkRateLimit, clientIpForRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const ip = clientIpForRateLimit(request)

  // 粗限流：擋住有人拿這支端點當計數器猛刷。與下面的去重是兩件事。
  if (!checkRateLimit(`blogview-ip:${ip}`, 60, 60_000).allowed) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  let slug: string | null = null
  try {
    const body = (await request.json()) as { slug?: unknown; path?: unknown }
    if (typeof body.slug === 'string') {
      slug = extractBlogSlug(`/blog/${body.slug}`)
    } else if (typeof body.path === 'string') {
      slug = extractBlogSlug(body.path)
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (!slug) {
    return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 })
  }

  // 去重：同一 IP 同一篇，視窗內只計一次。回 200 而不是 429——對呼叫端來說
  // 「已經計過了」是正常結果，不是錯誤。
  if (!shouldCountView(`${ip}:${slug}`)) {
    return NextResponse.json({ ok: true, counted: false }, { status: 200 })
  }

  try {
    const payload = await getPayload({ config })
    const hit = await incrementBlogViewCount(payload, slug)
    return NextResponse.json({ ok: true, counted: hit }, { status: 200 })
  } catch (err) {
    // 閱讀次數失敗絕不影響閱讀體驗，但要留下 log（這個欄位長期沒人動過，
    // 靜默失敗會讓它看起來又「沒計入真實反應」）。
    console.error('[blog/view] increment failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })
  }
}
