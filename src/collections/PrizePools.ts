import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 大獎池（Prize Pool）
 * ─────────────────────
 * 跨遊戲統一獎品庫存。每筆獎品包含：
 *   - 名稱、類型、面額、權重、適用遊戲（hasMany select）
 *   - 庫存控制（unlimited / 總量 / 剩餘）
 *   - 時程控制（active / 開始 / 結束）
 *   - 兌換方式（即時加分 / 電子券 / 實體隨單寄出）
 *   - 風控上限（個人月度 / 終身）
 *
 * 抽獎邏輯（gameEngine.ts drawPrize）：
 *   1. 撈所有 active=true、在 schedule 範圍內、eligibleGames includes 該遊戲的 prize-pools
 *   2. 過濾掉 inventory.remainingQuantity <= 0（unlimited 永遠通過）
 *   3. 套 weight + tier/credit boost（'none' 不享 boost）
 *   4. 中獎後 admin 可從後台看到 remainingQuantity 自動 -1（hook 處理）
 *
 * 若 PrizePools 對某遊戲 0 筆（admin 還沒設定）→ fallback 到 GAME_CONFIGS hardcoded prizeTable，
 * 確保新環境不會卡住。
 *
 * Phase B: collection schema only
 * Phase D: delivery.method='physical_shipping' 進 UserRewards.requiresPhysicalShipping=true
 * Phase E: compliance 欄位由 abuseDetection 讀取
 */
export const PrizePools: CollectionConfig = {
  slug: 'prize-pools',
  labels: { singular: '大獎池獎品', plural: '大獎池獎品' },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'name',
    defaultColumns: ['name', 'prizeType', 'amount', 'weight', 'inventoryRemaining', 'active', 'updatedAt'],
    description: '跨遊戲統一獎品配置 — 機率、庫存、時程、兌換方式集中管理',
  },
  access: {
    read: () => true, // 機率公示頁 /games/terms 公開讀取（剝掉 weight、剩餘庫存）
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    // ── 基本資訊 ──
    {
      type: 'tabs',
      tabs: [
        {
          label: '基本資訊',
          fields: [
            {
              name: 'name',
              label: '獎品名稱',
              type: 'text',
              required: true,
              admin: { description: '會員看到的獎品顯示名（例如「100 點數」「NT$50 購物金」「銘謝惠顧」）' },
            },
            {
              name: 'slug',
              label: '系統識別碼',
              type: 'text',
              required: true,
              unique: true,
              admin: {
                description: '英數小寫＋hyphen，建立後勿改（例：100-points / 50-credit / no-prize）',
              },
            },
            {
              name: 'prizeType',
              label: '獎品類型',
              type: 'select',
              required: true,
              options: [
                { label: '會員點數', value: 'points' },
                { label: '購物金', value: 'credit' },
                { label: '優惠券', value: 'coupon' },
                { label: '電影票', value: 'movie_ticket' },
                { label: '免運券', value: 'free_shipping' },
                { label: '實體贈品', value: 'physical_gift' },
                { label: '徽章', value: 'badge' },
                { label: '銘謝惠顧（未中獎）', value: 'none' },
              ],
            },
            {
              name: 'amount',
              label: '數值',
              type: 'number',
              defaultValue: 0,
              admin: {
                description: '點數量、購物金面額（NT$）、優惠券折扣百分點、贈品數量等',
              },
            },
            {
              name: 'couponCode',
              label: '優惠券代碼',
              type: 'text',
              admin: {
                description: 'prizeType=coupon 時填，對應 Coupons collection 的 code',
                condition: (_, { prizeType }) => prizeType === 'coupon',
              },
            },
            {
              name: 'description',
              label: '獎品說明',
              type: 'textarea',
              admin: { description: '獎品介紹、使用條件、注意事項' },
            },
            {
              name: 'image',
              label: '獎品圖片',
              type: 'upload',
              relationTo: 'media',
              admin: { description: '可選；公示頁與寶物箱會用' },
            },
          ],
        },

        // ── 抽獎機率 ──
        {
          label: '機率與適用遊戲',
          fields: [
            {
              name: 'weight',
              label: '機率權重',
              type: 'number',
              required: true,
              defaultValue: 10,
              min: 0,
              admin: {
                description: '同一遊戲內所有獎品 weight 加總後算百分比；越高越容易中獎。0 = 不會抽到',
              },
            },
            {
              name: 'eligibleGames',
              label: '適用遊戲',
              type: 'select',
              hasMany: true,
              required: true,
              options: [
                { label: '幸運轉盤', value: 'spin_wheel' },
                { label: '刮刮樂', value: 'scratch_card' },
                { label: '電影票抽獎', value: 'movie_lottery' },
                { label: '穿搭挑戰', value: 'fashion_challenge' },
                { label: '抽卡片比大小', value: 'card_battle' },
                { label: '穿搭 PK', value: 'style_pk' },
                { label: '穿搭接龍', value: 'style_relay' },
                { label: '每週挑戰', value: 'weekly_challenge' },
                { label: '好友共創', value: 'co_create' },
                { label: '穿搭盲盒', value: 'blind_box' },
                { label: '女王投票', value: 'queen_vote' },
                { label: '團體穿搭房', value: 'team_style' },
                { label: '穿搭許願池', value: 'wish_pool' },
              ],
              admin: { description: '此獎品可在哪些遊戲中抽到（可多選）' },
            },
            {
              name: 'tierBoost',
              label: '等級加成',
              type: 'group',
              admin: { description: '會員等級越高，抽到此獎機率提升的倍率（1.0 = 無加成）' },
              fields: [
                { name: 'ordinary', label: '一般會員', type: 'number', defaultValue: 1.0, min: 0 },
                { name: 'bronze', label: '銅牌', type: 'number', defaultValue: 1.0, min: 0 },
                { name: 'silver', label: '銀牌', type: 'number', defaultValue: 1.0, min: 0 },
                { name: 'gold', label: '金牌', type: 'number', defaultValue: 1.0, min: 0 },
                { name: 'platinum', label: '白金', type: 'number', defaultValue: 1.0, min: 0 },
                { name: 'diamond', label: '鑽石', type: 'number', defaultValue: 1.0, min: 0 },
              ],
            },
          ],
        },

        // ── 庫存控制 ──
        {
          label: '庫存與時程',
          fields: [
            {
              name: 'active',
              label: '啟用此獎品',
              type: 'checkbox',
              defaultValue: true,
              admin: { description: '取消勾選即移出抽獎池（不會被抽到，但歷史紀錄不影響）' },
            },
            {
              name: 'inventoryUnlimited',
              label: '無限量供應',
              type: 'checkbox',
              defaultValue: true,
              admin: { description: '勾選 = 抽不完（如點數類）；取消勾選需設總量' },
            },
            {
              name: 'inventoryTotal',
              label: '總量',
              type: 'number',
              min: 0,
              admin: {
                description: '本期可發出的總獎品數（實體獎品必填）',
                condition: (_, { inventoryUnlimited }) => !inventoryUnlimited,
              },
            },
            {
              name: 'inventoryRemaining',
              label: '剩餘量',
              type: 'number',
              min: 0,
              admin: {
                description: '剩餘可發出獎品數；中獎時自動扣 1。手動修改可重置',
                condition: (_, { inventoryUnlimited }) => !inventoryUnlimited,
              },
            },
            {
              name: 'startsAt',
              label: '上架時間',
              type: 'date',
              admin: {
                description: '留空 = 立即上架；填了則達該時間才會被抽到',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'endsAt',
              label: '下架時間',
              type: 'date',
              admin: {
                description: '留空 = 永不下架；填了則過該時間自動移出抽獎池',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },

        // ── 兌換方式 ──
        {
          label: '兌換方式',
          fields: [
            {
              name: 'deliveryMethod',
              label: '兌換方式',
              type: 'select',
              required: true,
              defaultValue: 'instant_credit',
              options: [
                { label: '即時入帳（點數 / 購物金直接加到帳戶）', value: 'instant_credit' },
                { label: '電子券（進寶物箱，可線上使用）', value: 'digital_coupon' },
                { label: '實體寄出（隨下次訂單一起出貨）', value: 'physical_shipping' },
                { label: '手動聯絡（客服協助履行）', value: 'manual_contact' },
              ],
              admin: {
                description: '物理寄出 = 中獎後寶物箱顯示「需配合下次購物隨單寄出」',
              },
            },
            {
              name: 'redemptionInstructions',
              label: '兌換說明',
              type: 'textarea',
              admin: {
                description: '會員看到的兌換指引（兌換地點、有效期、注意事項）',
              },
            },
            {
              name: 'expiryDays',
              label: '獎品有效天數',
              type: 'number',
              defaultValue: 365,
              min: 1,
              admin: {
                description: '中獎後幾天內須使用（電子券 / 實體贈品適用，預設 365 天）',
              },
            },
          ],
        },

        // ── 風控與合規 ──
        {
          label: '風控與合規',
          fields: [
            {
              name: 'maxPerUserMonthly',
              label: '每位會員月度上限',
              type: 'number',
              min: 0,
              admin: {
                description: '同一會員每月最多中此獎 N 次；0 或留空 = 不限',
              },
            },
            {
              name: 'maxPerUserLifetime',
              label: '每位會員終身上限',
              type: 'number',
              min: 0,
              admin: {
                description: '同一會員一生最多中此獎 N 次（高價獎品建議設 1）；0 或留空 = 不限',
              },
            },
            {
              name: 'estimatedValue',
              label: '預估市值（NT$）',
              type: 'number',
              min: 0,
              admin: {
                description: '法規揭露用，公示頁顯示。點數/購物金可留空（系統自動換算）',
              },
            },
            {
              name: 'adminNotes',
              label: '內部備註',
              type: 'textarea',
              admin: {
                description: 'admin 內部記事，不會顯示給會員',
              },
            },
          ],
        },
      ],
    },
  ],
}
