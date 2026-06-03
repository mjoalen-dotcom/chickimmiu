import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * SearchConsoleKeywords
 * ---------------------
 * Google Search Console import staging table.
 *
 * This keeps the workflow white-hat:
 * - store real query/page performance
 * - generate product SEO suggestions from first-party search data
 * - never fabricate backlinks or fake off-site signals
 */
export const SearchConsoleKeywords: CollectionConfig = {
  slug: 'search-console-keywords',
  labels: { singular: 'GSC 關鍵字', plural: 'GSC 關鍵字' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'query',
    defaultColumns: ['query', 'pagePath', 'impressions', 'clicks', 'ctr', 'position', 'status'],
    description: 'Google Search Console 高曝光低點擊關鍵字，用於商品頁 SEO 與文案回寫建議。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    { name: 'query', label: '搜尋字詞', type: 'text', required: true, index: true },
    { name: 'pagePath', label: 'Landing Page 路徑', type: 'text', index: true },
    {
      name: 'targetProduct',
      label: '對應商品',
      type: 'relationship',
      relationTo: 'products',
      admin: { description: '若 pagePath 對到 /products/<slug>，系統會自動嘗試綁定。' },
    },
    {
      name: 'source',
      label: '來源',
      type: 'select',
      defaultValue: 'gsc',
      options: [
        { label: 'Google Search Console', value: 'gsc' },
        { label: '手動輸入', value: 'manual' },
        { label: '內部搜尋', value: 'site_search' },
      ],
    },
    { name: 'impressions', label: '曝光', type: 'number', defaultValue: 0, min: 0 },
    { name: 'clicks', label: '點擊', type: 'number', defaultValue: 0, min: 0 },
    { name: 'ctr', label: 'CTR', type: 'number', defaultValue: 0, min: 0 },
    { name: 'position', label: '平均排名', type: 'number', min: 0 },
    {
      name: 'opportunityScore',
      label: '機會分數',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: { description: '高曝光 + 低 CTR + 可改善排名的優先度。' },
    },
    {
      name: 'intent',
      label: '搜尋意圖',
      type: 'select',
      defaultValue: 'unknown',
      options: [
        { label: '商品需求', value: 'product' },
        { label: '穿搭教學', value: 'styling' },
        { label: '保養照護', value: 'care' },
        { label: '品牌查詢', value: 'brand' },
        { label: '生活風格', value: 'lifestyle' },
        { label: '未知', value: 'unknown' },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: '新匯入', value: 'new' },
        { label: '待人工確認', value: 'reviewing' },
        { label: '已回寫', value: 'applied' },
        { label: '忽略', value: 'ignored' },
      ],
    },
    {
      name: 'suggestions',
      label: 'SEO 建議',
      type: 'group',
      fields: [
        { name: 'title', label: '建議 Title', type: 'text' },
        { name: 'metaDescription', label: '建議 Meta Description', type: 'textarea' },
        { name: 'faq', label: 'FAQ 建議 JSON', type: 'json' },
        { name: 'copyPatch', label: '商品文案補強建議', type: 'textarea' },
      ],
    },
    { name: 'importedAt', label: '匯入時間', type: 'date' },
    { name: 'lastAppliedAt', label: '最後回寫時間', type: 'date' },
  ],
}
