import type { Access, CollectionConfig, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 多人遊戲房間 container — 4/8 stub 遊戲會用到：
 *   style_pk / co_create / blind_box / team_style
 *
 * 本 collection 不涵蓋既有的 card-battle（CardBattles collection 保留獨立，prod 已跑
 * 不動；見 GAMES_SOCIAL_COLLECTIONS.md 決策 A）。
 *
 * State machine：
 *   waiting → active → voting → settled
 *   waiting → expired（expiresAt < now）
 *   waiting/active → cancelled（host 解散 / admin 處置）
 *
 * 直接 update 禁止（host 走 /api/games/room/* endpoint，內部 overrideAccess 改
 * status / participants）。只有 admin 可以 collection-level update。
 */

const canReadRoom: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  // 會員可讀：自己開的房 OR 自己參與的房 OR 公開已結算房
  return {
    or: [
      { host: { equals: user.id } },
      { 'participants.user': { equals: user.id } },
      { and: [{ visibility: { equals: 'public' } }, { status: { equals: 'settled' } }] },
    ],
  } as Where
}

export const StyleGameRooms: CollectionConfig = {
  slug: 'style-game-rooms',
  labels: { singular: '穿搭遊戲房', plural: '穿搭遊戲房' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'roomCode',
    defaultColumns: ['roomCode', 'gameType', 'host', 'status', 'visibility', 'expiresAt'],
    description: '穿搭社交遊戲房間（不含 card-battle，CardBattles 另存）',
  },
  access: {
    read: canReadRoom,
    create: isAdmin, // 實際開房走 server action overrideAccess
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data) {
          if (!data.roomCode) {
            const now = new Date()
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
            data.roomCode = `SR-${dateStr}-${rand}`
          }
          if (!data.expiresAt) {
            data.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'roomCode',
      label: '房號',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: '格式：SR-YYYYMMDD-XXXX；建立時自動產生',
      },
    },
    {
      name: 'gameType',
      label: '遊戲類型',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: '穿搭 PK', value: 'style_pk' },
        { label: '好友共創', value: 'co_create' },
        { label: '穿搭盲盒', value: 'blind_box' },
        { label: '團體穿搭房', value: 'team_style' },
      ],
    },
    {
      name: 'host',
      label: '房主',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'participants',
      label: '參與者',
      type: 'array',
      fields: [
        {
          name: 'user',
          label: '會員',
          type: 'relationship',
          relationTo: 'users',
          required: true,
        },
        {
          name: 'role',
          label: '角色',
          type: 'select',
          required: true,
          defaultValue: 'member',
          options: [
            { label: '房主', value: 'host' },
            { label: '成員', value: 'member' },
            { label: '觀眾', value: 'spectator' },
          ],
        },
        {
          name: 'joinedAt',
          label: '加入時間',
          type: 'date',
        },
        {
          name: 'status',
          label: '狀態',
          type: 'select',
          required: true,
          defaultValue: 'active',
          options: [
            { label: '活躍', value: 'active' },
            { label: '已離開', value: 'left' },
            { label: '已踢出', value: 'kicked' },
          ],
        },
      ],
    },
    {
      name: 'capacity',
      label: '人數上限',
      type: 'number',
      required: true,
      defaultValue: 2,
      min: 2,
      max: 10,
    },
    {
      name: 'visibility',
      label: '可見性',
      type: 'select',
      required: true,
      defaultValue: 'private',
      options: [
        { label: '私人（需邀請碼）', value: 'private' },
        { label: '僅好友', value: 'friends' },
        { label: '公開', value: 'public' },
      ],
    },
    {
      name: 'inviteCode',
      label: '邀請碼',
      type: 'text',
      admin: {
        description: '非 null 時必須唯一；private 房間用',
      },
    },
    {
      name: 'theme',
      label: '房間主題',
      type: 'text',
    },
    {
      name: 'settings',
      label: '遊戲設定',
      type: 'json',
      admin: {
        description: '時限 / 計分規則等遊戲特定參數',
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'waiting',
      index: true,
      options: [
        { label: '等待中', value: 'waiting' },
        { label: '進行中', value: 'active' },
        { label: '投票中', value: 'voting' },
        { label: '已結算', value: 'settled' },
        { label: '已過期', value: 'expired' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    {
      name: 'startedAt',
      label: '開始時間',
      type: 'date',
    },
    {
      name: 'settledAt',
      label: '結算時間',
      type: 'date',
    },
    {
      name: 'expiresAt',
      label: '過期時間',
      type: 'date',
      required: true,
      admin: {
        description: '預設建立後 24h；過期後由 cron 掃掉',
      },
    },
    {
      name: 'result',
      label: '結算結果',
      type: 'group',
      fields: [
        {
          name: 'winner',
          label: '勝者',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description: '團隊戰可留空，改看 submissions 得票',
          },
        },
        {
          name: 'totalSubmissions',
          label: '作品總數',
          type: 'number',
        },
        {
          name: 'totalVotes',
          label: '投票總數',
          type: 'number',
        },
        {
          name: 'summary',
          label: '摘要',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
    },
  ],
}
