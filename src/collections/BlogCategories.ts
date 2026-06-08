import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 部落格分類（獨立 collection，可後台管理顯示名稱 / 排序 / SEO）。
 *
 * 設計取捨：BlogPosts.category 維持 select（值不動，避免文章資料遷移風險）；
 * 本 collection 的 `value` 與 BlogPosts.category 的 5 個 select 值一一對應，
 * 前台依此 collection 渲染分類頁籤（標籤 + 排序），post 仍以 category 值過濾。
 *
 * 對應 migration：20260608_170000_add_blog_categories（CREATE TABLE + seed 5 筆）。
 */
export const BlogCategories: CollectionConfig = {
  slug: 'blog-categories',
  labels: { singular: '部落格分類', plural: '部落格分類' },
  admin: {
    group: '⑥ 內容與頁面',
    useAsTitle: 'name',
    defaultColumns: ['name', 'value', 'slug', 'displayOrder'],
    description: '穿搭誌文章分類：顯示名稱、排序、SEO。value 須對應 BlogPosts 的分類值。',
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  hooks: {
    afterChange: [() => safeRevalidate(['/blog'], ['blog-categories'])],
    afterDelete: [() => safeRevalidate(['/blog'], ['blog-categories'])],
  },
  fields: [
    {
      name: 'name',
      label: '分類名稱',
      type: 'text',
      required: true,
      admin: { description: '前台頁籤顯示的中文名（例：穿搭教學）' },
    },
    {
      name: 'value',
      label: '對應文章分類值',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: '穿搭教學', value: 'styling' },
        { label: '新品介紹', value: 'new-arrivals' },
        { label: '品牌故事', value: 'brand-story' },
        { label: '優惠活動', value: 'promotions' },
        { label: '時尚趨勢', value: 'trends' },
      ],
      admin: { description: '必須對應 BlogPosts.category 的 select 值，前台才能正確過濾' },
    },
    {
      name: 'slug',
      label: '網址代碼',
      type: 'text',
      unique: true,
      admin: { description: '供未來分類落地頁 /blog/category/<slug> 用' },
    },
    {
      name: 'description',
      label: '分類描述',
      type: 'textarea',
    },
    {
      name: 'displayOrder',
      label: '排序',
      type: 'number',
      defaultValue: 0,
      admin: { description: '數字小者排前面' },
    },
    {
      name: 'seo',
      label: 'SEO 設定',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta 標題', type: 'text' },
        { name: 'metaDescription', label: 'Meta 描述', type: 'textarea' },
      ],
    },
  ],
}
