import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 生日行銷活動 Collection
 * ──────────────────────────
 * 會員生日月 5 階段自動化行銷管理
 * 根據會員等級、信用分數自動計算禮物額度
 *
 * ⚠️ 前台稱號與後台分級碼完全分離
 *    前台只顯示：優雅初遇者 / 曦漾仙子 / 優漾女神 / 金曦女王 / 星耀皇后 / 璀璨天后
 */

const TIER_FRONT_NAMES: Record<string, string> = {
  ordinary: '優雅初遇者',
  bronze: '曦漾仙子',
  silver: '優漾女神',
  gold: '金曦女王',
  platinum: '星耀皇后',
  diamond: '璀璨天后',
}

const channelOptions = [
  { label: 'LINE', value: 'line' },
  { label: 'Email', value: 'email' },
  { label: '推播通知', value: 'push' },
  { label: '站內彈窗', value: 'in_app_popup' },
]

const phaseStatusOptions = [
  { label: '待發送', value: 'pending' },
  { label: '已發送', value: 'sent' },
  { label: '已跳過', value: 'skipped' },
]

export const BirthdayCampaigns: CollectionConfig = {
  slug: 'birthday-campaigns',
  labels: { singular: '生日行銷活動', plural: '生日行銷活動' },
  admin: {
    group: '行銷推廣',
    description: '會員生日月 5 階段自動化行銷管理',
    defaultColumns: ['targetUser', 'targetTier', 'birthdayMonth', 'status', 'createdAt'],
    useAsTitle: 'campaignTitle',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { targetUser: { equals: user.id } }
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (!data) return data

        // Auto-generate campaignTitle
        if (data.targetUser) {
          try {
            const userId = typeof data.targetUser === 'object' ? data.targetUser.id : data.targetUser
            const user = await req.payload.findByID({ collection: 'users', id: userId })
            const tierCode = (user as any)?.membershipTier || data.targetTier || 'ordinary'
            const frontName = TIER_FRONT_NAMES[tierCode] || '優雅初遇者'
            const userName = (user as any)?.name || (user as any)?.email || ''
            const month = data.birthdayMonth || ''
            data.campaignTitle = `生日禮遇 — ${frontName} ${userName} ${month}月`
            data.targetTierFrontName = frontName

            if (!data.targetTier) {
              data.targetTier = tierCode
            }
            if (!data.targetSegment) {
              data.targetSegment = (user as any)?.segment || ''
            }
            if (data.targetCreditScore === undefined || data.targetCreditScore === null) {
              data.targetCreditScore = (user as any)?.creditScore ?? 0
            }
          } catch {
            // If user lookup fails, use available data
            const frontName = TIER_FRONT_NAMES[data.targetTier || 'ordinary'] || '優雅初遇者'
            data.campaignTitle = `生日禮遇 — ${frontName} ${data.birthdayMonth || ''}月`
            data.targetTierFrontName = frontName
          }
        }

        // On create: auto-calculate gift amounts from MarketingAutomationSettings
        if (operation === 'create') {
          try {
            const settings = await req.payload.findGlobal({ slug: 'marketing-automation-settings' }) as any
            const bdConfig = settings?.birthdayConfig
            if (bdConfig) {
              const tierCode = data.targetTier || 'ordinary'
              const creditScore = data.targetCreditScore ?? 0

              // Look up tier-specific gifts from tierGifts array
              const tierGift = bdConfig.tierGifts?.find((g: any) => g.tierCode === tierCode)

              if (tierGift) {
                data.giftConfig = {
                  discountPercent: tierGift.discountPercent || 0,
                  shoppingCredit: tierGift.shoppingCredit || 0,
                  bonusPoints: tierGift.bonusPoints || 0,
                  couponCode: tierGift.couponCode || '',
                  pointsMultiplier: bdConfig.pointsMultiplier ?? 2,
                  freeShipping: bdConfig.freeShippingAllTiers ?? true,
                  priorityShipping: tierCode === 'diamond' ? Boolean(bdConfig.vipT5PriorityShipping) : false,
                  stylingMinutes: tierGift.stylingMinutes || 0,
                  giftBoxIncluded: tierGift.giftBoxIncluded || false,
                  creditScoreBonus: 0,
                }

                // Credit score bonus for T4/T5
                const threshold = bdConfig.creditScoreThreshold ?? 90
                if (creditScore >= threshold) {
                  if (tierCode === 'platinum') {
                    data.giftConfig.creditScoreBonus = bdConfig.creditScoreBonusT4 ?? 200
                  } else if (tierCode === 'diamond') {
                    data.giftConfig.creditScoreBonus = bdConfig.creditScoreBonusT5 ?? 400
                  }
                }
              }
            }
          } catch {
            // If settings lookup fails, proceed without auto-calculation
          }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'campaignTitle',
      label: '活動標題',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'targetUser',
      label: '目標會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    { name: 'targetTier', label: '會員等級', type: 'text', admin: { readOnly: true } },
    { name: 'targetTierFrontName', label: '前台稱號', type: 'text', admin: { readOnly: true } },
    { name: 'targetSegment', label: '客群分群', type: 'text', admin: { readOnly: true } },
    { name: 'targetCreditScore', label: '信用分數', type: 'number', admin: { readOnly: true } },
    {
      name: 'birthdayMonth',
      label: '生日月份',
      type: 'number',
      required: true,
      min: 1,
      max: 12,
    },
    {
      name: 'birthdayYear',
      label: '生日年份',
      type: 'number',
      required: true,
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'scheduled',
      options: [
        { label: '已排程', value: 'scheduled' },
        { label: '階段一：預告', value: 'phase1_preview' },
        { label: '階段二：祝福', value: 'phase2_greeting' },
        { label: '階段三：中期推薦', value: 'phase3_midmonth' },
        { label: '階段四：倒數加碼', value: 'phase4_countdown' },
        { label: '階段五：感謝回饋', value: 'phase5_followup' },
        { label: '已完成', value: 'completed' },
        { label: '已取消', value: 'cancelled' },
      ],
    },

    // ═══════════════════════════════════════
    // ── 5 階段 ──
    // ═══════════════════════════════════════
    {
      name: 'phases',
      label: '階段設定',
      type: 'group',
      fields: [
        // 階段一：預告提醒
        {
          name: 'phase1',
          label: '階段一：預告提醒',
          type: 'group',
          fields: [
            { name: 'scheduledDate', label: '排程日期', type: 'date' },
            { name: 'sentAt', label: '發送時間', type: 'date' },
            { name: 'status', label: '狀態', type: 'select', defaultValue: 'pending', options: phaseStatusOptions },
            { name: 'channels', label: '管道', type: 'select', hasMany: true, options: channelOptions },
            { name: 'sentMessage', label: '實際發送的訊息內容', type: 'json', admin: { description: '實際發送的訊息內容' } },
          ],
        },
        // 階段二：正式生日祝福
        {
          name: 'phase2',
          label: '階段二：正式生日祝福',
          type: 'group',
          fields: [
            { name: 'scheduledDate', label: '排程日期', type: 'date' },
            { name: 'sentAt', label: '發送時間', type: 'date' },
            { name: 'status', label: '狀態', type: 'select', defaultValue: 'pending', options: phaseStatusOptions },
            { name: 'channels', label: '管道', type: 'select', hasMany: true, options: channelOptions },
            { name: 'sentMessage', label: '訊息內容', type: 'json' },
            {
              name: 'giftsDelivered',
              label: '禮物發放狀態',
              type: 'group',
              fields: [
                { name: 'discountApplied', label: '折扣已套用', type: 'checkbox' },
                { name: 'shoppingCreditIssued', label: '購物金已發放', type: 'checkbox' },
                { name: 'pointsIssued', label: '點數已發放', type: 'checkbox' },
                { name: 'couponIssued', label: '優惠券已發放', type: 'checkbox' },
                { name: 'giftBoxSent', label: '禮盒已寄出', type: 'checkbox' },
                { name: 'stylingBooked', label: '造型諮詢已預約', type: 'checkbox' },
              ],
            },
          ],
        },
        // 階段三：中期推薦
        {
          name: 'phase3',
          label: '階段三：中期推薦',
          type: 'group',
          fields: [
            { name: 'scheduledDate', label: '排程日期', type: 'date' },
            { name: 'sentAt', label: '發送時間', type: 'date' },
            { name: 'status', label: '狀態', type: 'select', defaultValue: 'pending', options: phaseStatusOptions },
            { name: 'channels', label: '管道', type: 'select', hasMany: true, options: channelOptions },
            { name: 'sentMessage', label: '訊息內容', type: 'json' },
            {
              name: 'recommendedProducts',
              label: '推薦商品',
              type: 'array',
              fields: [
                { name: 'product', label: '商品', type: 'relationship', relationTo: 'products' },
                { name: 'reason', label: '推薦原因', type: 'text' },
              ],
            },
          ],
        },
        // 階段四：倒數加碼
        {
          name: 'phase4',
          label: '階段四：倒數加碼',
          type: 'group',
          fields: [
            { name: 'scheduledDate', label: '排程日期', type: 'date' },
            { name: 'sentAt', label: '發送時間', type: 'date' },
            { name: 'status', label: '狀態', type: 'select', defaultValue: 'pending', options: phaseStatusOptions },
            { name: 'channels', label: '管道', type: 'select', hasMany: true, options: channelOptions },
            { name: 'sentMessage', label: '訊息內容', type: 'json' },
            {
              name: 'bonusOffer',
              label: '加碼優惠',
              type: 'group',
              fields: [
                { name: 'extraDiscount', label: '額外折扣 %', type: 'number' },
                { name: 'extraPoints', label: '額外點數', type: 'number' },
                { name: 'flashDealEnabled', label: '限時快閃', type: 'checkbox' },
              ],
            },
          ],
        },
        // 階段五：感謝回饋
        {
          name: 'phase5',
          label: '階段五：感謝回饋',
          type: 'group',
          fields: [
            { name: 'scheduledDate', label: '排程日期', type: 'date' },
            { name: 'sentAt', label: '發送時間', type: 'date' },
            { name: 'status', label: '狀態', type: 'select', defaultValue: 'pending', options: phaseStatusOptions },
            { name: 'channels', label: '管道', type: 'select', hasMany: true, options: channelOptions },
            { name: 'sentMessage', label: '訊息內容', type: 'json' },
            { name: 'shareInviteSent', label: '分享邀請已發送', type: 'checkbox', defaultValue: false },
          ],
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── 禮物設定 ──
    // ═══════════════════════════════════════
    {
      name: 'giftConfig',
      label: '禮物設定',
      type: 'group',
      fields: [
        { name: 'discountPercent', label: '折扣 %', type: 'number' },
        { name: 'shoppingCredit', label: '購物金 NT$', type: 'number' },
        { name: 'bonusPoints', label: '贈送點數', type: 'number' },
        { name: 'couponCode', label: '優惠券代碼', type: 'text' },
        { name: 'pointsMultiplier', label: '點數倍率', type: 'number', defaultValue: 2 },
        { name: 'freeShipping', label: '免運', type: 'checkbox', defaultValue: true },
        { name: 'priorityShipping', label: '優先出貨', type: 'checkbox', defaultValue: false },
        { name: 'stylingMinutes', label: '造型諮詢分鐘', type: 'number', defaultValue: 0 },
        { name: 'giftBoxIncluded', label: '含限量禮盒', type: 'checkbox', defaultValue: false },
        { name: 'creditScoreBonus', label: '信用分數額外購物金', type: 'number', defaultValue: 0 },
      ],
    },

    // ═══════════════════════════════════════
    // ── 成效數據 ──
    // ═══════════════════════════════════════
    {
      name: 'performance',
      label: '成效數據',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        { name: 'totalMessagesSent', label: '總發送數', type: 'number', defaultValue: 0 },
        { name: 'totalOpened', label: '總開啟數', type: 'number', defaultValue: 0 },
        { name: 'totalClicked', label: '總點擊數', type: 'number', defaultValue: 0 },
        { name: 'totalConverted', label: '總轉換數', type: 'number', defaultValue: 0 },
        { name: 'totalRevenue', label: '總營收', type: 'number', defaultValue: 0 },
      ],
    },

    {
      name: 'adminNote',
      label: '後台備註',
      type: 'textarea',
    },
  ],
}
