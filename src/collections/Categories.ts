import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { revalidateCategory } from '../lib/revalidate'
import { seedShoplineCategoriesEndpoint } from '../endpoints/seedShoplineCategories'
import { categoryReorderEndpoint } from '../endpoints/categoryTreeReorder'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: {
    singular: '商品分類',
    plural: '商品分類',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'parent', 'level', 'sortOrder', 'productCount', 'updatedAt'],
    group: '② 商品管理',
    description: '商品分類管理（支援多層次分類：主分類 > 子分類 > 細分類）',
    listSearchableFields: ['name', 'slug'],
    components: {
      views: {
        list: {
          Component: '@/components/admin/CategoryTreeView',
        },
      },
    },
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  endpoints: [seedShoplineCategoriesEndpoint, categoryReorderEndpoint],
  hooks: {
    afterChange: [
      ({ doc, previousDoc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        const prevSlug = (previousDoc as Record<string, unknown> | undefined)?.slug as
          | string
          | undefined
        revalidateCategory(slug)
        if (prevSlug && prevSlug !== slug) revalidateCategory(prevSlug)
      },
    ],
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidateCategory(slug)
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          label: '分類名稱',
          type: 'text',
          required: true,
          admin: { width: '50%' },
        },
        {
          name: 'slug',
          label: '網址代碼',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            width: '50%',
            description: '用於 URL，例如 /category/dresses',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'parent',
          label: '上層分類',
          type: 'relationship',
          relationTo: 'categories',
          admin: {
            width: '40%',
            description: '若為子分類，選擇其上層分類。留空 = 頂層分類',
          },
        },
        {
          name: 'level',
          label: '層級',
          type: 'select',
          defaultValue: '1',
          options: [
            { label: 'Level 1 (Main)', value: '1' },
            { label: 'Level 2 (Sub)', value: '2' },
            { label: 'Level 3 (Detail)', value: '3' },
          ],
          admin: {
            width: '30%',
            description: 'Category depth level',
          },
        },
        {
          name: 'sortOrder',
          label: '排序',
          type: 'number',
          defaultValue: 0,
          admin: {
            width: '30%',
            description: 'Lower number = appears first',
          },
        },
      ],
    },
    {
      name: 'description',
      label: '分類說明',
      type: 'textarea',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'image',
          label: '分類圖片',
          type: 'upload',
          relationTo: 'media',
          admin: { width: '50%' },
        },
        {
          name: 'icon',
          label: '分類圖標',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Emoji or icon class, e.g. dress icon',
          },
        },
      ],
    },
    // Display helpers
    {
      name: 'isActive',
      label: '啟用',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Inactive categories are hidden from the frontend' },
    },
    {
      name: 'productCount',
      label: '商品數量',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Auto-calculated (approximate)',
      },
    },
    // SEO
    {
      name: 'seo',
      label: 'SEO',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta Title', type: 'text' },
        { name: 'metaDescription', label: 'Meta Description', type: 'textarea' },
      ],
    },
  ],
}
