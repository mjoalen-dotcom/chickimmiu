import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * InventoryTransactions 庫存異動流水帳（append-only log）
 * ────────────────────────────────────────────────────
 * 對標 Shopline 進銷存的「庫存異動紀錄」。每筆 = 一次庫存變動，方便查帳 / 追溯。
 *
 * 寫入來源（皆走 lib/inventory/server.ts，payload.local）：
 *   - sale_out：訂單扣庫存（Orders afterChange）
 *   - return_in：退貨回補（Returns afterChange）
 *   - purchase_in：進貨單收貨（PurchaseOrders afterChange）
 *   - stocktake：盤點調整（StockTakes afterChange）
 *   - adjust / transfer：手動 / 調撥
 *
 * 純 log：本 collection 沒有會改 products.stock 的 hook（庫存由各來源流程自己改），
 * 故不會有重複加扣。admin 手動建一筆只是補記錄，不會自動動庫存。
 */
export const InventoryTransactions: CollectionConfig = {
  slug: 'inventory-transactions',
  labels: { singular: '庫存異動', plural: '庫存異動' },
  admin: {
    group: '② 商品管理',
    useAsTitle: 'id',
    defaultColumns: ['product', 'sku', 'type', 'quantityDelta', 'balanceAfter', 'createdAt'],
    description:
      '庫存異動流水帳（進貨 / 銷售 / 退貨 / 盤點 / 調整）。查帳用；庫存實際值在商品本身。',
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
    listSearchableFields: ['sku', 'note'],
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  timestamps: true,
  fields: [
    {
      name: 'product',
      label: '商品',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'sku', label: '變體 SKU（空=主庫存）', type: 'text', admin: { width: '40%' } },
        {
          name: 'type',
          label: '異動類型',
          type: 'select',
          required: true,
          index: true,
          admin: { width: '30%' },
          options: [
            { label: '進貨入庫', value: 'purchase_in' },
            { label: '銷售出庫', value: 'sale_out' },
            { label: '退貨回補', value: 'return_in' },
            { label: '盤點調整', value: 'stocktake' },
            { label: '手動調整', value: 'adjust' },
            { label: '調撥', value: 'transfer' },
          ],
        },
        {
          name: 'quantityDelta',
          label: '異動量（+入 / −出）',
          type: 'number',
          required: true,
          admin: { width: '30%' },
        },
      ],
    },
    {
      name: 'balanceAfter',
      label: '異動後庫存',
      type: 'number',
      admin: { description: '異動後該 SKU / 主庫存的餘額快照' },
    },
    { name: 'relatedOrder', label: '相關訂單', type: 'relationship', relationTo: 'orders' },
    {
      name: 'relatedPurchaseOrder',
      label: '相關進貨單',
      type: 'relationship',
      relationTo: 'purchase-orders',
    },
    {
      name: 'relatedStockTake',
      label: '相關盤點',
      type: 'relationship',
      relationTo: 'stock-takes',
    },
    { name: 'note', label: '備註', type: 'textarea' },
  ],
}
