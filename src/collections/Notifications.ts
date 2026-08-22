import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * Notifications Collection（會員訊息信箱 v1 — 2026-08-22 需求 ③）
 * ──────────────────────────────────────────────────────────────
 * 會員站內通知：網站 /account/messages 信箱與 App 推播共用同一份資料源。
 *
 * 設計原則：
 * - 與客服中心 Conversations/Messages 分開建模 — 那邊是「雙向對話 thread」，
 *   這邊是「單向通知 feed」（訂單狀態、點數入帳、活動、部落格互動、公告）。
 * - 產生端一律走 lib/notifications/notify.ts 的 createNotification()
 *   （fire-and-forget，通知失敗不能擋主流程）。
 * - 會員標記已讀走 /api/v1/notifications/read（server 端限定 recipient=自己），
 *   不開放 collection update — 避免會員改到別人的或改其他欄位。
 * - pushSentAt 預留給 App 推播 worker：寄出後回填，空 = 未推播。
 */
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: '會員通知', plural: '會員通知' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'title',
    defaultColumns: ['recipient', 'category', 'title', 'readAt', 'createdAt'],
    description: '會員站內信箱（/account/messages 與 App 推播共用）。手動建立 = 直接發給該會員。',
    listSearchableFields: ['title', 'body'],
  },
  access: {
    // admin 全讀；會員只能讀自己的
    read: ({ req }) => {
      const user = req.user
      if (!user) return false
      if (user.collection === 'users') return true
      return { recipient: { equals: user.id } }
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'recipient',
      label: '收件會員',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    {
      name: 'category',
      label: '分類',
      type: 'select',
      required: true,
      defaultValue: 'system',
      index: true,
      options: [
        { label: '訂單物流', value: 'order' },
        { label: '點數獎勵', value: 'points' },
        { label: '優惠活動', value: 'promo' },
        { label: '部落格互動', value: 'blog' },
        { label: '系統公告', value: 'system' },
      ],
    },
    { name: 'title', label: '標題', type: 'text', required: true },
    { name: 'body', label: '內文', type: 'textarea' },
    {
      name: 'link',
      label: '連結',
      type: 'text',
      admin: { description: '點通知後導向（站內路徑如 /account/orders，或完整 URL）' },
    },
    {
      name: 'readAt',
      label: '已讀時間',
      type: 'date',
      index: true,
      admin: { description: '空 = 未讀。會員在信箱點開或按全部已讀時回填。' },
    },
    {
      name: 'pushSentAt',
      label: 'App 推播寄出時間',
      type: 'date',
      admin: { description: '預留欄位：App 推播 worker 寄出後回填，空 = 未推播' },
    },
    {
      name: 'meta',
      label: '來源資料',
      type: 'json',
      admin: { description: '產生來源（orderNumber / blogSlug 等），除錯與去重用' },
    },
  ],
}
