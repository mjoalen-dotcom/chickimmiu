import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 會員分群紀錄
 * ─────────────────────────────────────
 * 儲存每位會員的當前分群、綜合分數、歷史紀錄
 * 由每日排程 (segmentationEngine) 自動寫入／更新
 */
export const MemberSegments: CollectionConfig = {
  slug: 'member-segments',
  labels: {
    singular: '會員分群紀錄',
    plural: '會員分群紀錄',
  },
  admin: {
    group: '會員管理',
    useAsTitle: 'segmentLabel',
    defaultColumns: ['user', 'currentSegment', 'segmentLabel', 'compositeScore', 'segmentChangedAt'],
    description:
      '【資料表】每位會員的當前分群（1 位會員 = 1 筆），由每日凌晨排程自動寫入，請勿手動編輯。' +
      '演算法權重、判定門檻、排程時間請至「會員分群設定」Global 調整。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    // ── 基本關聯 ──
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
    },

    // ── 分群狀態 ──
    {
      name: 'currentSegment',
      label: '當前分群',
      type: 'select',
      required: true,
      options: [
        { label: 'VIP1 — 璀璨忠誠女王', value: 'VIP1' },
        { label: 'VIP2 — 金曦風格領袖', value: 'VIP2' },
        { label: 'POT1 — 潛力優雅新星', value: 'POT1' },
        { label: 'REG1 — 穩定優雅會員', value: 'REG1' },
        { label: 'REG2 — 價格敏感優雅客', value: 'REG2' },
        { label: 'RISK1 — 流失高風險客', value: 'RISK1' },
        { label: 'RISK2 — 退貨觀察客', value: 'RISK2' },
        { label: 'NEW1 — 優雅初遇新客', value: 'NEW1' },
        { label: 'SLP1 — 沉睡復活客', value: 'SLP1' },
        { label: 'BLK1 — 高風險警示客', value: 'BLK1' },
      ],
    },
    {
      name: 'segmentLabel',
      label: '分群名稱',
      type: 'text',
      admin: { description: '前台顯示用中文名稱（如：璀璨忠誠女王）' },
    },
    {
      name: 'segmentColor',
      label: '分群色碼',
      type: 'text',
      admin: { description: 'Hex 色碼（如：#9B59B6）' },
    },

    // ── 綜合分數 ──
    {
      name: 'scores',
      label: '分群分數',
      type: 'group',
      fields: [
        { name: 'rfmScore', label: 'RFM 分數', type: 'number', min: 0, max: 100, defaultValue: 0 },
        { name: 'creditScore', label: '信用分數', type: 'number', min: 0, max: 100, defaultValue: 0 },
        { name: 'ltvScore', label: 'LTV 分數', type: 'number', min: 0, max: 100, defaultValue: 0 },
        { name: 'churnScore', label: '流失分數', type: 'number', min: 0, max: 100, defaultValue: 0 },
        { name: 'behaviorScore', label: '行為偏好分數', type: 'number', min: 0, max: 100, defaultValue: 0 },
        { name: 'tierScore', label: '等級訂閱分數', type: 'number', min: 0, max: 100, defaultValue: 0 },
        { name: 'compositeScore', label: '綜合分數', type: 'number', min: 0, max: 100, defaultValue: 0 },
      ],
    },

    // ── 上次分群 ──
    {
      name: 'previousSegment',
      label: '上次分群',
      type: 'text',
    },
    {
      name: 'segmentChangedAt',
      label: '分群變動時間',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },

    // ── 歷史紀錄 ──
    {
      name: 'history',
      label: '分群歷史',
      type: 'array',
      admin: { description: '每次分群變動的紀錄' },
      fields: [
        { name: 'segment', label: '分群代碼', type: 'text' },
        { name: 'score', label: '綜合分數', type: 'number' },
        { name: 'changedAt', label: '變動時間', type: 'date' },
        { name: 'reason', label: '變動原因', type: 'text' },
      ],
    },

    // ── 自動標籤 ──
    {
      name: 'autoTags',
      label: '自動標籤',
      type: 'array',
      admin: { description: 'AI 自動產生的行為標籤' },
      fields: [
        { name: 'tag', label: '標籤', type: 'text' },
        { name: 'confidence', label: '信心度', type: 'number', min: 0, max: 100 },
      ],
    },
  ],
}
