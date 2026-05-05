import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * Currencies Collection（幣別 / 匯率表）
 * ─────────────────────────────────────────
 *
 * 用途：前台 CurrencySwitcher 切換顯示幣別時，前端從這裡讀活幣別 + 匯率
 * （TWD 為基準，rate = 1 TWD 對該幣別的匯率）。
 *
 * 重要：本站交易實際以 TWD 結算（ECPay 國內金流），其他幣別只用作
 * 「顯示估算」幫境外消費者理解價格；checkout / 收據仍以 TWD 為準。
 *
 * 編輯流程：admin 後台 → ① 內容資料 → 幣別設定 → 改 rateAgainstTwd
 *   （建議週更，可手動或日後接央行 API 自動 sync）。
 *
 * 預設 5 種：TWD（rate=1, base）/ USD / JPY / KRW / CNY。
 */
export const Currencies: CollectionConfig = {
  slug: 'currencies',
  labels: { singular: '幣別', plural: '幣別與匯率' },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'label', 'symbol', 'rateAgainstTwd', 'isActive', 'displayOrder'],
    group: '① 內容資料',
    description: '前台幣別選單 / 匯率設定（TWD 為基準）',
    listSearchableFields: ['code', 'label'],
  },
  access: {
    read: () => true, // 前台 /api/currencies 公開讀
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'code',
      label: '代碼 (ISO 4217)',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: '例：TWD / USD / JPY / KRW / CNY' },
    },
    {
      name: 'label',
      label: '顯示名稱',
      type: 'text',
      required: true,
      admin: { description: '例：新台幣 / 美元 / 日圓' },
    },
    {
      name: 'symbol',
      label: '貨幣符號',
      type: 'text',
      required: true,
      admin: { description: '例：NT$ / US$ / ¥ / ₩' },
    },
    {
      name: 'rateAgainstTwd',
      label: '對 TWD 匯率',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0.0000001,
      admin: {
        description:
          '1 TWD = 多少該幣別。例：USD 0.031（1 元 ≈ 0.031 美元）；JPY 4.8（1 元 ≈ 4.8 日圓）。TWD 自身設 1。',
      },
    },
    {
      name: 'decimalPlaces',
      label: '顯示小數位數',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 4,
      admin: {
        description: 'TWD/JPY/KRW 通常 0；USD/EUR 通常 2',
      },
    },
    {
      name: 'isActive',
      label: '前台啟用',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: '取消勾選 = 從前台 CurrencySwitcher 隱藏' },
    },
    {
      name: 'displayOrder',
      label: '顯示順序',
      type: 'number',
      defaultValue: 100,
      admin: { description: '小者在前；TWD 建議設 1' },
    },
    {
      name: 'description',
      label: '備註',
      type: 'textarea',
      admin: { description: '內部備註（不顯示前台）' },
    },
  ],
  timestamps: true,
}
