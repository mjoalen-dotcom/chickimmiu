import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

// SSR consumers:
//   - /podcast              (src/app/(frontend)/podcast/page.tsx)
//   - /podcast/[slug]       (src/app/(frontend)/podcast/[slug]/page.tsx)
//   - /                     (homepage 若日後加 podcast 區塊)
function revalidatePodcast(slug?: string | null) {
  const paths = ['/', '/podcast']
  if (slug) paths.push(`/podcast/${slug}`)
  safeRevalidate(paths, ['podcasts'])
}

export const Podcasts: CollectionConfig = {
  slug: 'podcasts',
  labels: { singular: 'Podcast 節目', plural: 'Podcast 節目' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'episodeNumber', 'category', 'status', 'publishedAt'],
    group: '⑥ 內容與頁面',
    description: 'Podcast 節目集數管理。每集可上傳 m4a/mp3 + show notes + 關聯商品 CTA。AI 生成的請勾選「AI 生成」。',
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
        revalidatePodcast(slug)
        if (prevSlug && prevSlug !== slug) revalidatePodcast(prevSlug)
      },
    ],
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidatePodcast(slug)
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: '基本資訊',
          fields: [
            {
              name: 'title',
              label: '節目標題',
              type: 'text',
              required: true,
            },
            {
              name: 'slug',
              label: '網址代碼',
              type: 'text',
              required: true,
              unique: true,
              admin: {
                description: '用於 URL，例如 /podcast/dongdaemun-2026-ss',
              },
            },
            {
              name: 'episodeNumber',
              label: '集數',
              type: 'number',
              required: true,
              admin: {
                description: '第幾集（1, 2, 3...）。前台會顯示為 EP01 / EP02 等。',
              },
            },
            {
              name: 'excerpt',
              label: '摘要',
              type: 'textarea',
              admin: {
                description: '顯示在節目列表的簡短說明（建議 80-150 字）',
              },
            },
            {
              name: 'category',
              label: '節目分類',
              type: 'select',
              required: true,
              defaultValue: 'trends',
              options: [
                { label: '新貨開箱', value: 'new-arrivals' },
                { label: '韓系趨勢', value: 'trends' },
                { label: '採購故事', value: 'sourcing' },
                { label: '行銷洞察', value: 'marketing' },
                { label: '客戶故事', value: 'customer-stories' },
                { label: '品牌故事', value: 'brand-story' },
              ],
            },
            {
              name: 'tags',
              label: '標籤',
              type: 'array',
              fields: [
                {
                  name: 'tag',
                  label: '標籤',
                  type: 'text',
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: '音訊與封面',
          fields: [
            {
              name: 'audioFile',
              label: '音訊檔（m4a / mp3）',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: {
                description: '上傳節目音檔。支援 m4a / mp3，最大 50 MB。建議 14 分鐘以內、stereo 192-256 kbps。',
              },
            },
            {
              name: 'duration',
              label: '時長（秒）',
              type: 'number',
              admin: {
                description: '節目總長度，秒數。例：14 分 = 840。前台會自動格式化為 mm:ss。',
              },
            },
            {
              name: 'coverImage',
              label: '封面圖片',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: '建議正方形 1:1，1400×1400 以上（Spotify / Apple Podcast 規格）。',
              },
            },
          ],
        },
        {
          label: 'Show Notes',
          fields: [
            {
              name: 'showNotes',
              label: 'Show Notes（節目筆記）',
              type: 'richText',
              editor: lexicalEditor({}),
              admin: {
                description: '節目重點、章節時間軸、引用與延伸閱讀。支援標題、清單、連結、引言。',
              },
            },
            {
              name: 'sources',
              label: '參考來源',
              type: 'array',
              admin: {
                description: '節目引用的研究來源 / URL 清單（顯示在前台 show notes 末段）。',
              },
              fields: [
                {
                  name: 'label',
                  label: '來源名稱',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'url',
                  label: '連結',
                  type: 'text',
                },
              ],
            },
            {
              name: 'hosts',
              label: '主持人',
              type: 'array',
              admin: {
                description: 'AI 生成可填「Mia」「Jay」等 persona 名稱。真人主持填本名。',
              },
              fields: [
                {
                  name: 'name',
                  label: '名稱',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'role',
                  label: '角色',
                  type: 'text',
                  admin: { description: '例：主持 / 來賓 / AI host' },
                },
              ],
            },
          ],
        },
        {
          label: '商品連結',
          fields: [
            {
              name: 'relatedProducts',
              label: '關聯商品（PDP CTA）',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
              admin: {
                description: '前台節目頁底部會列出這些商品，附「立即購買」CTA。建議 3-6 件。',
              },
            },
            {
              name: 'relatedCategories',
              label: '關聯分類',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
              admin: {
                description: '節目主題對應的商品分類；前台可能顯示「逛逛這個系列」CTA。',
              },
            },
          ],
        },
        {
          label: '發佈與 AI',
          fields: [
            {
              name: 'aiGenerated',
              label: 'AI 生成（誠實標）',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: '勾選代表本集主要內容由 AI（NotebookLM / ElevenLabs）生成。前台會在節目頁顯示「AI 生成」徽章，符合誠實揭露。',
              },
            },
            {
              name: 'notebookId',
              label: 'NotebookLM Notebook ID',
              type: 'text',
              admin: {
                description: '若本集由 NotebookLM 生成，可填 notebook id（用於後續 refresh / 補問）。例：99e84848-4cb8-49c5-8426-9d031c882a19',
              },
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
              label: '發佈時間',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: '正式上架時間。會顯示在前台節目卡與 RSS feed。',
              },
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'seo',
              label: 'SEO 設定',
              type: 'group',
              fields: [
                { name: 'metaTitle', label: 'Meta 標題', type: 'text' },
                { name: 'metaDescription', label: 'Meta 描述', type: 'textarea' },
                {
                  name: 'metaImage',
                  label: 'OG 圖片',
                  type: 'upload',
                  relationTo: 'media',
                  admin: { description: '社群分享用圖。沒填會 fallback 到「封面圖片」。' },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
