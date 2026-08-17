import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * CampaignActivities — 活動稽核軌跡（CHIC Commerce OS P0-C §6.2）
 * ────────────────────────────────────────────────────────────────
 * 工作單要求「任何 active/paused/ended 變更寫入 Audit Log：操作者、前後值、
 * 原因、版本與時間」。稽核發現這條完全沒做：MarketingCampaigns 既沒有
 * afterChange hook 也沒開 versions，所以「誰在什麼時候把活動打開/關掉/
 * 改預算」在系統裡查不到——一個會直接花錢的物件卻沒有任何操作軌跡。
 *
 * 設計沿用 repo 既有的 ConversationActivities 模式（不可竄改的 hook-written
 * audit log），不另發明一套：
 *   - create: () => true —— 由 MarketingCampaigns.afterChange 以 local API 寫入
 *   - update: () => false —— audit log 不可事後竄改
 *   - read/delete: admin
 *
 * 刻意「只記不擋」：寫入失敗不會讓活動存檔失敗（避免稽核系統故障癱瘓營運），
 * 但失敗會記 error log。
 */
export const CampaignActivities: CollectionConfig = {
  slug: 'campaign-activities',
  labels: { singular: '活動操作記錄', plural: '活動操作記錄' },
  admin: {
    group: '④ 行銷推廣',
    useAsTitle: 'summary',
    defaultColumns: ['campaign', 'type', 'fromStatus', 'toStatus', 'actor', 'createdAt'],
    description: 'Audit log：活動狀態轉換／預算調整／kill switch／核准全紀錄。不可竄改，由 hooks 自動寫入。',
  },
  access: {
    read: isAdmin,
    create: () => true, // hook 內以 local API 寫入
    update: () => false, // 不可竄改
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    {
      name: 'campaign',
      label: '活動',
      type: 'relationship',
      relationTo: 'marketing-campaigns',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          label: '操作類型',
          type: 'select',
          required: true,
          options: [
            { label: '狀態轉換', value: 'status_change' },
            { label: '預算調整', value: 'budget_change' },
            { label: 'Kill Switch', value: 'kill_switch' },
            { label: '核准', value: 'approval' },
            { label: '其他設定變更', value: 'settings_change' },
          ],
        },
        {
          name: 'actor',
          label: '操作者',
          type: 'relationship',
          relationTo: 'users',
          admin: { description: 'null = 系統/排程自動操作' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'fromStatus', label: '原狀態', type: 'text' },
        { name: 'toStatus', label: '新狀態', type: 'text' },
        {
          name: 'isOverride',
          label: '強制覆寫',
          type: 'checkbox',
          admin: { description: '勾選 = 這次轉換繞過了狀態機規則（需填原因）' },
        },
      ],
    },
    {
      name: 'summary',
      label: '摘要',
      type: 'text',
      admin: { description: '列表顯示用的一句話描述' },
    },
    { name: 'reason', label: '原因／備註', type: 'textarea' },
    {
      name: 'changes',
      label: '變更明細',
      type: 'json',
      admin: { description: '受監控欄位的前後值（budgetCap / killSwitch / approval 等）' },
    },
  ],
}
