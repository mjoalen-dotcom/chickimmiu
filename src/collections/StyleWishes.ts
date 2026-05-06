import type { Access, CollectionConfig, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 穿搭許願池 — wish_pool 遊戲專用（非對稱 ask/grant 結構）。
 *
 * 機制：
 *   1. seeker 發許願，可附 bountyPoints 預扣自己的點數
 *   2. 任何會員可以回應（建 style-submissions 並 set wish=this.id）
 *   3. seeker 在 grants 列表中選出 winningGrant
 *   4. winningGrant 決定後，bountyPoints 轉給 granter、狀態變 granted
 *
 * 與 style-submissions 分離的理由（見 GAMES_SOCIAL_COLLECTIONS.md 決策 B）：
 *   - seeker 只描述需求、不貼作品；granter 才貼作品
 *   - 管理端不同流程（過期自動關閉、seeker 挑選）
 *   - 獎勵模式為 bountyPoints 從 seeker 過到 granter，現金流不同
 *
 * 過期自動關閉由 cron（非本 PR）掃 expiresAt < now && status='open'，
 * 退還 bountyPoints 並 set status='expired'。
 */

const canReadWish: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return {
    or: [
      { seeker: { equals: user.id } },
      { status: { in: ['open', 'granted'] } },
    ],
  } as Where
}

const canUpdateOwnOpen: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return {
    and: [
      { seeker: { equals: user.id } },
      { status: { equals: 'open' } },
    ],
  } as Where
}

export const StyleWishes: CollectionConfig = {
  slug: 'style-wishes',
  labels: { singular: '穿搭許願池', plural: '穿搭許願池' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'title',
    defaultColumns: ['seeker', 'title', 'status', 'bountyPoints', 'expiresAt', 'createdAt'],
    description: '穿搭許願池（wish_pool 遊戲）',
  },
  access: {
    read: canReadWish,
    create: isAdmin, // 實際發願走 server action overrideAccess（預扣點數）
    update: canUpdateOwnOpen,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data && !data.expiresAt) {
          // default 14 天
          data.expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'seeker',
      label: '許願者',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'title',
      label: '許願標題',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      label: '需求描述',
      type: 'textarea',
      required: true,
    },
    {
      name: 'referencePhotos',
      label: '參考圖',
      type: 'array',
      maxRows: 5,
      fields: [
        {
          name: 'image',
          label: '圖片',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    {
      name: 'budgetHint',
      label: '預算/場合提示',
      type: 'text',
      admin: {
        description: '例「正式場合」、「週末約會」、「辦公室」',
      },
    },
    {
      name: 'bountyPoints',
      label: '懸賞點數',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'seeker 預扣；winningGrant 決定後轉給 granter',
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'open',
      index: true,
      options: [
        { label: '徵求中', value: 'open' },
        { label: '已選出', value: 'granted' },
        { label: '已關閉', value: 'closed' },
        { label: '已過期', value: 'expired' },
      ],
    },
    {
      name: 'grants',
      label: '回應作品',
      type: 'array',
      fields: [
        {
          name: 'granter',
          label: '回應者',
          type: 'relationship',
          relationTo: 'users',
          required: true,
        },
        {
          name: 'submission',
          label: '作品',
          type: 'relationship',
          relationTo: 'style-submissions',
          required: true,
        },
        {
          name: 'note',
          label: '留言',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'winningGrant',
      label: '獲選作品',
      type: 'relationship',
      relationTo: 'style-submissions',
      admin: {
        description: 'seeker 從 grants 中挑出的最佳回應；決定後自動轉 bountyPoints',
      },
    },
    {
      name: 'expiresAt',
      label: '過期時間',
      type: 'date',
      required: true,
      admin: {
        description: '預設建立後 14 天',
      },
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
    },
  ],
}
