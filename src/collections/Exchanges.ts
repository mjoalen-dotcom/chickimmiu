import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { sendReturnRequestedEmail } from '../lib/email/returnRequested'
import { sendReturnDecisionEmail } from '../lib/email/returnDecision'
import { sendAdminReturnAlert } from '../lib/email/adminReturnAlert'

/**
 * 換貨申請 Collection
 */
export const Exchanges: CollectionConfig = {
  slug: 'exchanges',
  labels: { singular: '換貨單', plural: '換貨單' },
  admin: {
    group: '① 訂單與物流',
    description: '換貨申請管理',
    defaultColumns: ['exchangeNumber', 'order', 'quickApproval', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if ((user as unknown as Record<string, unknown>).role === 'admin') return true
      return { customer: { equals: (user as unknown as Record<string, unknown>).id } }
    },
    create: ({ req: { user } }) => !!user,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'exchangeNumber', label: '換貨單號', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    // Admin list-view quick-action — pending 時顯示「核准 / 拒絕」；其他狀態顯示文字。
    {
      name: 'quickApproval',
      type: 'ui',
      label: '狀態 / 快捷',
      admin: {
        components: {
          Cell: '@/components/admin/ExchangeApprovalCellButton',
        },
      },
    },
    { name: 'order', label: '原始訂單', type: 'relationship', relationTo: 'orders', required: true },
    { name: 'customer', label: '申請人', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'items',
      label: '換貨商品',
      type: 'array',
      required: true,
      fields: [
        { name: 'product', label: '商品', type: 'relationship', relationTo: 'products', required: true },
        { name: 'originalVariant', label: '原款式', type: 'text', required: true },
        { name: 'newVariant', label: '換成款式', type: 'text', required: true },
        { name: 'quantity', label: '數量', type: 'number', required: true, min: 1 },
        { name: 'reason', label: '換貨原因', type: 'select', required: true, options: [
          { label: '尺寸不合', value: 'wrong_size' },
          { label: '顏色不符', value: 'color_mismatch' },
          { label: '商品瑕疵', value: 'defective' },
          { label: '其他', value: 'other' },
        ]},
      ],
    },
    {
      name: 'status',
      label: '處理狀態',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: '待審核', value: 'pending' },
        { label: '已核准', value: 'approved' },
        { label: '退回中', value: 'returning' },
        { label: '已收到', value: 'received' },
        { label: '新品已寄出', value: 'shipped' },
        { label: '已完成', value: 'completed' },
        { label: '已拒絕', value: 'rejected' },
      ],
    },
    { name: 'priceDifference', label: '價差金額', type: 'number', defaultValue: 0, admin: { description: '正數=需補差價，負數=退差價' } },
    { name: 'newTrackingNumber', label: '新品物流單號', type: 'text' },
    { name: 'adminNote', label: '後台備註', type: 'textarea' },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          const now = new Date()
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
          data.exchangeNumber = `EXC-${dateStr}-${rand}`
        }
        return data
      },
    ],
    afterChange: [
      // ── 申請確認信（顧客）+ admin 新換貨通知 ──
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        sendReturnRequestedEmail(
          req.payload,
          doc as unknown as Record<string, unknown>,
          'exchange',
        ).catch((err) => console.error('[Exchanges Hook] 換貨申請信寄送失敗:', err))
        try {
          const settings = (await req.payload.findGlobal({
            slug: 'order-settings',
          })) as unknown as {
            notifications?: {
              sendAdminNewOrderAlert?: boolean
              adminAlertEmails?: Array<{ email?: string }>
            }
          }
          const notif = settings?.notifications
          if (notif?.sendAdminNewOrderAlert === false) return
          const emails = (notif?.adminAlertEmails ?? [])
            .map((e) => e?.email)
            .filter((e): e is string => Boolean(e))
          if (emails.length === 0) return
          sendAdminReturnAlert(
            req.payload,
            doc as unknown as Record<string, unknown>,
            'exchange',
            emails,
          ).catch((err) => console.error('[Exchanges Hook] admin 換貨通知失敗:', err))
        } catch (err) {
          console.error('[Exchanges Hook] 讀 order-settings 失敗:', err)
        }
      },
      // ── 狀態變更：審核結果 / 完成通知（顧客） ──
      async ({ doc, previousDoc, req }) => {
        const status = doc.status as string
        const prevStatus = previousDoc?.status as string | undefined
        if (!prevStatus || status === prevStatus) return
        if (status === 'approved' && prevStatus === 'pending') {
          sendReturnDecisionEmail(
            req.payload,
            doc as unknown as Record<string, unknown>,
            'exchange',
            'approved',
          ).catch((err) => console.error('[Exchanges Hook] 核准通知信寄送失敗:', err))
        } else if (status === 'rejected' && prevStatus !== 'rejected') {
          sendReturnDecisionEmail(
            req.payload,
            doc as unknown as Record<string, unknown>,
            'exchange',
            'rejected',
          ).catch((err) => console.error('[Exchanges Hook] 拒絕通知信寄送失敗:', err))
        } else if (status === 'completed' && prevStatus !== 'completed') {
          sendReturnDecisionEmail(
            req.payload,
            doc as unknown as Record<string, unknown>,
            'exchange',
            'finalized',
          ).catch((err) => console.error('[Exchanges Hook] 換貨完成信寄送失敗:', err))
        }
      },
    ],
  },
}
