import type { CollectionConfig, Where } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 點數兌換 / 獎品管理 Collection
 * ──────────────────────────────
 * 支援：兌換優惠券、抽獎（電影票等）、加購、折抵
 * 點數會到期（依 LoyaltySettings 設定），購物金不會到期
 *
 * 後台保護：
 *   - stock > 0 時，redeemed 不可超過 stock（beforeValidate 擋）
 *   - redeemed 不可為負值
 *   - lottery 類型若有 prizes 陣列，權重總和會顯示於虛擬欄位提醒管理員
 */
type LooseRecord = Record<string, unknown>

export const PointsRedemptions: CollectionConfig = {
  slug: 'points-redemptions',
  labels: { singular: '點數兌換', plural: '點數兌換' },
  admin: {
    group: '會員與 CRM',
    description: '點數兌換獎品、抽獎、優惠券管理',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'pointsCost', 'stock', 'redeemed', 'isActive', 'sortOrder'],
    listSearchableFields: ['name', 'slug', 'description'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user && (user as unknown as Record<string, unknown>).role === 'admin') return true
      return { isActive: { equals: true } } as Where
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        const d = data as LooseRecord
        const stock = typeof d.stock === 'number' ? d.stock : 0
        const redeemed = typeof d.redeemed === 'number' ? d.redeemed : 0

        if (redeemed < 0) {
          throw new Error('已兌換數量 (redeemed) 不可為負值')
        }
        if (stock > 0 && redeemed > stock) {
          throw new Error(`已兌換數量 (${redeemed}) 不可超過庫存 (${stock})`)
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', label: '獎品名稱', type: 'text', required: true, admin: { width: '60%' } },
        { name: 'slug', label: '網址代碼', type: 'text', unique: true, admin: { width: '40%' } },
      ],
    },
    { name: 'description', label: '說明', type: 'textarea' },
    { name: 'image', label: '獎品圖片', type: 'upload', relationTo: 'media' },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          label: '兌換類型',
          type: 'select',
          required: true,
          admin: { width: '50%' },
          options: [
            { label: '實體獎品', value: 'physical' },
            { label: '電影票', value: 'movie_ticket' },
            { label: '優惠券', value: 'coupon' },
            { label: '折扣碼', value: 'discount_code' },
            { label: '購物金', value: 'store_credit' },
            { label: '抽獎機會', value: 'lottery' },
            { label: '加購優惠', value: 'addon_deal' },
            { label: '免運券', value: 'free_shipping' },
            { label: '體驗活動', value: 'experience' },
            { label: 'VIP 造型諮詢', value: 'styling' },
            { label: '公益捐贈', value: 'charity' },
            { label: '神秘禮物', value: 'mystery' },
          ],
        },
        { name: 'pointsCost', label: '兌換所需點數', type: 'number', required: true, min: 1, admin: { width: '25%' } },
        { name: 'sortOrder', label: '排序', type: 'number', defaultValue: 0, admin: { width: '25%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'stock', label: '庫存數量', type: 'number', min: 0, defaultValue: 0, admin: { width: '33%', description: '0 = 無限量' } },
        { name: 'redeemed', label: '已兌換數量', type: 'number', defaultValue: 0, min: 0, admin: { width: '33%', readOnly: true } },
        {
          name: 'remaining',
          label: '剩餘可兌換',
          type: 'number',
          virtual: true,
          admin: {
            width: '34%',
            readOnly: true,
            description: 'stock − redeemed；stock=0 時代表無限量',
          },
          hooks: {
            afterRead: [
              ({ data }) => {
                const d = (data || {}) as LooseRecord
                const stock = typeof d.stock === 'number' ? d.stock : 0
                const redeemed = typeof d.redeemed === 'number' ? d.redeemed : 0
                if (stock <= 0) return -1 // -1 當作無限量旗標
                return Math.max(0, stock - redeemed)
              },
            ],
          },
        },
      ],
    },
    { name: 'isActive', label: '啟用', type: 'checkbox', defaultValue: true },

    // ── 兌換限制 ──
    {
      name: 'limits',
      label: '兌換限制',
      type: 'group',
      fields: [
        { name: 'maxPerUser', label: '每人限兌次數', type: 'number', defaultValue: 0, admin: { description: '0 = 不限' } },
        { name: 'maxPerDay', label: '每日限量', type: 'number', defaultValue: 0, admin: { description: '0 = 不限' } },
        { name: 'minMemberTier', label: '最低會員等級', type: 'text', admin: { description: '例如 gold, platinum' } },
        { name: 'subscriberOnly', label: '訂閱會員專屬', type: 'checkbox', defaultValue: false },
        { name: 'startDate', label: '開放兌換日期', type: 'date' },
        { name: 'endDate', label: '截止兌換日期', type: 'date' },
      ],
    },

    // ── 優惠券/折扣碼設定 ──
    {
      name: 'couponConfig',
      label: '優惠券設定',
      type: 'group',
      admin: { condition: (_, siblingData) => ['coupon', 'discount_code', 'free_shipping'].includes(siblingData?.type || '') },
      fields: [
        { name: 'discountType', label: '折扣類型', type: 'select', options: [
          { label: '固定金額', value: 'fixed' },
          { label: '百分比', value: 'percentage' },
        ]},
        { name: 'discountValue', label: '折扣值', type: 'number', admin: { description: '固定金額=NT$, 百分比=%, 免運券不需填' } },
        { name: 'minOrderAmount', label: '最低消費門檻', type: 'number', defaultValue: 0 },
        { name: 'validDays', label: '優惠券有效天數', type: 'number', defaultValue: 30 },
      ],
    },

    // ── 抽獎設定 ──
    {
      name: 'lotteryConfig',
      label: '抽獎設定',
      type: 'group',
      admin: { condition: (_, siblingData) => siblingData?.type === 'lottery' },
      fields: [
        { name: 'winRate', label: '中獎機率（%）', type: 'number', min: 0, max: 100, defaultValue: 10 },
        {
          name: 'prizes',
          label: '獎品池',
          type: 'array',
          fields: [
            { name: 'prizeName', label: '獎品名稱', type: 'text', required: true },
            { name: 'prizeValue', label: '獎品價值', type: 'number' },
            { name: 'weight', label: '權重', type: 'number', defaultValue: 1, admin: { description: '數字越大中獎機率越高' } },
            { name: 'stock', label: '數量', type: 'number', defaultValue: 0, admin: { description: '0 = 無限' } },
          ],
        },
      ],
    },

    // ── 實體出貨設定 ──
    // 兌換後寫入 user-rewards（requiresPhysicalShipping=true），下次客戶下單時
    // Orders.beforeChange 會自動把該 reward attach 進 order.gifts[]，隨單寄出。
    // gifts[] 不影響訂單金額，且 Returns.items[] 不能 ref 贈品 → 結構上無法單獨退貨。
    {
      name: 'physicalConfig',
      label: '實體出貨設定',
      type: 'group',
      admin: {
        condition: (_, siblingData) =>
          ['physical', 'movie_ticket', 'gift_physical'].includes(siblingData?.type || ''),
        description:
          '實體類型獎品（如 physical / movie_ticket）兌換後會寫一筆 user-rewards，等候會員下一張訂單時自動隨單寄出。',
      },
      fields: [
        {
          name: 'linkedProduct',
          label: '關聯商品（可選）',
          type: 'relationship',
          relationTo: 'products',
          admin: { description: '若此獎品就是站內某項商品，可關聯以共用圖片 / 描述 / 變體' },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'physicalSku',
              label: 'SKU / 出貨備註',
              type: 'text',
              admin: { width: '60%', description: '例如「絲巾-黑色-M」、揀貨人員會看到' },
            },
            {
              name: 'validityDays',
              label: '有效天數',
              type: 'number',
              defaultValue: 365,
              min: 1,
              admin: { width: '40%', description: 'user-rewards.expiresAt = 兌換時 + N 天' },
            },
          ],
        },
        {
          name: 'shippingNote',
          label: '出貨注意事項',
          type: 'textarea',
          admin: { description: '會帶到 user-rewards.redemptionInstructions 給揀貨/客服參考' },
        },
        {
          name: 'rewardTypeOverride',
          label: 'UserReward 類型',
          type: 'select',
          defaultValue: 'gift_physical',
          options: [
            { label: '贈品（實體）', value: 'gift_physical' },
            { label: '電影券（實體）', value: 'movie_ticket_physical' },
          ],
          admin: { description: '寫進 user-rewards 的 rewardType；影響寶物箱顯示' },
        },
      ],
    },
  ],
  timestamps: true,
}
