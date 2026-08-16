import type { Payload } from 'payload'
import { adjustWallet } from '../wallet/server'

/**
 * 訂閱生命週期核心（綠界定期定額）
 * ────────────────────────────────
 * - activateSubscription：首期授權成功（ReturnURL callback）
 * - renewSubscription：第二期起授權成功（PeriodReturnURL callback）
 * - recordFailedPeriod：授權失敗紀錄（綠界連續失敗 6 次會自動停用後續）
 * - syncUserMembership：把生效狀態 denormalize 到 users.membership.*
 *
 * 冪等：兩個授權入口都先查 authLog 是否已有同 gwsr，有則直接略過
 * （綠界收不到 1|OK 會重送）。
 *
 * 購物金策略：monthlyCredit 於每次授權成功入帳；年繳一次入 12 個月份額
 * （monthlyCredit × 12），不做逐月排程。
 * streak 策略：月繳每期 +1；年繳每期 +12。里程碑以「跨過門檻」判定
 * （prev < months ≤ next），年繳一次跨多檔會全部補發。
 */

export type SubDoc = {
  id: number | string
  user: number | string | { id: number | string }
  plan: number | string | { id: number | string }
  status: string
  billingCycle: 'monthly' | 'yearly'
  amount: number
  streakMonths?: number | null
  currentPeriodEnd?: string | null
  ecpay?: {
    merchantTradeNo?: string | null
    gwsr?: string | null
    periodType?: string | null
    execTimes?: number | null
    totalSuccessTimes?: number | null
    lastAuthAt?: string | null
  } | null
  authLog?: { at?: string; amount?: number; gwsr?: string; rtnCode?: string; success?: boolean }[] | null
}

export type PlanDoc = {
  id: number | string
  name?: string
  benefits?: {
    discountPercent?: number | null
    pointsMultiplier?: number | null
    freeShippingThreshold?: number | null
    monthlyCredit?: number | null
  } | null
  dopamine?: {
    streakMilestones?: { months?: number | null; reward?: string | null; creditAmount?: number | null }[] | null
  } | null
}

export type AuthEvent = {
  gwsr: string
  rtnCode: string
  amount: number
  /** 綠界 ProcessDate（台北時間字串）；記錄用，periodEnd 一律以 server now 起算 */
  processDate?: string
}

const relId = (v: number | string | { id: number | string }): number | string =>
  typeof v === 'object' && v !== null ? v.id : v

/** 權益有效期：授權當下起算一期 + 3 天寬限（扣款日飄移/授權延遲緩衝） */
export function computePeriodEnd(cycle: 'monthly' | 'yearly', from: Date = new Date()): Date {
  const end = new Date(from)
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  end.setDate(end.getDate() + 3)
  return end
}

/** users.membership.* denormalized 快照同步（sub=null 代表清空/到期） */
export async function syncUserMembership(
  payload: Payload,
  userId: number | string,
  sub: SubDoc | null,
): Promise<void> {
  await payload.update({
    collection: 'customers',
    id: userId,
    data: {
      membership: sub
        ? {
            activePlan: relId(sub.plan),
            activeSubscription: sub.id,
            validUntil: sub.currentPeriodEnd || null,
            streakMonths: sub.streakMonths ?? 0,
          }
        : { activePlan: null, activeSubscription: null, validUntil: null, streakMonths: 0 },
    } as never,
    overrideAccess: true,
  })
}

/** 已在帳（同 gwsr）→ true（callback 重送冪等用） */
function alreadyLogged(sub: SubDoc, gwsr: string): boolean {
  return Boolean(gwsr && (sub.authLog || []).some((l) => l.gwsr === gwsr))
}

/** monthlyCredit 入帳 + 跨檔里程碑獎勵。回傳實際入帳總額（log 用）。 */
async function grantPeriodRewards(
  payload: Payload,
  userId: number | string,
  plan: PlanDoc,
  sub: SubDoc,
  prevStreak: number,
  newStreak: number,
): Promise<number> {
  let granted = 0
  const monthly = Number(plan.benefits?.monthlyCredit) || 0
  const periods = sub.billingCycle === 'yearly' ? 12 : 1
  const credit = monthly * periods
  if (credit > 0) {
    const r = await adjustWallet(payload, {
      userId,
      wallet: 'shoppingCredit',
      amount: credit,
      type: 'earn',
      source: 'subscription',
      description: `訂閱會員每月購物金${periods > 1 ? `（年繳 ${periods} 個月份額）` : ''}`,
    })
    if (r.ok) granted += credit
  }
  for (const m of plan.dopamine?.streakMilestones || []) {
    const months = Number(m.months) || 0
    const amount = Number(m.creditAmount) || 0
    if (months > prevStreak && months <= newStreak && amount > 0) {
      const r = await adjustWallet(payload, {
        userId,
        wallet: 'shoppingCredit',
        amount,
        type: 'earn',
        source: 'subscription',
        description: `連續訂閱 ${months} 個月里程碑${m.reward ? `：${m.reward}` : ''}`,
      })
      if (r.ok) granted += amount
    }
  }
  return granted
}

export interface AuthResult {
  applied: boolean
  sub: SubDoc
  plan: PlanDoc | null
  creditGranted: number
}

/** 首期授權成功（ReturnURL）。status pending→active + 權益發放。 */
export async function activateSubscription(
  payload: Payload,
  sub: SubDoc,
  ev: AuthEvent,
  merchantTradeNo: string,
): Promise<AuthResult> {
  if (alreadyLogged(sub, ev.gwsr) || sub.status === 'active') {
    return { applied: false, sub, plan: null, creditGranted: 0 }
  }
  const userId = relId(sub.user)
  const plan = (await payload.findByID({
    collection: 'subscription-plans',
    id: relId(sub.plan),
    depth: 0,
  })) as unknown as PlanDoc

  const now = new Date()
  const prevStreak = 0
  const newStreak = sub.billingCycle === 'yearly' ? 12 : 1
  const periodEnd = computePeriodEnd(sub.billingCycle, now)

  const updated = (await payload.update({
    collection: 'user-subscriptions',
    id: sub.id,
    data: {
      status: 'active',
      startedAt: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      streakMonths: newStreak,
      ecpay: {
        ...(sub.ecpay || {}),
        merchantTradeNo,
        gwsr: ev.gwsr,
        totalSuccessTimes: 1,
        lastAuthAt: now.toISOString(),
      },
      authLog: [
        ...(sub.authLog || []),
        { at: now.toISOString(), amount: ev.amount, gwsr: ev.gwsr, rtnCode: ev.rtnCode, success: true },
      ],
    } as never,
    overrideAccess: true,
  })) as unknown as SubDoc

  await syncUserMembership(payload, userId, updated)
  const creditGranted = await grantPeriodRewards(payload, userId, plan, updated, prevStreak, newStreak)
  return { applied: true, sub: updated, plan, creditGranted }
}

/** 第二期起授權成功（PeriodReturnURL）。延長權益 + streak + 發放。 */
export async function renewSubscription(
  payload: Payload,
  sub: SubDoc,
  ev: AuthEvent,
): Promise<AuthResult> {
  if (alreadyLogged(sub, ev.gwsr)) {
    return { applied: false, sub, plan: null, creditGranted: 0 }
  }
  const userId = relId(sub.user)
  const plan = (await payload.findByID({
    collection: 'subscription-plans',
    id: relId(sub.plan),
    depth: 0,
  })) as unknown as PlanDoc

  const now = new Date()
  const prevStreak = Number(sub.streakMonths) || 0
  const newStreak = prevStreak + (sub.billingCycle === 'yearly' ? 12 : 1)
  const periodEnd = computePeriodEnd(sub.billingCycle, now)

  const updated = (await payload.update({
    collection: 'user-subscriptions',
    id: sub.id,
    data: {
      // 取消後綠界仍可能送最後一期（時序競賽）：已取消不復活 status，只入帳權益
      status: sub.status === 'cancelled' ? 'cancelled' : 'active',
      currentPeriodEnd: periodEnd.toISOString(),
      streakMonths: newStreak,
      ecpay: {
        ...(sub.ecpay || {}),
        gwsr: ev.gwsr,
        totalSuccessTimes: (Number(sub.ecpay?.totalSuccessTimes) || 0) + 1,
        lastAuthAt: now.toISOString(),
      },
      authLog: [
        ...(sub.authLog || []),
        { at: now.toISOString(), amount: ev.amount, gwsr: ev.gwsr, rtnCode: ev.rtnCode, success: true },
      ],
    } as never,
    overrideAccess: true,
  })) as unknown as SubDoc

  await syncUserMembership(payload, userId, updated)
  const creditGranted = await grantPeriodRewards(payload, userId, plan, updated, prevStreak, newStreak)
  return { applied: true, sub: updated, plan, creditGranted }
}

/** 授權失敗：只記 authLog（權益不動；綠界連續失敗 6 次自動停用後續） */
export async function recordFailedPeriod(
  payload: Payload,
  sub: SubDoc,
  ev: AuthEvent,
): Promise<void> {
  if (alreadyLogged(sub, ev.gwsr)) return
  await payload.update({
    collection: 'user-subscriptions',
    id: sub.id,
    data: {
      authLog: [
        ...(sub.authLog || []),
        {
          at: new Date().toISOString(),
          amount: ev.amount,
          gwsr: ev.gwsr,
          rtnCode: ev.rtnCode,
          success: false,
        },
      ],
    } as never,
    overrideAccess: true,
  })
}

/** 讀 user 的生效訂閱權益（結帳/點數 hook 用）。過期回 null。 */
export async function getActiveMembership(
  payload: Payload,
  user: Record<string, unknown>,
): Promise<{ plan: PlanDoc; validUntil: Date; streakMonths: number } | null> {
  const membership = user.membership as
    | { activePlan?: number | string | { id: number | string } | null; validUntil?: string | null; streakMonths?: number | null }
    | undefined
  if (!membership?.activePlan || !membership.validUntil) return null
  const validUntil = new Date(membership.validUntil)
  if (!(validUntil.getTime() > Date.now())) return null
  try {
    const plan = (await payload.findByID({
      collection: 'subscription-plans',
      id: relId(membership.activePlan),
      depth: 0,
    })) as unknown as PlanDoc
    return { plan, validUntil, streakMonths: Number(membership.streakMonths) || 0 }
  } catch {
    return null
  }
}
