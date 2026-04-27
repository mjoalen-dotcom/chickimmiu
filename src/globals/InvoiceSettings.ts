import type { GlobalConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

/**
 * 綠界電子發票設定 Global
 * ─────────────────────────
 * ECPay E-Invoice API 連線設定、賣方資訊、自動化規則
 */
export const InvoiceSettings: GlobalConfig = {
  slug: 'invoice-settings',
  label: '綠界電子發票設定',
  admin: {
    group: '訂單與物流',
    description: 'ECPay 電子發票 API 連線設定、賣方資訊、自動化規則',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ═══════════════════════════════════════
    // ── ECPay API 設定 ──
    // ═══════════════════════════════════════
    {
      name: 'ecpayConfig',
      label: 'ECPay API 設定',
      type: 'group',
      fields: [
        {
          name: 'merchantId',
          label: 'MerchantID',
          type: 'text',
          required: true,
          admin: { description: '綠界特店代號' },
        },
        {
          name: 'hashKey',
          label: 'HashKey',
          type: 'text',
          required: true,
          admin: { description: '綠界 HashKey（加密用）' },
        },
        {
          name: 'hashIV',
          label: 'HashIV',
          type: 'text',
          required: true,
          admin: { description: '綠界 HashIV（加密用）' },
        },
        {
          name: 'environment',
          label: '環境',
          type: 'select',
          defaultValue: 'test',
          options: [
            { label: '測試環境', value: 'test' },
            { label: '正式環境', value: 'production' },
          ],
          admin: { description: '測試環境使用綠界 Sandbox；正式環境上線前請切換' },
        },
        {
          name: 'testGatewayUrl',
          label: '測試 Gateway',
          type: 'text',
          defaultValue: 'https://einvoice-stage.ecpay.com.tw',
          admin: { readOnly: true },
        },
        {
          name: 'prodGatewayUrl',
          label: '正式 Gateway',
          type: 'text',
          defaultValue: 'https://einvoice.ecpay.com.tw',
          admin: { readOnly: true },
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── 賣方資訊 ──
    // ═══════════════════════════════════════
    {
      name: 'sellerInfo',
      label: '賣方資訊',
      type: 'group',
      fields: [
        { name: 'sellerUBN', label: '賣方統一編號', type: 'text', required: true },
        {
          name: 'sellerName',
          label: '公司名稱',
          type: 'text',
          required: true,
          defaultValue: '靚秀國際有限公司',
        },
        {
          name: 'sellerAddress',
          label: '公司地址',
          type: 'text',
          defaultValue: '臺北市信義區基隆路一段68號9樓',
        },
        { name: 'sellerPhone', label: '公司電話', type: 'text' },
        { name: 'sellerEmail', label: '公司 Email', type: 'email' },
      ],
    },

    // ═══════════════════════════════════════
    // ── 品牌設定 ──
    // ═══════════════════════════════════════
    {
      name: 'brandingConfig',
      label: '品牌設定',
      type: 'group',
      fields: [
        {
          name: 'invoiceLogo',
          label: '發票 PDF LOGO',
          type: 'upload',
          relationTo: 'media',
          admin: { description: '建議尺寸 300×80px PNG 透明背景' },
        },
        {
          name: 'companyChop',
          label: '公司印章圖片（選填）',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'footerText',
          label: 'PDF 頁尾文字',
          type: 'text',
          defaultValue: '感謝您的購買！CHIC KIM & MIU 靚秀國際有限公司',
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── 自動化設定 ──
    // ═══════════════════════════════════════
    {
      name: 'automationConfig',
      label: '自動化設定',
      type: 'group',
      fields: [
        { name: 'autoIssueEnabled', label: '付款成功自動開立', type: 'checkbox', defaultValue: true },
        { name: 'autoNotifyEnabled', label: '開立後自動發送通知', type: 'checkbox', defaultValue: true },
        {
          name: 'notifyChannels',
          label: '通知通道',
          type: 'select',
          hasMany: true,
          defaultValue: ['email'],
          options: [
            { label: 'Email', value: 'email' },
            { label: 'LINE', value: 'line' },
          ],
        },
        { name: 'retryEnabled', label: '失敗自動重試', type: 'checkbox', defaultValue: true },
        { name: 'maxRetryCount', label: '最大重試次數', type: 'number', defaultValue: 3 },
        { name: 'retryIntervalMinutes', label: '重試間隔（分鐘）', type: 'number', defaultValue: 5 },
      ],
    },

    // ═══════════════════════════════════════
    // ── 預設設定 ──
    // ═══════════════════════════════════════
    {
      name: 'defaultConfig',
      label: '預設設定',
      type: 'group',
      fields: [
        {
          name: 'defaultInvoiceType',
          label: '預設發票類型',
          type: 'select',
          defaultValue: 'b2c_personal',
          options: [
            { label: '二聯式（個人）', value: 'b2c_personal' },
            { label: '二聯式（載具）', value: 'b2c_carrier' },
            { label: '三聯式（公司）', value: 'b2b' },
            { label: '捐贈發票', value: 'donation' },
          ],
        },
        {
          name: 'defaultDonationCode',
          label: '預設捐贈碼',
          type: 'text',
          admin: { description: '例如 7681（伊甸基金會）' },
        },
        {
          name: 'defaultTaxType',
          label: '預設稅率類型',
          type: 'select',
          defaultValue: 'taxable',
          options: [
            { label: '應稅', value: 'taxable' },
            { label: '零稅率', value: 'zero_tax' },
          ],
        },
        { name: 'itemTaxFree', label: '商品免稅', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
