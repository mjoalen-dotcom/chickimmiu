import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * Messages Collection（客服中心 v1 Phase 1A）
 * ──────────────────────────────────────────
 * 對話內每則訊息。獨立 collection（**不 inline 在 Conversations**），原因：
 * - Webhook race-safe：直接 payload.create，不需 read 整 thread
 * - 可 query by externalId 做 inbound dedup
 * - 無 Payload array length 上限
 * - Index (conversation_id, created_at) 翻頁快
 * - rawPayload debug 留底也不會把 Conversations 表撐大
 *
 * 內部備註（internal:true）= staff-only，channel outbound + 客戶 widget 都不送。
 *   差異於 Conversations.internalNote = thread-level pin（位置不同、用途不同）
 *
 * AI 欄位 aiSuggestion / aiUsed = Phase 6 接通後使用。
 */
export const Messages: CollectionConfig = {
  slug: 'messages',
  labels: { singular: '訊息', plural: '訊息' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'preview',
    defaultColumns: ['conversation', 'direction', 'sender', 'preview', 'createdAt'],
    description: '對話內每則訊息（雙向 inbound / outbound + 內部備註）',
    listSearchableFields: ['preview', 'externalId'],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    afterChange: [
      // 1. 同步 Conversations.lastMessageAt + unread + 客戶 reopen
      // 2. 首則 staff/ai 訊息 → 寫 Conversations.firstResponseAt
      // SSE 廣播留待 Phase 1D；此 hook 只負責資料一致性
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return
        try {
          const conv = await req.payload.findByID({
            collection: 'conversations',
            id: doc.conversation as string,
            depth: 0,
          })
          const updates: Record<string, unknown> = {
            lastMessageAt: doc.createdAt,
          }
          if (doc.direction === 'in' && !doc.internal) {
            updates.unread = true
            // 客戶在已解決 / 已關閉 thread 再來訊息 → auto reopen
            if (conv.status === 'resolved' || conv.status === 'closed') {
              updates.status = 'open'
            }
          }
          if (
            doc.direction === 'out' &&
            doc.sender !== 'system' &&
            !conv.firstResponseAt
          ) {
            updates.firstResponseAt = doc.createdAt
          }
          await req.payload.update({
            collection: 'conversations',
            id: doc.conversation as string,
            data: updates,
            req,
          })
        } catch {
          // hook 失敗不擋訊息寫入
        }
      },
    ],
  },
  fields: [
    {
      name: 'conversation',
      label: '所屬對話',
      type: 'relationship',
      relationTo: 'conversations',
      required: true,
      index: true,
    },
    {
      name: 'preview',
      label: '預覽',
      type: 'text',
      admin: { hidden: true },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // 取 body 前 60 字當 preview（list view 顯示用）
            const body = (siblingData as { body?: unknown })?.body
            const text =
              typeof body === 'string'
                ? body
                : body
                  ? JSON.stringify(body).slice(0, 200)
                  : ''
            return text
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 60)
          },
        ],
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'direction',
          label: '方向',
          type: 'select',
          required: true,
          index: true,
          admin: { width: '50%' },
          options: [
            { label: '⬇️ 入站（客戶來訊）', value: 'in' },
            { label: '⬆️ 出站（我方回覆）', value: 'out' },
          ],
        },
        {
          name: 'sender',
          label: '發送者類型',
          type: 'select',
          required: true,
          admin: { width: '50%' },
          options: [
            { label: '客戶', value: 'customer' },
            { label: '客服人員', value: 'staff' },
            { label: 'AI', value: 'ai' },
            { label: '系統', value: 'system' },
          ],
        },
      ],
    },
    {
      name: 'staffUser',
      label: '客服人員',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        condition: (_, sib) => sib?.sender === 'staff' || sib?.sender === 'ai',
        description: 'sender=staff/ai 時記錄是哪個 user 操作',
      },
    },
    {
      name: 'body',
      label: '內容',
      type: 'richText',
      admin: { description: '純文字 + 連結 + 簡單格式；附件用下方 attachments 欄' },
    },
    {
      name: 'attachments',
      label: '附件',
      type: 'array',
      fields: [
        { name: 'media', label: '檔案', type: 'upload', relationTo: 'media' },
        { name: 'caption', label: '說明', type: 'text' },
        {
          name: 'kind',
          label: '類型',
          type: 'select',
          options: [
            { label: '圖片', value: 'image' },
            { label: '影片', value: 'video' },
            { label: '音檔', value: 'audio' },
            { label: '貼圖', value: 'sticker' },
            { label: '檔案', value: 'file' },
            { label: '位置', value: 'location' },
          ],
        },
        {
          name: 'externalUrl',
          label: '外部 URL',
          type: 'text',
          admin: {
            description:
              'Channel 端原始 URL（LINE contentProvider / FB attachment payload.url）；尚未下載到 Media 時保留',
          },
        },
        { name: 'metadata', label: 'Metadata', type: 'json' },
      ],
    },
    {
      name: 'internal',
      label: '內部備註',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: '勾起來代表這則只給 staff 看，channel outbound + widget 都不送',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'externalId',
          label: '外部訊息 ID',
          type: 'text',
          index: true,
          admin: {
            width: '50%',
            description: 'LINE messageId / FB mid / IG mid / Email Message-ID（inbound dedup）',
          },
        },
        {
          name: 'replyToExternalId',
          label: '回覆對象外部 ID',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Email In-Reply-To / LINE reply token / FB reply_to.mid',
          },
        },
      ],
    },
    {
      name: 'quotedMessage',
      label: '引用訊息',
      type: 'relationship',
      relationTo: 'messages',
      admin: { description: '對話 UI 顯示「引用了誰的訊息」' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'readByCustomerAt',
          label: '客戶已讀時間',
          type: 'date',
          admin: {
            width: '50%',
            description: 'Web chat 即時；LINE/FB/IG 經 read receipt webhook 寫入',
          },
        },
        {
          name: 'readByStaffAt',
          label: 'Staff 已讀時間',
          type: 'date',
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'editedAt',
          label: '編輯時間',
          type: 'date',
          admin: { width: '50%' },
        },
        {
          name: 'deletedAt',
          label: '刪除時間',
          type: 'date',
          admin: {
            width: '50%',
            description: '軟刪除；UI 顯示「此訊息已撤回」，原文保留供 audit',
          },
        },
      ],
    },
    {
      name: 'aiSuggestion',
      label: 'AI 回覆建議',
      type: 'json',
      admin: {
        description:
          '[Phase 6 接通] `{drafts: string[], confidence: number, generatedAt: ISO}`',
      },
    },
    {
      name: 'aiUsed',
      label: '採用 AI 建議',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: '[Phase 6 接通] Staff 點「套用」後標記，分析 AI 採用率' },
    },
    {
      name: 'rawPayload',
      label: '原始 payload',
      type: 'json',
      admin: { hidden: true, description: 'Channel webhook 原始 body，問題排查 + replay 用' },
    },
  ],
}
