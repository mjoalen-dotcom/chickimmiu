import type { CollectionConfig, Access, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 遊戲紀錄讀取權限：
 * - Admin：看全部
 * - 會員：只看自己的紀錄
 */
const readOwn: Access = ({ req: { user } }) => {
  if (!user) return false
  const userData = user as unknown as Record<string, unknown>
  if (userData.role === 'admin') return true
  return { player: { equals: user.id } } as Where
}

export const MiniGameRecords: CollectionConfig = {
  slug: 'mini-game-records',
  admin: {
    group: '遊戲系統',
    useAsTitle: 'gameType',
    defaultColumns: ['player', 'gameType', 'result.outcome', 'result.prizeAmount', 'createdAt'],
    description: '所有小遊戲的遊玩紀錄',
  },
  access: {
    read: readOwn,
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
      name: 'gameType',
      label: '遊戲類型',
      type: 'select',
      required: true,
      options: [
        { label: '轉盤抽獎', value: 'spin_wheel' },
        { label: '刮刮樂', value: 'scratch_card' },
        { label: '每日簽到', value: 'daily_checkin' },
        { label: '電影抽獎', value: 'movie_lottery' },
        { label: '穿搭挑戰', value: 'fashion_challenge' },
        { label: '抽卡片比大小', value: 'card_battle' },
      ],
    },
    {
      name: 'result',
      label: '結果',
      type: 'group',
      fields: [
        {
          name: 'outcome',
          label: '結果',
          type: 'select',
          required: true,
          options: [
            { label: '贏', value: 'win' },
            { label: '輸', value: 'lose' },
            { label: '平手', value: 'draw' },
            { label: '完成', value: 'completed' },
          ],
        },
        {
          name: 'prizeType',
          label: '獎品類型',
          type: 'select',
          options: [
            { label: '點數', value: 'points' },
            { label: '購物金', value: 'credit' },
            { label: '優惠券', value: 'coupon' },
            { label: '徽章', value: 'badge' },
            { label: '無', value: 'none' },
          ],
        },
        {
          name: 'prizeAmount',
          label: '獎品數量',
          type: 'number',
          min: 0,
        },
        {
          name: 'prizeDescription',
          label: '獎品說明',
          type: 'text',
        },
        {
          name: 'couponCode',
          label: '優惠券代碼',
          type: 'text',
        },
      ],
    },
    {
      name: 'pointsSpent',
      label: '消耗點數',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: '玩這場遊戲花費的點數',
      },
    },
    {
      name: 'metadata',
      label: '額外資料',
      type: 'json',
      admin: {
        description: '各遊戲專屬的額外資料',
      },
    },
    {
      name: 'playerTier',
      label: '玩家等級快照',
      type: 'text',
      admin: {
        description: '遊玩時的會員等級',
      },
    },
    {
      name: 'playerCreditScore',
      label: '玩家信用分數快照',
      type: 'number',
      admin: {
        description: '遊玩時的信用分數',
      },
    },
    {
      name: 'referralCode',
      label: '推薦碼',
      type: 'text',
      admin: {
        description: '透過推薦連結觸發的遊戲',
      },
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'completed',
      options: [
        { label: '進行中', value: 'active' },
        { label: '已完成', value: 'completed' },
        { label: '已過期', value: 'expired' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
  ],
}
