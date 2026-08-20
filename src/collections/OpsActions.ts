import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * OpsActions — 營運 AI 助理的行動提案與稽核軌跡
 * ────────────────────────────────────────────────
 * L2 授權模型（AI 建議 + 人一鍵執行）的落地處。
 *
 * 生命週期：
 *   pending  ← AI 產生提案（唯一由 LLM 觸發的寫入，且只寫這張表）
 *   executed ← admin 在後台按下執行，且 ActionType.execute() 回傳 ok
 *   failed   ← 按了執行但被熔斷擋下或執行出錯（error 欄位記原因）
 *   rejected ← admin 按駁回
 *   expired  ← 超過 7 天沒人處理（避免拿過期數字去執行）
 *
 * 這張表是 append-friendly 的稽核軌跡：executed / failed / rejected 之後
 * 不允許改回 pending，也不允許改 input（見 beforeChange hook）。
 * 出事要回答「誰在什麼時候按了什麼、當時預覽長什麼樣」全靠這裡。
 */
export const OpsActions: CollectionConfig = {
  slug: 'ops-actions',
  labels: { singular: 'AI 行動提案', plural: 'AI 行動提案' },
  admin: {
    // 2026-08-15 步驟03分組整併後「⑦ 系統與安全」已拆散；比照
    // CKMUSystemToolsNavGroup 的落點，掛在 ⑥（全站設定與工具的語意落腳處）。
    // 主要操作介面是 /admin/ops-copilot 指揮艙，這裡的 list view 是稽核軌跡。
    group: '⑥ 內容與頁面',
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'actionType', 'risk', 'status', 'createdAt'],
    description:
      '營運 AI 助理產生的行動提案與執行紀錄。AI 只能建立 pending 提案，' +
      '真正的寫入一律要 admin 在此核准後才會發生。',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    // 稽核軌跡不給刪。要清理請用 expired 狀態。
    delete: () => false,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation !== 'update' || !originalDoc) return data
        const locked = ['executed', 'failed', 'rejected']
        if (locked.includes(originalDoc.status as string)) {
          // 已定案的提案只允許補註記，其餘欄位一律還原成原值。
          return {
            ...originalDoc,
            adminNote: (data as Record<string, unknown>)?.adminNote ?? originalDoc.adminNote,
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'summary',
      label: '提案內容',
      type: 'text',
      required: true,
      admin: { description: '一句話講清楚按下去會發生什麼' },
    },
    {
      name: 'actionType',
      label: '行動類型',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: '建立進貨單草稿', value: 'create_purchase_order' },
        { label: '調整商品售價', value: 'adjust_product_price' },
        { label: '建立折扣碼', value: 'create_coupon' },
        { label: '寄送個人化 DM', value: 'send_member_dm' },
        { label: '標記會員需信用複查', value: 'flag_credit_review' },
      ],
    },
    {
      name: 'risk',
      label: '風險等級',
      type: 'select',
      defaultValue: 'low',
      options: [
        { label: '低（可直接核准）', value: 'low' },
        { label: '高（需二次確認）', value: 'high' },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: '待核准', value: 'pending' },
        { label: '已執行', value: 'executed' },
        { label: '執行失敗', value: 'failed' },
        { label: '已駁回', value: 'rejected' },
        { label: '已過期', value: 'expired' },
      ],
    },
    {
      name: 'input',
      label: '執行參數',
      type: 'json',
      required: true,
      admin: {
        readOnly: true,
        description: 'AI 產生的參數。執行前會再跑一次 validate() 與熔斷檢查。',
      },
    },
    {
      name: 'sourceSignalId',
      label: '來源訊號',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: '例：inventory.low_stock' },
    },
    {
      name: 'previewSnapshot',
      label: '提案當下的預覽',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          '建立提案時算出的 before/after。執行時會重算一次 —— 兩者不一致代表期間資料被改過。',
      },
    },
    {
      name: 'resultMessage',
      label: '執行結果',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'affected',
      label: '受影響實體',
      type: 'json',
      admin: { readOnly: true },
    },
    {
      name: 'error',
      label: '錯誤原因',
      type: 'textarea',
      admin: { readOnly: true },
    },
    {
      name: 'decidedBy',
      label: '核准 / 駁回者',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },
    {
      name: 'decidedAt',
      label: '決定時間',
      type: 'date',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'adminNote',
      label: '人工備註',
      type: 'textarea',
      admin: { description: '唯一在提案定案後仍可編輯的欄位' },
    },
  ],
}
