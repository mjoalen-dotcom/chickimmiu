import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'

/**
 * GET /api/_audit/schema
 * ──────────────────────
 * 用 Bearer CRON_SECRET 認證的 schema 審計端點。
 *
 * 為什麼需要：Payload 的 snake-case 規則對 ALL-CAPS 連續大寫字母會每個字
 * 母獨立加 `_`（`requireTOS` → `require_t_o_s`），但人寫 migration 容易誤
 * 用 lodash.snakeCase 結果（`require_tos`）。這種 mismatch 唯一症狀就是
 * runtime SQLITE_ERROR `no such column: ...`，前端 5xx，但只有真的點到
 * 該 endpoint 才會發現。
 *
 * 審計邏輯：對每個 collection 跑一次 `payload.find({limit:1})` + 對每個
 * global 跑一次 `payload.findGlobal()`，所有 query overrideAccess=true 確
 * 保 admin-only collection 也驗到 schema 而非被 access control 擋掉。
 *
 * 用法：
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://pre.chickimmiu.com/api/_audit/schema
 *
 * 回傳 JSON：
 *   { ok: bool, summary: {...}, collections: { ok: [...], fail: [{slug, error, missingColumn?}] }, globals: same }
 */
export const dynamic = 'force-dynamic'

type FailRecord = {
  slug: string
  error: string
  missingColumn?: string
}

const MISSING_COLUMN_RE = /no such column:\s*([\w.]+)/i

function classifyError(err: unknown): { error: string; missingColumn?: string } {
  const msg = err instanceof Error ? err.message : String(err)
  const m = MISSING_COLUMN_RE.exec(msg)
  return {
    error: msg.length > 500 ? msg.slice(0, 500) + '…' : msg,
    missingColumn: m?.[1],
  }
}

export async function GET(req: NextRequest) {
  const authFail = verifyCronAuth(req)
  if (authFail) return authFail

  const payload = await getPayload({ config })
  const collections = payload.config.collections.map((c) => c.slug)
  const globals = payload.config.globals.map((g) => g.slug)

  const collectionOk: string[] = []
  const collectionFail: FailRecord[] = []
  for (const slug of collections) {
    try {
      await payload.find({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection: slug as any,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      collectionOk.push(slug)
    } catch (err) {
      collectionFail.push({ slug, ...classifyError(err) })
    }
  }

  const globalOk: string[] = []
  const globalFail: FailRecord[] = []
  for (const slug of globals) {
    try {
      await payload.findGlobal({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slug: slug as any,
        depth: 0,
        overrideAccess: true,
      })
      globalOk.push(slug)
    } catch (err) {
      globalFail.push({ slug, ...classifyError(err) })
    }
  }

  return NextResponse.json({
    ok: collectionFail.length === 0 && globalFail.length === 0,
    summary: {
      totalCollections: collections.length,
      totalGlobals: globals.length,
      collectionFailCount: collectionFail.length,
      globalFailCount: globalFail.length,
    },
    collections: { ok: collectionOk, fail: collectionFail },
    globals: { ok: globalOk, fail: globalFail },
    timestamp: new Date().toISOString(),
  })
}
