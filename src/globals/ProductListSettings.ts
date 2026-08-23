import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 商品列表頁設定 Global
 * --------------------
 * 控制 /products 列表頁的分頁、排序、篩選器顯示、頂部 banner。
 * Wave 1 PR-α 只建 admin 設定，不接前台渲染（留給 Wave 2 PR-κ）。
 */
export const ProductListSettings: GlobalConfig = {
  slug: 'product-list-settings',
  label: '商品列表頁設定',
  admin: {
    group: '⑥ 內容與頁面',
    description: '/products 列表頁的分頁、排序、banner、篩選器顯示控制',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        safeRevalidate(['/products'])
      },
    ],
  },
  fields: [
    {
      name: 'cardStyle',
      label: '商品卡風格',
      type: 'select',
      defaultValue: 'classic',
      options: [
        { label: '經典（圓角＋彩色標籤，預設）', value: 'classic' },
        { label: '精品極簡（LV/Dior 式：直角、黑白標籤）', value: 'minimal' },
      ],
      admin: { description: '切換商品列表頁的卡片外觀，存檔即生效' },
    },
    {
      name: 'pageSize',
      label: '每頁商品數',
      type: 'number',
      defaultValue: 24,
      min: 6,
      max: 120,
    },
    {
      name: 'pageSizeOptions',
      label: '前台可切換的每頁筆數選項',
      type: 'array',
      defaultValue: [{ value: 12 }, { value: 24 }, { value: 36 }, { value: 48 }, { value: 60 }],
      fields: [
        { name: 'value', type: 'number', required: true, min: 6, max: 200 },
      ],
    },
    {
      name: 'defaultSort',
      label: '預設排序',
      type: 'select',
      defaultValue: 'newest',
      options: [
        { label: '最新上架', value: 'newest' },
        { label: '價格：低到高', value: 'price-asc' },
        { label: '價格：高到低', value: 'price-desc' },
        { label: '人氣推薦', value: 'popular' },
      ],
    },
    {
      name: 'maxPriceCap',
      label: '價格篩選上限（NTD）',
      type: 'number',
      defaultValue: 10000,
      min: 100,
    },
    {
      name: 'hideOutOfStock',
      label: '缺貨商品自動隱藏',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'showSizeFilter',
      label: '顯示尺寸篩選器',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'defaultRelatedCount',
      label: 'PDP「同樣的人也買了」筆數',
      type: 'number',
      defaultValue: 4,
      min: 0,
      max: 12,
    },
    {
      name: 'banner',
      label: '頂部 Banner',
      type: 'group',
      fields: [
        {
          name: 'image',
          label: '頂部 banner 圖（建議 1920×400）',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'overline',
          label: '上方小標',
          type: 'text',
          defaultValue: 'PRODUCTS',
        },
        {
          name: 'title',
          label: '主標',
          type: 'text',
          defaultValue: '全部商品',
        },
        {
          name: 'subtitle',
          label: '副標說明',
          type: 'textarea',
        },
      ],
    },
  ],
}
