import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * Conversations Collection（客服中心 v1 Phase 1A）
 * ────────────────────────────────────────────────
 * 對話 thread 主檔。1 row = 1 個客服 thread（跨多訊息）。
 *
 * 設計原則（schema-first）：
 * - 一次把 priority/status/SLA/AI/CSAT/UTM 全做完整，後續 phase 只 ALTER 加欄位、不破壞
 * - Phase 6（AI）/ Phase 8（CSAT）的欄位先存著，UI 在 tabs 標示「接通後啟用」
 * - 訊息獨立成 Messages collection（不 inline array），因 webhook race-safe + externalId dedup +
 *   無 Payload array length 上限
 *
 * 工單編號 ticketNumber：beforeChange hook 自動產生 CS-YYYY-NNNNN（年度流水）
 *
 * 對應：
 * - Messages.ts（hasMany messages with relationship）
 * - MessageTags.ts（hasMany tags）
 * - ConversationActivities.ts（audit log）
 * - CustomerServiceSettings global（業務時間、SLA 規則）
 * - CustomerServiceTickets.ts（v0，已 admin.hidden 取代之）
 */
export const Conversations: CollectionConfig = {
  slug: 'conversations',
  labels: { singular: '對話', plural: '對話' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'ticketNumber',
    defaultColumns: [
      'ticketNumber',
      'channel',
      'customer',
      'status',
      'priority',
      'assignee',
      'lastMessageAt',
    ],
    description: '所有 channel 客服對話 thread（LINE / FB / IG / Email / Web Chat / 電話 / 表單）',
    listSearchableFields: ['ticketNumber', 'subject', 'externalThreadId'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      // ticketNumber 自動產生 CS-YYYY-NNNNN（年度流水）
      async ({ data, operation, req }) => {
        if (operation === 'create' && !data.ticketNumber) {
          const year = new Date().getFullYear()
          const result = await req.payload.find({
            collection: 'conversations',
            where: { ticketNumber: { like: `CS-${year}-%` } },
            sort: '-ticketNumber',
            limit: 1,
            depth: 0,
          })
          const last = result.docs[0]?.ticketNumber as string | undefined
          const lastNum = last ? parseInt(last.slice(-5), 10) : 0
          data.ticketNumber = `CS-${year}-${String(lastNum + 1).padStart(5, '0')}`
        }
        return data
      },
    ],
    afterChange: [
      // status / priority / assignee / category / mergedInto 變更 → ConversationActivities 寫 audit log
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || !previousDoc) return
        const fieldsToTrack = [
          'status',
          'priority',
          'assignee',
          'category',
          'mergedInto',
        ] as const
        const changes: Array<{ field: string; from: unknown; to: unknown }> = []
        for (const field of fieldsToTrack) {
          if (doc[field] !== previousDoc[field]) {
            changes.push({ field, from: previousDoc[field], to: doc[field] })
          }
        }
        if (!changes.length) return
        try {
          await req.payload.create({
            collection: 'conversation-activities',
            data: {
              conversation: doc.id,
              actor: req.user?.id ?? null,
              actorType: req.user ? 'staff' : 'system',
              type: 'field_changed',
              payload: { changes },
            },
            req,
          })
        } catch {
          // audit log 失敗不擋主流程
        }
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ── TAB 1: 基本 ─────────────────────────────────────────
        {
          label: '基本',
          description: '識別 / 客戶 / Channel / 狀態',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'ticketNumber',
                  label: '工單編號',
                  type: 'text',
                  required: true,
                  unique: true,
                  index: true,
                  admin: {
                    width: '50%',
                    description: '格式 CS-YYYY-NNNNN，beforeChange hook 自動產生',
                    readOnly: true,
                  },
                },
                {
                  name: 'externalThreadId',
                  label: '外部 thread ID',
                  type: 'text',
                  index: true,
                  admin: {
                    width: '50%',
                    description:
                      'LINE: source.userId / FB: senderPSID / IG: senderId / Email: thread Message-ID root',
                  },
                },
              ],
            },
            {
              name: 'subject',
              label: '主題',
              type: 'text',
              admin: { description: 'Email subject / 自動取首訊息前 30 字' },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'channel',
                  label: '管道',
                  type: 'select',
                  required: true,
                  index: true,
                  admin: { width: '50%' },
                  options: [
                    { label: '站內 Web Chat', value: 'web' },
                    { label: 'LINE OA', value: 'line' },
                    { label: 'FB Messenger', value: 'fb' },
                    { label: 'IG DM', value: 'ig' },
                    { label: 'Email', value: 'email' },
                    { label: '電話', value: 'phone' },
                    { label: '網頁表單', value: 'web_form' },
                  ],
                },
                {
                  name: 'channelMetadata',
                  label: 'Channel metadata',
                  type: 'json',
                  admin: {
                    width: '50%',
                    description:
                      'Channel 端原始資訊（LINE channelId / FB pageId / IG igAccountId / Email mailbox）',
                  },
                },
              ],
            },
            {
              name: 'customer',
              label: '會員',
              type: 'relationship',
              relationTo: 'users',
              index: true,
              admin: {
                description: '若客戶有登入則 link；沒登入時走下方 anonId + guest 欄位',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'anonId',
                  label: '匿名 ID',
                  type: 'text',
                  index: true,
                  admin: {
                    width: '50%',
                    description: 'Web chat 匿名訪客；登入後 customer 補上、anonId 留著',
                  },
                },
                {
                  name: 'guestName',
                  label: '訪客顯示名稱',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: '無登入時客戶輸入的暱稱，或 channel 端取得（LINE displayName / FB profile name）',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'guestEmail',
                  label: '訪客 Email',
                  type: 'email',
                  admin: { width: '50%' },
                },
                {
                  name: 'guestPhone',
                  label: '訪客電話',
                  type: 'text',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'status',
                  label: '狀態',
                  type: 'select',
                  required: true,
                  defaultValue: 'open',
                  index: true,
                  admin: { width: '34%' },
                  options: [
                    { label: '🟢 待回覆', value: 'open' },
                    { label: '🟡 處理中', value: 'pending' },
                    { label: '🔵 已解決', value: 'resolved' },
                    { label: '⚫ 已關閉', value: 'closed' },
                    { label: '🤖 AI 處理中', value: 'ai_handling' },
                    { label: '⏳ 等客戶回應', value: 'awaiting_customer' },
                    { label: '🚫 垃圾訊息', value: 'spam' },
                  ],
                },
                {
                  name: 'priority',
                  label: '優先度',
                  type: 'select',
                  defaultValue: 'normal',
                  index: true,
                  admin: { width: '33%' },
                  options: [
                    { label: '低', value: 'low' },
                    { label: '一般', value: 'normal' },
                    { label: '高', value: 'high' },
                    { label: '緊急', value: 'urgent' },
                  ],
                },
                {
                  name: 'unread',
                  label: '未讀',
                  type: 'checkbox',
                  defaultValue: true,
                  index: true,
                  admin: {
                    width: '33%',
                    description: '客戶端來新訊息 → true；staff 開過 → false',
                  },
                },
              ],
            },
          ],
        },

        // ── TAB 2: 指派與關聯 ──────────────────────────────────
        {
          label: '指派與關聯',
          description: '指派客服 / 標籤 / 分類 / 相關訂單商品 / 對話合併',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'assignee',
                  label: '指派客服',
                  type: 'relationship',
                  relationTo: 'users',
                  index: true,
                  admin: { width: '50%' },
                },
                {
                  name: 'category',
                  label: '分類',
                  type: 'select',
                  admin: { width: '50%' },
                  options: [
                    { label: '訂單查詢', value: 'order_inquiry' },
                    { label: '物流狀態', value: 'shipping_status' },
                    { label: '退換貨', value: 'return_exchange' },
                    { label: '尺寸建議', value: 'size_advice' },
                    { label: '點數查詢', value: 'points_inquiry' },
                    { label: '信用分數', value: 'credit_score' },
                    { label: '商品推薦', value: 'product_recommendation' },
                    { label: '優惠券查詢', value: 'coupon_inquiry' },
                    { label: '等級升級', value: 'tier_upgrade' },
                    { label: '客訴', value: 'complaint' },
                    { label: '面交', value: 'meetup' },
                    { label: '其他', value: 'other' },
                  ],
                },
              ],
            },
            {
              name: 'tags',
              label: '標籤',
              type: 'relationship',
              relationTo: 'message-tags',
              hasMany: true,
            },
            {
              name: 'relatedOrders',
              label: '相關訂單',
              type: 'relationship',
              relationTo: 'orders',
              hasMany: true,
            },
            {
              name: 'relatedProducts',
              label: '相關商品',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
            },
            {
              name: 'relatedReturns',
              label: '相關退貨',
              type: 'relationship',
              relationTo: 'returns',
              hasMany: true,
            },
            {
              name: 'mergedInto',
              label: '合併到對話',
              type: 'relationship',
              relationTo: 'conversations',
              admin: {
                description:
                  '此對話被合併到另一個 thread；mergedInto 有值的對話不在 inbox 顯示',
              },
            },
          ],
        },

        // ── TAB 3: SLA & 時序 ──────────────────────────────────
        {
          label: 'SLA',
          description: '首回 / 解決 / 最後訊息時間 + SLA 計算',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'firstResponseAt',
                  label: '首回時間',
                  type: 'date',
                  admin: {
                    width: '50%',
                    description: '第一個 staff 訊息的時間，Messages.afterChange hook 自動寫入',
                    readOnly: true,
                  },
                },
                {
                  name: 'resolvedAt',
                  label: '解決時間',
                  type: 'date',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'lastMessageAt',
                  label: '最後訊息時間',
                  type: 'date',
                  index: true,
                  admin: {
                    width: '50%',
                    description: 'Messages.afterChange hook 同步',
                    readOnly: true,
                  },
                },
                {
                  name: 'slaDueAt',
                  label: 'SLA 到期時間',
                  type: 'date',
                  admin: {
                    width: '50%',
                    description: '依 CustomerServiceSettings.sla 的 channel + priority 表格計算',
                  },
                },
              ],
            },
            {
              name: 'slaBreached',
              label: 'SLA 已逾時',
              type: 'checkbox',
              defaultValue: false,
              index: true,
            },
          ],
        },

        // ── TAB 4: 內部備註 ─────────────────────────────────────
        {
          label: '內部備註',
          description: '客戶絕對看不到。Thread-level pin（不同於對話流中的 Messages.internal=true）',
          fields: [
            {
              name: 'internalNote',
              label: '內部備註',
              type: 'richText',
              admin: {
                description:
                  '客戶絕對看不到。Thread-level pin。差異於 Messages.internal=true 是「對話流中的內部訊息」，這個是 thread metadata',
              },
            },
          ],
        },

        // ── TAB 5: 來源追蹤 ─────────────────────────────────────
        {
          label: '來源追蹤',
          description: 'Web chat 觸發頁面 + UTM（行銷分析用）',
          fields: [
            {
              name: 'source',
              label: '來源 URL',
              type: 'text',
              admin: { description: 'Web chat 觸發頁面 URL；其他 channel 留空' },
            },
            {
              type: 'row',
              fields: [
                { name: 'utmSource', label: 'UTM source', type: 'text', admin: { width: '33%' } },
                { name: 'utmMedium', label: 'UTM medium', type: 'text', admin: { width: '33%' } },
                {
                  name: 'utmCampaign',
                  label: 'UTM campaign',
                  type: 'text',
                  admin: { width: '34%' },
                },
              ],
            },
          ],
        },

        // ── TAB 6: AI 與 CSAT (Phase 6 / 8 接通後啟用) ─────────
        {
          label: 'AI 與 CSAT',
          description:
            'Phase 6（AI）與 Phase 8（CSAT）功能接通後啟用；目前欄位先保留，避免後續 ALTER',
          fields: [
            {
              name: 'aiSummary',
              label: 'AI 摘要',
              type: 'textarea',
              admin: {
                description:
                  '[Phase 6 接通] 長對話 >20 訊息自動摘要，新增訊息後失效要重生',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'aiSummaryGeneratedAt',
                  label: 'AI 摘要產生時間',
                  type: 'date',
                  admin: { width: '50%', description: '[Phase 6 接通]' },
                },
                {
                  name: 'sentiment',
                  label: '情緒',
                  type: 'select',
                  admin: { width: '50%', description: '[Phase 6 接通]' },
                  options: [
                    { label: '😊 正面', value: 'positive' },
                    { label: '😐 中立', value: 'neutral' },
                    { label: '😟 負面', value: 'negative' },
                    { label: '😡 憤怒', value: 'angry' },
                  ],
                },
              ],
            },
            {
              name: 'detectedLanguage',
              label: '偵測語言',
              type: 'text',
              admin: {
                description:
                  '[Phase 6 接通] BCP-47 語言代碼（zh-TW / en / ja…）；多語翻譯依此切',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'csatScore',
                  label: 'CSAT 評分',
                  type: 'number',
                  min: 1,
                  max: 5,
                  admin: { width: '33%', description: '[Phase 8 接通] 1–5 星' },
                },
                {
                  name: 'csatAt',
                  label: 'CSAT 提交時間',
                  type: 'date',
                  admin: { width: '67%', description: '[Phase 8 接通]' },
                },
              ],
            },
            {
              name: 'csatComment',
              label: 'CSAT 留言',
              type: 'textarea',
              admin: { description: '[Phase 8 接通]' },
            },
          ],
        },
      ],
    },
  ],
}
