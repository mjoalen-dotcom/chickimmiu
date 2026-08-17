import type { CollectionConfig } from 'payload'
import { checkTransition } from '../lib/marketing/campaignLifecycle'
import { recordCampaignActivity } from '../lib/marketing/campaignAudit'

import { isAdmin } from '../access/isAdmin'

/**
 * 行銷活動 Collection
 * ──────────────────
 * 管理所有行銷活動：限時特賣、節慶行銷、新品上市、會員升等、清倉、UGC 競賽等
 * 支援 A/B 測試、多管道推播、AI 個人化、信用分數篩選、預算追蹤
 */
export const MarketingCampaigns: CollectionConfig = {
  slug: 'marketing-campaigns',
  labels: { singular: '行銷活動', plural: '行銷活動' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'campaignName',
    defaultColumns: ['campaignName', 'campaignType', 'status', 'updatedAt'],
    listSearchableFields: ['campaignName', 'campaignSlug'],
    description: '管理所有行銷活動與排程',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      // Campaign Engine（P0-C）：商務活動啟用門檻 — 預算上限與核准缺一不可（fail closed）
      ({ data, originalDoc }) => {
        if (!data) return data
        const next = { ...(originalDoc ?? {}), ...data } as Record<string, any>
        const commerce = next.commerce as Record<string, any> | undefined
        const activating = next.status === 'active' || next.status === 'scheduled'
        if (commerce?.enabled && activating) {
          if (typeof commerce.budgetCap !== 'number' || commerce.budgetCap <= 0) {
            throw new Error('商務活動啟用前必須填寫「活動總預算上限」（經濟護欄，不可留空）')
          }
          if (!commerce.approval?.approvedBy || !commerce.approval?.approvedAt) {
            throw new Error('商務活動啟用前必須完成核准（核准人 + 核准時間）')
          }
        }
        return data
      },
      // P0-C §6.2：狀態機強制。原本 10 個狀態只是下拉選項，任何轉換都放行
      // （active 可拉回 draft、ended 可拉回 active），等於沒有生命週期。
      ({ data, originalDoc, operation }) => {
        if (!data) return data
        const from = operation === 'create' ? null : (originalDoc?.status as string | undefined)
        const to = data.status as string | undefined
        if (to === undefined) return data // 沒動到 status 的更新不檢查

        const override = Boolean(data.statusOverride ?? originalDoc?.statusOverride)
        if (override) {
          const reason = String(data.statusOverrideReason ?? originalDoc?.statusOverrideReason ?? '').trim()
          if (!reason) {
            throw new Error('勾選「強制覆寫狀態」時必須填寫「覆寫原因」——這次操作會被寫入活動操作記錄供事後追查')
          }
          return data
        }

        const check = checkTransition(from, to)
        if (!check.allowed) throw new Error(check.message)
        return data
      },
      // P0-C §6.2：職責分離 — 不得自己核准自己送審的活動。
      // 預設關閉（小團隊只有一個 admin 時會卡死營運），由
      // promotion-settings.requireSeparateApprover 開啟。
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const approvedBy = (data.commerce as Record<string, any> | undefined)?.approval?.approvedBy
        if (!approvedBy) return data
        const prevApprovedBy = (originalDoc?.commerce as Record<string, any> | undefined)?.approval?.approvedBy
        const relId = (v: unknown) =>
          v == null ? null : typeof v === 'object' ? ((v as Record<string, unknown>).id ?? null) : v
        // 只在「核准人這次才被設定/變更」時檢查，避免每次存檔都擋
        if (String(relId(approvedBy)) === String(relId(prevApprovedBy))) return data

        const actorId = (req.user as Record<string, unknown> | null | undefined)?.id
        if (actorId == null || String(relId(approvedBy)) !== String(actorId)) return data

        try {
          const settings = (await req.payload.findGlobal({
            slug: 'promotion-settings' as never,
          })) as Record<string, unknown>
          if (settings?.requireSeparateApprover === true) {
            throw new Error(
              '職責分離：不可將核准人設為自己。請由另一位管理員核准此活動（此規則由「促銷引擎設定 → 核准需另一位管理員」控制）。',
            )
          }
        } catch (err) {
          // 只有我們自己丟的職責分離錯誤要往上拋；設定讀取失敗不擋存檔
          if (err instanceof Error && err.message.startsWith('職責分離')) throw err
        }
        return data
      },
    ],
    afterChange: [
      // P0-C §6.2：稽核軌跡。工作單要求「任何 active/paused/ended 變更寫入
      // Audit Log：操作者、前後值、原因、版本與時間」——原本完全沒有。
      //
      // 稽核寫入沿用同一個 transaction（見 campaignAudit.ts 的外鍵死鎖說明），
      // 因此語意是 fail-closed：稽核寫不進去，這次變更也不會存檔。對一個會直接
      // 花錢的物件來說「有變更卻查不到紀錄」比「存不了檔」更糟，這是刻意取捨。
      // 下面的 catch 只能攔到非 DB 層的錯（PG 一旦報錯整條 transaction 就作廢），
      // 留著是為了讓 error log 有內容可查，不是為了讓存檔繼續。
      async ({ doc, previousDoc, operation, req }) => {
        try {
          await recordCampaignActivity({ payload: req.payload, req, doc, previousDoc, operation })
        } catch (err) {
          req.payload.logger.error({ err, msg: '[campaign-audit] 稽核紀錄寫入失敗（不影響活動存檔）' })
        }
        return doc
      },
    ],
  },
  timestamps: true,
  fields: [
    {
      name: 'campaignName',
      label: '活動名稱',
      type: 'text',
      required: true,
    },
    {
      name: 'campaignSlug',
      label: '活動代碼',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'campaignType',
      label: '活動類型',
      type: 'select',
      options: [
        { label: '限時特賣', value: 'flash_sale' },
        { label: '節慶行銷', value: 'festival' },
        { label: '新品上市', value: 'new_product_launch' },
        { label: '會員升等', value: 'membership_upgrade' },
        { label: '清倉特賣', value: 'clearance' },
        { label: 'UGC 競賽', value: 'ugc_contest' },
        { label: '推薦加碼', value: 'referral_boost' },
        { label: '忠誠活動', value: 'loyalty_event' },
        { label: '季節性活動', value: 'seasonal' },
        { label: '自訂', value: 'custom' },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '送審中', value: 'review' },
        { label: '已核准', value: 'approved' },
        { label: '已排程', value: 'scheduled' },
        { label: '進行中', value: 'active' },
        { label: '已暫停', value: 'paused' },
        { label: '已結束', value: 'ended' },
        { label: '已完成', value: 'completed' },
        { label: '已取消', value: 'cancelled' },
        { label: '已封存', value: 'archived' },
      ],
    },
    {
      name: 'description',
      label: '活動描述',
      type: 'textarea',
    },
    {
      name: 'targetSegments',
      label: '目標客群',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'VIP1 - 高價值忠誠', value: 'VIP1' },
        { label: 'VIP2 - 高價值成長', value: 'VIP2' },
        { label: 'POT1 - 潛力客戶', value: 'POT1' },
        { label: 'REG1 - 穩定客戶', value: 'REG1' },
        { label: 'REG2 - 一般客戶', value: 'REG2' },
        { label: 'RISK1 - 流失風險', value: 'RISK1' },
        { label: 'RISK2 - 高風險', value: 'RISK2' },
        { label: 'NEW1 - 新客戶', value: 'NEW1' },
        { label: 'SLP1 - 沉睡客戶', value: 'SLP1' },
        { label: 'BLK1 - 黑名單', value: 'BLK1' },
        { label: '全部', value: 'all' },
      ],
    },
    {
      name: 'creditScoreFilter',
      label: '信用分數篩選',
      type: 'group',
      fields: [
        { name: 'minScore', label: '最低分數', type: 'number' },
        { name: 'maxScore', label: '最高分數', type: 'number' },
      ],
    },
    {
      name: 'tierFilter',
      label: '會員等級篩選',
      type: 'select',
      hasMany: true,
      options: [
        { label: '優雅初遇者', value: 'ordinary' },
        { label: '曦漾仙子', value: 'bronze' },
        { label: '優漾女神', value: 'silver' },
        { label: '金曦女王', value: 'gold' },
        { label: '星耀皇后', value: 'platinum' },
        { label: '璀璨天后', value: 'diamond' },
        { label: '全部', value: 'all' },
      ],
    },
    {
      name: 'schedule',
      label: '排程',
      type: 'group',
      fields: [
        { name: 'startDate', label: '開始日期', type: 'date', required: true },
        { name: 'endDate', label: '結束日期', type: 'date', required: true },
        { name: 'timezone', label: '時區', type: 'text', defaultValue: 'Asia/Taipei' },
      ],
    },
    {
      name: 'channels',
      label: '推播管道',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'LINE', value: 'line' },
        { label: 'Email', value: 'email' },
        { label: '簡訊', value: 'sms' },
        { label: '推播通知', value: 'push' },
        { label: '站內彈窗', value: 'in_app_popup' },
        { label: 'EDM', value: 'edm' },
      ],
    },
    {
      name: 'journeyRef',
      label: '關聯自動化旅程',
      type: 'relationship',
      relationTo: 'automation-journeys',
    },
    {
      name: 'messageTemplates',
      label: '訊息模板',
      type: 'array',
      fields: [
        {
          name: 'channel',
          label: '管道',
          type: 'select',
          options: [
            { label: 'LINE', value: 'line' },
            { label: 'Email', value: 'email' },
            { label: '簡訊', value: 'sms' },
            { label: '推播通知', value: 'push' },
            { label: '站內彈窗', value: 'in_app_popup' },
            { label: 'EDM', value: 'edm' },
          ],
        },
        {
          name: 'templateRef',
          label: '訊息模板',
          type: 'relationship',
          relationTo: 'message-templates',
        },
      ],
    },
    {
      name: 'abTestEnabled',
      label: '啟用 A/B 測試',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'abTestConfig',
      label: 'A/B 測試設定',
      type: 'group',
      admin: {
        condition: (data) => Boolean(data?.abTestEnabled),
      },
      fields: [
        { name: 'variantCount', label: '變體數量', type: 'number', defaultValue: 2 },
        {
          name: 'splitRatio',
          label: '流量分配',
          type: 'array',
          fields: [
            { name: 'variantName', label: '變體名稱', type: 'text' },
            { name: 'percentage', label: '百分比', type: 'number' },
          ],
        },
        {
          name: 'winnerMetric',
          label: '勝出指標',
          type: 'select',
          options: [
            { label: '開信率', value: 'open_rate' },
            { label: '點擊率', value: 'click_rate' },
            { label: '轉換率', value: 'conversion_rate' },
            { label: '營收', value: 'revenue' },
          ],
        },
        { name: 'autoSelectWinner', label: '自動選擇勝出', type: 'checkbox', defaultValue: true },
        { name: 'minSampleSize', label: '最小樣本數', type: 'number', defaultValue: 100 },
      ],
    },
    {
      name: 'budget',
      label: '預算',
      type: 'group',
      fields: [
        { name: 'totalBudget', label: '總預算', type: 'number' },
        { name: 'spentAmount', label: '已花費', type: 'number', defaultValue: 0 },
        { name: 'costPerMessage', label: '每則訊息成本', type: 'number' },
      ],
    },
    {
      name: 'performance',
      label: '成效數據',
      type: 'group',
      admin: {
        readOnly: true,
      },
      fields: [
        { name: 'sent', label: '已發送', type: 'number', defaultValue: 0 },
        { name: 'delivered', label: '已送達', type: 'number', defaultValue: 0 },
        { name: 'opened', label: '已開啟', type: 'number', defaultValue: 0 },
        { name: 'clicked', label: '已點擊', type: 'number', defaultValue: 0 },
        { name: 'converted', label: '已轉換', type: 'number', defaultValue: 0 },
        { name: 'revenue', label: '營收', type: 'number', defaultValue: 0 },
        { name: 'unsubscribed', label: '退訂', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'personalizedContent',
      label: '個人化內容',
      type: 'group',
      fields: [
        { name: 'useAIRecommendation', label: '使用 AI 推薦', type: 'checkbox', defaultValue: true },
        { name: 'useUGC', label: '使用 UGC 內容', type: 'checkbox', defaultValue: true },
        { name: 'useCreditScorePersonalization', label: '依信用分數個人化', type: 'checkbox', defaultValue: true },
        { name: 'useSegmentPersonalization', label: '依客群個人化', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      name: 'linkedFestival',
      label: '關聯節慶模板',
      type: 'relationship',
      relationTo: 'festival-templates',
      admin: {
        condition: (data) => data?.campaignType === 'festival',
      },
    },
    // ── Campaign Engine（CHIC Commerce OS P0）：商務促銷設定 ──────────────
    // 活動是 Root；實際折扣規則在 promotion-rules（版本化）。
    // 啟用門檻（beforeChange 強制）：budgetCap + approval 缺一不可。
    {
      name: 'commerce',
      label: '商務促銷設定',
      type: 'group',
      admin: {
        description: '啟用後此活動可掛促銷規則（任N件折X等）；預算與核准為啟用必要條件',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'enabled', label: '啟用商務促銷', type: 'checkbox', defaultValue: false },
            {
              name: 'killSwitch',
              label: '🚨 暫停此活動促銷',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: '立即停用此活動所有規則（不影響其他活動）' },
            },
          ],
        },
        {
          name: 'objective',
          label: '商業目標',
          type: 'select',
          options: [
            { label: '提升轉換', value: 'conversion' },
            { label: '提升客單價', value: 'aov' },
            { label: '清庫存', value: 'clearance' },
            { label: '回購', value: 'repurchase' },
            { label: '會員啟用', value: 'activation' },
            { label: 'KOL 團購', value: 'kol' },
            { label: '新品探索', value: 'discovery' },
          ],
        },
        {
          name: 'surfaces',
          label: '體驗版位',
          type: 'select',
          hasMany: true,
          options: [
            { label: '首頁', value: 'home' },
            { label: '商品列表', value: 'plp' },
            { label: '商品頁', value: 'pdp' },
            { label: '購物車', value: 'cart' },
            { label: '結帳', value: 'checkout' },
            { label: '會員中心', value: 'member' },
            { label: '完成頁', value: 'complete' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'headline', label: '活動主張', type: 'text' },
            { name: 'badgeText', label: '商品 Badge 文字', type: 'text' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'ctaText', label: 'CTA 文字', type: 'text' },
            { name: 'ctaHref', label: 'CTA 連結', type: 'text' },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'budgetCap',
              label: '活動總預算上限（NT$）',
              type: 'number',
              min: 1,
              admin: { description: '折扣成本上限；啟用必填（缺值不可上線）' },
            },
            {
              name: 'budgetSpent',
              label: '已用預算（NT$）',
              type: 'number',
              defaultValue: 0,
              min: 0,
              admin: { readOnly: true, description: '建單時原子累加；取消/退款回沖' },
            },
          ],
        },
        {
          name: 'approval',
          label: '核准',
          type: 'group',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'approvedBy',
                  label: '核准人',
                  type: 'relationship',
                  relationTo: 'users',
                },
                { name: 'approvedAt', label: '核准時間', type: 'date' },
              ],
            },
            { name: 'approvalNote', label: '核准備註', type: 'text' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'statusOverride',
          label: '強制覆寫狀態',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              '狀態機逃生門：正常請照 草稿→送審→核准→排程→上線 依序操作。確實需要例外時勾選並填原因，該次轉換會在活動操作記錄中標記為強制覆寫。',
          },
        },
        {
          name: 'statusOverrideReason',
          label: '覆寫原因',
          type: 'text',
          admin: {
            condition: (_d, sibling) =>
              Boolean((sibling as Record<string, unknown> | undefined)?.statusOverride),
          },
        },
      ],
    },
    {
      name: 'adminNote',
      label: '後台備註',
      type: 'textarea',
    },
  ],
}
