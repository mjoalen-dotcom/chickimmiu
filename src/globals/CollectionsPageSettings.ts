import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

export const CollectionsPageSettings: GlobalConfig = {
  slug: 'collections-page-settings',
  label: '主題精選頁設定',
  admin: {
    group: '⑥ 內容與頁面',
    description: '/collections 頁的 hero 文案與主題卡片管理（卡片連到 /collections/<slug> 商品篩選頁）',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      ({ doc }) => {
        safeRevalidate(['/collections'])
        const cards = (doc?.cards as Array<{ slug?: string | null }> | undefined) || []
        for (const c of cards) {
          if (c?.slug) safeRevalidate([`/collections/${c.slug}`])
        }
      },
    ],
  },
  fields: [
    {
      name: 'hero',
      label: '頁面 Hero 區塊',
      type: 'group',
      fields: [
        {
          name: 'overline',
          label: '上方小標',
          type: 'text',
          defaultValue: 'Collection',
        },
        {
          name: 'title',
          label: '主標',
          type: 'text',
          defaultValue: '主題精選',
        },
        {
          name: 'description',
          label: '副標說明',
          type: 'textarea',
          defaultValue: '依風格、場合、主題瀏覽我們為您精心策劃的系列',
        },
      ],
    },
    {
      name: 'cards',
      label: '主題卡片',
      type: 'array',
      minRows: 1,
      maxRows: 24,
      admin: {
        description: '/collections 頁的主題卡片陣列（每張卡片導去 /collections/<slug>）',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'image',
          label: '卡片圖片',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'title',
          label: '卡片標題',
          type: 'text',
          required: true,
        },
        {
          name: 'slug',
          label: 'Slug',
          type: 'text',
          required: true,
          admin: {
            description: '對應 /collections/<slug>，例如 jin-live、formal-dresses',
          },
        },
        {
          name: 'description',
          label: '卡片描述',
          type: 'textarea',
          admin: {
            description: '/collections/<slug> 點進去頁面的副標',
          },
        },
        {
          name: 'span',
          label: '卡片尺寸',
          type: 'select',
          defaultValue: 'normal',
          options: [
            { label: '一般 (1×1)', value: 'normal' },
            { label: '寬 (2×1)', value: 'wide' },
            { label: '高 (1×2)', value: 'tall' },
            { label: '大 (2×2)', value: 'large' },
          ],
        },
        {
          name: 'sortOrder',
          label: '排序順序',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: '數字小的排前面（同樣值依新增順序）',
          },
        },
        {
          name: 'isActive',
          label: '啟用',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'collectionTagsFilter',
          label: '商品分類標籤篩選',
          type: 'select',
          hasMany: true,
          admin: {
            description: '此卡片連到的 /collections/<slug> 頁顯示的商品篩選條件（對應 Products.collectionTags）',
          },
          options: [
            { label: '金老佛爺 Live', value: 'jin-live' },
            { label: '金金同款專區', value: 'jin-style' },
            { label: '主播同款專區', value: 'host-style' },
            { label: '品牌自訂款', value: 'brand-custom' },
            { label: '婚禮洋裝/正式洋裝', value: 'formal-dresses' },
            { label: '現貨速到 Rush', value: 'rush' },
            { label: '藝人穿搭', value: 'celebrity-style' },
            { label: '韓星同款', value: 'korean-celebrity' },
          ],
        },
        {
          name: 'seo',
          label: 'SEO',
          type: 'group',
          fields: [
            {
              name: 'metaTitle',
              label: 'Meta Title',
              type: 'text',
            },
            {
              name: 'metaDescription',
              label: 'Meta Description',
              type: 'textarea',
            },
          ],
        },
      ],
    },
  ],
}
