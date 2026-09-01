import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 散步趣 每日紀錄（App 專屬活動三）
 * ────────────────────────────────
 * 工單 2026-08-25：user + date 複合唯一索引（一人一天一筆）。
 *
 * 步數由裝置健康資料取得、後端無法自行查核，因此採「先上傳、再核對紀錄」的
 * 兩段式流程 —— 發獎依據永遠是這張表上的 steps，不是領獎請求送來的數字
 * （共通規則 #3）。
 *
 * claimedMilestones 存「已領取的里程碑門檻值」，重複領取即以它判定。
 */
export const StepDailyRecords: CollectionConfig = {
  slug: 'step-daily-records',
  labels: { singular: '散步趣每日紀錄', plural: '散步趣每日紀錄' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'date',
    defaultColumns: ['user', 'date', 'steps', 'updatedAt'],
    description: 'App 散步趣的每日步數與已領里程碑（一人一天一筆，日界為 Asia/Taipei）',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ['user', 'date'], unique: true }],
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
      name: 'date',
      label: '日期',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'YYYY-MM-DD（Asia/Taipei）。用 text 而非 date 以避免時區換算誤差' },
    },
    {
      name: 'steps',
      label: '當日步數',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: '同日只允許遞增；不設上限（獎勵是階段制，步數再高也不會多拿）' },
    },
    {
      name: 'claimedMilestones',
      label: '已領取的里程碑',
      type: 'json',
      admin: { description: '門檻值陣列，如 [5000, 10000]' },
    },
  ],
}
