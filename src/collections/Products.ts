import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { createExportEndpoint, createImportEndpoint, type FieldMapping } from '../endpoints/importExport'

const productFieldMappings: FieldMapping[] = [
  { key: 'name', label: '商品名稱' },
  { key: 'slug', label: '網址代碼' },
  { key: 'price', label: '原價' },
  { key: 'salePrice', label: '特價' },
  { key: 'stock', label: '庫存' },
  { key: 'status', label: '狀態' },
  { key: 'isNew', label: '新品' },
  { key: 'isHot', label: '熱銷' },
  { key: 'weight', label: '重量' },
  { key: 'variants', label: '變體（JSON）' },
  { key: 'tags', label: '標籤（JSON）' },
]

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'price', 'salePrice', 'stock', 'status', 'isHot', 'isNew'],
    group: '商品管理',
    description: '商品資料管理（含變體、庫存、分類、CSV/Excel 匯入匯出）',
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/SinsangImporter',
        },
        {
          path: '@/components/admin/ShoplineImportPanel',
        },
        {
          path: '@/components/admin/ImageMigrationPanel',
        },
        {
          path: '@/components/admin/ImportExportButtons',
          clientProps: { collectionSlug: 'products' },
        },
      ],
    },
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return { status: { equals: 'published' } }
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  endpoints: [
    createExportEndpoint('products', productFieldMappings),
    createImportEndpoint('products', productFieldMappings),
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data) return data
        // 自動計算低庫存狀態
        const threshold = data.lowStockThreshold ?? 5
        const variants = data.variants as { stock?: number }[] | undefined
        if (variants && variants.length > 0) {
          const totalStock = variants.reduce((sum: number, v: { stock?: number }) => sum + (v.stock ?? 0), 0)
          data.isLowStock = totalStock <= threshold
        } else {
          data.isLowStock = (data.stock ?? 0) <= threshold
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      label: '商品名稱',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: '網址代碼',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: '用於 URL，例如 /products/elegant-dress' },
    },
    {
      name: 'description',
      label: '商品描述',
      type: 'richText',
    },
    // ── 價格 ──
    {
      name: 'price',
      label: '原價（新台幣）',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'salePrice',
      label: '特價（新台幣）',
      type: 'number',
      min: 0,
      admin: { description: '留空表示無特價' },
    },
    // ── 分類與標籤 ──
    {
      name: 'category',
      label: '商品分類',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'tags',
      label: '商品標籤',
      type: 'array',
      fields: [
        { name: 'tag', label: '標籤', type: 'text', required: true },
      ],
    },
    {
      name: 'collectionTags',
      label: '主題專區標籤',
      type: 'select',
      hasMany: true,
      options: [
        { label: '金老佛爺 Live', value: 'jin-live' },
        { label: '金金同款專區', value: 'jin-style' },
        { label: '主播同款專區', value: 'host-style' },
        { label: '品牌自訂款', value: 'brand-custom' },
        { label: '婚禮洋裝/正式洋裝', value: 'formal-dresses' },
        { label: '現貨速到 Rush', value: 'rush' },
        { label: '藝人穿搭', value: 'celebrity-style' },
      ],
      admin: {
        description: '選擇此商品所屬的主題專區（可多選）',
      },
    },
    // ── 圖片 ──
    {
      name: 'images',
      label: '商品圖片',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'image',
          label: '圖片',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    // ── 變體（顏色 / 尺寸） ──
    {
      name: 'variants',
      label: '商品變體',
      type: 'array',
      admin: { description: '每個變體代表一種顏色 + 尺寸的組合' },
      fields: [
        { name: 'colorName', label: '顏色名稱', type: 'text', required: true },
        { name: 'colorCode', label: '色碼', type: 'text', admin: { description: 'HEX 色碼，例如 #FF6B6B' } },
        { name: 'size', label: '尺寸', type: 'text', required: true, admin: { description: '例如 S / M / L / XL / XXL' } },
        { name: 'sku', label: 'SKU 編號', type: 'text', required: true },
        { name: 'stock', label: '庫存數量', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'priceOverride', label: '此變體價格覆蓋', type: 'number', min: 0, admin: { description: '若此變體有不同價格，填入此欄位' } },
      ],
    },
    // ── 庫存（無變體時使用） ──
    {
      name: 'stock',
      label: '總庫存（無變體時使用）',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: { description: '若有設定變體，以變體的庫存為準' },
    },
    {
      name: 'lowStockThreshold',
      label: '低庫存警示門檻',
      type: 'number',
      min: 0,
      defaultValue: 5,
      admin: { description: '庫存低於此數量時在後台顯示警示' },
    },
    {
      name: 'isLowStock',
      label: '低庫存警示',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, description: '系統自動判斷，無需手動修改' },
    },
    {
      name: 'allowPreOrder',
      label: '允許預購',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: '庫存為 0 時仍可下單' },
    },
    {
      name: 'preOrderNote',
      label: '預購說明',
      type: 'text',
      admin: {
        description: '例如：預購流程 → 下單→收到訂單→搭飛機中→清關→包裝→寄出',
        condition: (data) => Boolean(data?.allowPreOrder),
      },
    },
    // ── 標記 ──
    {
      name: 'isNew',
      label: '新品標記',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isHot',
      label: '熱銷標記',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'status',
      label: '上架狀態',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已上架', value: 'published' },
        { label: '已下架', value: 'archived' },
      ],
    },
    // ── 重量 ──
    {
      name: 'weight',
      label: '商品重量（公克）',
      type: 'number',
      min: 0,
    },
    // ── SEO ──
    {
      name: 'seo',
      label: 'SEO 設定',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta 標題', type: 'text' },
        { name: 'metaDescription', label: 'Meta 描述', type: 'textarea' },
        { name: 'metaImage', label: 'OG 圖片', type: 'upload', relationTo: 'media' },
      ],
    },
    // ── 採購資訊（後台內部，前台不顯示） ──
    {
      name: 'sourcing',
      label: '採購來源資訊',
      type: 'group',
      admin: {
        description: '⚠️ 內部採購資訊，僅後台人員可見，前台完全隱藏',
        position: 'sidebar',
      },
      fields: [
        { name: 'sourceId', label: '來源商品 ID', type: 'text', admin: { description: 'Sinsang Market 商品 ID' } },
        { name: 'supplierName', label: '供應商名稱', type: 'text', admin: { description: '例如 BBOOM UP' } },
        { name: 'supplierLocation', label: '供應商位置代碼', type: 'text', admin: { description: '例如 Studio W 1F 특7' } },
        { name: 'costKRW', label: '進貨成本（韓元）', type: 'number', min: 0, admin: { description: '韓元原價' } },
        { name: 'costTWD', label: '參考台幣成本', type: 'number', min: 0, admin: { readOnly: true, description: '= 韓元 × 換算係數（匯入時自動計算）' } },
        { name: 'exchangeRate', label: '匯入時換算係數', type: 'number', admin: { readOnly: true, description: '匯入當下使用的換算係數' } },
        { name: 'originalDescription', label: '韓文原始描述', type: 'textarea', admin: { description: '僅供翻譯參考，不自動成為前台商品說明' } },
        { name: 'fabricInfo', label: '布料資訊', type: 'group', fields: [
          { name: 'material', label: '材質說明', type: 'text', admin: { description: '例如 棉 60%、聚酯纖維 40%' } },
          { name: 'thickness', label: '厚度', type: 'text' },
          { name: 'transparency', label: '透明度', type: 'text' },
          { name: 'elasticity', label: '彈性', type: 'text' },
          { name: 'madeIn', label: '製造國', type: 'text' },
        ]},
      ],
    },
  ],
}
