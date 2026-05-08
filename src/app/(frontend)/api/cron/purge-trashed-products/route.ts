import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * /api/cron/purge-trashed-products
 *
 * 永久刪除「已在垃圾桶超過 7 天」的商品（products.deletedAt < now - 7d）。
 *
 * 行為：
 *   - 只動 deletedAt < cutoff 的紀錄；deletedAt 為 NULL 的不動
 *   - 走 payload.delete + trash:true 才能對 trashed 紀錄真正硬刪
 *     （否則 Payload 預設會用 appendNonTrashedFilter 把 trashed 文檔濾掉，刪不到）
 *   - 失敗單筆 catch、繼續下一筆，最後回 errors[]
 *
 * 建議排程：每天 03:00 一次（GitHub Actions cron schedule）。
 *   使用範例：
 *     curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *       https://pre.chickimmiu.com/api/cron/purge-trashed-products
 *
 * 可由 query string 覆寫保留天數（測試用）：?days=14
 */
export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const url = new URL(request.url)
  const daysParam = Number(url.searchParams.get('days') ?? '7')
  const retentionDays = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const payload = await getPayload({ config })

  // 1. 找出 deletedAt < cutoff 的商品 — 必須帶 trash:true，否則 Payload 預設過濾掉 trashed
  const { docs } = await payload.find({
    collection: 'products',
    where: {
      deletedAt: { less_than: cutoff.toISOString() },
    },
    trash: true,
    depth: 0,
    limit: 0,
    pagination: false,
  })

  if (docs.length === 0) {
    return NextResponse.json({
      ok: true,
      retentionDays,
      cutoff: cutoff.toISOString(),
      candidates: 0,
      purged: 0,
      duration_ms: Date.now() - started,
    })
  }

  // 2. 逐筆硬刪（失敗單筆不阻擋其他）
  let purged = 0
  const errors: { id: string | number; message: string }[] = []
  for (const doc of docs) {
    try {
      await payload.delete({
        collection: 'products',
        id: doc.id,
        trash: true, // 允許對 trashed 紀錄硬刪
        overrideAccess: true,
      })
      purged++
    } catch (err) {
      errors.push({
        id: doc.id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    retentionDays,
    cutoff: cutoff.toISOString(),
    candidates: docs.length,
    purged,
    errors: errors.slice(0, 20),
    duration_ms: Date.now() - started,
  })
}
