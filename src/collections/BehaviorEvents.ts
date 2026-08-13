import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * BehaviorEvents Collection — 通用消費者行為事件流
 * ─────────────────────────────────────────────────
 * 跟 ProductViewEvents 不同：那張只記 PDP 瀏覽（每筆 1 row），
 * 這張收所有頁面互動：點擊、加購、收藏、scroll depth、dwell 等。
 *
 * 寫入路徑：客端 BehaviorTracker → 批次 navigator.sendBeacon →
 *           POST /api/behavior/track (overrideAccess) → 一次 create 多筆
 *
 * 讀取路徑：admin /admin/consumer-insights → GET /api/users/consumer-insights
 *           → 30 天 server-side aggregation。
 *
 * 量級警告：高流量 → 行為事件爆表。封測期 < 1k DAU 無痛；之後到 10k+ DAU
 *   要做：
 *     1. createdAt + eventType 複合 index（已建）
 *     2. cron 每 30 天 archive 到 BehaviorEventsArchive collection
 *     3. 改用 ClickHouse / D1 / Postgres + materialized aggregations
 *
 * Privacy：
 *   - cookie consent 拒絕 → 客端不會 enqueue 任何事件，這張表也就不會寫
 *   - userId 可空（訪客也記，用 sessionId 串起來）
 *   - 不存完整 user agent / IP（CDN headers 推 country / device 兩欄夠用）
 *   - GDPR / 個資法：每筆都可用 sessionId / userId 找出來刪除
 */

const EVENT_TYPES = [
  // 頁面類
  { label: '頁面瀏覽', value: 'pageview' },
  { label: '商品瀏覽', value: 'product_view' },
  // 互動類
  { label: '點擊', value: 'click' },
  { label: '搜尋', value: 'search' },
  // 商業關鍵
  { label: '加入購物車', value: 'add_to_cart' },
  { label: '從購物車移除', value: 'remove_from_cart' },
  { label: '加入收藏', value: 'wishlist_add' },
  { label: '移除收藏', value: 'wishlist_remove' },
  { label: '開始結帳', value: 'checkout_start' },
  { label: '完成購買', value: 'purchase' },
  // 停留行為
  { label: 'Scroll 深度', value: 'scroll' },
  { label: '頁面停留時間', value: 'dwell' },
  // Campaign Engine（CHIC Commerce OS P0-D）
  { label: '活動曝光', value: 'campaign_exposed' },
  { label: '活動點擊', value: 'campaign_clicked' },
  { label: '活動符合資格', value: 'campaign_eligible' },
  { label: '活動不符資格', value: 'campaign_ineligible' },
  { label: '進度瀏覽', value: 'progress_viewed' },
  { label: '獎勵解鎖', value: 'reward_unlocked' },
  { label: '促銷套用', value: 'promotion_applied' },
  { label: '促銷拒絕', value: 'promotion_rejected' },
] as const

export const BehaviorEvents: CollectionConfig = {
  slug: 'behavior-events',
  labels: { singular: '消費者行為事件', plural: '消費者行為事件' },
  admin: {
    useAsTitle: 'sessionId',
    defaultColumns: ['eventType', 'pagePath', 'product', 'user', 'createdAt'],
    group: '③ 會員與 CRM',
    description:
      '所有客端行為事件流（點擊 / 加購 / scroll / dwell）。查聚合報表請走 ⓪ 數據儀表 → 消費者分析。',
    listSearchableFields: ['sessionId', 'pagePath', 'elementKey'],
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
  },
  access: {
    // 客端不直接讀寫，全走 /api/behavior/track endpoint（overrideAccess）
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'eventType',
      label: '事件類型',
      type: 'select',
      required: true,
      index: true,
      options: EVENT_TYPES as unknown as { label: string; value: string }[],
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
      name: 'pagePath',
      label: '頁面路徑',
      type: 'text',
      required: true,
      index: true,
      admin: { description: '事件發生時的 pathname + query（最長 500）' },
    },
    {
      name: 'product',
      label: '商品（適用商品事件）',
      type: 'relationship',
      relationTo: 'products',
      index: true,
      admin: { description: '商品瀏覽 / 加購 / 收藏 / 購買 才有' },
    },
    {
      name: 'elementKey',
      label: '元素鍵（點擊事件）',
      type: 'text',
      admin: {
        description: '點擊事件用 — DOM 上 [data-track="<key>"] 的 key，例：add-to-cart / hero-cta',
      },
    },
    {
      name: 'value',
      label: '金額',
      type: 'number',
      admin: { description: '購物相關事件的單品 unitPrice 或事件 value' },
    },
    {
      name: 'quantity',
      label: '數量',
      type: 'number',
      admin: { description: '加購 / 購買事件用' },
    },
    {
      name: 'durationMs',
      label: '停留時間 (ms)',
      type: 'number',
      admin: { description: 'dwell 事件用：頁面停留毫秒數' },
    },
    {
      name: 'scrollPctMax',
      label: '最大 scroll %',
      type: 'number',
      admin: { description: 'scroll / dwell 事件用：使用者本次最深滾到頁面的多少 %' },
    },
    {
      name: 'searchQuery',
      label: '搜尋關鍵字',
      type: 'text',
      admin: { description: 'search 事件用，最長 200' },
    },
    {
      name: 'utmSource',
      label: 'UTM Source',
      type: 'text',
      index: true,
    },
    {
      name: 'utmMedium',
      label: 'UTM Medium',
      type: 'text',
    },
    {
      name: 'utmCampaign',
      label: 'UTM Campaign',
      type: 'text',
      index: true,
    },
    {
      name: 'referrer',
      label: 'Referrer',
      type: 'text',
    },
    {
      name: 'landingPath',
      label: 'Landing 路徑',
      type: 'text',
    },
    {
      name: 'deviceType',
      label: '裝置類型',
      type: 'select',
      index: true,
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
      admin: { description: 'ISO 兩碼，從 CDN header 取（cf-ipcountry）' },
    },
    // ── Campaign Engine（CHIC Commerce OS P0-D）：活動歸因欄位 ────────────
    {
      name: 'campaign',
      label: '活動',
      type: 'relationship',
      relationTo: 'marketing-campaigns',
      index: true,
      admin: { description: '活動事件（campaign_* / promotion_*）帶的歸因' },
    },
    {
      name: 'ruleKey',
      label: 'Rule Key',
      type: 'text',
      index: true,
      admin: { description: 'campaignId:slug:vN' },
    },
    {
      name: 'variantId',
      label: '實驗 Variant',
      type: 'text',
    },
    {
      name: 'surface',
      label: '版位',
      type: 'select',
      options: [
        { label: '首頁', value: 'home' },
        { label: '商品列表', value: 'plp' },
        { label: '商品頁', value: 'pdp' },
        { label: '購物車', value: 'cart' },
        { label: '結帳', value: 'checkout' },
        { label: '會員中心', value: 'member' },
        { label: '完成頁', value: 'complete' },
        { label: '其他', value: 'other' },
      ],
    },
    {
      name: 'meta',
      label: '額外資料 (JSON)',
      type: 'json',
      admin: { description: '保留欄位，未來事件型別擴充用' },
    },
  ],
  timestamps: true,
}
