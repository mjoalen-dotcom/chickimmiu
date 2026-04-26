import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { TIER_LEVELS } from '@/lib/crm/tierEngine'

/**
 * Points Redemptions API
 *   GET  /api/v1/points  — 取得可兌換商品列表
 *   POST /api/v1/points  — 兌換商品（需 Payload session 登入）
 *
 * POST 流程（physical / movie_ticket / gift_physical）：
 *   1. Payload session auth
 *   2. 取得 redemption + user，驗證 active / 日期 / 庫存 / 點數 / 等級 /
 *      maxPerUser / maxPerDay
 *   3. 原子順序寫：bump redeemed → 扣 user.points → 建 points-transactions →
 *      建 user-rewards（state=unused, requiresPhysicalShipping=true, redemptionRef,
 *      expiresAt=now+validityDays）
 *   4. user-rewards 建立後，下次客戶下單時 Orders.beforeChange 自動 attach 到
 *      order.gifts[] 隨單寄出。gifts[] 不影響訂單金額；Returns.items[] 不能 ref
 *      贈品 → 結構上無法單獨退貨。
 *
 * 其他類型（coupon / lottery / store_credit / experience / ...）目前僅扣點 +
 * bump 計數，實際發放需另行接通；本 endpoint 暫不開放線上兌換以免使用者
 * 「扣了點卻拿不到任何東西」。
 */

const SHIPPABLE_TYPES = new Set(['physical', 'movie_ticket', 'gift_physical'])

type LooseRecord = Record<string, unknown>

function pickId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'string' || typeof val === 'number') return val
  if (typeof val === 'object') {
    const id = (val as LooseRecord).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
    const type = searchParams.get('type')

    const payload = await getPayload({ config })

    const now = new Date().toISOString()
    const where: Record<string, unknown> = {
      isActive: { equals: true },
      or: [
        { 'limits.endDate': { exists: false } },
        { 'limits.endDate': { greater_than_equal: now } },
      ],
    }

    if (type) {
      where.type = { equals: type }
    }

    const result = await payload.find({
      collection: 'points-redemptions',
      where: where as never,
      page,
      limit,
      sort: 'sortOrder',
    })

    return NextResponse.json({
      success: true,
      data: result.docs.map((item) => ({
        ...item,
        remaining: ((item.stock as number) || 0) - ((item.redeemed as number) || 0),
      })),
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
      },
    })
  } catch (error) {
    console.error('Points API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  // ── 1. Auth via Payload session ──
  const { user: sessionUser } = await payload.auth({ headers: req.headers })
  if (!sessionUser) {
    return NextResponse.json(
      { success: false, error: '請先登入' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }
  const { redemptionId } = (body ?? {}) as { redemptionId?: string | number }
  if (!redemptionId) {
    return NextResponse.json(
      { success: false, error: 'Missing redemptionId' },
      { status: 400 },
    )
  }

  try {
    // ── 2a. Fetch redemption + user (depth:1 for tier slug) ──
    const redemption = (await payload.findByID({
      collection: 'points-redemptions',
      id: redemptionId,
      depth: 0,
    })) as unknown as LooseRecord

    if (!redemption || !redemption.isActive) {
      return NextResponse.json(
        { success: false, error: '此兌換項目已下架' },
        { status: 404 },
      )
    }

    const type = String(redemption.type ?? '')
    if (!SHIPPABLE_TYPES.has(type)) {
      return NextResponse.json(
        {
          success: false,
          error: '此類型獎品暫不開放線上兌換，請洽客服或於指定活動兌換',
        },
        { status: 400 },
      )
    }

    // ── 2b. Date window ──
    const limits = (redemption.limits as LooseRecord | undefined) ?? {}
    const now = Date.now()
    const startDate = limits.startDate ? new Date(limits.startDate as string).getTime() : null
    const endDate = limits.endDate ? new Date(limits.endDate as string).getTime() : null
    if (startDate && now < startDate) {
      return NextResponse.json(
        { success: false, error: '兌換尚未開放' },
        { status: 400 },
      )
    }
    if (endDate && now > endDate) {
      return NextResponse.json(
        { success: false, error: '兌換已截止' },
        { status: 400 },
      )
    }

    // ── 2c. Stock ──
    const stock = (redemption.stock as number) ?? 0
    const redeemed = (redemption.redeemed as number) ?? 0
    if (stock > 0 && redeemed >= stock) {
      return NextResponse.json(
        { success: false, error: '已兌換完畢' },
        { status: 400 },
      )
    }

    // ── 2d. User points ──
    const user = (await payload.findByID({
      collection: 'users',
      id: sessionUser.id,
      depth: 1,
    })) as unknown as LooseRecord
    const userPoints = (user.points as number) ?? 0
    const cost = (redemption.pointsCost as number) ?? 0
    if (cost <= 0) {
      return NextResponse.json(
        { success: false, error: '兌換點數設定錯誤' },
        { status: 500 },
      )
    }
    if (userPoints < cost) {
      return NextResponse.json(
        {
          success: false,
          error: '點數不足',
          required: cost,
          current: userPoints,
        },
        { status: 400 },
      )
    }

    // ── 2e. Tier gating ──
    const minTierSlug = String(limits.minMemberTier ?? '').trim().toLowerCase()
    if (minTierSlug) {
      const userTier = user.memberTier as LooseRecord | string | null | undefined
      const userTierSlug =
        typeof userTier === 'string'
          ? userTier
          : ((userTier as LooseRecord | null | undefined)?.slug as string) || 'ordinary'
      const userLevel = TIER_LEVELS[userTierSlug] ?? 0
      const minLevel = TIER_LEVELS[minTierSlug] ?? 0
      if (userLevel < minLevel) {
        return NextResponse.json(
          {
            success: false,
            error: `本獎品需 ${minTierSlug} 以上會員才能兌換`,
            requiredTier: minTierSlug,
          },
          { status: 403 },
        )
      }
    }

    // ── 2f. Per-user / per-day limit (via user-rewards.redemptionRef) ──
    const maxPerUser = (limits.maxPerUser as number) ?? 0
    const maxPerDay = (limits.maxPerDay as number) ?? 0
    if (maxPerUser > 0 || maxPerDay > 0) {
      const baseWhere = {
        user: { equals: sessionUser.id },
        redemptionRef: { equals: redemptionId },
      }
      if (maxPerUser > 0) {
        const total = await payload.count({
          collection: 'user-rewards',
          where: baseWhere as never,
        })
        if (total.totalDocs >= maxPerUser) {
          return NextResponse.json(
            { success: false, error: `本獎品每人限兌 ${maxPerUser} 次` },
            { status: 400 },
          )
        }
      }
      if (maxPerDay > 0) {
        const dayStart = new Date()
        dayStart.setHours(0, 0, 0, 0)
        const today = await payload.count({
          collection: 'user-rewards',
          where: {
            and: [
              baseWhere,
              { createdAt: { greater_than_equal: dayStart.toISOString() } },
            ],
          } as never,
        })
        if (today.totalDocs >= maxPerDay) {
          return NextResponse.json(
            { success: false, error: `本獎品每日限兌 ${maxPerDay} 次` },
            { status: 400 },
          )
        }
      }
    }

    // ── 3. Atomic-ish writes ──
    // SQLite single-writer 假設下，每個 update 本身原子；極少數高併發場景可能
    // 出現 stock 跑超過 1 件的競態，admin 可後台調整。
    // 順序：bump redeemed (lock-ish) → 扣 user.points → 建 txn → 建 reward。
    // 任一步失敗時 best-effort revert 前面已寫的 mutation，並回 500。

    type Reverter = () => Promise<void>
    const reverters: Reverter[] = []

    try {
      // (a) bump redeemed counter
      await payload.update({
        collection: 'points-redemptions',
        id: redemptionId,
        data: { redeemed: redeemed + 1 } as LooseRecord,
        overrideAccess: true,
      })
      reverters.unshift(async () => {
        await payload
          .update({
            collection: 'points-redemptions',
            id: redemptionId,
            data: { redeemed: redeemed } as LooseRecord,
            overrideAccess: true,
          })
          .catch(() => {})
      })

      // (b) deduct user.points
      await payload.update({
        collection: 'users',
        id: sessionUser.id,
        data: { points: userPoints - cost } as LooseRecord,
        overrideAccess: true,
      })
      reverters.unshift(async () => {
        await payload
          .update({
            collection: 'users',
            id: sessionUser.id,
            data: { points: userPoints } as LooseRecord,
            overrideAccess: true,
          })
          .catch(() => {})
      })

      // (c) PointsTransactions audit row
      // payloadAPI === 'local' 時 hooks skip user.points 同步 → 我們手動扣，
      // balance 由我們指定為扣除後的餘額。
      await payload.create({
        collection: 'points-transactions',
        data: {
          user: sessionUser.id,
          type: 'redeem',
          amount: -cost,
          balance: userPoints - cost,
          source: 'redemption',
          description: `兌換：${redemption.name ?? '點數商城商品'}`,
        } as LooseRecord,
        overrideAccess: true,
      })

      // (d) UserRewards inventory row
      const physicalConfig = (redemption.physicalConfig as LooseRecord | undefined) ?? {}
      const rewardType =
        (physicalConfig.rewardTypeOverride as string) ||
        (type === 'movie_ticket' ? 'movie_ticket_physical' : 'gift_physical')
      const validityDays = (physicalConfig.validityDays as number) ?? 365
      const expiresAt = new Date(now + validityDays * 24 * 60 * 60 * 1000).toISOString()
      const shippingNote = (physicalConfig.shippingNote as string) || ''
      const sku = (physicalConfig.physicalSku as string) || ''
      const linkedProductId = pickId(physicalConfig.linkedProduct)

      const instructionsParts: string[] = []
      if (sku) instructionsParts.push(`SKU：${sku}`)
      if (linkedProductId) instructionsParts.push(`商品 ID：${linkedProductId}`)
      if (shippingNote) instructionsParts.push(shippingNote)
      const redemptionInstructions = instructionsParts.join('\n') || null

      const created = await payload.create({
        collection: 'user-rewards',
        data: {
          user: sessionUser.id,
          rewardType,
          displayName: String(redemption.name ?? '點數商城獎品'),
          state: 'unused',
          requiresPhysicalShipping: true,
          expiresAt,
          redemptionRef: redemptionId,
          pointsCostSnapshot: cost,
          ...(redemptionInstructions ? { redemptionInstructions } : {}),
        } as LooseRecord,
        overrideAccess: true,
      })

      return NextResponse.json({
        success: true,
        message: '兌換成功！獎品將隨您的下一張訂單寄出',
        data: {
          rewardId: (created as LooseRecord).id,
          pointsDeducted: cost,
          remainingPoints: userPoints - cost,
          expiresAt,
          rewardType,
        },
      })
    } catch (writeErr) {
      console.error('[Points Redeem] write failed, attempting revert:', writeErr)
      for (const revert of reverters) {
        await revert()
      }
      return NextResponse.json(
        { success: false, error: '兌換處理失敗，請稍後再試' },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('Points redemption error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
