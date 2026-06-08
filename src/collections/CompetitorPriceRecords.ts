import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { scoreCompetitorPriceRecord } from '../lib/marketing/whiteHatAutomation'

export const CompetitorPriceRecords: CollectionConfig = {
  slug: 'competitor-price-records',
  labels: { singular: '競品價格紀錄', plural: '競品價格紀錄' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'productName',
    defaultColumns: ['productName', 'platform', 'priceTWD', 'totalScore', 'status', 'observedAt'],
    description:
      '競品售價與韓國熱賣趨勢紀錄。用途是採購決策，不做假外鏈、不抓取侵權內容。',
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
      ({ data }) => {
        if (!data) return data
        const scored = scoreCompetitorPriceRecord(data as Record<string, unknown>)
        return { ...data, ...scored }
      },
    ],
  },
  fields: [
    { name: 'productName', label: '商品名稱 / 款式名稱', type: 'text', required: true, index: true },
    { name: 'normalizedName', label: '正規化名稱', type: 'text', index: true },
    {
      name: 'relatedProduct',
      label: '站內相近商品',
      type: 'relationship',
      relationTo: 'products',
    },
    {
      name: 'platform',
      label: '平台',
      type: 'select',
      defaultValue: 'other',
      options: [
        { label: 'Sinsang Market', value: 'sinsang' },
        { label: 'Naver Smart Store', value: 'naver' },
        { label: 'Zigzag', value: 'zigzag' },
        { label: 'ABLY', value: 'ably' },
        { label: 'Shopline / 品牌官網', value: 'shopline' },
        { label: '其他', value: 'other' },
      ],
    },
    { name: 'competitorName', label: '競品 / 店家名稱', type: 'text' },
    { name: 'sourceUrl', label: '平台連結', type: 'text' },
    { name: 'priceTWD', label: '市場售價（TWD）', type: 'number', min: 0 },
    { name: 'priceKRW', label: '韓元價格（KRW）', type: 'number', min: 0 },
    { name: 'estimatedCostTWD', label: '預估採購成本（TWD）', type: 'number', min: 0 },
    { name: 'style', label: '風格', type: 'text', admin: { description: '例：韓系通勤、婚禮洋裝、直播亮點款' } },
    { name: 'material', label: '材質', type: 'text' },
    { name: 'observedAt', label: '觀察日期', type: 'date' },
    {
      name: 'metrics',
      label: '採購評分',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        { name: 'marginScore', label: '毛利分數', type: 'number' },
        { name: 'trendScore', label: '熱度分數', type: 'number' },
        { name: 'riskScore', label: '風險分數', type: 'number' },
        { name: 'matchingScore', label: '搭配性分數', type: 'number' },
        { name: 'liveScore', label: '直播適合度', type: 'number' },
        { name: 'adsScore', label: '廣告投放適合度', type: 'number' },
        { name: 'estimatedMarginPercent', label: '預估毛利率 %', type: 'number' },
      ],
    },
    { name: 'totalScore', label: '總分', type: 'number', defaultValue: 0, min: 0, max: 100 },
    {
      name: 'flags',
      label: '自動標記',
      type: 'select',
      hasMany: true,
      options: [
        { label: '高毛利', value: 'high_margin' },
        { label: '低風險', value: 'low_risk' },
        { label: '適合直播', value: 'live_suitable' },
        { label: '適合廣告投放', value: 'ad_suitable' },
        { label: '可列入補貨', value: 'reorder_candidate' },
        { label: '需人工觀察', value: 'watchlist' },
      ],
    },
    { name: 'purchaseRecommendation', label: '採購建議', type: 'textarea' },
    {
      name: 'status',
      label: '處理狀態',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: '新資料', value: 'new' },
        { label: '已審核', value: 'reviewed' },
        { label: '已採購', value: 'purchased' },
        { label: '暫不採購', value: 'rejected' },
      ],
    },
    { name: 'notes', label: '備註', type: 'textarea' },
  ],
}
