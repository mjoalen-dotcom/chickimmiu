import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * PromotionApplications — 不可變的促銷套用交易紀錄（CHIC Commerce OS P0-B）
 *
 * - 每筆 = 一張訂單套用了一條規則版本的結果（金額 / 分攤 / 版本 / 來源）。
 * - `idempotencyKey = <orderId>:<ruleKey>` 有 UNIQUE index（migration 建）：
 *   request replay / hook 重跑不會產生第二筆。
 * - 不可變：只允許 server（退款/取消回沖）把 status applied → reversed；
 *   其他任何 update / delete 一律 hook 擋（overrideAccess 也擋不掉 hook）。
 * - 財務對帳以本表 + orders.promotion 快照為準；behavior-events 只做分析。
 */
export const PromotionApplications: CollectionConfig = {
  slug: 'promotion-applications',
  labels: { singular: '促銷套用紀錄', plural: '促銷套用紀錄' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'ruleKey',
    defaultColumns: ['order', 'ruleKey', 'discountAmount', 'status', 'createdAt'],
    listSearchableFields: ['ruleKey', 'couponCode'],
    description: '促銷套用的不可變交易紀錄（回沖只標記 reversed，不刪除）',
  },
  access: {
    read: isAdmin,
    create: () => false, // 僅 server 以 overrideAccess 寫入
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation !== 'update' || !originalDoc) return data
        // 只允許 applied → reversed 的狀態轉換（含 reversedAt / reversalReason）
        const allowed = new Set(['status', 'reversedAt', 'reversalReason', 'updatedAt'])
        for (const key of Object.keys(data ?? {})) {
          if (allowed.has(key)) continue
          if (JSON.stringify(data?.[key]) !== JSON.stringify(originalDoc?.[key])) {
            throw new Error(`促銷套用紀錄不可變：不可修改「${key}」`)
          }
        }
        if (data?.status && data.status !== originalDoc.status) {
          if (!(originalDoc.status === 'applied' && data.status === 'reversed')) {
            throw new Error('僅允許 applied → reversed 的狀態轉換')
          }
        }
        return data
      },
    ],
    beforeDelete: [
      () => {
        throw new Error('促銷套用紀錄不可刪除（財務交易資料）')
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'order',
          label: '訂單',
          type: 'relationship',
          relationTo: 'orders',
          required: true,
          index: true,
        },
        { name: 'user', label: '會員', type: 'relationship', relationTo: 'users', index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'campaign',
          label: '活動',
          type: 'relationship',
          relationTo: 'marketing-campaigns',
          index: true,
        },
        { name: 'rule', label: '規則', type: 'relationship', relationTo: 'promotion-rules', index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'ruleKey',
          label: 'Rule Key',
          type: 'text',
          required: true,
          index: true,
          admin: { description: 'campaignId:slug:vN（coupon 來源為 coupon:code:v1）' },
        },
        { name: 'version', label: '規則版本', type: 'number', required: true, min: 1 },
        {
          name: 'source',
          label: '來源',
          type: 'select',
          required: true,
          options: [
            { label: '活動規則', value: 'campaign_rule' },
            { label: '優惠券', value: 'coupon' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'couponCode', label: '券碼', type: 'text' },
        { name: 'effectType', label: '效果類型', type: 'text', required: true },
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          required: true,
          defaultValue: 'applied',
          index: true,
          options: [
            { label: '已套用', value: 'applied' },
            { label: '已回沖', value: 'reversed' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'discountAmount', label: '商品折抵', type: 'number', required: true, min: 0 },
        { name: 'shippingDiscountAmount', label: '運費折抵', type: 'number', defaultValue: 0, min: 0 },
        {
          name: 'budgetCostAmount',
          label: '佔用活動預算（非折抵）',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: {
            description:
              '贈品成本／點數面額／獎項價值。顧客不會少付這筆錢，但活動預算會被佔用。回沖時讀的是這一欄（快照只在下單時用），漏寫就會扣得到、退不回。',
          },
        },
      ],
    },
    {
      name: 'allocations',
      label: '行分攤明細',
      type: 'json',
      admin: { description: '[{ lineId, amount }]，加總 = 商品折抵' },
    },
    {
      name: 'idempotencyKey',
      label: 'Idempotency Key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'reversedAt', label: '回沖時間', type: 'date' },
        { name: 'reversalReason', label: '回沖原因', type: 'text' },
      ],
    },
  ],
  timestamps: true,
}
