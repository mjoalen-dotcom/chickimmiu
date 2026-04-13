import type { CollectionConfig, Access, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 發票讀取權限：
 * - Admin：看全部
 * - Customer：只看自己的發票（customer === user.id）
 */
const readOwnOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { customer: { equals: user.id } } as Where
}

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: '電子發票', plural: '電子發票' },
  admin: {
    group: '訂單管理',
    useAsTitle: 'invoiceNumber',
    description: '綠界電子發票管理（開立、查詢、作廢、折讓）',
    defaultColumns: ['invoiceNumber', 'order', 'invoiceType', 'status', 'totalAmount', 'createdAt'],
  },
  access: {
    read: readOwnOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    // ── 基本資訊 ──
    {
      name: 'invoiceNumber',
      label: '發票號碼',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        description: '綠界回傳的發票號碼，格式 XX-00000000',
      },
    },
    {
      name: 'order',
      label: '關聯訂單',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      index: true,
    },
    {
      name: 'customer',
      label: '購買人',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },

    // ── 發票類型 ──
    {
      name: 'invoiceType',
      label: '發票類型',
      type: 'select',
      required: true,
      options: [
        { label: '二聯式（個人）', value: 'b2c_personal' },
        { label: '二聯式（載具）', value: 'b2c_carrier' },
        { label: '三聯式（公司）', value: 'b2b' },
        { label: '捐贈發票', value: 'donation' },
      ],
    },

    // ── 發票狀態 ──
    {
      name: 'status',
      label: '發票狀態',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: '待開立', value: 'pending' },
        { label: '已開立', value: 'issued' },
        { label: '已作廢', value: 'void' },
        { label: '已折讓', value: 'allowance' },
        { label: '開立失敗', value: 'failed' },
        { label: '重試中', value: 'retry' },
      ],
    },

    // ── 載具資訊 ──
    {
      name: 'carrierInfo',
      label: '載具資訊',
      type: 'group',
      fields: [
        {
          name: 'carrierType',
          label: '載具類型',
          type: 'select',
          defaultValue: 'none',
          options: [
            { label: '不使用載具', value: 'none' },
            { label: '手機條碼', value: 'phone_barcode' },
            { label: '自然人憑證', value: 'natural_cert' },
            { label: '綠界會員載具', value: 'ecpay_member' },
          ],
        },
        {
          name: 'carrierNumber',
          label: '載具號碼',
          type: 'text',
          admin: { description: '手機條碼 / 開頭，自然人憑證 2 碼大寫英文 + 14 碼數字' },
        },
      ],
    },

    // ── 捐贈資訊 ──
    {
      name: 'donationInfo',
      label: '捐贈資訊',
      type: 'group',
      admin: {
        condition: (data) => data?.invoiceType === 'donation',
      },
      fields: [
        {
          name: 'loveCode',
          label: '捐贈碼（愛心碼）',
          type: 'text',
          admin: { description: '3~7 碼數字' },
        },
      ],
    },

    // ── 買方資訊 ──
    {
      name: 'buyerInfo',
      label: '買方資訊',
      type: 'group',
      fields: [
        { name: 'buyerName', label: '買方名稱', type: 'text' },
        { name: 'buyerEmail', label: '買方 Email', type: 'email', required: true },
        { name: 'buyerPhone', label: '買方電話', type: 'text' },
        {
          name: 'buyerUBN',
          label: '買方統一編號',
          type: 'text',
          admin: {
            description: '三聯式必填',
            condition: (data) => data?.invoiceType === 'b2b',
          },
        },
        {
          name: 'buyerCompanyName',
          label: '買方公司名稱',
          type: 'text',
          admin: {
            condition: (data) => data?.invoiceType === 'b2b',
          },
        },
        { name: 'buyerAddress', label: '買方地址', type: 'text' },
      ],
    },

    // ── 發票品項 ──
    {
      name: 'invoiceItems',
      label: '發票品項',
      type: 'array',
      required: true,
      fields: [
        { name: 'itemName', label: '品名', type: 'text', required: true },
        { name: 'itemCount', label: '數量', type: 'number', required: true, min: 1 },
        { name: 'itemWord', label: '單位', type: 'text', defaultValue: '件' },
        { name: 'itemPrice', label: '單價', type: 'number', required: true },
        {
          name: 'itemTaxType',
          label: '課稅類型',
          type: 'select',
          defaultValue: 'taxable',
          options: [
            { label: '應稅', value: 'taxable' },
            { label: '零稅率', value: 'zero_tax' },
            { label: '免稅', value: 'tax_free' },
          ],
        },
        {
          name: 'itemAmount',
          label: '小計',
          type: 'number',
          required: true,
          admin: { readOnly: true },
        },
      ],
    },

    // ── 金額 ──
    { name: 'totalAmount', label: '發票金額', type: 'number', required: true, min: 0 },
    { name: 'salesAmount', label: '銷售額（未稅）', type: 'number', admin: { readOnly: true } },
    { name: 'taxAmount', label: '稅額', type: 'number', admin: { readOnly: true } },
    {
      name: 'taxType',
      label: '稅率類型',
      type: 'select',
      defaultValue: 'taxable',
      options: [
        { label: '應稅', value: 'taxable' },
        { label: '零稅率', value: 'zero_tax' },
        { label: '混合', value: 'mixed' },
      ],
    },

    // ── 綠界回傳資料 ──
    {
      name: 'ecpayResponse',
      label: '綠界回傳資料',
      type: 'group',
      admin: { description: '系統自動填入，勿手動修改' },
      fields: [
        { name: 'invoiceNo', label: '發票號碼', type: 'text', admin: { readOnly: true } },
        { name: 'invoiceDate', label: '發票日期', type: 'text', admin: { readOnly: true } },
        { name: 'randomNumber', label: '隨機碼', type: 'text', admin: { readOnly: true } },
        { name: 'barCode', label: '一維條碼', type: 'text', admin: { readOnly: true } },
        { name: 'qrCodeLeft', label: 'QR Code 左', type: 'text', admin: { readOnly: true } },
        { name: 'qrCodeRight', label: 'QR Code 右', type: 'text', admin: { readOnly: true } },
        { name: 'invoiceTransNo', label: '綠界交易碼', type: 'text', admin: { readOnly: true } },
        { name: 'rtnCode', label: '回傳碼', type: 'text', admin: { readOnly: true } },
        { name: 'rtnMsg', label: '回傳訊息', type: 'text', admin: { readOnly: true } },
        { name: 'rawResponse', label: '完整回傳 JSON', type: 'json', admin: { readOnly: true } },
      ],
    },

    // ── 作廢資訊 ──
    {
      name: 'voidInfo',
      label: '作廢資訊',
      type: 'group',
      admin: {
        condition: (data) => data?.status === 'void',
      },
      fields: [
        { name: 'voidReason', label: '作廢原因', type: 'textarea' },
        { name: 'voidDate', label: '作廢日期', type: 'date' },
        { name: 'voidOperator', label: '作廢人', type: 'relationship', relationTo: 'users' },
      ],
    },

    // ── 折讓資訊 ──
    {
      name: 'allowanceInfo',
      label: '折讓資訊',
      type: 'group',
      admin: {
        condition: (data) => data?.status === 'allowance',
      },
      fields: [
        { name: 'allowanceAmount', label: '折讓金額', type: 'number' },
        { name: 'allowanceReason', label: '折讓原因', type: 'textarea' },
        { name: 'allowanceDate', label: '折讓日期', type: 'date' },
        { name: 'allowanceNo', label: '折讓單號', type: 'text', admin: { readOnly: true } },
      ],
    },

    // ── 其他 ──
    { name: 'pdfUrl', label: 'PDF 下載連結', type: 'text', admin: { readOnly: true } },
    { name: 'notificationSent', label: '已發送通知', type: 'checkbox', defaultValue: false },
    { name: 'retryCount', label: '重試次數', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'lastError', label: '最後錯誤訊息', type: 'text', admin: { readOnly: true } },
  ],
}
