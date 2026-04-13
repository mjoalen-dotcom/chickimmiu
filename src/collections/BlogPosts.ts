import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

export const BlogPosts: CollectionConfig = {
  slug: 'blog-posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'publishedAt'],
    group: '內容管理',
    description: '部落格文章管理',
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
  fields: [
    {
      name: 'title',
      label: '文章標題',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: '網址代碼',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: '用於 URL，例如 /blog/my-article' },
    },
    {
      name: 'excerpt',
      label: '摘要',
      type: 'textarea',
      admin: { description: '顯示在文章列表的簡短說明' },
    },
    {
      name: 'content',
      label: '文章內容',
      type: 'richText',
      required: true,
    },
    {
      name: 'featuredImage',
      label: '封面圖片',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'author',
      label: '作者',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'category',
      label: '文章分類',
      type: 'select',
      options: [
        { label: '穿搭教學', value: 'styling' },
        { label: '新品介紹', value: 'new-arrivals' },
        { label: '品牌故事', value: 'brand-story' },
        { label: '優惠活動', value: 'promotions' },
        { label: '時尚趨勢', value: 'trends' },
      ],
    },
    {
      name: 'tags',
      label: '標籤',
      type: 'array',
      fields: [
        {
          name: 'tag',
          label: '標籤名稱',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      label: '狀態',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已發佈', value: 'published' },
      ],
    },
    {
      name: 'publishedAt',
      label: '發佈日期',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: '設定發佈時間',
      },
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
  ],
}
