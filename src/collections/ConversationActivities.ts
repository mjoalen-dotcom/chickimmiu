import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * ConversationActivities Collection（客服中心 v1 Phase 1A）
 * ────────────────────────────────────────────────────────
 * 對話 audit log。每筆 assign / tag / status / merge / 訊息編輯刪除全紀錄。
 *
 * Shopline 沒做好的關鍵差異化：可回溯「誰在 X 時間把對話狀態改成 Y」、
 * 「誰把 tag A 拿掉換成 B」、「客戶 reopen 過幾次」等所有 thread 變動。
 *
 * 寫入：
 * - Conversations.afterChange hook（status / priority / assignee / category / mergedInto 變更）
 * - Messages.afterChange hook（編輯 / 刪除）
 * - 各 channel webhook（conversation_opened / customer reopen）
 * - SLA cron（sla_breached）
 * - AI subroutine（ai_replied）
 *
 * 不允許 update（audit log 不可竄改）；create() => true 因 hook 內 req.payload.create 走 access。
 * 讀取與刪除限 admin。
 */
export const ConversationActivities: CollectionConfig = {
  slug: 'conversation-activities',
  labels: { singular: '對話活動記錄', plural: '對話活動記錄' },
  admin: {
    group: '③ 會員與 CRM',
    useAsTitle: 'type',
    defaultColumns: ['conversation', 'type', 'actor', 'actorType', 'createdAt'],
    description:
      'Audit log：對話狀態 / 指派 / tag / 合併 / 訊息編輯刪除全紀錄。不可竄改、由 hooks 自動寫入',
  },
  access: {
    read: isAdmin,
    create: () => true, // hook 內 req.payload.create 寫入；非 admin 直接 POST 也擋不住於此層
    update: () => false, // audit log 不可竄改
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'conversation',
      label: '對話',
      type: 'relationship',
      relationTo: 'conversations',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'actor',
          label: '操作者',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            width: '50%',
            description: 'null = 系統 / webhook / cron 自動操作',
          },
        },
        {
          name: 'actorType',
          label: '操作者類型',
          type: 'select',
          required: true,
          defaultValue: 'staff',
          admin: { width: '50%' },
          options: [
            { label: '客服人員', value: 'staff' },
            { label: '客戶', value: 'customer' },
            { label: 'AI', value: 'ai' },
            { label: '系統', value: 'system' },
            { label: 'Webhook', value: 'webhook' },
          ],
        },
      ],
    },
    {
      name: 'type',
      label: '活動類型',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: '對話開啟', value: 'conversation_opened' },
        { label: '欄位變更', value: 'field_changed' },
        { label: '指派變更', value: 'assignment_changed' },
        { label: '狀態變更', value: 'status_changed' },
        { label: 'Tag 加入', value: 'tag_added' },
        { label: 'Tag 移除', value: 'tag_removed' },
        { label: '對話合併', value: 'conversations_merged' },
        { label: '對話拆分', value: 'conversation_split' },
        { label: '訊息編輯', value: 'message_edited' },
        { label: '訊息刪除', value: 'message_deleted' },
        { label: '優先度升級', value: 'escalated' },
        { label: 'SLA 逾時', value: 'sla_breached' },
        { label: 'AI 自動回覆', value: 'ai_replied' },
        { label: 'CSAT 提交', value: 'csat_submitted' },
        { label: '客戶 reopen', value: 'reopened' },
      ],
    },
    {
      name: 'payload',
      label: '詳細',
      type: 'json',
      admin: {
        description:
          'type-specific 結構，如 field_changed → `{changes: [{field, from, to}]}`',
      },
    },
    {
      name: 'note',
      label: '備註',
      type: 'text',
      admin: { description: '人工操作可選的補充說明' },
    },
  ],
}
