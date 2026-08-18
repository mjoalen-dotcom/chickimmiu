/**
 * GET /api/promotions/drop-status — 限量券包／神秘禮物的真實剩餘量
 *
 * 為什麼要獨立一支端點而不是從 evaluator 拿：evaluator 的 usage snapshot 裡
 * totalApplied 來自 promotion-applications 的 count，那是**下單之後**才有的資料，
 * 而且查詢失敗時會 fail closed 設成 MAX_SAFE_INTEGER。真實剩餘量只能從
 * marketing_campaigns 的 quota 計數欄位直接讀。
 *
 * ⚠️ 這支只負責「顯示」。真正防超發的是結帳鏈的條件式原子 UPDATE
 *（reserveCampaignBudgetAndQuota）—— rateLimit.ts 自述是 in-memory 單進程，
 * pm2 多實例時額度會按實例數倍化，它只是輔助不是防線。
 *
 * 唯讀、不寫入、不需登入（未登入時 perUserClaimed 固定 0）。
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { checkRateLimit, clientIpForRateLimit } from '@/lib/rateLimit'

// 對齊 pricing/quote 的讀取型端點等級（前台會隨購物車變動輪詢）
const RATE_LIMIT_MAX = 120
const RATE_LIMIT_WINDOW_MS = 60_000

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const

export async function GET(request: Request) {
  const rate = checkRateLimit(
    `drop-status:${clientIpForRateLimit(request)}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rate.retryAfter) } },
    )
  }

  const url = new URL(request.url)
  const campaignId = url.searchParams.get('campaignId')
  const ruleKey = url.searchParams.get('ruleKey')
  if (!campaignId && !ruleKey) {
    return NextResponse.json(
      { ok: false, error: 'campaignId 或 ruleKey 至少要給一個' },
      { status: 400, headers: NO_STORE },
    )
  }

  try {
    const payload = await getPayload({ config })

    // ruleKey 的格式是 `${campaignId}:${slug}:v${version}`，第一段就是活動 id
    const resolvedCampaignId = campaignId ?? ruleKey!.split(':')[0]
    if (!resolvedCampaignId) {
      return NextResponse.json(
        { ok: false, error: 'ruleKey 格式不正確' },
        { status: 400, headers: NO_STORE },
      )
    }

    const campaign = (await payload
      .findByID({
        collection: 'marketing-campaigns',
        id: resolvedCampaignId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)) as unknown as Record<string, unknown> | null

    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404, headers: NO_STORE })
    }

    const commerce = (campaign.commerce ?? {}) as Record<string, unknown>
    const totalRaw = Number(commerce.dropTotal)
    const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null
    const claimed = Math.max(0, Number(commerce.dropClaimed) || 0)
    const remaining = total == null ? null : Math.max(0, total - claimed)

    // 該使用者領過幾次（未登入 → 0，前台就顯示「可領取」）
    let perUserClaimed = 0
    const user = (request.headers.get('cookie') ?? '').length > 0 ? await currentUserId(payload, request) : null
    if (user != null && ruleKey) {
      const res = await payload
        .find({
          collection: 'promotion-drop-claims' as never,
          where: {
            and: [
              { ruleKey: { equals: ruleKey } },
              { user: { equals: user } },
              { status: { in: ['reserved', 'granted'] } },
            ],
          },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
      perUserClaimed = res?.totalDocs ?? 0
    }

    return NextResponse.json(
      {
        ok: true,
        campaignId: resolvedCampaignId,
        ruleKey: ruleKey ?? null,
        total,
        claimed,
        remaining,
        perUserClaimed,
        // total 未設 = 不限量，永遠不會 soldOut
        soldOut: remaining != null && remaining <= 0,
      },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('[drop-status] 查詢失敗', err)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500, headers: NO_STORE })
  }
}

/** 取目前登入會員 id；未登入或查不到一律 null（這支端點不因未登入而失敗） */
async function currentUserId(
  payload: Awaited<ReturnType<typeof getPayload>>,
  request: Request,
): Promise<number | string | null> {
  try {
    const { user } = await payload.auth({
      headers: request.headers,
    } as Parameters<typeof payload.auth>[0])
    return (user as { id?: number | string } | null)?.id ?? null
  } catch {
    return null
  }
}
