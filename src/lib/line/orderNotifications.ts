import type { Payload } from 'payload'

import { pushMessage, type LineMessage } from './client'

/**
 * 訂單 LINE 推播（確認 / 出貨）
 * ----------------------------
 * 掛在 Orders afterChange（email 通知旁邊），fire-and-forget — caller .catch 接。
 * 規矩同 renderFromTemplate：不 import @payload-config（防模組循環），payload 由 caller 傳。
 * 會員未綁 lineUid / 總開關關閉 / 缺 token → 安靜略過。
 */

type OrderDoc = Record<string, unknown>

function ntd(n: unknown): string {
  const num = Number(n)
  return Number.isFinite(num) ? `NT$ ${num.toLocaleString('zh-TW')}` : '—'
}

async function getOrderLineUid(payload: Payload, order: OrderDoc): Promise<string | null> {
  const customer = order.customer
  const customerId =
    typeof customer === 'object' && customer !== null
      ? (customer as { id?: string | number }).id
      : (customer as string | number | undefined)
  if (customerId === undefined || customerId === null) return null
  try {
    const user = (await payload.findByID({
      collection: 'users',
      id: customerId,
      depth: 0,
    })) as unknown as { lineUid?: string }
    return typeof user.lineUid === 'string' && user.lineUid ? user.lineUid : null
  } catch {
    return null
  }
}

const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://pre.chickimmiu.com'

/** 簡潔 Flex bubble：標題 + 訂單號 + 金額 +（選配）物流 + 查看訂單按鈕 */
function orderFlexBubble(opts: {
  altText: string
  title: string
  subtitle: string
  orderNumber: string
  total: unknown
  trackingLine?: string
  orderId?: string | number
}): LineMessage {
  const bodyContents: Record<string, unknown>[] = [
    { type: 'text', text: opts.title, weight: 'bold', size: 'lg', color: '#2C2C2C' },
    { type: 'text', text: opts.subtitle, size: 'sm', color: '#6B6B6B', wrap: true, margin: 'sm' },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            { type: 'text', text: '訂單編號', size: 'sm', color: '#9B9B9B', flex: 2 },
            { type: 'text', text: opts.orderNumber, size: 'sm', color: '#2C2C2C', flex: 4, wrap: true },
          ],
        },
        {
          type: 'box',
          layout: 'baseline',
          contents: [
            { type: 'text', text: '訂單金額', size: 'sm', color: '#9B9B9B', flex: 2 },
            { type: 'text', text: ntd(opts.total), size: 'sm', color: '#C19A5B', weight: 'bold', flex: 4 },
          ],
        },
        ...(opts.trackingLine
          ? [
              {
                type: 'box',
                layout: 'baseline',
                contents: [
                  { type: 'text', text: '物流', size: 'sm', color: '#9B9B9B', flex: 2 },
                  { type: 'text', text: opts.trackingLine, size: 'sm', color: '#2C2C2C', flex: 4, wrap: true },
                ],
              },
            ]
          : []),
      ],
    },
  ]

  return {
    type: 'flex',
    altText: opts.altText,
    contents: {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', contents: bodyContents },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#C19A5B',
            action: {
              type: 'uri',
              label: '查看訂單',
              uri: opts.orderId
                ? `${SITE_URL()}/account/orders/${opts.orderId}`
                : `${SITE_URL()}/account/orders`,
            },
          },
        ],
      },
    },
  }
}

/** 訂單確認（pending → processing，與確認信同時機） */
export async function sendOrderConfirmationLine(payload: Payload, order: OrderDoc): Promise<void> {
  const lineUid = await getOrderLineUid(payload, order)
  if (!lineUid) return
  const orderNumber = String(order.orderNumber || '')
  const items = (order.items as Array<{ quantity?: number }> | undefined) || []
  const itemCount = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0)
  const msg = orderFlexBubble({
    altText: `【CHIC KIM & MIU】訂單成立 ${orderNumber}`,
    title: '訂單成立 🎉',
    subtitle: `感謝您的訂購！共 ${itemCount} 件商品，我們會盡快為您安排出貨。`,
    orderNumber,
    total: order.total,
    orderId: order.id as string | number | undefined,
  })
  await pushMessage(payload, lineUid, [msg])
}

/** 出貨通知（status → shipped，與出貨信同時機） */
export async function sendOrderShippedLine(payload: Payload, order: OrderDoc): Promise<void> {
  const lineUid = await getOrderLineUid(payload, order)
  if (!lineUid) return
  const orderNumber = String(order.orderNumber || '')
  const sm = order.shippingMethod as
    | { carrier?: string; trackingNumber?: string; methodName?: string }
    | undefined
  const trackingLine =
    [sm?.carrier || sm?.methodName, sm?.trackingNumber].filter(Boolean).join(' ') || undefined
  const msg = orderFlexBubble({
    altText: `【CHIC KIM & MIU】訂單已出貨 ${orderNumber}`,
    title: '訂單已出貨 📦',
    subtitle: '您的商品已交給物流，請留意配送通知並備妥收件準備。',
    orderNumber,
    total: order.total,
    trackingLine,
    orderId: order.id as string | number | undefined,
  })
  await pushMessage(payload, lineUid, [msg])
}
