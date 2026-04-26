/**
 * Customer self-service window for orders.
 *
 * Customers can cancel their own order or edit the shipping address as long as
 * the order has NOT yet been picked up by admin (status === 'pending') AND it
 * was placed less than SELF_SERVICE_WINDOW_MS ago. Convenience-store pickup
 * orders cannot self-edit address because the storeId is locked to an
 * ECPay logistics number that would need to be re-issued — those still need
 * customer service.
 *
 * The 'cancelled' status flip is processed by Orders.ts afterChange hooks
 * which already revoke collectible cards, reverse pending rewards, and send
 * the cancellation email — we do NOT duplicate that logic here.
 */

export const SELF_SERVICE_WINDOW_MS = 30 * 60 * 1000 // 30 min

const CONVENIENCE_CARRIERS = new Set(['711', 'family', 'hilife', 'ok'])

export type SelfServiceEligibility = {
  canCancel: boolean
  canEditAddress: boolean
  /** Absolute timestamp at which the self-service window closes. null when status alone disqualifies. */
  expiresAt: string | null
  /** Human-readable Chinese reason shown to customers when actions are unavailable. */
  reason: string | null
  /** True for convenience-store pickup, where address-edit is structurally blocked. */
  isConvenienceStore: boolean
}

export function getSelfServiceEligibility(
  order: Record<string, unknown> | null | undefined,
): SelfServiceEligibility {
  const ineligibleBase = {
    canCancel: false,
    canEditAddress: false,
    expiresAt: null,
    reason: null,
    isConvenienceStore: false,
  } as const

  if (!order) return { ...ineligibleBase }

  const shippingMethod = (order.shippingMethod as Record<string, unknown> | null) ?? {}
  const carrier = String(shippingMethod.carrier ?? '').toLowerCase()
  const cs = (shippingMethod.convenienceStore as Record<string, unknown> | null) ?? null
  const isConvenienceStore = CONVENIENCE_CARRIERS.has(carrier) || Boolean(cs?.storeName)

  const status = String(order.status ?? '')
  if (status !== 'pending') {
    return {
      ...ineligibleBase,
      isConvenienceStore,
      reason: '訂單已開始處理，如需取消或修改請聯絡客服協助',
    }
  }

  const created = new Date(String(order.createdAt ?? ''))
  if (Number.isNaN(created.getTime())) return { ...ineligibleBase, isConvenienceStore }

  const expiresAt = new Date(created.getTime() + SELF_SERVICE_WINDOW_MS)
  if (Date.now() > expiresAt.getTime()) {
    return {
      canCancel: false,
      canEditAddress: false,
      expiresAt: expiresAt.toISOString(),
      reason: '已超過下單後 30 分鐘自助修改時限，如需取消或修改請聯絡客服協助',
      isConvenienceStore,
    }
  }

  return {
    canCancel: true,
    canEditAddress: !isConvenienceStore,
    expiresAt: expiresAt.toISOString(),
    reason: isConvenienceStore
      ? '超商取貨訂單需透過客服更換取貨門市；訂單仍可自助取消'
      : null,
    isConvenienceStore,
  }
}
