import type { CollectionConfig } from 'payload'
import {
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HorizontalRuleFeature,
  lexicalEditor,
  UploadFeature,
} from '@payloadcms/richtext-lexical'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

// SSR consumers (as of Phase 5.1 Batch 3, 2026-04-16):
//   - /blog                  (src/app/(frontend)/blog/page.tsx)
//   - /blog/[slug]           (src/app/(frontend)/blog/[slug]/page.tsx)
//   - /                      (home style journal section in src/app/(frontend)/page.tsx)
// All use `getPayload().find()`; full-route cache is invalidated via revalidatePath.
function revalidateBlog(slug?: string | null) {
  const paths = ['/', '/blog']
  if (slug) paths.push(`/blog/${slug}`)
  safeRevalidate(paths, ['blog-posts'])
}

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
  hooks: {
    afterChange: [
      ({ doc, previousDoc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        const prevSlug = (previousDoc as Record<string, unknown> | undefined)?.slug as
          | string
          | undefined
        revalidateBlog(slug)
        if (prevSlug && prevSlug !== slug) revalidateBlog(prevSlug)
      },
    ],
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidateBlog(slug)
      },
    ],
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
      editor: lexicalEditor({
        // 部落格專用「完整編輯器」：在全域 defaultFeatures 之上加上
        //   1. FixedToolbarFeature — 頂部固定工具列（傳統 WYSIWYG 體驗，
        //      比預設的 floating toolbar 對非技術作者更直覺）
        //   2. EXPERIMENTAL_TableFeature — 表格（比較表、尺寸對照、時程表常用）
        //   3. HorizontalRuleFeature — 水平分隔線（顯式加入，defaultFeatures 有
        //      但若未來全域被精簡這裡仍保有）
        //   4. UploadFeature — 內嵌圖片（與全域一致）
        // 其它 defaults（Heading/Bold/Italic/Underline/Strikethrough/InlineCode/
        // Subscript/Superscript/Link/AutoLink/Lists/Checklist/Blockquote/Align/
        // Indent/Relationship/ParagraphFeature）照用。
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          FixedToolbarFeature(),
          HorizontalRuleFeature(),
          EXPERIMENTAL_TableFeature(),
          UploadFeature({ collections: { media: { fields: [] } } }),
        ],
      }),
      admin: {
        description:
          '支援標題（H1–H6）、粗體 / 斜體 / 底線 / 刪除線、引言、條列、核取清單、超連結、' +
          '表格、水平線、圖片、左右對齊與縮排。頂部工具列永遠顯示；選取文字可叫出浮動選單做快速格式化。',
      },
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
