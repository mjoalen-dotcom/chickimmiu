import type { Payload } from 'payload'

/**
 * 進銷存 server 工具
 * ──────────────────
 * adjustStock：調整商品庫存（base 或指定 sku 變體）。delta 加減；setTo 設絕對值。回傳新餘額。
 * recordInventory：寫一筆 inventory-transactions 流水（純 log，不動庫存）。
 * moveStock：調庫存 + 寫 log（用於 PO 進貨 / 盤點）。
 *
 * 全走 payload.local（overrideAccess）。InventoryTransactions 是純 log collection，
 * 沒有會改庫存的 hook，故這裡不會有重複加扣問題。
 */

export type InventoryType =
  | 'purchase_in' // 進貨入庫
  | 'sale_out' // 銷售出庫
  | 'return_in' // 退貨回補
  | 'adjust' // 手動調整
  | 'stocktake' // 盤點調整
  | 'transfer' // 調撥

type P = Record<string, unknown>

/** 調整庫存（base 或 sku 變體）；delta 加減 / setTo 設絕對值。回傳新餘額，找不到商品回 null。 */
export async function adjustStock(
  payload: Payload,
  args: { productId: string | number; sku?: string; delta?: number; setTo?: number },
): Promise<number | null> {
  const product = (await payload
    .findByID({ collection: 'products', id: args.productId, depth: 0 })
    .catch(() => null)) as P | null
  if (!product) return null

  if (args.sku) {
    const variants = (product.variants as Array<{ sku?: string; stock?: number }>) || []
    let newBal: number | null = null
    const updated = variants.map((v) => {
      if (v.sku === args.sku) {
        const cur = Number(v.stock) || 0
        newBal = args.setTo != null ? Math.max(0, args.setTo) : Math.max(0, cur + (args.delta || 0))
        return { ...v, stock: newBal }
      }
      return v
    })
    if (newBal == null) return null // sku 不存在
    await payload.update({
      collection: 'products',
      id: args.productId,
      data: { variants: updated } as never,
      overrideAccess: true,
    })
    return newBal
  }

  const cur = Number(product.stock) || 0
  const newBal = args.setTo != null ? Math.max(0, args.setTo) : Math.max(0, cur + (args.delta || 0))
  await payload.update({
    collection: 'products',
    id: args.productId,
    data: { stock: newBal } as never,
    overrideAccess: true,
  })
  return newBal
}

export interface InventoryLogInput {
  productId: string | number
  sku?: string
  type: InventoryType
  quantityDelta: number
  balanceAfter?: number
  relatedOrder?: string | number
  relatedPurchaseOrder?: string | number
  relatedStockTake?: string | number
  note?: string
}

/** 只寫流水帳（不動庫存）。 */
export async function recordInventory(payload: Payload, input: InventoryLogInput): Promise<void> {
  try {
    await payload.create({
      collection: 'inventory-transactions',
      data: {
        product: input.productId,
        sku: input.sku,
        type: input.type,
        quantityDelta: input.quantityDelta,
        balanceAfter: input.balanceAfter,
        relatedOrder: input.relatedOrder,
        relatedPurchaseOrder: input.relatedPurchaseOrder,
        relatedStockTake: input.relatedStockTake,
        note: input.note,
      } as never,
      overrideAccess: true,
    })
  } catch (e) {
    console.error('[inventory] recordInventory 失敗:', e)
  }
}

/** 調庫存 + 寫流水（進貨 / 盤點絕對值）。回傳新餘額。 */
export async function moveStock(
  payload: Payload,
  args: {
    productId: string | number
    sku?: string
    delta?: number
    setTo?: number
    type: InventoryType
    relatedOrder?: string | number
    relatedPurchaseOrder?: string | number
    relatedStockTake?: string | number
    note?: string
  },
): Promise<number | null> {
  const newBal = await adjustStock(payload, args)
  if (newBal == null) return null
  // setTo 時 delta = 設定值 - 不可知舊值，故 quantityDelta 以傳入 delta 為準（盤點會另算）
  await recordInventory(payload, {
    productId: args.productId,
    sku: args.sku,
    type: args.type,
    quantityDelta: args.delta ?? 0,
    balanceAfter: newBal,
    relatedOrder: args.relatedOrder,
    relatedPurchaseOrder: args.relatedPurchaseOrder,
    relatedStockTake: args.relatedStockTake,
    note: args.note,
  })
  return newBal
}
