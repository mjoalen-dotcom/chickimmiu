import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * CustomerServiceSettings Global（客服中心 v1 Phase 1A）
 * ───────────────────────────────────────────────────────
 * 客服中心通用設定：業務時段、SLA 規則、自動回覆、anti-spam、預設指派、CSAT。
 *
 * 部分欄位 Phase 1A 先建好但 hook 還沒接：
 * - sla → Phase 1B+ 計算 slaDueAt + cron 偵測 breach
 * - autoAssignMode + defaultAssignee → Phase 5B 接
 * - businessHours.offHourAutoReply → Phase 5E 接
 * - antiSpam.maxMessagesPerMinute → Phase 1C / 10A 接
 * - csat → Phase 8 接
 *
 * scope：v1 單店、單時區（Asia/Taipei）；多店多時區屬 v2。
 */
export const CustomerServiceSettings: GlobalConfig = {
  slug: 'cs-settings', // 縮短：避免深層 array.select enum 名稱超過 SQL identifier 63 字元上限
  label: '客服設定',
  admin: {
    group: '③ 會員與 CRM',
    description: '業務時間 / SLA / 自動回覆 / anti-spam / 預設指派 / CSAT',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    // ── 業務時段 ──────────────────────────────────────────
    {
      name: 'businessHours',
      label: '業務時間',
      type: 'group',
      fields: [
        {
          name: 'timezone',
          label: '時區',
          type: 'text',
          defaultValue: 'Asia/Taipei',
        },
        {
          name: 'schedule',
          label: '每週時段',
          type: 'array',
          admin: { description: '依星期幾設定當天客服上線時段（24 小時制 HH:mm）' },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'dayOfWeek',
                  label: '星期',
                  type: 'select',
                  admin: { width: '34%' },
                  options: [
                    { label: '週一', value: '1' },
                    { label: '週二', value: '2' },
                    { label: '週三', value: '3' },
                    { label: '週四', value: '4' },
                    { label: '週五', value: '5' },
                    { label: '週六', value: '6' },
                    { label: '週日', value: '0' },
                  ],
                },
                {
                  name: 'openTime',
                  label: '開始（HH:mm）',
                  type: 'text',
                  admin: { width: '33%' },
                },
                {
                  name: 'closeTime',
                  label: '結束（HH:mm）',
                  type: 'text',
                  admin: { width: '33%' },
                },
              ],
            },
          ],
        },
        {
          name: 'holidays',
          label: '假日',
          type: 'array',
          fields: [
            { name: 'date', label: '日期', type: 'date' },
            { name: 'reason', label: '原因', type: 'text' },
          ],
        },
        {
          name: 'offHourAutoReply',
          label: '離線自動回覆',
          type: 'textarea',
          defaultValue:
            '感謝您的訊息！目前是非營業時段，我們會在下次營業時間（週一至週五 10:00–18:00）盡快回覆您。',
        },
      ],
    },

    // ── SLA 規則 ──────────────────────────────────────────
    {
      name: 'sla',
      label: 'SLA 規則',
      type: 'group',
      fields: [
        {
          name: 'firstResponseMinutes',
          label: '首回時限（分鐘）',
          type: 'array',
          admin: { description: '依 channel + priority 各自設定首回 SLA' },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'channel',
                  label: 'Channel',
                  type: 'select',
                  admin: { width: '40%' },
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
                  name: 'priority',
                  label: '優先度',
                  type: 'select',
                  admin: { width: '30%' },
                  options: [
                    { label: '低', value: 'low' },
                    { label: '一般', value: 'normal' },
                    { label: '高', value: 'high' },
                    { label: '緊急', value: 'urgent' },
                  ],
                },
                {
                  name: 'minutes',
                  label: '分鐘',
                  type: 'number',
                  admin: { width: '30%' },
                },
              ],
            },
          ],
        },
        {
          name: 'resolutionHours',
          label: '解決時限（小時）',
          type: 'array',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'priority',
                  label: '優先度',
                  type: 'select',
                  admin: { width: '50%' },
                  options: [
                    { label: '低', value: 'low' },
                    { label: '一般', value: 'normal' },
                    { label: '高', value: 'high' },
                    { label: '緊急', value: 'urgent' },
                  ],
                },
                {
                  name: 'hours',
                  label: '小時',
                  type: 'number',
                  admin: { width: '50%' },
                },
              ],
            },
          ],
        },
        {
          name: 'breachAction',
          label: '逾時動作',
          type: 'select',
          defaultValue: 'notify_assignee',
          options: [
            { label: '通知指派人', value: 'notify_assignee' },
            { label: '升級優先度', value: 'escalate' },
            { label: '通知主管', value: 'notify_supervisor' },
          ],
        },
      ],
    },

    // ── 預設指派 ──────────────────────────────────────────
    {
      type: 'row',
      fields: [
        {
          name: 'defaultAssignee',
          label: '預設指派客服',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            width: '50%',
            description: '新對話建立時自動指派；留空 = 不指派',
          },
        },
        {
          name: 'autoAssignMode',
          label: '自動指派策略',
          type: 'select',
          defaultValue: 'round_robin',
          admin: { width: '50%' },
          options: [
            { label: '不自動指派', value: 'none' },
            { label: '輪流分配', value: 'round_robin' },
            { label: '依關鍵字', value: 'keyword' },
            { label: '依客戶等級', value: 'tier' },
          ],
        },
      ],
    },

    // ── 開場 / 歡迎訊息 ────────────────────────────────────
    {
      name: 'greeting',
      label: '歡迎訊息',
      type: 'group',
      admin: { description: '客戶第一次開啟對話視窗（或加為好友）時的自動歡迎訊息' },
      fields: [
        {
          name: 'web',
          label: '站內 Web Chat',
          type: 'textarea',
          defaultValue: '哈囉！我是 CHIC KIM & MIU 的客服小幫手，請問需要什麼協助呢？',
        },
        { name: 'line', label: 'LINE OA', type: 'textarea' },
        { name: 'fb', label: 'FB Messenger', type: 'textarea' },
        { name: 'ig', label: 'IG DM', type: 'textarea' },
      ],
    },

    // ── Anti-spam ─────────────────────────────────────────
    {
      name: 'antiSpam',
      label: '防 Spam',
      type: 'group',
      fields: [
        {
          name: 'maxMessagesPerMinute',
          label: '單一 anonId 每分鐘上限',
          type: 'number',
          defaultValue: 5,
        },
        {
          name: 'blockedKeywords',
          label: '黑名單關鍵字',
          type: 'array',
          fields: [{ name: 'keyword', label: '關鍵字', type: 'text' }],
        },
        {
          name: 'blockedAnonIds',
          label: '黑名單 anonId',
          type: 'array',
          fields: [{ name: 'anonId', label: 'anonId', type: 'text' }],
        },
        {
          name: 'blockedIPs',
          label: '黑名單 IP',
          type: 'array',
          fields: [{ name: 'ip', label: 'IP', type: 'text' }],
        },
      ],
    },

    // ── CSAT ──────────────────────────────────────────────
    {
      name: 'csat',
      label: 'CSAT 設定',
      type: 'group',
      admin: { description: '[Phase 8 接通] 對話結束後自動發 1–5 星評分問卷' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'enabled',
              label: '啟用',
              type: 'checkbox',
              defaultValue: true,
              admin: { width: '34%' },
            },
            {
              name: 'sendDelayHours',
              label: '結案後幾小時寄出',
              type: 'number',
              defaultValue: 24,
              admin: { width: '33%' },
            },
            {
              name: 'question',
              label: '評分問題',
              type: 'text',
              defaultValue: '您對這次客服體驗滿意嗎？（1–5 星）',
              admin: { width: '33%' },
            },
          ],
        },
      ],
    },
  ],
}
