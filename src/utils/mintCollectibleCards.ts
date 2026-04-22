import crypto from 'crypto'
import type { Payload } from 'payload'

import { LIMITED_PRICE_THRESHOLD as THRESHOLD } from './collectibleCardConstants'

/**
 * 造型卡 mint 工具。
 *
 * 觸發路徑：
 *   - Orders.afterChange（paymentStatus→paid）→ mintCardsForPaidOrder
 *   - （PR B 加）/api/cards/craft → mintLimitedByCraft
 *   - （PR C 加）/api/points-shop/cards → mintLimitedByPointsShop
 *
 * 本檔 PR A 只實作 mintCardsForPaidOrder + revokeCardsForCancelledOrder。
 *
 * 原子性：SQLite 單進程 JS runtime 天然序列化寫入；同 order hook 內 await
 *   每次 payload.update template（扣 remaining + serial 推進）都是同步完成
 *   才開下一次，不會出現同序號雙開。轉 Postgres 或多 worker 要改 advisory
 *   lock / FOR UPDATE。
 */

const LIMITED_PRICE_THRESHOLD = THRESHOLD

function generateDesignSeed(): string {
  return crypto.randomBytes(16).toString('hex')
}

function generateShareSlug(): string {
  // 32 字元 base62 風格；nanoid 會拉整包依賴，這邊直接 hex 夠用
  return crypto.randomBytes(16).toString('hex')
}

type OrderItem = {
  product: string | number | { id: string | number; price?: number; title?: string; name?: string }
  sku?: string
  quantity: number
  unitPrice?: number
  title?: string
}

type MintOrderArg = {
  id: string | number
  orderNumber?: string
  customer: string | number | { id: string | number }
  items: OrderItem[]
}

type UserSnapshot = {
  id: string | number
  name?: string
  email?: string
}

function pickCustomerId(customer: MintOrderArg['customer']): string | number | null {
  if (!customer) return null
  if (typeof customer === 'string' || typeof customer === 'number') return customer
  return (customer as { id?: string | number }).id ?? null
}

function pickProductId(item: OrderItem): string | number | null {
  if (item.product == null) return null
  if (typeof item.product === 'string' || typeof item.product === 'number') return item.product
  return (item.product as { id?: string | number }).id ?? null
}

/**
 * 訂單付款完成時 mint 卡片：
 *   - 每件 line item × qty → 1 張 common 卡（永遠發）
 *   - unitPrice > 5000 且有 active 藍圖且 salePoolRemaining > 0 → 額外 1 張 limited
 */
export async function mintCardsForPaidOrder(
  payload: Payload,
  order: MintOrderArg,
): Promise<{ commonsMinted: number; limitedMinted: number; errors: string[] }> {
  const errors: string[] = []
  let commonsMinted = 0
  let limitedMinted = 0

  const customerId = pickCustomerId(order.customer)
  if (!customerId) {
    return { commonsMinted, limitedMinted, errors: ['no customer on order'] }
  }

  let userSnapshot: UserSnapshot | null = null
  try {
    const u = await payload.findByID({ collection: 'users', id: customerId as string })
    userSnapshot = {
      id: (u as { id: string | number }).id,
      name: (u as { name?: string }).name,
      email: (u as { email?: string }).email,
    }
  } catch (err) {
    errors.push(`findUser: ${String(err)}`)
    return { commonsMinted, limitedMinted, errors }
  }

  for (const item of order.items ?? []) {
    const productId = pickProductId(item)
    if (!productId) continue
    const qty = Math.max(1, Math.floor(item.quantity || 1))
    const unitPrice = Number(item.unitPrice ?? 0)

    // ── common：每件 qty 一張 ──
    for (let i = 0; i < qty; i++) {
      try {
        const slug = generateShareSlug()
        const card = await (payload.create as Function)({
          collection: 'collectible-cards',
          data: {
            cardType: 'common',
            product: productId,
            owner: customerId,
            originalOwner: customerId,
            status: 'active',
            mintedVia: 'purchase',
            sourceOrder: order.id,
            mintedAt: new Date().toISOString(),
            designSeed: generateDesignSeed(),
            shareSlug: slug,
            ownerNicknameSnapshot: userSnapshot?.name || userSnapshot?.email || '',
            displayTitle: `${item.title || 'Product'}（普通）`,
          },
          overrideAccess: true,
        })
        commonsMinted++
        await (payload.create as Function)({
          collection: 'collectible-card-events',
          data: {
            card: (card as { id: string | number }).id,
            action: 'mint',
            toUser: customerId,
            sourceOrder: order.id,
            notes: `訂單 ${order.orderNumber || order.id} 付款 mint common`,
          },
          overrideAccess: true,
        })
      } catch (err) {
        errors.push(`mint common ${productId}: ${String(err)}`)
      }
    }

    // ── limited：單價 > 5000 才考慮 ──
    if (unitPrice <= LIMITED_PRICE_THRESHOLD) continue

    try {
      const tmplFind = await payload.find({
        collection: 'collectible-card-templates',
        where: {
          and: [
            { product: { equals: productId } },
            { isActive: { equals: true } },
          ],
        },
        limit: 1,
        depth: 0,
      })
      const tmpl = tmplFind.docs[0] as unknown as
        | {
            id: string | number
            salePoolRemaining: number
            nextSerialNo: number
            totalSupply: number
          }
        | undefined
      if (!tmpl) continue
      // 每件 line item（qty 大於 1 也只配一張 limited；
      // 避免單張訂單 10 件直接把限量池刷空）
      if (tmpl.salePoolRemaining < 1) continue

      const serial = tmpl.nextSerialNo
      // 原子推進：先扣 remaining / 推進 serial；失敗時下一個 mint 會從新值抓
      await (payload.update as Function)({
        collection: 'collectible-card-templates',
        id: tmpl.id,
        data: {
          salePoolRemaining: tmpl.salePoolRemaining - 1,
          nextSerialNo: tmpl.nextSerialNo + 1,
        },
        overrideAccess: true,
      })

      const slug = generateShareSlug()
      const card = await (payload.create as Function)({
        collection: 'collectible-cards',
        data: {
          cardType: 'limited',
          product: productId,
          template: tmpl.id,
          serialNo: serial,
          owner: customerId,
          originalOwner: customerId,
          status: 'active',
          mintedVia: 'purchase',
          sourceOrder: order.id,
          mintedAt: new Date().toISOString(),
          designSeed: generateDesignSeed(),
          shareSlug: slug,
          ownerNicknameSnapshot: userSnapshot?.name || userSnapshot?.email || '',
          displayTitle: `${item.title || 'Product'} #${String(serial).padStart(4, '0')}（限量）`,
        },
        overrideAccess: true,
      })
      limitedMinted++
      await (payload.create as Function)({
        collection: 'collectible-card-events',
        data: {
          card: (card as { id: string | number }).id,
          action: 'mint',
          toUser: customerId,
          sourceOrder: order.id,
          notes: `訂單 ${order.orderNumber || order.id} 付款 mint limited #${serial}`,
        },
        overrideAccess: true,
      })
    } catch (err) {
      errors.push(`mint limited ${productId}: ${String(err)}`)
    }
  }

  return { commonsMinted, limitedMinted, errors }
}

/**
 * 訂單取消/退貨時撤回該訂單 mint 的卡片。
 *
 * 策略：
 *   - 只撤 status='active' 的卡（已 burned/transferred 不動）
 *   - serial 不回收（避免空洞；pool remaining 也不退，稀缺承諾保持）
 *   - 寫 revoke event，撤銷通知（PR B 做）
 */
export async function revokeCardsForCancelledOrder(
  payload: Payload,
  orderId: string | number,
  orderNumber?: string,
): Promise<{ revoked: number; errors: string[] }> {
  const errors: string[] = []
  let revoked = 0

  try {
    const cards = await payload.find({
      collection: 'collectible-cards',
      where: {
        and: [
          { sourceOrder: { equals: orderId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 200,
      depth: 0,
    })

    for (const cRaw of cards.docs) {
      const card = cRaw as unknown as { id: string | number; owner?: string | number }
      try {
        await (payload.update as Function)({
          collection: 'collectible-cards',
          id: card.id,
          data: { status: 'revoked', owner: null },
          overrideAccess: true,
        })
        await (payload.create as Function)({
          collection: 'collectible-card-events',
          data: {
            card: card.id,
            action: 'revoke',
            fromUser: card.owner,
            sourceOrder: orderId,
            notes: `訂單 ${orderNumber || orderId} 取消/退貨撤卡`,
          },
          overrideAccess: true,
        })
        revoked++
      } catch (err) {
        errors.push(`revoke ${card.id}: ${String(err)}`)
      }
    }
  } catch (err) {
    errors.push(`find cards: ${String(err)}`)
  }

  return { revoked, errors }
}
