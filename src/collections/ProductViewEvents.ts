import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * ProductViewEvents Collection
 * ────────────────────────────
 * 每一筆 = 一次 PDP 瀏覽事件，附帶該 session 的 UTM 歸因。
 *
 * 寫入路徑：客端進到 /products/[slug] → fire `/api/utm/track` (POST) →
 *           server endpoint 用 overrideAccess:true 寫入這條 collection。
 *
 * 讀取路徑：admin 報表頁 /admin/reports/utm-attribution 用 payload.find
 *           做 source × product 矩陣聚合。
 *
 * 量級警告：每個 PDP 瀏覽都會插入一筆。封測期低流量無影響；之後若日均 >10000
 *          視 SQLite 性能加：
 *            (1) 建 index on product_id + utm_source + created_at
 *            (2) cron 每 30 天 archive 到 ProductViewEventsArchive collection
 *            (3) 或改用 D1 / Postgres
 *
 * Privacy：
 *   - userId 可空（訪客也記，用 sessionId 串起來）
 *   - 不存完整 user agent / IP（只取 deviceType / country 兩個粗粒度欄位）
 *   - GDPR / 個資法考量：cookie consent 拒絕後客端不發 /api/utm/track
 */
export const ProductViewEvents: CollectionConfig = {
  slug: 'product-view-events',
  labels: { singular: '商品瀏覽事件', plural: '商品瀏覽事件' },
  admin: {
    useAsTitle: 'sessionId',
    defaultColumns: ['product', 'utmSource', 'utmCampaign', 'user', 'createdAt'],
    group: '③ 會員與 CRM',
    description: '商品 PDP 瀏覽事件流（UTM 歸因報表的原始來源）。讀多寫多，請走 /admin/reports/utm-attribution 看聚合報表。',
    listSearchableFields: ['sessionId', 'utmCampaign', 'utmSource'],
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
  },
  access: {
    // 客端不直接讀寫，全走 /api/utm/track endpoint（overrideAccess）
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'product',
      label: '商品',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    {
      name: 'sessionId',
      label: 'Session ID',
      type: 'text',
      required: true,
      index: true,
      admin: { description: '客端 sessionStorage 取的 ckm-session-id；30 分鐘活性' },
    },
    {
      name: 'user',
      label: '會員（已登入）',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: '訪客留空' },
    },
    {
      name: 'utmSource',
      label: 'UTM Source',
      type: 'text',
      index: true,
      admin: { description: '來源平台，例如 facebook / google / line / direct' },
    },
    {
      name: 'utmMedium',
      label: 'UTM Medium',
      type: 'text',
      admin: { description: '媒介類型，例如 cpc / social / email / referral / organic' },
    },
    {
      name: 'utmCampaign',
      label: 'UTM Campaign',
      type: 'text',
      index: true,
      admin: { description: '活動名稱' },
    },
    {
      name: 'utmTerm',
      label: 'UTM Term',
      type: 'text',
      admin: { description: '關鍵字（搜尋廣告用）' },
    },
    {
      name: 'utmContent',
      label: 'UTM Content',
      type: 'text',
      admin: { description: '廣告素材識別' },
    },
    {
      name: 'referrer',
      label: 'Referrer URL',
      type: 'text',
      admin: { description: 'document.referrer，可推導 organic / direct' },
    },
    {
      name: 'landingPath',
      label: 'Landing 路徑',
      type: 'text',
      admin: { description: '本次 session 第一個進站頁面（不一定是這個 PDP）' },
    },
    {
      name: 'deviceType',
      label: '裝置類型',
      type: 'select',
      options: [
        { label: '手機', value: 'mobile' },
        { label: '平板', value: 'tablet' },
        { label: '桌機', value: 'desktop' },
        { label: '其他', value: 'other' },
      ],
    },
    {
      name: 'countryCode',
      label: '國別碼',
      type: 'text',
      admin: { description: 'ISO 兩碼，例如 TW / HK / SG' },
    },
  ],
  timestamps: true,
}
