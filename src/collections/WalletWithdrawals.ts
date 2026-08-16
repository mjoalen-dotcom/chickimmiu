import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { adjustWallet } from '../lib/wallet/server'

/**
 * WalletWithdrawals 儲值金退現申請
 * ────────────────────────────────────────────────────
 * 流程：
 *   1. 會員在 /account/wallet 送出退現 → POST /api/account/wallet/withdraw
 *      該 route 會「先扣住」儲值金（adjustWallet 出帳 + 帳本）並建立此申請
 *      （status=pending, held=true）。
 *   2. 後台處理：
 *      - approved / paid：實際匯款在系統外完成，餘額維持已扣除狀態（不退回）。
 *      - rejected / cancelled：afterChange hook 自動把扣住的金額退回儲值金
 *        （adjustWallet 入帳 + 帳本），並標記 refundedToWallet 防重複退。
 *   3. 會員亦可在 pending 狀態自行取消（API 把 status 設 cancelled，由 hook 退款）。
 *
 * 注意：餘額「扣住」只在 API 路徑做（held=true）。後台手動新建的申請 held=false，
 *   拒絕時不會自動退（因為當初沒扣），需 admin 自行處理，避免無中生有退錢。
 */

type LooseRecord = Record<string, unknown>

function pickId(val: unknown): string | number | null {
  if (val == null) return null
  if (typeof val === 'string' || typeof val === 'number') return val
  if (typeof val === 'object') {
    const id = (val as LooseRecord).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

const REFUND_STATUSES = new Set(['rejected', 'cancelled'])

export const WalletWithdrawals: CollectionConfig = {
  slug: 'wallet-withdrawals',
  labels: { singular: '儲值金退現', plural: '儲值金退現' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'id',
    defaultColumns: ['user', 'amount', 'status', 'held', 'refundedToWallet', 'createdAt'],
    description:
      '會員儲值金退現申請。拒絕 / 取消會自動退回已扣住的儲值金；核准 / 已匯款則維持扣除。',
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
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (operation !== 'update' || !previousDoc) return doc
        const prevStatus = String((previousDoc as LooseRecord).status || '')
        const status = String(doc.status || '')
        if (prevStatus === status) return doc // 非狀態變更（例如只改備註）

        const userId = pickId(doc.user)
        const amount = typeof doc.amount === 'number' ? doc.amount : 0
        const held = Boolean((doc as LooseRecord).held)
        const refunded = Boolean((doc as LooseRecord).refundedToWallet)

        // 拒絕 / 取消 → 退回扣住的儲值金（僅當初有扣 held 且尚未退）
        if (REFUND_STATUSES.has(status) && held && !refunded && userId && amount > 0) {
          await adjustWallet(req.payload, {
            userId,
            wallet: 'storedValue',
            amount: amount, // 退回（入帳）
            type: 'withdraw_refund',
            source: 'withdrawal_refund',
            description: `退現申請 #${doc.id} ${status === 'cancelled' ? '取消' : '未通過'}，儲值金退回`,
            relatedWithdrawal: doc.id as string | number,
          })
          await (req.payload.update as (args: {
            collection: 'wallet-withdrawals'
            id: string | number
            data: Record<string, unknown>
            overrideAccess?: boolean
          }) => Promise<unknown>)({
            collection: 'wallet-withdrawals',
            id: doc.id as string | number,
            data: { refundedToWallet: true, processedAt: new Date().toISOString() },
            overrideAccess: true,
          })
        } else if (!doc.processedAt && status !== 'pending') {
          // approved / paid 等：記錄處理時間
          await (req.payload.update as (args: {
            collection: 'wallet-withdrawals'
            id: string | number
            data: Record<string, unknown>
            overrideAccess?: boolean
          }) => Promise<unknown>)({
            collection: 'wallet-withdrawals',
            id: doc.id as string | number,
            data: { processedAt: new Date().toISOString() },
            overrideAccess: true,
          })
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: '待處理', value: 'pending' },
        { label: '已核准', value: 'approved' },
        { label: '已匯款', value: 'paid' },
        { label: '已拒絕', value: 'rejected' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    {
      name: 'amount',
      label: '退現金額',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'bankInfo',
      label: '收款帳戶',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'bankName', label: '銀行', type: 'text', admin: { width: '50%' } },
            { name: 'bankCode', label: '銀行代碼', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'accountName', label: '戶名', type: 'text', admin: { width: '50%' } },
            { name: 'accountNumber', label: '帳號', type: 'text', admin: { width: '50%' } },
          ],
        },
      ],
    },
    {
      name: 'userNote',
      label: '會員備註',
      type: 'textarea',
    },
    {
      name: 'adminNote',
      label: '後台備註',
      type: 'textarea',
    },
    {
      name: 'held',
      label: '已扣住儲值金',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'API 送出時即扣住金額；拒絕/取消才會退回。後台手動新建為 false（不自動退）。',
      },
    },
    {
      name: 'refundedToWallet',
      label: '已退回儲值金',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'processedAt',
      label: '處理時間',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
}
