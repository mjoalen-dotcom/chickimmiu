import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 物流方式 Collection
 * ──────────────────
 * 後台可設定多種物流商與運費計算規則
 */
export const ShippingMethods: CollectionConfig = {
  slug: 'shipping-methods',
  labels: { singular: '物流方式', plural: '物流方式' },
  admin: {
    group: '訂單管理',
    useAsTitle: 'name',
    description: '管理物流商與運費規則',
    defaultColumns: ['name', 'carrier', 'baseFee', 'isActive'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', label: '物流名稱', type: 'text', required: true, admin: { description: '例如：黑貓宅急便、7-11 超商取貨、郵局包裹' } },
    { name: 'carrier', label: '物流商', type: 'select', required: true, options: [
      { label: '新竹物流', value: 'hct' },
      { label: '黑貓宅急便', value: 'tcat' },
      { label: '7-ELEVEN 超商取貨', value: '711' },
      { label: '全家超商取貨', value: 'family' },
      { label: '萊爾富超商取貨', value: 'hilife' },
      { label: 'OK 超商取貨', value: 'ok' },
      { label: '中華郵政', value: 'post' },
      { label: '面交自取', value: 'meetup' },
      { label: '國際快遞 DHL', value: 'dhl' },
      { label: '國際快遞 FedEx', value: 'fedex' },
      { label: '其他', value: 'other' },
    ]},
    { name: 'description', label: '說明', type: 'textarea' },
    { name: 'baseFee', label: '基本運費（TWD）', type: 'number', required: true, defaultValue: 60 },
    { name: 'freeShippingThreshold', label: '免運門檻（TWD）', type: 'number', defaultValue: 1000, admin: { description: '訂單金額超過此門檻免運，0=無免運' } },
    { name: 'estimatedDays', label: '預計送達天數', type: 'text', admin: { description: '例如：1-3 個工作天' } },
    { name: 'maxWeight', label: '最大重量（kg）', type: 'number' },
    {
      name: 'regions',
      label: '配送區域',
      type: 'select',
      hasMany: true,
      defaultValue: ['taiwan'],
      options: [
        { label: '台灣本島', value: 'taiwan' },
        { label: '離島', value: 'offshore' },
        { label: '國際', value: 'international' },
      ],
    },
    { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },
    { name: 'sortOrder', label: '排序', type: 'number', defaultValue: 0 },
    {
      name: 'trackingFlow',
      label: '物流追蹤流程',
      type: 'array',
      admin: { description: '定義此物流的追蹤狀態步驟' },
      fields: [
        { name: 'step', label: '步驟名稱', type: 'text', required: true },
        { name: 'description', label: '說明', type: 'text' },
        { name: 'icon', label: '圖示', type: 'text', admin: { description: '例如：📦、✈️、🛃、📮' } },
      ],
    },
  ],
}
