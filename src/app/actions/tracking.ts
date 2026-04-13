'use server'

import { sendMetaCAPI } from '@/lib/tracking'
import type { CAPIEventData } from '@/lib/tracking'

/**
 * Server Action：發送 Meta Conversions API 事件
 * 從結帳成功等需要 server-side 追蹤的場景呼叫
 */
export async function sendServerPurchaseEvent(data: {
  transactionId: string
  value: number
  currency: string
  items: { id: string; name: string; quantity: number }[]
  userEmail?: string
  userAgent?: string
  sourceUrl?: string
}) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || ''
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN || ''

  if (!pixelId || !accessToken) return

  const event: CAPIEventData = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: data.sourceUrl,
    user_data: {
      client_user_agent: data.userAgent,
      ...(data.userEmail
        ? {
            em: [
              // Meta 要求 SHA-256 hash，正式環境應先 hash
              data.userEmail.toLowerCase().trim(),
            ],
          }
        : {}),
    },
    custom_data: {
      currency: data.currency,
      value: data.value,
      content_ids: data.items.map((i) => i.id),
      contents: data.items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
      })),
      content_type: 'product',
      order_id: data.transactionId,
    },
  }

  await sendMetaCAPI(pixelId, accessToken, [event])
}
