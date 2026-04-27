import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * T5 璀璨天后 — 私人生活管家服務請求
 * ──────────────────────────────────────────────
 * 僅 T5（璀璨天后）會員可提交管家服務請求
 * AI 初步處理 + 真人管家跟進
 */
export const ConciergeServiceRequests: CollectionConfig = {
  slug: 'concierge-service-requests',
  labels: {
    singular: '管家服務請求',
    plural: '管家服務請求',
  },
  admin: {
    group: '⑤ 互動體驗',
    useAsTitle: 'requestNumber',
    defaultColumns: ['requestNumber', 'requester', 'serviceType', 'priority', 'status', 'createdAt'],
    description: 'T5 璀璨天后私人生活管家服務請求管理',
  },
  timestamps: true,
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // 璀璨天后會員只能看自己的請求
      return {
        requester: { equals: user.id },
      }
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      // 僅 diamond (T5 璀璨天后) 可建立
      const tierObj = user.memberTier as unknown as Record<string, unknown> | undefined
      const tierSlug = typeof user.memberTier === 'string'
        ? user.memberTier
        : tierObj?.slug as string | undefined
      return tierSlug === 'diamond'
    },
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          // 自動產生請求編號 CNC-YYYYMMDD-XXXX
          const now = new Date()
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
          const randomSuffix = String(Math.floor(1000 + Math.random() * 9000))
          data.requestNumber = `CNC-${dateStr}-${randomSuffix}`

          // 自動填入 requesterTier 和 requesterCreditScore
          if (data.requester) {
            const { getPayload } = await import('payload')
            const config = (await import('@payload-config')).default
            const payload = await getPayload({ config })
            const userId = typeof data.requester === 'string' ? data.requester : data.requester.id || data.requester
            const user = await payload.findByID({
              collection: 'users',
              id: userId,
              depth: 1,
            })
            if (user) {
              const tierObj = user.memberTier as unknown as Record<string, unknown> | undefined
              const tierSlug = typeof user.memberTier === 'string'
                ? user.memberTier
                : tierObj?.slug as string | undefined
              data.requesterTier = tierSlug || 'unknown'
              data.requesterCreditScore = (user as unknown as Record<string, unknown>).creditScore as number ?? 0

              // 信用分數 >= 90 自動設為 high 優先級
              const creditScore = data.requesterCreditScore as number
              if (creditScore >= 95) {
                data.priority = 'urgent'
              } else if (creditScore >= 90) {
                data.priority = 'high'
              }
            }
          }
        }
        return data
      },
    ],
  },
  fields: [
    // ── 請求基本資訊 ──
    {
      name: 'requestNumber',
      label: '請求編號',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'requester',
      label: '請求會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'requesterTier',
      label: '會員等級',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'requesterCreditScore',
      label: '信用分數',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'assignedConcierge',
      label: '指派專屬管家',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: '固定真人管家' },
    },
    // ── 服務類型 ──
    {
      name: 'serviceType',
      label: '服務類型',
      type: 'select',
      required: true,
      options: [
        { label: '時尚購物顧問 — 穿搭建議', value: 'fashion_styling' },
        { label: '時尚購物顧問 — 尺寸諮詢', value: 'size_consultation' },
        { label: '時尚購物顧問 — 客製化訂購', value: 'custom_order' },
        { label: '生活禮賓 — 訂餐廳', value: 'restaurant_booking' },
        { label: '生活禮賓 — 米其林 / 高級餐廳', value: 'michelin_booking' },
        { label: '生活禮賓 — 演唱會 / 展覽門票', value: 'event_tickets' },
        { label: '生活禮賓 — 訂花 / 蛋糕 / 禮物', value: 'flower_cake_gift' },
        { label: '生活禮賓 — 酒店 / 旅行規劃', value: 'hotel_travel' },
        { label: '生活禮賓 — 私人活動規劃', value: 'private_event' },
        { label: '生活禮賓 — 美容 / 健身', value: 'beauty_wellness' },
        { label: '生活禮賓 — 專車接送', value: 'driver_service' },
        { label: '其他生活需求', value: 'other' },
      ],
    },
    // ── 優先級 ──
    {
      name: 'priority',
      label: '優先級',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: '緊急（30 分鐘內回應）', value: 'urgent' },
        { label: '高（1 小時內回應）', value: 'high' },
        { label: '一般（2 小時內回應）', value: 'normal' },
        { label: '低（24 小時內回應）', value: 'low' },
      ],
    },
    // ── 狀態 ──
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      defaultValue: 'submitted',
      options: [
        { label: '已提交', value: 'submitted' },
        { label: 'AI 初步處理中', value: 'ai_processing' },
        { label: '已指派管家', value: 'assigned' },
        { label: '處理中', value: 'in_progress' },
        { label: '等待確認', value: 'pending_confirmation' },
        { label: '已完成', value: 'completed' },
        { label: '已取消', value: 'cancelled' },
      ],
    },
    // ── 需求詳情 ──
    {
      name: 'requestDetail',
      label: '需求詳情',
      type: 'group',
      fields: [
        {
          name: 'description',
          label: '需求描述',
          type: 'textarea',
          required: true,
        },
        {
          name: 'preferredDate',
          label: '希望日期',
          type: 'date',
        },
        {
          name: 'preferredTime',
          label: '希望時間',
          type: 'text',
        },
        {
          name: 'location',
          label: '地點',
          type: 'text',
        },
        {
          name: 'budget',
          label: '預算範圍',
          type: 'text',
        },
        {
          name: 'numberOfPeople',
          label: '人數',
          type: 'number',
        },
        {
          name: 'specialRequirements',
          label: '特殊需求',
          type: 'textarea',
        },
        {
          name: 'attachments',
          label: '附件',
          type: 'array',
          fields: [
            {
              name: 'file',
              label: '檔案',
              type: 'upload',
              relationTo: 'media',
            },
          ],
        },
      ],
    },
    // ── AI 初步回覆 ──
    {
      name: 'aiResponse',
      label: 'AI 初步回覆',
      type: 'group',
      fields: [
        {
          name: 'aiSuggestion',
          label: 'AI 建議方案',
          type: 'textarea',
        },
        {
          name: 'aiConfidence',
          label: 'AI 信心指數 %',
          type: 'number',
        },
        {
          name: 'aiProcessedAt',
          label: 'AI 處理時間',
          type: 'date',
        },
        {
          name: 'aiRecommendedOptions',
          label: 'AI 推薦選項',
          type: 'json',
        },
      ],
    },
    // ── 管家處理紀錄 ──
    {
      name: 'conciergeNotes',
      label: '管家處理紀錄',
      type: 'array',
      fields: [
        {
          name: 'note',
          label: '備註',
          type: 'textarea',
          required: true,
        },
        {
          name: 'noteType',
          label: '備註類型',
          type: 'select',
          options: [
            { label: '進度更新', value: 'update' },
            { label: '內部備註', value: 'internal' },
            { label: '客戶可見', value: 'customer_facing' },
          ],
        },
        {
          name: 'addedBy',
          label: '新增者',
          type: 'relationship',
          relationTo: 'users',
        },
        {
          name: 'addedAt',
          label: '新增時間',
          type: 'date',
        },
      ],
    },
    // ── 處理結果 ──
    {
      name: 'resolution',
      label: '處理結果',
      type: 'group',
      fields: [
        {
          name: 'outcome',
          label: '服務結果',
          type: 'textarea',
        },
        {
          name: 'customerSatisfaction',
          label: '滿意度',
          type: 'number',
          min: 1,
          max: 5,
        },
        {
          name: 'feedbackNote',
          label: '客戶回饋',
          type: 'textarea',
        },
        {
          name: 'completedAt',
          label: '完成時間',
          type: 'date',
        },
        {
          name: 'totalCost',
          label: '實際費用',
          type: 'number',
        },
        {
          name: 'invoiceNumber',
          label: '發票號碼',
          type: 'text',
        },
      ],
    },
    // ── 關聯與生日月 ──
    {
      name: 'relatedOrder',
      label: '相關訂單',
      type: 'relationship',
      relationTo: 'orders',
    },
    {
      name: 'isBirthdayMonthRequest',
      label: '生日月請求',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'birthdayMonthUpgrade',
      label: '生日月升級項目',
      type: 'text',
      admin: {
        condition: (data) => Boolean(data?.isBirthdayMonthRequest),
      },
    },
  ],
}
