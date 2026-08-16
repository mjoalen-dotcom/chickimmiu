import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/products/exists?slug=xxx
 * ──────────────────────────────────
 * 給 middleware 用的輕量存在性檢查（PDP soft-404 修法的一部分）。
 * middleware 跑在 Edge runtime，沒有 Node.js 檔案系統存取能力，摸不到
 * SQLite，所以查詢動作外包給這支普通 Node.js runtime 的 route handler。
 * 自架主機上 middleware → 這支 route 是同機 loopback，不是真正跨區的
 * edge 網路呼叫，延遲可忽略。
 *
 * 只回傳「找不找得到」與（找不到時）別名對應的正確 slug，不回傳商品完整資料
 * ——避免把這支輕量檢查端點變成另一個完整商品資料外洩面。
 *
 * select 只取 id/slug 兩欄，limit 1、depth 0，把查詢成本壓到最低（跟
 * products/[slug]/page.tsx 自己的 findProductBySlug／findAliasTarget
 * 邏輯一致，只是精簡到只回是否存在）。
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ exists: false }, { status: 400 })
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    decoded = slug
  }
  const candidates = Array.from(new Set([slug, decoded]))

  try {
    const payload = await getPayload({ config })

    for (const cand of candidates) {
      const { docs } = await payload.find({
        collection: 'products',
        where: { slug: { equals: cand } },
        limit: 1,
        depth: 0,
        select: { slug: true },
      })
      if (docs[0]) {
        return NextResponse.json(
          { exists: true },
          { headers: { 'Cache-Control': 'private, max-age=30' } },
        )
      }
    }

    for (const cand of candidates) {
      const { docs } = await payload.find({
        collection: 'products',
        where: { 'aliasSlugs.slug': { equals: cand } },
        limit: 1,
        depth: 0,
        select: { slug: true },
      })
      const match = docs[0] as { slug?: string } | undefined
      if (match?.slug && match.slug !== cand) {
        return NextResponse.json(
          { exists: false, aliasTarget: match.slug },
          { headers: { 'Cache-Control': 'private, max-age=30' } },
        )
      }
    }

    return NextResponse.json(
      { exists: false },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    )
  } catch (err) {
    // 查詢本身出錯：fail-open（回 exists:true），讓 middleware 放行走原本
    // 流程（soft-404 現況），不要因為這支輔助端點掛掉就讓真正存在的商品
    // 頁面也連不上。
    console.error('[api/products/exists] query failed:', err)
    return NextResponse.json({ exists: true, error: true }, { status: 200 })
  }
}
