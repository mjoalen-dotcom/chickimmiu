import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * PointsTransactions 帳本
 * ────────────────────────────────────────────────────
 * 運作模式（兩條互不衝突的路徑）：
 *   1. 後台（admin REST/GraphQL）— 手動建立異動：hooks 會自動
 *      a) 從使用者當前 points 推算 balance（若未填）
 *      b) 依 amount 同步 Users.points 餘額
 *      c) 修改 amount 時以 delta 逆向修正；刪除時逆向 amount
 *   2. 伺服端程式碼（payload.local API）— gameActions / cron / redemption API：
 *      這些呼叫本來就會自行 update users.points，所以以 req.payloadAPI === 'local'
 *      為閘門，hooks 會跳過，避免重複加扣。
 */

type LooseRecord = Record<string, unknown>

function pickUserId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'string' || typeof val === 'number') return val
  if (typeof val === 'object') {
    const id = (val as LooseRecord).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export const PointsTransactions: CollectionConfig = {
  slug: 'points-transactions',
  labels: { singular: '點數異動', plural: '點數異動' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'description',
    defaultColumns: ['user', 'type', 'amount', 'balance', 'source', 'createdAt'],
    description: '會員點數異動紀錄（正數=獲得、負數=扣除；balance 為異動後餘額）',
    listSearchableFields: ['description'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (req.payloadAPI === 'local') return data
        if (operation !== 'create') return data

        // balance 未填 → 從使用者當前點數計算
        if (data.balance === undefined || data.balance === null) {
          const userId = pickUserId(data.user)
          const amount = typeof data.amount === 'number' ? data.amount : 0
          if (userId) {
            const user = (await req.payload.findByID({
              collection: 'users',
              id: userId,
              depth: 0,
            })) as unknown as LooseRecord
            const current = (user?.points as number) ?? 0
            data.balance = Math.max(0, current + amount)
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (req.payloadAPI === 'local') return doc

        const userId = pickUserId(doc.user)
        if (!userId) return doc

        let delta = 0
        if (operation === 'create') {
          delta = typeof doc.amount === 'number' ? doc.amount : 0
        } else if (operation === 'update' && previousDoc) {
          const prev = typeof previousDoc.amount === 'number' ? previousDoc.amount : 0
          const curr = typeof doc.amount === 'number' ? doc.amount : 0
          delta = curr - prev
        }
        if (delta === 0) return doc

        const user = (await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
        })) as unknown as LooseRecord
        const current = (user?.points as number) ?? 0
        const next = Math.max(0, current + delta)

        await (req.payload.update as (args: {
          collection: 'users'
          id: string | number
          data: Record<string, unknown>
        }) => Promise<unknown>)({
          collection: 'users',
          id: userId,
          data: { points: next },
        })

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (req.payloadAPI === 'local') return
        const userId = pickUserId((doc as LooseRecord).user)
        if (!userId) return
        const amount = typeof (doc as LooseRecord).amount === 'number' ? ((doc as LooseRecord).amount as number) : 0
        if (amount === 0) return

        const user = (await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
        })) as unknown as LooseRecord
        const current = (user?.points as number) ?? 0
        const next = Math.max(0, current - amount)

        await (req.payload.update as (args: {
          collection: 'users'
          id: string | number
          data: Record<string, unknown>
        }) => Promise<unknown>)({
          collection: 'users',
          id: userId,
          data: { points: next },
        })
      },
    ],
  },
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          label: '類型',
          type: 'select',
          admin: { width: '33%' },
          options: [
            { label: '獲得', value: 'earn' },
            { label: '兌換', value: 'redeem' },
            { label: '過期', value: 'expire' },
            { label: '管理員調整', value: 'admin_adjust' },
            { label: '退款扣回', value: 'refund_deduct' },
          ],
        },
        {
          name: 'amount',
          label: '數量',
          type: 'number',
          required: true,
          admin: {
            width: '33%',
            description: '正數=獲得、負數=扣除',
          },
        },
        {
          name: 'balance',
          label: '異動後餘額',
          type: 'number',
          admin: {
            width: '33%',
            description: '留空則自動依會員當前點數計算',
          },
        },
      ],
    },
    {
      name: 'source',
      label: '來源',
      type: 'select',
      options: [
        { label: '購買', value: 'purchase' },
        { label: '評價', value: 'review' },
        { label: '推薦', value: 'referral' },
        { label: '生日', value: 'birthday' },
        { label: '月度獎勵', value: 'monthly_bonus' },
        { label: '遊戲', value: 'game' },
        { label: '兌換', value: 'redemption' },
        { label: '訂單退款', value: 'order_refund' },
        { label: '管理員', value: 'admin' },
        { label: '點數過期', value: 'points_expiry' },
        { label: '歡迎禮', value: 'welcome' },
        { label: '升等贈點', value: 'tier_upgrade' },
        { label: '銷毀造型卡', value: 'card_burn' },
      ],
    },
    {
      name: 'description',
      label: '說明',
      type: 'text',
    },
    {
      name: 'relatedOrder',
      label: '相關訂單',
      type: 'relationship',
      relationTo: 'orders',
    },
    {
      name: 'expiresAt',
      label: '過期時間',
      type: 'date',
      admin: {
        description: '參考用；實際到期由 FIFO（createdAt + LoyaltySettings.pointsExpiryDays）決定',
      },
    },
  ],
}
