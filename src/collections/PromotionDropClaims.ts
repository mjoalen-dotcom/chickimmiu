import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * PromotionDropClaims — 限量券包／神秘禮物的領取憑據（CHIC Commerce OS P0-B）
 *
 * 兩個職責，都是既有機制做不到的：
 *
 * 1. **「每人每檔活動 1 次」的 DB 級硬約束**。evaluator 的 perUserLimit 只吃
 *    usage snapshot（下單後才有的 promotion-applications count），是報價期的
 *    軟檢查、有 TOCTOU：同一個人同時送兩張單，兩邊都會看到「還沒領過」。
 *    真正的防線是 `idempotencyKey` 的 UNIQUE index —— 第二筆 insert 直接被 DB 擋。
 *    idempotencyKey = `${ruleKey}:u${userId}`，單欄 unique 就同時提供「每人 1 次」
 *    與「重放冪等」兩件事，不必宣告複合 index。
 *
 * 2. **退款回沖時「這張單發過什麼」的唯一憑據**。現有的取消還原只撈
 *    state='pending_attach' 的 user-rewards，而促銷發的獎是 state='unused'，
 *    查詢條件永遠不匹配 —— 退款完全不回沖已發出的獎。回沖三件事（quota、
 *    獎品庫存、活動預算）必須成套，少一件就是單向漏。
 *
 * ⚠️ `user` 設 required 是刻意的：PG 的 unique index **不擋 NULL**，訪客若
 * user=NULL 則同一個 key 可以插無限筆、約束等於零。而且訪客結帳每筆都新建一個
 * isGuest 臨時帳號，任何以 user id 為鍵的「每人 1 次」對訪客本來就是零約束。
 * 所以本功能限登入會員（見 orderPricingHook 的 userId==null 直接略過）。
 */
export const PromotionDropClaims: CollectionConfig = {
  slug: 'promotion-drop-claims',
  labels: { singular: '限量領取紀錄', plural: '限量領取紀錄' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'idempotencyKey',
    defaultColumns: ['idempotencyKey', 'user', 'order', 'effectType', 'status', 'createdAt'],
    listSearchableFields: ['idempotencyKey', 'ruleKey'],
    description: '限量券包／神秘禮物的領取憑據：每人每檔 1 次的硬約束 + 退款回沖依據',
  },
  access: {
    read: isAdmin,
    // 前台一律走伺服器路徑（overrideAccess），不開任何前台寫入
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'idempotencyKey',
      label: '冪等鍵',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: '`${ruleKey}:u${userId}` —— UNIQUE 同時擔任「每人每檔 1 次」與重放冪等',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'campaign',
          label: '所屬活動',
          type: 'relationship',
          relationTo: 'marketing-campaigns',
          admin: { readOnly: true },
        },
        {
          name: 'rule',
          label: '促銷規則',
          type: 'relationship',
          relationTo: 'promotion-rules' as never,
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'ruleKey',
          label: '規則鍵',
          type: 'text',
          required: true,
          index: true,
          admin: { readOnly: true },
        },
        {
          name: 'effectType',
          label: '效果類型',
          type: 'text',
          required: true,
          admin: { readOnly: true, description: 'coupon_drop / mystery_gift' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'user',
          label: '會員',
          type: 'relationship',
          relationTo: 'customers',
          required: true,
          index: true,
          admin: { readOnly: true, description: '本功能限登入會員（PG unique 不擋 NULL）' },
        },
        {
          name: 'order',
          label: '訂單',
          type: 'relationship',
          relationTo: 'orders',
          index: true,
          admin: { readOnly: true },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          required: true,
          defaultValue: 'reserved',
          options: [
            { label: '已預留（下單時）', value: 'reserved' },
            { label: '已發放（付款後）', value: 'granted' },
            { label: '已回沖（退款/取消）', value: 'reversed' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'budgetCostAmount',
          label: '佔用活動預算（NT$）',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: {
            readOnly: true,
            description: '下單時是估算值（獎池最高值），付款後改成實際發出的獎項價值',
          },
        },
        {
          name: 'quotaConsumed',
          label: '已扣總量',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
            description: '回沖時據此決定要不要把 commerce.dropClaimed 減回去（避免重複回沖）',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'prizePool',
          label: '抽中的獎',
          type: 'relationship',
          relationTo: 'prize-pools' as never,
          admin: { readOnly: true, description: '回沖時據此還原獎品庫存' },
        },
        {
          name: 'grantedReward',
          label: '發出的寶物',
          type: 'relationship',
          relationTo: 'user-rewards' as never,
          admin: { readOnly: true },
        },
        {
          name: 'coupon',
          label: '發出的券',
          type: 'relationship',
          relationTo: 'coupons',
          admin: { readOnly: true, description: '動態產生的一次性券；回沖時設為停用' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'grantedAt', label: '發放時間', type: 'date', admin: { readOnly: true } },
        { name: 'reversedAt', label: '回沖時間', type: 'date', admin: { readOnly: true } },
        {
          name: 'reversalReason',
          label: '回沖原因',
          type: 'text',
          admin: { readOnly: true, description: 'order_cancelled / order_refunded' },
        },
      ],
    },
    {
      name: 'notes',
      label: '備註',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: '落地過程的診斷訊息（例如走了保底獎、重抽幾次）',
      },
    },
  ],
  timestamps: true,
}
