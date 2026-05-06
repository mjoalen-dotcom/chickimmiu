import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 台灣稅務設定 Global
 * ─────────────────────
 * 5% 營業稅、免稅商品類別、發票稅額 breakdown。
 * 預設帶台灣 TW 一般零售商慣例：商品價格內含稅、標準稅率 5%、運費課稅。
 *
 * scope 限制：v1 只做台灣稅制；外銷零稅率 / 境外代收代付 / 多國 VAT 屬 v2。
 */
export const TaxSettings: GlobalConfig = {
  slug: 'tax-settings',
  label: '稅務設定',
  admin: {
    group: '① 訂單與物流',
    description: '台灣營業稅、免稅類別、發票稅額 breakdown 規則',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'defaultTaxIncluded',
      label: '商品價格內含稅',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: '勾選 = 商品標價已含 5% 營業稅（台灣慣例）；不勾選 = 結帳時外加',
      },
    },
    {
      name: 'defaultTaxRate',
      label: '標準稅率（%）',
      type: 'number',
      defaultValue: 5,
      min: 0,
      max: 100,
      admin: { description: '台灣營業稅目前固定為 5%' },
    },
    {
      name: 'taxCategories',
      label: '稅率類別',
      type: 'array',
      admin: {
        description: '商品可選擇的課稅類別；新增 Products.taxCategory 會從這裡讀選項',
      },
      fields: [
        { name: 'value', label: '代碼', type: 'text', required: true },
        { name: 'label', label: '顯示名稱', type: 'text', required: true },
        { name: 'rate', label: '稅率（%）', type: 'number', defaultValue: 0, min: 0, max: 100 },
        {
          name: 'exempt',
          label: '免稅（不開立含稅銷售額）',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: '免稅 vs 零稅率：免稅完全不列入稅額欄位；零稅率仍列入但稅額為 0' },
        },
      ],
      defaultValue: [
        { value: 'standard', label: '應稅 5%', rate: 5, exempt: false },
        { value: 'reduced', label: '優惠稅率 0%', rate: 0, exempt: false },
        { value: 'exempt', label: '免稅', rate: 0, exempt: true },
        { value: 'zero_rated', label: '零稅率（外銷）', rate: 0, exempt: false },
      ],
    },
    {
      name: 'shippingTaxable',
      label: '運費課稅',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: '台灣慣例：運費視為勞務供應，須加課營業稅' },
    },
    {
      name: 'invoiceBreakdown',
      label: '發票稅額顯示',
      type: 'group',
      fields: [
        {
          name: 'showTaxLine',
          label: '發票顯示稅額',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: '三聯式必開；二聯式可選擇是否列印稅額欄位' },
        },
        {
          name: 'roundingMode',
          label: '稅額四捨五入模式',
          type: 'select',
          defaultValue: 'round_half_up',
          options: [
            { label: '四捨五入（標準）', value: 'round_half_up' },
            { label: '無條件捨去', value: 'round_down' },
            { label: '無條件進位', value: 'round_up' },
          ],
        },
      ],
    },
  ],
}
