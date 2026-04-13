import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 遊戲系統設定 Global
 * ──────────────────────
 * 14 款小遊戲，每款皆有獨立啟動開關（預設全部關閉）
 * 後台可隨時開啟/關閉任何遊戲，前台動態顯示
 */

/* ── 共用：各會員等級免費次數欄位 ── */
const tierFreeFields = (defaults: number[]) => ({
  name: 'freePerTier',
  label: '各等級免費次數',
  type: 'group' as const,
  fields: [
    { name: 'ordinary', label: '一般會員', type: 'number' as const, defaultValue: defaults[0] },
    { name: 'bronze', label: '銅牌', type: 'number' as const, defaultValue: defaults[1] },
    { name: 'silver', label: '銀牌', type: 'number' as const, defaultValue: defaults[2] },
    { name: 'gold', label: '金牌', type: 'number' as const, defaultValue: defaults[3] },
    { name: 'platinum', label: '白金', type: 'number' as const, defaultValue: defaults[4] },
    { name: 'diamond', label: '鑽石', type: 'number' as const, defaultValue: defaults[5] },
  ],
})

/* ── 共用：獎品陣列 ── */
const prizesField = {
  name: 'prizes',
  label: '獎品設定',
  type: 'array' as const,
  fields: [
    { name: 'prizeName', label: '獎品名稱', type: 'text' as const, required: true },
    {
      name: 'prizeType',
      label: '獎品類型',
      type: 'select' as const,
      options: [
        { label: '點數', value: 'points' },
        { label: '購物金', value: 'credit' },
        { label: '優惠券', value: 'coupon' },
        { label: '電影票', value: 'movie_ticket' },
        { label: '免運券', value: 'free_shipping' },
        { label: '無獎品', value: 'none' },
      ],
    },
    { name: 'prizeAmount', label: '獎品數量', type: 'number' as const },
    { name: 'weight', label: '機率權重', type: 'number' as const, defaultValue: 10, admin: { description: '越高越容易中獎' } },
    { name: 'couponCode', label: '優惠券代碼', type: 'text' as const },
  ],
}

export const GameSettings: GlobalConfig = {
  slug: 'game-settings',
  label: '遊戲系統設定',
  admin: {
    group: '遊戲系統',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ══════════════════════════════════════
        // Tab 1: 遊戲通用設定
        // ══════════════════════════════════════
        {
          label: '通用設定',
          fields: [
            { name: 'enabled', label: '啟用遊戲系統（總開關）', type: 'checkbox', defaultValue: true },
            {
              name: 'globalDailyPointsLimit',
              label: '每日全遊戲點數上限',
              type: 'number',
              defaultValue: 500,
              admin: { description: '會員每日從所有遊戲獲得的總點數上限' },
            },
            {
              name: 'gameList',
              label: '遊戲總覽（快速開關）',
              type: 'group',
              admin: { description: '在此快速查看/切換所有遊戲的啟用狀態' },
              fields: [
                { name: 'dailyCheckinEnabled', label: '1. 每日簽到', type: 'checkbox', defaultValue: true, admin: { description: '✅ 預設開啟 — 基礎日常遊戲' } },
                { name: 'spinWheelEnabled', label: '2. 幸運轉盤', type: 'checkbox', defaultValue: true, admin: { description: '✅ 預設開啟 — 基礎抽獎遊戲' } },
                { name: 'scratchCardEnabled', label: '3. 刮刮樂', type: 'checkbox', defaultValue: true, admin: { description: '✅ 預設開啟 — 基礎抽獎遊戲' } },
                { name: 'movieLotteryEnabled', label: '4. 電影票抽獎', type: 'checkbox', defaultValue: false, admin: { description: '🔒 建議等待會員升級系統完善後開啟，可作為金牌以上會員專屬福利' } },
                { name: 'fashionChallengeEnabled', label: '5. 璀璨穿搭挑戰', type: 'checkbox', defaultValue: false, admin: { description: '📅 可配合換季、節慶等活動期間限時開啟' } },
                { name: 'cardBattleEnabled', label: '6. 抽卡片比大小', type: 'checkbox', defaultValue: true, admin: { description: '✅ 預設開啟 — 社交互動遊戲' } },
                { name: 'stylePKEnabled', label: '7. 穿搭 PK 對戰', type: 'checkbox', defaultValue: false, admin: { description: '📅 可配合活動期間開啟，需要足夠會員基數才有趣' } },
                { name: 'styleRelayEnabled', label: '8. 穿搭接龍', type: 'checkbox', defaultValue: false, admin: { description: '📅 可配合週末或特殊主題活動開啟' } },
                { name: 'weeklyChallengeEnabled', label: '9. 每週風格挑戰賽', type: 'checkbox', defaultValue: false, admin: { description: '📅 建議會員數達一定規模後開啟，每週一自動更新主題' } },
                { name: 'coCreateEnabled', label: '10. 好友共創穿搭', type: 'checkbox', defaultValue: false, admin: { description: '📅 可配合閨蜜節、情人節等社交主題活動開啟' } },
                { name: 'wishPoolEnabled', label: '11. 穿搭許願池', type: 'checkbox', defaultValue: false, admin: { description: '📅 可配合新品上市前開啟，收集會員期望' } },
                { name: 'blindBoxEnabled', label: '12. 穿搭盲盒互贈', type: 'checkbox', defaultValue: false, admin: { description: '📅 可配合聖誕節、交換禮物等節慶活動開啟' } },
                { name: 'queenVoteEnabled', label: '13. 女王投票大賽', type: 'checkbox', defaultValue: false, admin: { description: '📅 可配合婦女節、品牌週年慶等大型活動開啟' } },
                { name: 'teamStyleEnabled', label: '14. 團體穿搭房', type: 'checkbox', defaultValue: false, admin: { description: '📅 需要足夠活躍會員，建議搭配直播活動開啟' } },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 2: 每日簽到
        // ══════════════════════════════════════
        {
          label: '每日簽到',
          fields: [
            {
              name: 'dailyCheckin',
              type: 'group',
              label: '每日簽到設定',
              fields: [
                { name: 'day1to6Points', label: '第1~6天簽到點數', type: 'number', defaultValue: 5 },
                { name: 'day7BonusPoints', label: '第7天獎勵點數', type: 'number', defaultValue: 50 },
                { name: 'streakBonusMultiplier', label: '連續簽到倍率', type: 'number', defaultValue: 1.5, admin: { description: '連續簽到超過7天的倍率' } },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '每日簽到' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '每天簽到賺點數，連續七天有大獎！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '📅' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 3: 幸運轉盤
        // ══════════════════════════════════════
        {
          label: '幸運轉盤',
          fields: [
            {
              name: 'spinWheel',
              type: 'group',
              label: '幸運轉盤設定',
              fields: [
                tierFreeFields([0, 1, 2, 3, 5, 10]),
                { name: 'pointsCostPerPlay', label: '額外次數消耗點數', type: 'number', defaultValue: 50 },
                { name: 'dailyLimit', label: '每日次數上限', type: 'number', defaultValue: 10 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '幸運轉盤' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '轉動命運之輪，贏取超值獎品！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🎡' },
                prizesField,
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 4: 刮刮樂
        // ══════════════════════════════════════
        {
          label: '刮刮樂',
          fields: [
            {
              name: 'scratchCard',
              type: 'group',
              label: '刮刮樂設定',
              fields: [
                tierFreeFields([1, 1, 2, 2, 3, 5]),
                { name: 'pointsCostPerPlay', label: '額外次數消耗點數', type: 'number', defaultValue: 30 },
                { name: 'dailyLimit', label: '每日次數上限', type: 'number', defaultValue: 5 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '刮刮樂' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '刮開驚喜，幸運就在指尖！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🎫' },
                prizesField,
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 5: 電影票抽獎
        // ══════════════════════════════════════
        {
          label: '電影票抽獎',
          fields: [
            {
              name: 'movieLottery',
              type: 'group',
              label: '電影票抽獎設定',
              fields: [
                { name: 'pointsCostPerPlay', label: '每次消耗點數', type: 'number', defaultValue: 100 },
                { name: 'dailyLimit', label: '每日次數上限', type: 'number', defaultValue: 3 },
                { name: 'winRate', label: '中獎機率 (%)', type: 'number', defaultValue: 5, admin: { description: '百分比，5 = 5%' } },
                { name: 'ticketType', label: '電影票類型', type: 'text', defaultValue: '威秀影城 2D 一般廳' },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '電影票抽獎' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '用點數抽威秀電影票，看電影不花錢！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🎬' },
                { name: 'totalTickets', label: '本期總票數', type: 'number', defaultValue: 50 },
                { name: 'remainingTickets', label: '剩餘票數', type: 'number', defaultValue: 50 },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 6: 璀璨穿搭挑戰
        // ══════════════════════════════════════
        {
          label: '璀璨穿搭挑戰',
          fields: [
            {
              name: 'fashionChallenge',
              type: 'group',
              label: '璀璨穿搭挑戰設定',
              fields: [
                { name: 'dailyLimit', label: '每日次數上限', type: 'number', defaultValue: 5 },
                { name: 'pointsCostPerPlay', label: '每次消耗點數', type: 'number', defaultValue: 0 },
                { name: 'timeLimitSeconds', label: '時間限制（秒）', type: 'number', defaultValue: 60 },
                { name: 'rankSPoints', label: 'S 級獎勵點數', type: 'number', defaultValue: 50 },
                { name: 'rankAPoints', label: 'A 級獎勵點數', type: 'number', defaultValue: 30 },
                { name: 'rankBPoints', label: 'B 級獎勵點數', type: 'number', defaultValue: 15 },
                { name: 'rankCPoints', label: 'C 級獎勵點數', type: 'number', defaultValue: 5 },
                { name: 'shareBonusPoints', label: '分享獎勵點數', type: 'number', defaultValue: 10 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '璀璨穿搭挑戰' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '60秒混搭穿搭，AI即時評分！挑戰S級時尚達人！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '✨' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 7: 抽卡片比大小
        // ══════════════════════════════════════
        {
          label: '抽卡片比大小',
          fields: [
            {
              name: 'cardBattle',
              type: 'group',
              label: '抽卡片比大小設定',
              fields: [
                { name: 'dailyBattleLimit', label: '每日對戰次數', type: 'number', defaultValue: 3 },
                { name: 'winnerPointsMin', label: '贏家最低點數', type: 'number', defaultValue: 30 },
                { name: 'winnerPointsMax', label: '贏家最高點數', type: 'number', defaultValue: 80 },
                { name: 'loserPointsMin', label: '輸家最低點數', type: 'number', defaultValue: 5 },
                { name: 'loserPointsMax', label: '輸家最高點數', type: 'number', defaultValue: 15 },
                { name: 'drawPointsMin', label: '平手最低點數', type: 'number', defaultValue: 20 },
                { name: 'drawPointsMax', label: '平手最高點數', type: 'number', defaultValue: 40 },
                { name: 'roomExpiryHours', label: '房間過期時間（小時）', type: 'number', defaultValue: 24 },
                { name: 'referralBonusPoints', label: '推薦碼對戰額外獎勵', type: 'number', defaultValue: 20 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '抽卡片比大小' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '邀請好友抽卡對戰，比大小贏點數！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🃏' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 8: 穿搭 PK 對戰
        // ══════════════════════════════════════
        {
          label: '穿搭PK對戰',
          fields: [
            {
              name: 'stylePK',
              type: 'group',
              label: '穿搭 PK 對戰設定',
              fields: [
                { name: 'dailyLimit', label: '每日PK次數', type: 'number', defaultValue: 5 },
                { name: 'voteDurationHours', label: '投票持續時間（小時）', type: 'number', defaultValue: 24 },
                { name: 'winnerPoints', label: '勝出者獎勵點數', type: 'number', defaultValue: 50 },
                { name: 'participantPoints', label: '參與者獎勵點數', type: 'number', defaultValue: 10 },
                { name: 'voterPoints', label: '投票者獎勵點數', type: 'number', defaultValue: 3 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '穿搭 PK 對戰' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '上傳穿搭照，與其他玩家 PK，讓大家投票選出最佳穿搭！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '⚔️' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 9: 穿搭接龍
        // ══════════════════════════════════════
        {
          label: '穿搭接龍',
          fields: [
            {
              name: 'styleRelay',
              type: 'group',
              label: '穿搭接龍設定',
              fields: [
                { name: 'dailyLimit', label: '每日接龍次數', type: 'number', defaultValue: 3 },
                { name: 'participantPoints', label: '參與獎勵點數', type: 'number', defaultValue: 15 },
                { name: 'bestPickPoints', label: '最佳接龍獎勵', type: 'number', defaultValue: 50 },
                { name: 'chainLengthBonus', label: '接龍長度加成（每環）', type: 'number', defaultValue: 5 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '穿搭接龍' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '延續上一位玩家的風格元素，接力創造穿搭故事！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🔗' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 10: 每週風格挑戰賽
        // ══════════════════════════════════════
        {
          label: '每週挑戰',
          fields: [
            {
              name: 'weeklyChallenge',
              type: 'group',
              label: '每週風格挑戰賽設定',
              fields: [
                { name: 'submissionLimit', label: '每週投稿次數', type: 'number', defaultValue: 3 },
                { name: 'participantPoints', label: '投稿獎勵點數', type: 'number', defaultValue: 20 },
                { name: 'top1Points', label: '冠軍獎勵點數', type: 'number', defaultValue: 200 },
                { name: 'top2Points', label: '亞軍獎勵點數', type: 'number', defaultValue: 100 },
                { name: 'top3Points', label: '季軍獎勵點數', type: 'number', defaultValue: 50 },
                { name: 'currentTheme', label: '本週主題', type: 'text', defaultValue: '春日約會穿搭' },
                { name: 'themeDescription', label: '主題說明', type: 'textarea' },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '每週風格挑戰賽' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '每週不同主題，秀出你的時尚品味，爭奪穿搭冠軍！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🏆' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 11: 好友共創穿搭
        // ══════════════════════════════════════
        {
          label: '好友共創',
          fields: [
            {
              name: 'coCreate',
              type: 'group',
              label: '好友共創穿搭設定',
              fields: [
                { name: 'dailyLimit', label: '每日共創次數', type: 'number', defaultValue: 3 },
                { name: 'creatorPoints', label: '發起者獎勵點數', type: 'number', defaultValue: 20 },
                { name: 'collaboratorPoints', label: '共創者獎勵點數', type: 'number', defaultValue: 15 },
                { name: 'maxCollaborators', label: '最大共創人數', type: 'number', defaultValue: 4 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '好友共創穿搭' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '邀請好友一起搭配穿搭，共同創作時尚造型！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '👯' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 12: 穿搭許願池
        // ══════════════════════════════════════
        {
          label: '許願池',
          fields: [
            {
              name: 'wishPool',
              type: 'group',
              label: '穿搭許願池設定',
              fields: [
                { name: 'dailyWishLimit', label: '每日許願次數', type: 'number', defaultValue: 3 },
                { name: 'dailyFulfillLimit', label: '每日圓願次數', type: 'number', defaultValue: 5 },
                { name: 'wisherPoints', label: '被圓願者獲得點數', type: 'number', defaultValue: 10 },
                { name: 'fulfillerPoints', label: '圓願者獎勵點數', type: 'number', defaultValue: 20 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '穿搭許願池' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '許下穿搭願望，讓時尚達人幫你圓夢！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🌟' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 13: 穿搭盲盒互贈
        // ══════════════════════════════════════
        {
          label: '盲盒互贈',
          fields: [
            {
              name: 'blindBox',
              type: 'group',
              label: '穿搭盲盒互贈設定',
              fields: [
                { name: 'dailyLimit', label: '每日互贈次數', type: 'number', defaultValue: 2 },
                { name: 'pointsCost', label: '每次消耗點數', type: 'number', defaultValue: 30 },
                { name: 'senderPoints', label: '送出者獎勵點數', type: 'number', defaultValue: 15 },
                { name: 'receiverPoints', label: '接收者獎勵點數', type: 'number', defaultValue: 10 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '穿搭盲盒互贈' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '隨機搭配穿搭盲盒送給好友，拆箱驚喜無限！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🎁' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 14: 女王投票大賽
        // ══════════════════════════════════════
        {
          label: '女王投票',
          fields: [
            {
              name: 'queenVote',
              type: 'group',
              label: '女王投票大賽設定',
              fields: [
                { name: 'dailyVoteLimit', label: '每日投票次數', type: 'number', defaultValue: 10 },
                { name: 'submissionLimit', label: '每期投稿次數', type: 'number', defaultValue: 1 },
                { name: 'voterPoints', label: '投票者獎勵點數', type: 'number', defaultValue: 2 },
                { name: 'queenPoints', label: '女王獎勵點數', type: 'number', defaultValue: 500 },
                { name: 'runnerUpPoints', label: '亞軍獎勵點數', type: 'number', defaultValue: 200 },
                { name: 'participantPoints', label: '參與者獎勵點數', type: 'number', defaultValue: 30 },
                { name: 'periodDays', label: '每期天數', type: 'number', defaultValue: 7 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '女王投票大賽' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '上傳你的最美穿搭，爭奪本週時尚女王寶座！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '👑' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 15: 團體穿搭房
        // ══════════════════════════════════════
        {
          label: '團體穿搭房',
          fields: [
            {
              name: 'teamStyle',
              type: 'group',
              label: '團體穿搭房設定',
              fields: [
                { name: 'maxRoomSize', label: '最大房間人數', type: 'number', defaultValue: 6 },
                { name: 'dailyLimit', label: '每日開房次數', type: 'number', defaultValue: 3 },
                { name: 'hostPoints', label: '房主獎勵點數', type: 'number', defaultValue: 25 },
                { name: 'memberPoints', label: '參與者獎勵點數', type: 'number', defaultValue: 15 },
                { name: 'bestOutfitPoints', label: '最佳穿搭獎勵', type: 'number', defaultValue: 50 },
                { name: 'roomExpiryHours', label: '房間過期時間（小時）', type: 'number', defaultValue: 48 },
                { name: 'displayName', label: '顯示名稱', type: 'text', defaultValue: '團體穿搭房' },
                { name: 'description', label: '遊戲說明', type: 'textarea', defaultValue: '開房邀請好友，一起穿搭競賽，最佳造型贏大獎！' },
                { name: 'icon', label: '圖示 Emoji', type: 'text', defaultValue: '🏠' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════
        // Tab 16: 排行榜與徽章
        // ══════════════════════════════════════
        {
          label: '排行榜與徽章',
          fields: [
            {
              name: 'leaderboard',
              type: 'group',
              label: '排行榜設定',
              fields: [
                { name: 'enabled', label: '啟用排行榜', type: 'checkbox', defaultValue: true },
                { name: 'resetDaily', label: '每日重置', type: 'checkbox', defaultValue: true },
                { name: 'resetWeekly', label: '每週重置', type: 'checkbox', defaultValue: true },
                { name: 'resetMonthly', label: '每月重置', type: 'checkbox', defaultValue: true },
                { name: 'top3DailyBonus', label: '每日前三名額外獎勵', type: 'number', defaultValue: 100 },
                { name: 'top3WeeklyBonus', label: '每週前三名額外獎勵', type: 'number', defaultValue: 500 },
                { name: 'top3MonthlyBonus', label: '每月前三名額外獎勵', type: 'number', defaultValue: 2000 },
              ],
            },
          ],
        },
      ],
    },
  ],
}
