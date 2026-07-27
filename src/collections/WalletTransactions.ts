import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * WalletTransactions 錢包帳本（購物金 + 儲值金 流水）
 * ────────────────────────────────────────────────────
 * 一張表記兩個錢包的異動，用 `wallet` 欄位區分：
 *   - shoppingCredit 購物金：平台贈送（簽到/兌換/遊戲/生日），不可退現
 *   - storedValue   儲值金：使用者真金白銀儲值，可退現（見 wallet-withdrawals）
 *
 * 運作模式（承襲 PointsTransactions 雙路徑）：
 *   1. 後台 admin（REST/GraphQL）手動建異動：hooks 會
 *      a) balance 未填 → 從使用者當前對應錢包餘額 + amount 推算
 *      b) 依 amount 同步 Users 的對應餘額欄位（shoppingCredit / storedValueBalance）
 *      c) 改 amount 以 delta 逆向修正；刪除逆向 amount
 *   2. 伺服端程式（payload.local API）— 兌換 / 遊戲 / 註冊禮 / 退現：
 *      呼叫端本來就會自行 update 餘額，故以 req.payloadAPI === 'local' 為閘門跳過
 *      hooks，避免重複加扣。程式端請用 lib/wallet/server.ts 的 recordWalletTxn()。
 */

type LooseRecord = Record<string, unknown>

// wallet 值 → Users 餘額欄位
const WALLET_FIELD: Record<string, 'shoppingCredit' | 'storedValueBalance'> = {
  shoppingCredit: 'shoppingCredit',
  storedValue: 'storedValueBalance',
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

function balanceField(wallet: unknown): 'shoppingCredit' | 'storedValueBalance' {
  return WALLET_FIELD[String(wallet)] ?? 'shoppingCredit'
}

export const WalletTransactions: CollectionConfig = {
  slug: 'wallet-transactions',
  labels: { singular: '錢包異動', plural: '錢包異動' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'description',
    defaultColumns: ['user', 'wallet', 'type', 'amount', 'balance', 'source', 'createdAt'],
    description:
      '購物金 / 儲值金異動帳本（正數=入帳、負數=出帳；balance 為該錢包異動後餘額）。後台手動建會自動同步會員餘額。',
    listSearchableFields: ['description'],
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
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
        if (data.balance === undefined || data.balance === null) {
          const userId = pickUserId(data.user)
          const amount = typeof data.amount === 'number' ? data.amount : 0
          if (userId) {
            const user = (await req.payload.findByID({
              collection: 'users',
              id: userId,
              depth: 0,
            })) as unknown as LooseRecord
            const field = balanceField(data.wallet)
            const current = (user?.[field] as number) ?? 0
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

        const field = balanceField(doc.wallet)
        const user = (await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
        })) as unknown as LooseRecord
        const current = (user?.[field] as number) ?? 0
        const next = Math.max(0, current + delta)

        await (req.payload.update as (args: {
          collection: 'users'
          id: string | number
          data: Record<string, unknown>
        }) => Promise<unknown>)({
          collection: 'users',
          id: userId,
          data: { [field]: next },
        })
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (req.payloadAPI === 'local') return
        const userId = pickUserId((doc as LooseRecord).user)
        if (!userId) return
        const amount =
          typeof (doc as LooseRecord).amount === 'number' ? ((doc as LooseRecord).amount as number) : 0
        if (amount === 0) return

        const field = balanceField((doc as LooseRecord).wallet)
        const user = (await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
        })) as unknown as LooseRecord
        const current = (user?.[field] as number) ?? 0
        const next = Math.max(0, current - amount)

        await (req.payload.update as (args: {
          collection: 'users'
          id: string | number
          data: Record<string, unknown>
        }) => Promise<unknown>)({
          collection: 'users',
          id: userId,
          data: { [field]: next },
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
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'wallet',
          label: '錢包',
          type: 'select',
          required: true,
          defaultValue: 'shoppingCredit',
          admin: { width: '25%' },
          options: [
            { label: '購物金', value: 'shoppingCredit' },
            { label: '儲值金', value: 'storedValue' },
          ],
        },
        {
          name: 'type',
          label: '類型',
          type: 'select',
          admin: { width: '25%' },
          options: [
            { label: '入帳', value: 'earn' },
            { label: '消費', value: 'spend' },
            { label: '兌換存入', value: 'redeem' },
            { label: '退款入帳', value: 'refund' },
            { label: '退現扣除', value: 'withdraw' },
            { label: '退現退回', value: 'withdraw_refund' },
            { label: '過期', value: 'expire' },
            { label: '管理員調整', value: 'admin_adjust' },
          ],
        },
        {
          name: 'amount',
          label: '金額',
          type: 'number',
          required: true,
          admin: { width: '25%', description: '正數=入帳、負數=出帳' },
        },
        {
          name: 'balance',
          label: '異動後餘額',
          type: 'number',
          admin: { width: '25%', description: '留空則自動依會員當前該錢包餘額計算' },
        },
      ],
    },
    {
      name: 'source',
      label: '來源',
      type: 'select',
      options: [
        { label: '註冊禮', value: 'signup' },
        { label: '點數兌換', value: 'redemption' },
        { label: '遊戲獎勵', value: 'game' },
        { label: '生日禮', value: 'birthday' },
        { label: '推薦回饋', value: 'referral' },
        { label: '訂閱會員', value: 'subscription' },
        { label: '訂單', value: 'order' },
        { label: '訂單退款', value: 'order_refund' },
        { label: '儲值', value: 'topup' },
        { label: '儲值金退現', value: 'withdrawal' },
        { label: '退現退回', value: 'withdrawal_refund' },
        { label: '管理員', value: 'admin' },
        { label: '其他', value: 'other' },
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
      name: 'relatedWithdrawal',
      label: '相關退現申請',
      type: 'relationship',
      relationTo: 'wallet-withdrawals',
    },
  ],
}
