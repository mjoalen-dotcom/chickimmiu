import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 散步趣 每週紀錄（App 專屬活動三）
 * ────────────────────────────────
 * 工單 2026-08-25：user + weekId 複合唯一索引。
 *
 * 週累計步數不另存欄位 —— 領獎時從當週的每日紀錄即時加總，避免兩處數字不一致。
 * weekId 由後端依當下時間（Asia/Taipei）計算，App 不得傳入（共通規則 #3：
 * 允許指定週次會讓會員補領過去任何一週）。
 */
export const StepWeeklyRecords: CollectionConfig = {
  slug: 'step-weekly-records',
  labels: { singular: '散步趣每週紀錄', plural: '散步趣每週紀錄' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'weekId',
    defaultColumns: ['user', 'weekId', 'claimed', 'updatedAt'],
    description: 'App 散步趣的每週領獎紀錄（ISO 週，時區 Asia/Taipei，如 2026_W35）',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ['user', 'weekId'], unique: true }],
  timestamps: true,
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
      maxDepth: 0,
    },
    {
      name: 'weekId',
      label: '週次',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'ISO 週（Asia/Taipei），格式 YYYY_Www，如 2026_W35' },
    },
    { name: 'claimed', label: '本週已領', type: 'checkbox', defaultValue: false },
    { name: 'claimedAt', label: '領取時間', type: 'date' },
    {
      name: 'stepsAtClaim',
      label: '領取當下週累計步數',
      type: 'number',
      min: 0,
      admin: { description: '稽核用快照；週累計本身由每日紀錄即時加總' },
    },
  ],
}
