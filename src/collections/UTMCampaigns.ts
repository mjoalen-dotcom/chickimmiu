import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * UTMCampaigns Collection
 * ───────────────────────
 * 集中管理 UTM campaign 名稱：避免 marketing team 拼錯導致歸因報表分裂
 * （例如有人寫 "spring2026"、有人寫 "Spring-2026"、有人寫 "spring_2026"）。
 *
 * Workflow：
 *   1. 行銷團隊在後台「行銷推廣 → UTM 活動管理」建一個 campaign（自動 slug）
 *   2. 開「UTM Builder」工具 (/admin/tools/utm-builder) 從這個 campaign 拼 URL
 *   3. URL 用在廣告 / EDM / Social post，回流的歸因報表會 group by campaign slug
 *
 * 跟 ProductViewEvents 的 utmCampaign 欄位是 string-match 關係（沒做 FK），
 * 因為訪客點外部 URL 帶來的 utm_campaign 可能不在這個 collection 裡（手寫、
 * 異常值）。報表頁會把 known campaigns 標綠、unknown 標灰。
 */
export const UTMCampaigns: CollectionConfig = {
  slug: 'utm-campaigns',
  labels: { singular: 'UTM 活動', plural: 'UTM 活動' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'source', 'medium', 'startDate', 'endDate', 'status'],
    group: '④ 行銷推廣',
    description: '集中管理 UTM 活動名稱與 slug，避免報表因拼字不一致分裂。配合 /admin/tools/utm-builder 使用。',
    listSearchableFields: ['name', 'slug', 'source', 'medium', 'campaignNotes'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        // 自動 slug from name
        if (!data.slug && typeof data.name === 'string') {
          data.slug = String(data.name)
            .toLowerCase()
            .trim()
            .replace(/[^\p{L}\p{N}\s_-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: '活動名稱',
          type: 'text',
          required: true,
          admin: { width: '60%', description: '行銷對內顯示名稱，例如「2026 春季新品上市」' },
        },
        {
          name: 'slug',
          label: 'Slug（utm_campaign 值）',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            width: '40%',
            description: '留空自動產生。Slug 會直接出現在 URL `?utm_campaign=...`',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'source',
          label: 'UTM Source',
          type: 'select',
          required: true,
          dbName: 'utm_camp_source',
          defaultValue: 'facebook',
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Google', value: 'google' },
            { label: 'LINE', value: 'line' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'Email / EDM', value: 'email' },
            { label: 'SMS', value: 'sms' },
            { label: 'Direct', value: 'direct' },
            { label: 'Affiliate', value: 'affiliate' },
            { label: 'Other', value: 'other' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'medium',
          label: 'UTM Medium',
          type: 'select',
          required: true,
          dbName: 'utm_camp_medium',
          defaultValue: 'cpc',
          options: [
            { label: 'CPC（付費點擊）', value: 'cpc' },
            { label: 'CPM（曝光）', value: 'cpm' },
            { label: 'Social（社群有機）', value: 'social' },
            { label: 'Email（電子報）', value: 'email' },
            { label: 'SMS', value: 'sms' },
            { label: 'Referral（合作推薦）', value: 'referral' },
            { label: 'Organic（自然搜尋）', value: 'organic' },
            { label: 'Display（橫幅廣告）', value: 'display' },
            { label: 'Influencer', value: 'influencer' },
            { label: 'Other', value: 'other' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'defaultContent',
      label: '預設 UTM Content（選填）',
      type: 'text',
      admin: { description: 'Builder 預填值，可在每次拼 URL 時覆寫' },
    },
    {
      name: 'defaultTerm',
      label: '預設 UTM Term（選填）',
      type: 'text',
      admin: { description: '搜尋廣告關鍵字，多用於 Google Ads' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startDate',
          label: '活動開始日',
          type: 'date',
          admin: { width: '50%' },
        },
        {
          name: 'endDate',
          label: '活動結束日',
          type: 'date',
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'budget',
          label: '預算（新台幣）',
          type: 'number',
          min: 0,
          admin: { width: '50%', description: '計算 ROAS 用' },
        },
        {
          name: 'spend',
          label: '實際花費（新台幣）',
          type: 'number',
          min: 0,
          admin: { width: '50%', description: '結算後填入。報表會用此值算 ROAS = 營收 / 花費' },
        },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'planning',
      dbName: 'utm_camp_status',
      options: [
        { label: '規劃中', value: 'planning' },
        { label: '進行中', value: 'active' },
        { label: '已暫停', value: 'paused' },
        { label: '已結束', value: 'ended' },
      ],
    },
    {
      name: 'campaignNotes',
      label: '活動備註',
      type: 'textarea',
      admin: { description: '受眾、文案方向、KPI 預期等' },
    },
  ],
  timestamps: true,
}
