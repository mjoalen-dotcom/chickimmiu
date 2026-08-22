import type { Payload } from 'payload'

/**
 * 會員通知產生端共用 helper（2026-08-22 需求 ③）
 * ─────────────────────────────────────────────
 * - createNotification：fire-and-forget。通知只是副作用，任何失敗都
 *   不能擋主流程（訂單 hook / 點數入帳），只 console.error。
 * - pickRelationId：Payload relationship 值可能是 string / number / 物件
 *   （depth 而定）— 只認 string 會讓整段靜默跳過（08-14 超賣防線、
 *   08-21 扣庫存鏈都踩過同一坑），一律走這裡正規化。
 */

export function pickRelationId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'string' || typeof val === 'number') return val
  if (typeof val === 'object') {
    const id = (val as Record<string, unknown>).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export type NotificationCategory = 'order' | 'points' | 'promo' | 'blog' | 'system'

export async function createNotification(
  payload: Payload,
  args: {
    recipient: string | number
    category: NotificationCategory
    title: string
    body?: string
    link?: string
    meta?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await (payload.create as (a: {
      collection: 'notifications'
      data: Record<string, unknown>
      overrideAccess?: boolean
    }) => Promise<unknown>)({
      collection: 'notifications',
      data: {
        recipient: args.recipient,
        category: args.category,
        title: args.title,
        body: args.body ?? null,
        link: args.link ?? null,
        meta: args.meta ?? null,
      },
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[notifications] createNotification failed:', err)
  }
}
