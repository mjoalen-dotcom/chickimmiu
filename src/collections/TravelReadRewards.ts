import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 愛旅遊 閱讀獎勵紀錄（App 專屬活動一）
 * ──────────────────────────────────
 * 工單 2026-08-25：每位會員每篇文章一筆，user + articleId 複合唯一索引即為
 * 「同篇只能領一次」的冪等保證。
 *
 * articleId 只存字串、不與 blog-posts 關聯 —— 愛旅遊文章不在本次遷移範圍，
 * 仍由 App 既有來源提供，這裡只需記錄「這個會員領過這個 ID」。
 *
 * Access：全 admin-only。App 一律走 /api/app/travel/* 端點（overrideAccess），
 * 不直接讀寫 collection。
 */
export const TravelReadRewards: CollectionConfig = {
  slug: 'travel-read-rewards',
  labels: { singular: '愛旅遊閱讀獎勵', plural: '愛旅遊閱讀獎勵' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'articleTitle',
    defaultColumns: ['user', 'articleTitle', 'articleId', 'pointsAwarded', 'claimedAt'],
    description: 'App 愛旅遊文章閱讀獎勵的領取紀錄（同一會員同一篇只能領一次）',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  indexes: [{ fields: ['user', 'articleId'], unique: true }],
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
      name: 'articleId',
      label: '文章 ID',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'App 端愛旅遊文章的 ID（字串，不與 Payload 文章關聯）' },
    },
    {
      name: 'articleTitle',
      label: '文章標題（快照）',
      type: 'text',
      admin: { description: '領取當下的標題，供後台辨識' },
    },
    {
      name: 'pointsAwarded',
      label: '實發點數',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    { name: 'claimedAt', label: '領取時間', type: 'date' },
  ],
}
