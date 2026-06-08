import type { CollectionConfig, Access, Where } from 'payload'

import type { UserReward } from '../payload-types'
import { isAdmin } from '../access/isAdmin'

type RewardType = UserReward['rewardType']

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
  labels: { singular: '小遊戲記錄', plural: '小遊戲記錄' },
  admin: {
    group: '⑤ 互動體驗',
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
        // ── 8 social/UGC 遊戲（PR-1 擴充；對應 style-submissions / style-game-rooms / style-votes / style-wishes）──
        { label: '穿搭 PK', value: 'style_pk' },
        { label: '穿搭接龍', value: 'style_relay' },
        { label: '每週挑戰', value: 'weekly_challenge' },
        { label: '好友共創', value: 'co_create' },
        { label: '穿搭盲盒', value: 'blind_box' },
        { label: '女王投票', value: 'queen_vote' },
        { label: '團體穿搭房', value: 'team_style' },
        { label: '穿搭許願池', value: 'wish_pool' },
        // ── 個性測驗類遊戲 ──
        { label: 'MBTI 個性測驗', value: 'mbti_quiz' },
        // ── 系統聚合列：排行榜（非真實遊戲紀錄，由 updateLeaderboard 寫入 4 個 period bucket）──
        // gameEngine.ts:568 updateLeaderboard 會建 `leaderboard_{daily|weekly|monthly|all_time}` 4 種 aggregate row，
        // 依 metadata.periodKey + metadata.totalPoints 統計各時段分數。PR-1 (c56ee07) 把 gameType 改成 strict enum
        // 後這 4 值被 Payload validator reject → /api/games 500。加到 options 讓 Payload 放行。
        { label: '[系統] 每日排行榜', value: 'leaderboard_daily' },
        { label: '[系統] 每週排行榜', value: 'leaderboard_weekly' },
        { label: '[系統] 每月排行榜', value: 'leaderboard_monthly' },
        { label: '[系統] 全時段排行榜', value: 'leaderboard_all_time' },
        // ── 排行榜前三名結算獎勵紀錄（leaderboardSettle.ts 寫入）──
        { label: '[系統] 每日排行榜獎勵', value: 'leaderboard_daily_bonus' },
        { label: '[系統] 每週排行榜獎勵', value: 'leaderboard_weekly_bonus' },
        { label: '[系統] 每月排行榜獎勵', value: 'leaderboard_monthly_bonus' },
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
            // Phase B PrizePool 新增的類型
            { label: '電影票', value: 'movie_ticket' },
            { label: '免運券', value: 'free_shipping' },
            { label: '實體贈品', value: 'physical_gift' },
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
  hooks: {
    afterChange: [
      // 贏家獎項自動進寶物箱（UserRewards 庫存）。
      // 規則：
      //   - 只在 create 時觸發（update 不重複建）
      //   - result.outcome === 'win' 才算中獎
      //   - prizeType ∈ {coupon, badge, movie_ticket, free_shipping, physical_gift} → 建 UserRewards
      //   - prizeType ∈ {points, credit} → 跳過（已直接寫入 user.points / user.shoppingCredit）
      //   - prizeType = 'none' 或未設 → 跳過
      //
      // Phase D 接通 PrizePool.deliveryMethod：
      //   - metadata.deliveryMethod = 'physical_shipping' → requiresPhysicalShipping=true
      //     （隨下次訂單寄出，wave 會自動 attach 到 checkout）
      //   - metadata.deliveryMethod = 'digital_coupon' / 'instant_credit' → requiresPhysicalShipping=false
      //   - metadata.expiryDays / couponCode 也由 PrizePool 帶過來
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        const result = (doc as { result?: Record<string, unknown> }).result
        if (!result || result.outcome !== 'win') return doc

        const metadata = (doc as { metadata?: Record<string, unknown> }).metadata || {}
        const deliveryMethod = (metadata.deliveryMethod as string | undefined) || 'instant_credit'
        const expiryDays = typeof metadata.expiryDays === 'number' ? metadata.expiryDays : 365
        const isPhysicalDelivery = deliveryMethod === 'physical_shipping'

        const prizeType = typeof result.prizeType === 'string' ? result.prizeType : undefined

        // PrizePool prizeType → UserRewards.rewardType mapping。
        // movie_ticket 依 deliveryMethod 分流到 physical / digital。
        const rewardTypeMap: Record<string, RewardType> = {
          coupon: 'coupon',
          badge: 'badge',
          movie_ticket: isPhysicalDelivery ? 'movie_ticket_physical' : 'movie_ticket_digital',
          free_shipping: 'free_shipping_coupon',
          physical_gift: 'gift_physical',
        }
        const rewardType: RewardType | undefined = prizeType ? rewardTypeMap[prizeType] : undefined
        if (!rewardType) return doc

        const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        // physical_gift / movie_ticket_physical 一律需出貨；其他依 deliveryMethod
        const requiresPhysicalShipping =
          isPhysicalDelivery ||
          rewardType === 'gift_physical' ||
          rewardType === 'movie_ticket_physical'

        const playerId = (doc as { player?: unknown }).player
        const displayName =
          (typeof result.prizeDescription === 'string' && result.prizeDescription) ||
          `${(doc as { gameType?: string }).gameType ?? '遊戲'} 獎品`

        try {
          await req.payload.create({
            collection: 'user-rewards',
            data: {
              user: playerId as number,
              sourceRecord: (doc as { id?: number }).id,
              rewardType,
              displayName,
              amount: typeof result.prizeAmount === 'number' ? result.prizeAmount : undefined,
              couponCode:
                typeof result.couponCode === 'string' && result.couponCode
                  ? result.couponCode
                  : undefined,
              state: 'unused',
              expiresAt,
              requiresPhysicalShipping,
            },
            overrideAccess: true,
          })
        } catch (err) {
          req.payload.logger.error({
            err,
            msg: 'UserRewards auto-create failed from mini-game-record',
            recordId: (doc as { id?: number }).id,
          })
        }

        return doc
      },
    ],
  },
}
