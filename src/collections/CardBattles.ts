import type { CollectionConfig, Access, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 卡片對戰讀取權限：
 * - Admin：看全部
 * - 會員：只看自己參與的對戰（挑戰者或對手）
 */
const readOwnBattles: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return {
    or: [
      { challenger: { equals: user.id } },
      { opponent: { equals: user.id } },
    ],
  } as Where
}

export const CardBattles: CollectionConfig = {
  slug: 'card-battles',
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'roomCode',
    defaultColumns: ['roomCode', 'challenger', 'opponent', 'status', 'result.winner', 'createdAt'],
    description: '抽卡片比大小對戰房間',
  },
  access: {
    read: readOwnBattles,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          // Auto-generate roomCode
          const now = new Date()
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
          data.roomCode = `CB-${dateStr}-${rand}`

          // Auto-set expiresAt to 24h from now if not set
          if (!data.expiresAt) {
            const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
            data.expiresAt = expires.toISOString()
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'roomCode',
      label: '房間代碼',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: '格式：CB-YYYYMMDD-XXXX',
      },
    },
    {
      name: 'challenger',
      label: '挑戰者',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'opponent',
      label: '對手',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'referralCode',
      label: '推薦碼',
      type: 'text',
      admin: {
        description: '建立對戰時使用的推薦碼',
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'waiting',
      options: [
        { label: '等待中', value: 'waiting' },
        { label: '進行中', value: 'in_progress' },
        { label: '已完成', value: 'completed' },
        { label: '已過期', value: 'expired' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    {
      name: 'challengerCard',
      label: '挑戰者的牌',
      type: 'group',
      fields: [
        {
          name: 'rank',
          label: '數字',
          type: 'number',
          min: 1,
          max: 13,
          admin: {
            description: '1=A, 11=J, 12=Q, 13=K',
          },
        },
        {
          name: 'suit',
          label: '花色',
          type: 'select',
          options: [
            { label: '黑桃', value: 'spades' },
            { label: '紅心', value: 'hearts' },
            { label: '方塊', value: 'diamonds' },
            { label: '梅花', value: 'clubs' },
          ],
        },
        {
          name: 'drawnAt',
          label: '抽牌時間',
          type: 'date',
        },
      ],
    },
    {
      name: 'opponentCard',
      label: '對手的牌',
      type: 'group',
      fields: [
        {
          name: 'rank',
          label: '數字',
          type: 'number',
          min: 1,
          max: 13,
          admin: {
            description: '1=A, 11=J, 12=Q, 13=K',
          },
        },
        {
          name: 'suit',
          label: '花色',
          type: 'select',
          options: [
            { label: '黑桃', value: 'spades' },
            { label: '紅心', value: 'hearts' },
            { label: '方塊', value: 'diamonds' },
            { label: '梅花', value: 'clubs' },
          ],
        },
        {
          name: 'drawnAt',
          label: '抽牌時間',
          type: 'date',
        },
      ],
    },
    {
      name: 'result',
      label: '結果',
      type: 'group',
      fields: [
        {
          name: 'winner',
          label: '勝者',
          type: 'select',
          options: [
            { label: '挑戰者', value: 'challenger' },
            { label: '對手', value: 'opponent' },
            { label: '平手', value: 'draw' },
          ],
        },
        {
          name: 'challengerPrize',
          label: '挑戰者獎品',
          type: 'group',
          fields: [
            {
              name: 'type',
              label: '類型',
              type: 'select',
              options: [
                { label: '點數', value: 'points' },
                { label: '優惠券', value: 'coupon' },
              ],
            },
            {
              name: 'amount',
              label: '數量',
              type: 'number',
            },
            {
              name: 'description',
              label: '說明',
              type: 'text',
            },
          ],
        },
        {
          name: 'opponentPrize',
          label: '對手獎品',
          type: 'group',
          fields: [
            {
              name: 'type',
              label: '類型',
              type: 'select',
              options: [
                { label: '點數', value: 'points' },
                { label: '優惠券', value: 'coupon' },
              ],
            },
            {
              name: 'amount',
              label: '數量',
              type: 'number',
            },
            {
              name: 'description',
              label: '說明',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'expiresAt',
      label: '過期時間',
      type: 'date',
      required: true,
      admin: {
        description: '房間建立後 24 小時自動過期',
      },
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
      admin: {
        description: '對戰相關的額外資料',
      },
    },
  ],
}
