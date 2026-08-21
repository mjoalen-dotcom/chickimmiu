/**
 * 兌換商品 badge 計算（server-only 共用）
 * ─────────────────────────────────────
 * B-6（APP 遷移需求 2026-08-20）：badge 原本只在 /account/points server
 * component 內計算，GET /api/v1/points 沒有帶出，App 無從推導「熱門」等
 * 標籤。抽成共用函式讓網站與 API 同一套規則。
 *
 * scarcity 門檻來自 point-redemption-settings global（一般會員可讀）。
 * 已知 badge 值：即將售完 / 熱門 / 驚喜 / 愛心 / 專屬 / VIP（前端負責上色）。
 */

type LooseRecord = Record<string, unknown>

export interface BadgeScarcity {
  lowStockThreshold: number
  hotBadgeThreshold: number
}

export function computeRedemptionBadge(
  item: LooseRecord,
  scarcity: BadgeScarcity,
): string | null {
  const stock = (item.stock as number) ?? 0
  const redeemed = (item.redeemed as number) ?? 0
  const type = item.type as string
  const limits = item.limits as LooseRecord | undefined
  const remaining = stock > 0 ? stock - redeemed : null

  if (remaining !== null && remaining <= scarcity.lowStockThreshold) return '即將售完'
  if (redeemed >= scarcity.hotBadgeThreshold) return '熱門'
  if (type === 'mystery') return '驚喜'
  if (type === 'charity') return '愛心'
  if (type === 'styling') return '專屬'
  if (type === 'experience') return 'VIP'
  if (limits?.subscriberOnly) return 'VIP'
  return null
}

/** 從 point-redemption-settings global doc 取 scarcity 門檻（含預設值） */
export function scarcityFromSettings(redemptionSettings: LooseRecord | null | undefined): BadgeScarcity {
  const scarcity = redemptionSettings?.scarcity as LooseRecord | undefined
  return {
    lowStockThreshold: (scarcity?.lowStockThreshold as number) ?? 10,
    hotBadgeThreshold: (scarcity?.hotBadgeThreshold as number) ?? 50,
  }
}
