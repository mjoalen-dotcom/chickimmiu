import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { adjustStock, recordInventory } from '../lib/inventory/server'

/**
 * StockTakes 庫存盤點
 * ────────────────────────────────────────
 * 對標 Shopline 進銷存的「盤點」。每筆盤點列出商品的系統量 vs 實盤量。
 * 狀態設為「已完成」時 afterChange 把庫存校正為實盤量（countedQty），
 * 並寫 inventory-transactions(stocktake, delta=實盤−系統)；applied 旗標防重複。
 */

type LooseRecord = Record<string, unknown>

function pickId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'object') return (val as { id?: string | number }).id ?? null
  return val as string | number
}

export const StockTakes: CollectionConfig = {
  slug: 'stock-takes',
  labels: { singular: '庫存盤點', plural: '庫存盤點' },
  admin: {
    group: '② 商品管理',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'completedAt', 'createdAt'],
    description: '盤點單。狀態設為「已完成」時自動把庫存校正為實盤量並寫流水（防重複）。',
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  timestamps: true,
  hooks: {
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (operation !== 'update' || !previousDoc) return doc
        const prev = String((previousDoc as LooseRecord).status || '')
        const status = String(doc.status || '')
        if (status !== 'completed' || prev === 'completed') return doc
        if ((doc as LooseRecord).applied) return doc

        const items = (doc.items as Array<LooseRecord>) || []
        for (const it of items) {
          const productId = pickId(it.product)
          const counted = Number(it.countedQty)
          if (!productId || !Number.isFinite(counted)) continue
          const system = Number(it.systemQty) || 0
          const sku = it.sku ? String(it.sku) : undefined
          const newBal = await adjustStock(req.payload, { productId, sku, setTo: counted })
          if (newBal == null) continue
          await recordInventory(req.payload, {
            productId,
            sku,
            type: 'stocktake',
            quantityDelta: counted - system,
            balanceAfter: newBal,
            relatedStockTake: doc.id as string | number,
            note: `盤點 #${doc.id}：系統 ${system} → 實盤 ${counted}`,
          })
        }
        await (req.payload.update as (a: {
          collection: 'stock-takes'
          id: string | number
          data: Record<string, unknown>
          overrideAccess?: boolean
        }) => Promise<unknown>)({
          collection: 'stock-takes',
          id: doc.id as string | number,
          data: { applied: true, completedAt: new Date().toISOString() },
          overrideAccess: true,
        })
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'title', label: '盤點標題', type: 'text', admin: { width: '60%' } },
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          index: true,
          admin: { width: '40%' },
          options: [
            { label: '草稿', value: 'draft' },
            { label: '已完成', value: 'completed' },
            { label: '取消', value: 'cancelled' },
          ],
        },
      ],
    },
    {
      name: 'items',
      label: '盤點品項',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'product',
              label: '商品',
              type: 'relationship',
              relationTo: 'products',
              required: true,
              admin: { width: '40%' },
            },
            { name: 'sku', label: '變體 SKU（空=主庫存）', type: 'text', admin: { width: '24%' } },
            { name: 'systemQty', label: '系統量', type: 'number', admin: { width: '18%' } },
            { name: 'countedQty', label: '實盤量', type: 'number', required: true, admin: { width: '18%' } },
          ],
        },
      ],
    },
    {
      name: 'applied',
      label: '已校正庫存',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar', description: '完成後自動校正；旗標防重複。' },
    },
    { name: 'completedAt', label: '完成時間', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'note', label: '備註', type: 'textarea' },
  ],
}
