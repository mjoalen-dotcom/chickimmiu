import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * MessageTags Collection（客服中心 v1 Phase 1A）
 * ─────────────────────────────────────────────
 * 客服對話分類標籤 taxonomy。多階層支援（self-referential parent）。
 *
 * 用途：
 * - Conversations.tags hasMany 此 collection
 * - 自動指派規則的 keyword match（依 slug）
 * - Phase 8 數據洞察：tag 趨勢分析（哪類問題暴增）
 *
 * usageCount 是快取欄位，由 Conversations afterChange hook 同步遞增/遞減。
 *   Phase 1A 先建欄位，hook 留待 1B/1G 補。
 */
export const MessageTags: CollectionConfig = {
  slug: 'message-tags',
  labels: { singular: '對話標籤', plural: '對話標籤' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'name',
    defaultColumns: ['name', 'parent', 'color', 'usageCount'],
    description: '客服對話分類標籤（多階層 taxonomy）',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: '標籤名稱',
          type: 'text',
          required: true,
          unique: true,
          admin: { width: '50%' },
        },
        {
          name: 'slug',
          label: '標籤代碼',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: {
            width: '50%',
            description: '英數加底線；自動指派規則的 keyword match 用',
          },
        },
      ],
    },
    {
      name: 'parent',
      label: '父標籤',
      type: 'relationship',
      relationTo: 'message-tags',
      admin: {
        description: '留空 = 頂層；做出像「退換貨 > 尺寸不合 > 太大」的多階',
      },
    },
    {
      name: 'color',
      label: '顏色',
      type: 'select',
      options: [
        { label: '灰', value: 'gray' },
        { label: '紅', value: 'red' },
        { label: '橘', value: 'orange' },
        { label: '黃', value: 'yellow' },
        { label: '綠', value: 'green' },
        { label: '藍', value: 'blue' },
        { label: '紫', value: 'purple' },
        { label: '粉', value: 'pink' },
      ],
    },
    {
      name: 'description',
      label: '說明',
      type: 'textarea',
    },
    {
      name: 'usageCount',
      label: '使用次數',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: '快取欄位；Conversations.tags 變動時遞增/遞減（Phase 1B+ 接通）',
      },
    },
  ],
}
