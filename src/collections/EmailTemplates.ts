import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import {
  EMAIL_EVENT_KEYS,
  EMAIL_EVENT_LABELS,
  EMAIL_EVENT_VARIABLES,
} from '../lib/email/renderFromTemplate'

/**
 * EmailTemplates — 交易事件 email 模板（後台可編輯 / 預覽 / 測試寄送）
 * ─────────────────────────────────────────────────────────────────
 * 與行銷 message-templates 解耦：本 collection 專管「事件導向」的系統信
 * （會員歡迎 / 訂單 6 狀態 / auth 驗證 / 忘記密碼）。每個 eventKey 一筆（unique）。
 *
 * 運作：各 sender 呼叫 renderEmailFromTemplate(payload, eventKey, vars)；
 *   - 有啟用中模板 → subject/headline/bodyHtml 跑 {{變數}} 合併 + emailWrapper 外框
 *   - 無 / 停用 / 出錯 → fallback 現有 hardcoded HTML（零退化）
 *
 * 模板用 {{變數}}：純量（{{customerName}} {{orderNumber}} {{total}}…）由系統填，
 * 結構化區塊（{{itemsTable}} {{addressBlock}} {{orderButton}}…）由系統先 render 好再注入，
 * admin 只要排版 / 改文案，訂單資料照樣正確呈現。各事件可用變數見「預覽 / 測試寄送」頁。
 *
 * 對應：
 *   - src/lib/email/renderFromTemplate.ts（render 引擎 + 預設模板 + 懶 seed）
 *   - migration 20260609_140000_add_email_templates（CREATE TABLE，無 seed；首次進
 *     預覽頁時 ensureDefaultEmailTemplates 補齊 9 種預設）
 *   - 預覽 / 測試寄送：admin view /admin/tools/email-templates
 */

const eventOptions = EMAIL_EVENT_KEYS.map((value) => ({
  label: EMAIL_EVENT_LABELS[value],
  value,
}))

/** 把各事件可用變數整理成後台說明文字 */
const variablesHelp = EMAIL_EVENT_KEYS.map((key) => {
  const vars = EMAIL_EVENT_VARIABLES[key].map((v) => `{{${v.name}}}`).join('、')
  return `• ${EMAIL_EVENT_LABELS[key]}：${vars}`
}).join('\n')

export const EmailTemplates: CollectionConfig = {
  slug: 'email-templates',
  labels: { singular: 'Email 模板', plural: 'Email 模板' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'name',
    defaultColumns: ['name', 'eventKey', 'enabled', 'updatedAt'],
    description:
      '系統交易信模板（歡迎 / 訂單通知 / 驗證信）。每個事件一筆，停用即回退預設信。' +
      '可用 {{變數}}（見「預覽 / 測試寄送」頁或 bodyHtml 欄位說明）。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      label: '模板名稱',
      type: 'text',
      required: true,
      admin: { description: '後台識別用（例：出貨通知信）' },
    },
    {
      name: 'eventKey',
      label: '觸發事件',
      type: 'select',
      required: true,
      unique: true,
      options: eventOptions,
      admin: { description: '每個事件僅能有一筆模板。系統依此鍵在對應事件載入本模板。' },
    },
    {
      name: 'enabled',
      label: '啟用',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: '取消勾選 → 該事件回退系統預設信（不會停止寄信）。' },
    },
    {
      name: 'subject',
      label: '主旨',
      type: 'text',
      required: true,
      admin: { description: '支援 {{變數}}，例：【CHIC KIM & MIU】訂單確認 {{orderNumber}}' },
    },
    {
      name: 'preheader',
      label: '預覽摘要（preheader）',
      type: 'text',
      admin: { description: '收件匣標題下的灰字預覽。支援 {{變數}}。' },
    },
    {
      name: 'headline',
      label: '標題（信件頂部大字）',
      type: 'text',
      required: true,
      admin: { description: '品牌外框內的主標題。支援 {{變數}}。' },
    },
    {
      name: 'bodyHtml',
      label: '內文 HTML',
      type: 'code',
      required: true,
      admin: {
        language: 'html',
        description:
          '信件主體 HTML（會被品牌外框包覆，不需自帶 <html>/<body>）。可用 {{變數}}：\n' +
          variablesHelp,
      },
    },
    {
      name: 'previewSample',
      label: '預覽樣本變數（選填 JSON）',
      type: 'json',
      admin: {
        description:
          '預覽 / 測試寄送時覆寫純量變數的樣本值（例：{"customerName":"王小美"}）。' +
          '結構化區塊（明細表 / 地址 / 按鈕）一律由系統用範例訂單即時 render。',
      },
    },
  ],
}
