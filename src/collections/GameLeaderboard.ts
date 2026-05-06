import type { CollectionConfig, Access, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const GameLeaderboard: CollectionConfig = {
  slug: 'game-leaderboard',
  labels: { singular: '遊戲排行榜', plural: '遊戲排行榜' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'periodKey',
    defaultColumns: ['player', 'period', 'totalPoints', 'rank', 'gamesPlayed'],
    description: '遊戲排行榜與徽章紀錄（player + period + periodKey 為唯一組合）',
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'player',
      label: '玩家',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'period',
      label: '週期類型',
      type: 'select',
      required: true,
      options: [
        { label: '每日', value: 'daily' },
        { label: '每週', value: 'weekly' },
        { label: '每月', value: 'monthly' },
        { label: '累計', value: 'all_time' },
      ],
    },
    {
      name: 'periodKey',
      label: '週期鍵值',
      type: 'text',
      required: true,
      admin: {
        description: '例如：2026-04-11（日）、2026-W15（週）、2026-04（月）',
      },
    },
    {
      name: 'totalPoints',
      label: '總點數',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'gamesPlayed',
      label: '遊戲場次',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'wins',
      label: '勝場數',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'streak',
      label: '連勝紀錄',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: '連續獲勝場次',
      },
    },
    {
      name: 'badges',
      label: '徽章',
      type: 'array',
      fields: [
        {
          name: 'badgeId',
          label: '徽章 ID',
          type: 'text',
          required: true,
        },
        {
          name: 'badgeName',
          label: '徽章名稱',
          type: 'text',
          required: true,
        },
        {
          name: 'badgeIcon',
          label: '徽章圖示',
          type: 'text',
          admin: {
            description: 'Emoji 或圖示名稱',
          },
        },
        {
          name: 'earnedAt',
          label: '獲得時間',
          type: 'date',
          required: true,
        },
        {
          name: 'badgeType',
          label: '徽章類型',
          type: 'select',
          options: [
            { label: '成就', value: 'achievement' },
            { label: '連勝', value: 'streak' },
            { label: '季節', value: 'seasonal' },
            { label: '特殊', value: 'special' },
          ],
        },
      ],
    },
    {
      name: 'rank',
      label: '排名',
      type: 'number',
      min: 1,
    },
    {
      name: 'playerTier',
      label: '玩家等級快照',
      type: 'text',
      admin: {
        description: '紀錄時的會員等級',
      },
    },
  ],
}
