import type { Endpoint, PayloadRequest } from 'payload'

/**
 * GET /api/users/repeat-purchase
 * ───────────────────────────────
 * 封測會員 90 天回購分析儀表板（admin-only）。
 *
 * 關鍵定義：
 *   "首購" = 該會員第一張 paymentStatus='paid' 訂單（createdAt 升冪最小值）。
 *   "回購" = 首購之後再一張 paymentStatus='paid' 訂單；距首購 ≤ N 天算 D_N 回購。
 *   "D30/60/90 eligible" = 首購距今 ≥ N 天。還沒到觀察窗的 cohort 不計入分母，
 *     避免封測初期人為拉低回購率；前端遇到 rate=null 要顯示「—」而非 0%。
 *
 * 額外提供 actionable list：已首購、尚未回購的會員，按 daysSinceFirst 升冪
 *   （最新首購在前，還在 honeymoon 期最該接觸）+ phase 分級，對應 3 段式行銷：
 *     d0_14 Delight / d15_45 Discovery / d46_90 Conversion / beyond_90 Reactivation
 *
 * 資料量假設：封測期 <1k 訂單，server 端一次撈完聚合；>50k 時要改分頁。
 */

type OrderLite = {
  id: string | number
  orderNumber?: string | null
  customer?: string | number | { id: string | number } | null
  paymentStatus?: string | null
  total?: number | null
  createdAt?: string | null
}

type UserLite = {
  id: string | number
  name?: string | null
  email?: string | null
  memberTier?: string | number | null
}

type WindowStat = { eligible: number; repeated: number; rate: number | null }

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY)
}

// 台灣慣用週日為週起，回傳該日所在週的週日 00:00。
function weekStart(d: Date): Date {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  t.setDate(t.getDate() - t.getDay())
  return t
}

function fmtMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function customerIdOf(o: OrderLite): string | null {
  const c = o.customer
  if (c == null) return null
  if (typeof c === 'object' && 'id' in c) return String(c.id)
  return String(c)
}

function withRate(s: { eligible: number; repeated: number }): WindowStat {
  return {
    eligible: s.eligible,
    repeated: s.repeated,
    rate: s.eligible > 0 ? s.repeated / s.eligible : null,
  }
}

function phaseOf(daysSinceFirst: number): 'd0_14' | 'd15_45' | 'd46_90' | 'beyond_90' {
  if (daysSinceFirst <= 14) return 'd0_14'
  if (daysSinceFirst <= 45) return 'd15_45'
  if (daysSinceFirst <= 90) return 'd46_90'
  return 'beyond_90'
}

export const repeatPurchaseEndpoint: Endpoint = {
  path: '/repeat-purchase',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const user = req.user
    if (!user || (user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const now = new Date()

      // ── 1. 撈全部 paid 訂單，按 createdAt ASC 排好 ──────────────────────
      const ordersResp = await req.payload.find({
        collection: 'orders',
        limit: 50000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
        where: { paymentStatus: { equals: 'paid' } },
        sort: 'createdAt',
      })
      const orders = ordersResp.docs as unknown as OrderLite[]

      // ── 2. 每位會員的訂單鏈 ─────────────────────────────────────────
      type UserAgg = {
        userId: string
        firstOrder: OrderLite
        firstOrderDate: Date
        repeatDatesAfterFirst: Date[]
      }
      const userAgg = new Map<string, UserAgg>()

      for (const o of orders) {
        const uid = customerIdOf(o)
        if (!uid) continue
        const createdAt = o.createdAt ? new Date(o.createdAt) : null
        if (!createdAt || Number.isNaN(createdAt.getTime())) continue

        const existing = userAgg.get(uid)
        if (!existing) {
          userAgg.set(uid, {
            userId: uid,
            firstOrder: o,
            firstOrderDate: createdAt,
            repeatDatesAfterFirst: [],
          })
        } else {
          existing.repeatDatesAfterFirst.push(createdAt)
        }
      }

      // ── 3. 會員 + 等級 label lookup ──────────────────────────────────
      const usersResp = await req.payload.find({
        collection: 'users',
        limit: 10000,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      const userMap = new Map<string, UserLite>()
      for (const u of usersResp.docs as unknown as UserLite[]) {
        userMap.set(String(u.id), u)
      }

      const tiersResp = await req.payload.find({
        collection: 'membership-tiers',
        limit: 100,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      type TierLite = { id: string | number; frontName?: string; name?: string }
      const tierLabelMap = new Map<string, string>()
      for (const t of tiersResp.docs as unknown as TierLite[]) {
        tierLabelMap.set(String(t.id), t.frontName || t.name || `等級 ${t.id}`)
      }

      // ── 4. 觀察窗 + cohort 累計 ──────────────────────────────────────
      type CohortAcc = {
        key: string
        startISO: string
        endISO: string
        firstBuyers: number
        firstAOVSum: number
        d30: { eligible: number; repeated: number }
        d60: { eligible: number; repeated: number }
        d90: { eligible: number; repeated: number }
        soFarRepeated: number
        daysElapsedMax: number
      }
      const cohortMap = new Map<string, CohortAcc>()
      const globalSum = {
        d30: { eligible: 0, repeated: 0 },
        d60: { eligible: 0, repeated: 0 },
        d90: { eligible: 0, repeated: 0 },
        anyRepeat: 0,
      }

      const windows: { key: 'd30' | 'd60' | 'd90'; days: number }[] = [
        { key: 'd30', days: 30 },
        { key: 'd60', days: 60 },
        { key: 'd90', days: 90 },
      ]

      for (const u of userAgg.values()) {
        const daysSince = daysBetween(u.firstOrderDate, now)
        const hasAnyRepeat = u.repeatDatesAfterFirst.length > 0
        if (hasAnyRepeat) globalSum.anyRepeat += 1

        const ws = weekStart(u.firstOrderDate)
        const we = new Date(ws)
        we.setDate(we.getDate() + 6)
        const key = ws.toISOString().slice(0, 10)

        let acc = cohortMap.get(key)
        if (!acc) {
          acc = {
            key,
            startISO: ws.toISOString(),
            endISO: we.toISOString(),
            firstBuyers: 0,
            firstAOVSum: 0,
            d30: { eligible: 0, repeated: 0 },
            d60: { eligible: 0, repeated: 0 },
            d90: { eligible: 0, repeated: 0 },
            soFarRepeated: 0,
            daysElapsedMax: 0,
          }
          cohortMap.set(key, acc)
        }
        acc.firstBuyers += 1
        acc.firstAOVSum += typeof u.firstOrder.total === 'number' ? u.firstOrder.total : 0
        if (hasAnyRepeat) acc.soFarRepeated += 1
        if (daysSince > acc.daysElapsedMax) acc.daysElapsedMax = daysSince

        for (const w of windows) {
          if (daysSince < w.days) continue
          globalSum[w.key].eligible += 1
          acc[w.key].eligible += 1
          const within = u.repeatDatesAfterFirst.some(
            (d) => daysBetween(u.firstOrderDate, d) <= w.days,
          )
          if (within) {
            globalSum[w.key].repeated += 1
            acc[w.key].repeated += 1
          }
        }
      }

      const cohorts = [...cohortMap.values()]
        .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0)) // 最新在前
        .map((c) => ({
          key: c.key,
          label: `${fmtMD(new Date(c.startISO))}–${fmtMD(new Date(c.endISO))}`,
          startISO: c.startISO,
          endISO: c.endISO,
          firstBuyers: c.firstBuyers,
          avgFirstAOV: c.firstBuyers > 0 ? Math.round(c.firstAOVSum / c.firstBuyers) : 0,
          d30: withRate(c.d30),
          d60: withRate(c.d60),
          d90: withRate(c.d90),
          soFar: {
            daysElapsed: c.daysElapsedMax,
            repeated: c.soFarRepeated,
            rate: c.firstBuyers > 0 ? c.soFarRepeated / c.firstBuyers : 0,
          },
        }))

      // ── 5. actionable list：已首購未回購，按 daysSinceFirst ASC ──────
      const actionable: Array<{
        userId: string
        name: string
        email: string
        firstOrderISO: string
        firstOrderId: string | number
        firstOrderNumber: string
        firstOrderTotal: number
        daysSinceFirst: number
        tierLabel: string
        phase: 'd0_14' | 'd15_45' | 'd46_90' | 'beyond_90'
      }> = []

      for (const u of userAgg.values()) {
        if (u.repeatDatesAfterFirst.length > 0) continue
        const days = daysBetween(u.firstOrderDate, now)
        const info = userMap.get(u.userId)
        const tierKey = info?.memberTier != null ? String(info.memberTier) : ''
        actionable.push({
          userId: u.userId,
          name: info?.name || info?.email || `#${u.userId}`,
          email: info?.email || '',
          firstOrderISO: u.firstOrderDate.toISOString(),
          firstOrderId: u.firstOrder.id,
          firstOrderNumber: String(u.firstOrder.orderNumber ?? ''),
          firstOrderTotal: typeof u.firstOrder.total === 'number' ? u.firstOrder.total : 0,
          daysSinceFirst: days,
          tierLabel: tierKey ? tierLabelMap.get(tierKey) || '' : '',
          phase: phaseOf(days),
        })
      }
      actionable.sort((a, b) => a.daysSinceFirst - b.daysSinceFirst)

      // ── 6. 基準線提示：封測初期 D30/60/90 都還沒成熟 ─────────────────
      const baselineNote =
        userAgg.size === 0
          ? '目前還沒有任何 paid 訂單。等封測首張付款訂單進來後就會有資料。'
          : globalSum.d30.eligible === 0
            ? 'D30 還沒到（最早的首購距今不滿 30 天）。繼續累積訂單，約首購日 +30 天後開始有意義的回購率。表格下方「迄今」欄可先看早期信號。'
            : globalSum.d90.eligible === 0
              ? 'D30 已有數據，D60/90 仍在累積中。'
              : ''

      return Response.json({
        generatedAt: now.toISOString(),
        summary: {
          totalFirstBuyers: userAgg.size,
          d30: withRate(globalSum.d30),
          d60: withRate(globalSum.d60),
          d90: withRate(globalSum.d90),
          anyRepeatCount: globalSum.anyRepeat,
          anyRepeatRate: userAgg.size > 0 ? globalSum.anyRepeat / userAgg.size : 0,
          baselineNote,
        },
        cohorts,
        actionable,
      })
    } catch (e) {
      req.payload.logger.error({ msg: 'repeat-purchase-analytics failed', err: e })
      return Response.json(
        { error: 'Internal error', detail: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      )
    }
  },
}
