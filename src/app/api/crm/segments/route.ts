import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  SEGMENT_DEFINITIONS,
  runDailySegmentation,
  calculateMemberSegment,
} from '@/lib/crm/segmentationEngine'

/**
 * Segmentation API
 * GET  /api/crm/segments — 讀取目前分群分佈（來源：member-segments collection 的真實計算結果）
 * POST /api/crm/segments — 觸發真實分群計算（呼叫 segmentationEngine，與每日 cron 相同邏輯）
 *
 * 不再使用任何 demo / 假資料：未跑過分群前，各分群 count 一律為 0。
 * 真實計算結果由 segmentationEngine.runDailySegmentation 寫入 member-segments
 * collection 的 currentSegment 欄位，本 route 由該 collection 統計分佈。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 全量分群對每位 user 都要多次 find，大戶可能會慢，給足 5 分鐘（與 cron 相同）。
export const maxDuration = 300

const SEGMENT_ORDER = [
  'VIP1', 'VIP2', 'POT1', 'REG1', 'REG2', 'RISK1', 'RISK2', 'NEW1', 'SLP1', 'BLK1',
] as const

interface SegmentItem {
  code: string
  label: string
  color: string
  count: number
  percentage: number
  description: string
}

/** 未有計算結果時的空分佈（count 全 0，只帶分群定義 metadata）。 */
function emptyDistribution(): SegmentItem[] {
  return SEGMENT_ORDER.map((code) => {
    const def = SEGMENT_DEFINITIONS[code]
    return {
      code,
      label: def?.label ?? code,
      color: def?.color ?? '#999999',
      description: def?.description ?? '',
      count: 0,
      percentage: 0,
    }
  })
}

/**
 * 從 member-segments collection 統計各分群實際人數。
 * 每個分群一個 count 查詢（limit:1 只取 totalDocs），共 10 次，成本低。
 */
async function buildDistribution(
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<{ distribution: SegmentItem[]; totalProcessed: number }> {
  const counts: Record<string, number> = {}
  let total = 0
  for (const code of SEGMENT_ORDER) {
    const res = await payload.find({
      collection: 'member-segments',
      where: { currentSegment: { equals: code } } as never,
      limit: 1,
      depth: 0,
    })
    counts[code] = res.totalDocs
    total += res.totalDocs
  }
  const distribution: SegmentItem[] = SEGMENT_ORDER.map((code) => {
    const def = SEGMENT_DEFINITIONS[code]
    const count = counts[code] ?? 0
    return {
      code,
      label: def?.label ?? code,
      color: def?.color ?? '#999999',
      description: def?.description ?? '',
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }
  })
  return { distribution, totalProcessed: total }
}

export async function GET(_req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { distribution, totalProcessed } = await buildDistribution(payload)

    // 最近一次分群更新時間（member-segments updatedAt 最大值）；無資料則 null。
    let lastRunAt: string | null = null
    const latest = await payload.find({
      collection: 'member-segments',
      limit: 1,
      depth: 0,
      sort: '-updatedAt',
    })
    if (latest.docs.length > 0) {
      const doc = latest.docs[0] as unknown as Record<string, unknown>
      lastRunAt = (doc.updatedAt as string) ?? null
    }

    return NextResponse.json({
      success: true,
      data: { distribution, lastRunAt, totalProcessed, totalChanged: 0 },
    })
  } catch (error) {
    console.error('Segments GET error:', error)
    // 出錯回傳空分佈（不假資料）。
    return NextResponse.json({
      success: true,
      data: { distribution: emptyDistribution(), lastRunAt: null, totalProcessed: 0, totalChanged: 0 },
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = (await req.json().catch(() => ({}))) as { scope?: string; userId?: string }
    const scope = body.scope || 'all'

    if (scope === 'single' && body.userId) {
      // 單一會員：呼叫真實演算法計算其分群（runDailySegmentation 內部同款計算）。
      const result = await calculateMemberSegment(body.userId)
      const { distribution } = await buildDistribution(payload)
      return NextResponse.json({
        success: true,
        data: { processed: 1, changed: 1, distribution, assignedSegment: result.segment },
      })
    }

    // 全量：跑真實分群引擎（與 /api/cron/segments 相同），結果寫入 member-segments。
    const run = await runDailySegmentation()
    const { distribution, totalProcessed } = await buildDistribution(payload)
    return NextResponse.json({
      success: true,
      data: {
        processed: run.processed || totalProcessed,
        changed: run.changed,
        distribution,
      },
    })
  } catch (error) {
    console.error('Segments POST error:', error)
    return NextResponse.json({ success: false, error: '分群計算失敗' }, { status: 500 })
  }
}
