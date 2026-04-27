import type { Access, CollectionConfig, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 穿搭作品 UGC sink — 所有社交/UGC 類遊戲的作品都存這裡，用 gameType discriminator 切。
 *
 * 涵蓋 8 個 stub 遊戲：
 *   style_pk / style_relay / weekly_challenge / co_create /
 *   blind_box / queen_vote / team_style / wish_pool
 *
 * 房間類遊戲（style_pk / co_create / blind_box / team_style）另靠 `room` 關聯
 * style-game-rooms；接龍（style_relay）用 self-ref `parent`；許願池（wish_pool）
 * 用 `wish` 關聯 style-wishes。
 *
 * ⚠️ 本 collection 純資料層；實際投遞（daily quota / 遊戲 enable 判斷 /
 * metadata 寫入）由 PR-2 的 server actions 包裝，client 直 create 只能走 admin。
 * UGCPosts 是「外部社群聚合」域（admin-only 匯入），與本 collection 分離。
 */

const isAdminOrAuthor: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  // 會員：可讀自己的 draft / disqualified；公開狀態（approved / winner / submitted）任何登入會員都可讀
  return {
    or: [
      { player: { equals: user.id } },
      { status: { in: ['submitted', 'approved', 'winner'] } },
    ],
  } as Where
}

export const StyleSubmissions: CollectionConfig = {
  slug: 'style-submissions',
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'caption',
    defaultColumns: ['player', 'gameType', 'status', 'voteCount', 'rank', 'createdAt'],
    description: '穿搭作品（8 個 UGC 遊戲共用）',
  },
  access: {
    read: isAdminOrAuthor,
    create: isAdmin, // PR-1 純資料層；正式投稿走 server action + overrideAccess
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'player',
      label: '作者',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'gameType',
      label: '遊戲類型',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: '穿搭 PK', value: 'style_pk' },
        { label: '穿搭接龍', value: 'style_relay' },
        { label: '每週挑戰', value: 'weekly_challenge' },
        { label: '好友共創', value: 'co_create' },
        { label: '穿搭盲盒', value: 'blind_box' },
        { label: '女王投票', value: 'queen_vote' },
        { label: '團體穿搭房', value: 'team_style' },
        { label: '穿搭許願池', value: 'wish_pool' },
      ],
    },
    {
      name: 'room',
      label: '所屬房間',
      type: 'relationship',
      relationTo: 'style-game-rooms',
      index: true,
      admin: {
        description: '僅多人遊戲需要（style_pk / co_create / blind_box / team_style）',
      },
    },
    {
      name: 'parent',
      label: '接龍上一節',
      type: 'relationship',
      relationTo: 'style-submissions',
      index: true,
      admin: {
        description: '僅 style_relay 接龍遊戲使用；指向前一棒作品',
      },
    },
    {
      name: 'wish',
      label: '回應的許願',
      type: 'relationship',
      relationTo: 'style-wishes',
      index: true,
      admin: {
        description: '僅 wish_pool 遊戲使用；此作品是對某個 wish 的回應',
      },
    },
    {
      name: 'theme',
      label: '主題',
      type: 'text',
      admin: {
        description: '週主題 / 賽主題（weekly_challenge、queen_vote 使用）',
      },
    },
    {
      name: 'images',
      label: '作品圖片',
      type: 'array',
      minRows: 1,
      maxRows: 6,
      required: true,
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
      name: 'caption',
      label: '文案',
      type: 'textarea',
    },
    {
      name: 'tags',
      label: '標籤',
      type: 'array',
      fields: [
        {
          name: 'tag',
          label: '標籤',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已送出', value: 'submitted' },
        { label: '已核可', value: 'approved' },
        { label: '已隱藏', value: 'hidden' },
        { label: '得獎', value: 'winner' },
        { label: '喪失資格', value: 'disqualified' },
      ],
    },
    {
      name: 'rank',
      label: '最終排名',
      type: 'number',
      admin: {
        description: '結算後 snapshot（queen_vote top-N、weekly_challenge 前 N 名）',
      },
    },
    {
      name: 'voteCount',
      label: '票數',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'style-votes.afterChange 雙寫的快取；feed 排序用',
        readOnly: true,
      },
    },
    {
      name: 'viewCount',
      label: '瀏覽數',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'playerTierSnapshot',
      label: '會員等級快照',
      type: 'text',
      admin: {
        description: '投稿當下的會員等級；snapshot，會員日後升等不回填',
      },
    },
    {
      name: 'moderation',
      label: '審核',
      type: 'group',
      fields: [
        {
          name: 'reviewedBy',
          label: '審核人',
          type: 'relationship',
          relationTo: 'users',
        },
        {
          name: 'reviewedAt',
          label: '審核時間',
          type: 'date',
        },
        {
          name: 'note',
          label: '備註',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
      admin: {
        description: '各遊戲專屬 metadata（pk_round / relay_depth / blindbox_pairId 等）',
      },
    },
  ],
}
