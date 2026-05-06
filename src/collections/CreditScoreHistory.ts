import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * CreditScoreHistory 帳本
 * ────────────────────────────────────────────────────
 * 運作模式（與 PointsTransactions 相同雙路徑）：
 *   1. 後台（admin REST/GraphQL）— 手動建立異動：hooks 會自動
 *      a) 從 Users.creditScore 當前值推算 previousScore / newScore（若未填）
 *      b) 把 newScore 寫回 Users.creditScore
 *      c) 修改 change 值時以 delta 逆向修正；刪除時逆向 change
 *   2. 伺服端程式碼（payload.local API）— lib/crm/creditScoreEngine.ts adjustCreditScore：
 *      已經自己 update users.creditScore，所以 req.payloadAPI === 'local' 時 hooks 跳過。
 *
 * 分數上下限：0 ~ 100
 */

type LooseRecord = Record<string, unknown>

const SCORE_MIN = 0
const SCORE_MAX = 100
const DEFAULT_INITIAL_SCORE = 100

function clampScore(val: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, val))
}

function pickUserId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'string' || typeof val === 'number') return val
  if (typeof val === 'object') {
    const id = (val as LooseRecord).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export const CreditScoreHistory: CollectionConfig = {
  slug: 'credit-score-history',
  labels: { singular: '信用分數異動', plural: '信用分數異動' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'reason',
    defaultColumns: ['user', 'change', 'reason', 'newScore', 'createdAt'],
    description: '會員信用分數異動紀錄（change 為變動值，正數=加分、負數=扣分；分數範圍 0-100）',
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

        const userId = pickUserId(data.user)
        if (!userId) return data

        const change = typeof data.change === 'number' ? data.change : 0

        // 如果沒填 previousScore → 從 Users.creditScore 讀
        if (data.previousScore === undefined || data.previousScore === null) {
          const user = (await req.payload.findByID({
            collection: 'users',
            id: userId,
            depth: 0,
          })) as unknown as LooseRecord
          data.previousScore = (user?.creditScore as number) ?? DEFAULT_INITIAL_SCORE
        }

        // 自動算 newScore（如未填）
        if (data.newScore === undefined || data.newScore === null) {
          const prev = typeof data.previousScore === 'number' ? data.previousScore : DEFAULT_INITIAL_SCORE
          data.newScore = clampScore(prev + change)
        } else if (typeof data.newScore === 'number') {
          data.newScore = clampScore(data.newScore)
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (req.payloadAPI === 'local') return doc
        const userId = pickUserId(doc.user)
        if (!userId) return doc

        if (operation === 'create') {
          // 直接採用 doc.newScore；若空則不動 user
          const next = typeof doc.newScore === 'number' ? clampScore(doc.newScore) : null
          if (next === null) return doc
          await (req.payload.update as (args: {
            collection: 'users'
            id: string | number
            data: Record<string, unknown>
          }) => Promise<unknown>)({
            collection: 'users',
            id: userId,
            data: { creditScore: next },
          })
        } else if (operation === 'update' && previousDoc) {
          // 編輯歷史紀錄：以 change delta 調整 user.creditScore
          const prevChange = typeof previousDoc.change === 'number' ? previousDoc.change : 0
          const currChange = typeof doc.change === 'number' ? doc.change : 0
          const delta = currChange - prevChange
          if (delta === 0) return doc
          const user = (await req.payload.findByID({
            collection: 'users',
            id: userId,
            depth: 0,
          })) as unknown as LooseRecord
          const current = (user?.creditScore as number) ?? DEFAULT_INITIAL_SCORE
          const next = clampScore(current + delta)
          await (req.payload.update as (args: {
            collection: 'users'
            id: string | number
            data: Record<string, unknown>
          }) => Promise<unknown>)({
            collection: 'users',
            id: userId,
            data: { creditScore: next },
          })
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (req.payloadAPI === 'local') return
        const userId = pickUserId((doc as LooseRecord).user)
        if (!userId) return
        const change = typeof (doc as LooseRecord).change === 'number'
          ? ((doc as LooseRecord).change as number)
          : 0
        if (change === 0) return

        const user = (await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
        })) as unknown as LooseRecord
        const current = (user?.creditScore as number) ?? DEFAULT_INITIAL_SCORE
        const next = clampScore(current - change)

        await (req.payload.update as (args: {
          collection: 'users'
          id: string | number
          data: Record<string, unknown>
        }) => Promise<unknown>)({
          collection: 'users',
          id: userId,
          data: { creditScore: next },
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
          name: 'previousScore',
          label: '異動前分數',
          type: 'number',
          min: 0,
          max: 100,
          admin: {
            width: '33%',
            description: '留空則讀取會員當前分數',
          },
        },
        {
          name: 'change',
          label: '變動值',
          type: 'number',
          required: true,
          admin: {
            width: '33%',
            description: '正數=加分、負數=扣分',
          },
        },
        {
          name: 'newScore',
          label: '異動後分數',
          type: 'number',
          min: 0,
          max: 100,
          admin: {
            width: '33%',
            description: '留空則自動計算（前分數 + 變動值，限制於 0-100）',
          },
        },
      ],
    },
    {
      name: 'reason',
      label: '原因',
      type: 'select',
      required: true,
      options: [
        { label: '購買', value: 'purchase' },
        { label: '準時到貨', value: 'on_time_delivery' },
        { label: '好評', value: 'good_review' },
        { label: '圖片評價', value: 'photo_review' },
        { label: '推薦成功', value: 'referral_success' },
        { label: '首次註冊', value: 'first_register' },
        { label: '首次購買', value: 'first_purchase' },
        { label: '生日加分', value: 'birthday_bonus' },
        { label: '訂閱加分', value: 'subscriber_bonus' },
        { label: '一般退貨', value: 'return_general' },
        { label: '無理由退貨', value: 'return_no_reason' },
        { label: '惡意退貨', value: 'return_malicious' },
        { label: '退貨率懲罰', value: 'return_rate_penalty' },
        { label: '棄單', value: 'abandoned_cart' },
        { label: '惡意取消', value: 'malicious_cancel' },
        { label: '管理員調整', value: 'admin_adjustment' },
        { label: '月度衰減', value: 'monthly_decay' },
        { label: '優良會員獎勵', value: 'good_customer_reward' },
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
      name: 'relatedReturn',
      label: '相關退貨',
      type: 'relationship',
      relationTo: 'returns',
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
    },
  ],
}
