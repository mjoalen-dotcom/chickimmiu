import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { moveStock } from '../lib/inventory/server'

/**
 * PurchaseOrders 進貨單（採購單）
 * ────────────────────────────────────────
 * 對標 Shopline 進銷存的「進貨單」。狀態：草稿 → 已下單 → 已收貨 / 取消。
 * 收貨（status=received）時 afterChange 自動把每個品項數量入庫（products.stock）
 * 並寫 inventory-transactions(purchase_in)；stockApplied 旗標防重複入庫。
 */

type LooseRecord = Record<string, unknown>

function pickId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'object') return (val as { id?: string | number }).id ?? null
  return val as string | number
}

export const PurchaseOrders: CollectionConfig = {
  slug: 'purchase-orders',
  labels: { singular: '進貨單', plural: '進貨單' },
  admin: {
    group: '② 商品管理',
    useAsTitle: 'poNumber',
    defaultColumns: ['poNumber', 'supplierName', 'status', 'totalCost', 'receivedDate', 'createdAt'],
    description: '採購 / 進貨單。狀態設為「已收貨」時自動入庫並寫庫存流水（防重複）。',
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
    listSearchableFields: ['poNumber', 'supplierName'],
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  timestamps: true,
  hooks: {
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (operation !== 'update' || !previousDoc) return doc
        const prev = String((previousDoc as LooseRecord).status || '')
        const status = String(doc.status || '')
        if (status !== 'received' || prev === 'received') return doc
        if ((doc as LooseRecord).stockApplied) return doc

        const items = (doc.items as Array<LooseRecord>) || []
        for (const it of items) {
          const productId = pickId(it.product)
          const qty = Number(it.quantity) || 0
          if (!productId || qty <= 0) continue
          await moveStock(req.payload, {
            productId,
            sku: it.sku ? String(it.sku) : undefined,
            delta: qty,
            type: 'purchase_in',
            relatedPurchaseOrder: doc.id as string | number,
            note: `進貨單 #${doc.id} 收貨`,
          })
        }
        await (req.payload.update as (a: {
          collection: 'purchase-orders'
          id: string | number
          data: Record<string, unknown>
          overrideAccess?: boolean
        }) => Promise<unknown>)({
          collection: 'purchase-orders',
          id: doc.id as string | number,
          data: { stockApplied: true, receivedDate: new Date().toISOString() },
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
        { name: 'poNumber', label: '進貨單號', type: 'text', admin: { width: '50%' } },
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          index: true,
          admin: { width: '50%' },
          options: [
            { label: '草稿', value: 'draft' },
            { label: '已下單', value: 'ordered' },
            { label: '已收貨', value: 'received' },
            { label: '取消', value: 'cancelled' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'supplierName', label: '供應商', type: 'text', admin: { width: '50%' } },
        { name: 'expectedDate', label: '預計到貨日', type: 'date', admin: { width: '50%' } },
      ],
    },
    {
      name: 'items',
      label: '進貨品項',
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
            { name: 'sku', label: '變體 SKU（空=主庫存）', type: 'text', admin: { width: '25%' } },
            { name: 'quantity', label: '數量', type: 'number', required: true, admin: { width: '15%' } },
            { name: 'unitCost', label: '單位成本', type: 'number', admin: { width: '20%' } },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'totalCost', label: '總成本', type: 'number', admin: { width: '50%' } },
        { name: 'receivedDate', label: '實際收貨日', type: 'date', admin: { readOnly: true, width: '50%' } },
      ],
    },
    {
      name: 'stockApplied',
      label: '已入庫',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar', description: '收貨後自動入庫；旗標防重複。' },
    },
    { name: 'note', label: '備註', type: 'textarea' },
  ],
}
