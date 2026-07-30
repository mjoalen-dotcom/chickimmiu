import type { Payload } from 'payload'
import { getActiveMembership } from '../subscription/activate'

/**
 * 會員點數倍率解析 — 與 Orders 消費回饋（付款完成 hook）同一套規則：
 * tier 倍率（LoyaltySettings.tierMultipliers.<slug>Multiplier）疊乘
 * 訂閱倍率（SubscriptionPlans.benefits.pointsMultiplier）。
 * 任一查詢失敗退回 1，不影響基礎發放。
 *
 * user 需以 depth ≥ 1 取得（memberTier 要 populate 出 slug）。
 */
export async function resolvePointsMultiplier(
  payload: Payload,
  user: Record<string, unknown>,
): Promise<number> {
  let tierMultiplier = 1
  try {
    const loyaltySettings = (await payload.findGlobal({
      slug: 'loyalty-settings',
    })) as unknown as Record<string, unknown>
    const rawTier = user.memberTier
    const tierSlug =
      typeof rawTier === 'string'
        ? rawTier
        : ((rawTier as Record<string, unknown> | null)?.slug as string) || 'bronze'
    const tierMultipliers = loyaltySettings.tierMultipliers as
      | Record<string, unknown>
      | undefined
    const value = Number(tierMultipliers?.[`${tierSlug}Multiplier`])
    if (Number.isFinite(value) && value > 0) tierMultiplier = value
  } catch (error) {
    console.error('[loyalty] tier 倍率查詢失敗（用 1）:', error)
  }

  let subscriptionMultiplier = 1
  try {
    const membership = await getActiveMembership(payload, user)
    const value = Number(membership?.plan.benefits?.pointsMultiplier)
    if (Number.isFinite(value) && value > 0) subscriptionMultiplier = value
  } catch (error) {
    console.error('[loyalty] 訂閱倍率查詢失敗（用 1）:', error)
  }

  return tierMultiplier * subscriptionMultiplier
}
