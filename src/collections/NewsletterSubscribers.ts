import type { CollectionConfig } from 'payload'
import { randomUUID } from 'crypto'

import { isAdmin } from '../access/isAdmin'

/**
 * NewsletterSubscribers Collection — 電子報訂閱名單
 * ───────────────────────────────────────────────
 * 任何訪客（不需登入）在首頁 / 頁尾「訂閱電子報」表單留下 email 即進此名單。
 *
 * 跟 Users.subscriptionStatus（會員的 email/sms/line 訂閱偏好）區隔：
 *   - 那邊是「已是會員」的通道偏好；
 *   - 這張是「品牌電子報名單」，多數是匿名訪客，少數會員順手登記。
 *   - 會員若用同一 email 訂閱，`user` 欄會回連到該會員（API 端帶入）。
 *
 * 寫入路徑：前台表單 → POST /api/newsletter/subscribe（overrideAccess）→ upsert
 * 退訂路徑：email 內連結 → GET /api/newsletter/unsubscribe?token=<unsubscribeToken>
 * 讀取／匯出：僅 admin（行銷推播時讀 status='subscribed'）
 *
 * email 唯一：避免重複訂閱；重複 POST 視為冪等成功（已訂閱）或重新啟用（曾退訂）。
 */
export const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter-subscribers',
  labels: { singular: '電子報訂閱', plural: '電子報訂閱' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: [
      'email',
      'status',
      'kimBlogSubscribed',
      'source',
      'user',
      'createdAt',
    ],
    group: '④ 行銷推廣',
    description:
      '電子報訂閱名單（前台「訂閱最新消息」表單寫入）。行銷推播請篩 status=已訂閱；退訂走 email 內連結自動標記。',
    listSearchableFields: ['email', 'name'],
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
  },
  access: {
    // 前台不直接讀寫；全走 /api/newsletter/* endpoint（overrideAccess）。
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // 確保每筆都有退訂 token（admin 手動建立時也補上）
        if (data && !data.unsubscribeToken) {
          data.unsubscribeToken = randomUUID()
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'status',
      label: '訂閱狀態',
      type: 'select',
      required: true,
      defaultValue: 'subscribed',
      index: true,
      options: [
        { label: '已訂閱', value: 'subscribed' },
        { label: '已退訂', value: 'unsubscribed' },
      ],
    },
    {
      name: 'name',
      label: '姓名',
      type: 'text',
      admin: { description: '選填；會員訂閱時自動帶入' },
    },
    {
      name: 'source',
      label: '來源',
      type: 'select',
      defaultValue: 'homepage',
      index: true,
      options: [
        { label: '首頁', value: 'homepage' },
        { label: '頁尾', value: 'footer' },
        { label: '結帳', value: 'checkout' },
        { label: '彈窗', value: 'popup' },
        { label: '匯入', value: 'import' },
        { label: '金老佛爺部落格', value: 'kim-blog' },
        { label: '其他', value: 'other' },
      ],
    },
    {
      name: 'kimBlogSubscribed',
      label: '金老佛爺文章訂閱',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description:
          '獨立於原始來源；勾選代表可接收金老佛爺部落格文章通知。',
      },
    },
    {
      name: 'kimBlogSubscribedAt',
      label: '金老佛爺文章訂閱時間',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'user',
      label: '會員（若為登入會員訂閱）',
      type: 'relationship',
      relationTo: 'customers',
      admin: { description: '匿名訪客留空' },
    },
    {
      name: 'locale',
      label: '語系',
      type: 'text',
      admin: { description: '訂閱當下的前台語系（zh-TW / en …）' },
    },
    {
      name: 'unsubscribeToken',
      label: '退訂 Token',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: '退訂連結用，建立時自動產生，請勿外洩或修改。',
      },
    },
    {
      name: 'confirmedAt',
      label: '訂閱時間',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'unsubscribedAt',
      label: '退訂時間',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'ipAddress',
      label: 'IP（訂閱當下）',
      type: 'text',
      admin: { readOnly: true, description: '防濫用 / 個資合規追溯用' },
    },
  ],
  timestamps: true,
}
