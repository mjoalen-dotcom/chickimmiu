/**
 * Payload v3 REST list-query shim
 * ─────────────────────────────────
 * Next.js App Router 的 file-based route（例如 `src/app/(frontend)/api/returns/route.ts`）
 * 一旦匹配 `/api/<slug>`，就會把 Payload 內建的 catch-all（`/api/[...slug]/route.ts`）擋掉，
 * 所有未 export 的 method 直接 405。對於原本只 export POST 的會員提交端點（returns、
 * exchanges 等），admin 後台 dashboard widget 走 GET `/api/<slug>?limit=0&where[...]=...`
 * 拿 count / list 時就 405。
 *
 * 解法不是把 file-based route 砍掉（POST 那組欄位驗證、IDOR guard 都要保留），而是讓
 * 這組 file-based route 自己也提供 GET handler。本 helper 把 `qs-esm` 風格的 query string
 * 轉成 `payload.find()` 認的 args，呼叫端再加 collection slug + auth user 即可。
 *
 * 支援子集：limit, page, depth, sort, where[...]（任意巢狀，包含 and/or）。
 * 沒支援：joins, populate（dashboard 用不到）。
 */

import type { Where } from 'payload'

/**
 * 解析 qs 風格 key path：`where[and][0][createdAt][greater_than_equal]` →
 * `['where', 'and', '0', 'createdAt', 'greater_than_equal']`
 */
function splitQsKey(key: string): string[] {
  const segments: string[] = []
  let buf = ''
  let inBracket = false
  for (const ch of key) {
    if (ch === '[') {
      if (!inBracket && buf) {
        segments.push(buf)
        buf = ''
      }
      inBracket = true
      continue
    }
    if (ch === ']') {
      if (inBracket) {
        segments.push(buf)
        buf = ''
        inBracket = false
      }
      continue
    }
    buf += ch
  }
  if (buf) segments.push(buf)
  return segments
}

/** 把 URLSearchParams reduce 成 nested object（純字串 leaf），相容 qs 巢狀格式。 */
function parseQs(searchParams: URLSearchParams): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const [rawKey, value] of searchParams.entries()) {
    const segments = splitQsKey(rawKey)
    if (segments.length === 0) continue
    let cursor: Record<string, unknown> = root
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]
      const next = cursor[seg]
      if (next && typeof next === 'object' && !Array.isArray(next)) {
        cursor = next as Record<string, unknown>
      } else {
        const created: Record<string, unknown> = {}
        cursor[seg] = created
        cursor = created
      }
    }
    cursor[segments[segments.length - 1]] = value
  }
  return root
}

export type PayloadListQuery = {
  limit: number
  page: number
  depth: number
  sort?: string
  where?: Where
}

/**
 * 從 Request URL 解析 Payload list query。
 * 預設 limit=10、page=1、depth=0，與 Payload REST 預設一致（除了 depth — Payload 預設 2，
 * 但 dashboard 通常只要 count，傳 0 比較省）。
 */
export function parsePayloadListQuery(url: URL): PayloadListQuery {
  const sp = url.searchParams
  const parsed = parseQs(sp)

  const rawLimit = parsed.limit
  const limit =
    typeof rawLimit === 'string' && rawLimit.trim() !== '' && Number.isFinite(Number(rawLimit))
      ? Math.max(0, Math.floor(Number(rawLimit)))
      : 10

  const rawPage = parsed.page
  const page =
    typeof rawPage === 'string' && Number.isFinite(Number(rawPage))
      ? Math.max(1, Math.floor(Number(rawPage)))
      : 1

  const rawDepth = parsed.depth
  const depth =
    typeof rawDepth === 'string' && Number.isFinite(Number(rawDepth))
      ? Math.max(0, Math.floor(Number(rawDepth)))
      : 0

  const sort = typeof parsed.sort === 'string' ? parsed.sort : undefined
  const where =
    parsed.where && typeof parsed.where === 'object'
      ? (parsed.where as Where)
      : undefined

  return { limit, page, depth, sort, where }
}
