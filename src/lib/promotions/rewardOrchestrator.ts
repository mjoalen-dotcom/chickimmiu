/**
 * Reward Orchestrator（CHIC Commerce OS P0-B 效果類補完）
 * ────────────────────────────────────────────────────────
 * 背景：evaluator 對 gift_item / points_multiplier / grant_reward 三種效果只
 * 產生 RewardIntent 快照，**原本沒有任何程式讀它**——規則在後台建得出來、
 * 前台也算得出「已解鎖」，但贈品不會出現、點數倍率不生效、XP/Mystery Key
 * 不會發。ADR D4 把落地推給 P1 Member Economy，導致第7.1節有 5 種玩法
 * （Buy X Get Y / 滿額贈 / 滿額點數倍率 / Mystery Gift / XP）長期空轉。
 *
 * 本模組在**不新建帳本**的前提下把 intent 接到既有基礎設施：
 *   - gift_item        → 計價階段由伺服器注入 0 元贈品行（見 pricing.ts）
 *   - points_multiplier→ 疊乘進 Orders 既有的發點鏈（tier × 訂閱 × 活動）
 *   - grant_reward     → 寫既有的 UserRewards（寶物箱），不另造 XP 帳本
 *
 * 真正的 XP/Level/Mission 帳本仍屬 P1；這裡只確保「規則設了就真的發得出去」。
 */
import type { Payload } from 'payload'
import type { RewardIntent } from './types'

/** 從訂單的 promotion 快照取出 reward intents（欄位是 JSON，型別要自己收斂） */
export function readRewardIntents(doc: Record<string, unknown> | null | undefined): RewardIntent[] {
  const promo = doc?.promotion as Record<string, unknown> | undefined
  const raw = promo?.rewardIntents
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (r): r is RewardIntent =>
      Boolean(r) && typeof r === 'object' && typeof (r as RewardIntent).type === 'string',
  )
}

/**
 * 活動點數倍率：把所有 points_multiplier intent 連乘起來。
 * 找不到 → 1（不影響既有 tier × 訂閱 的計算）。
 * 防呆：非正數或非有限值一律忽略，避免把發點數算成 0 或 NaN。
 */
export function campaignPointsMultiplier(intents: RewardIntent[]): number {
  let m = 1
  for (const i of intents) {
    if (i.type !== 'points_multiplier') continue
    const v = Number(i.multiplier)
    if (Number.isFinite(v) && v > 0) m *= v
  }
  return m
}

/**
 * grant_reward → 寫進既有 UserRewards（寶物箱）。
 *
 * 冪等：以 `sourceRecord` 記 `order:<orderId>:<ruleKey>`，寫入前先查有沒有
 * 同一把 key 的紀錄。付款狀態 hook 可能因為 nested update 重跑，沒有這道
 * 檢查會重複發獎。
 *
 * 失敗不拋出——發獎失敗不該讓訂單付款流程整個炸掉，記 log 由人工補發。
 */
export async function grantIntentRewards(
  payload: Payload,
  args: {
    userId: number | string
    orderId: number | string
    orderNumber?: string
    intents: RewardIntent[]
  },
): Promise<{ granted: number; skipped: number }> {
  let granted = 0
  let skipped = 0
  for (const intent of args.intents) {
    if (intent.type !== 'grant_reward') continue
    const rewardKey = String(intent.rewardKey ?? '').trim()
    if (!rewardKey) continue
    try {
      // 冪等：UserRewards.sourceRecord 是指向 mini-game-records 的 relationship，
      // 塞不了字串 key，所以改用「同一張訂單 + 同一個獎項名稱」判重。
      // （attachedToOrder 是 relationTo:'orders'，正好可用。）
      const existing = await payload.find({
        collection: 'user-rewards',
        where: {
          and: [
            { attachedToOrder: { equals: args.orderId } },
            { displayName: { equals: rewardKey } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        skipped += 1
        continue
      }
      const qty = Math.max(1, Math.floor(Number(intent.quantity) || 1))
      await payload.create({
        collection: 'user-rewards',
        data: {
          user: args.userId,
          // rewardType 是 required 且為封閉 enum，由規則作者在後台指定；
          // 沒指定時退回 'voucher'（客服履行兌換券）——語意上最接近
          // 「活動發的、需人工或後續流程履行的獎項」，且確定是合法值。
          rewardType: intent.rewardType ?? 'voucher',
          displayName: rewardKey,
          amount: qty,
          state: 'unused',
          attachedToOrder: args.orderId,
        } as never,
        overrideAccess: true,
      })
      granted += 1
    } catch (err) {
      payload.logger.error({
        err,
        msg: '[rewardOrchestrator] grant_reward 發放失敗（不阻斷訂單）',
        orderNumber: args.orderNumber,
        rewardKey,
      })
    }
  }
  return { granted, skipped }
}
