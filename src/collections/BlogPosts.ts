import type { CollectionConfig, Field } from 'payload'
import {
  BlocksFeature,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HorizontalRuleFeature,
  lexicalEditor,
  UploadFeature,
} from '@payloadcms/richtext-lexical'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'
import { triggerKimBlogDeploy } from '../lib/blog/kimSyndication'

const EMOTICON_FOLDER_NAME = 'Kim 表情圖案（PIXNET 117824267）'

const blogImageDisplayFields: Field[] = [
  {
    name: 'displayWidth',
    label: '圖片顯示寬度',
    type: 'number',
    min: 24,
    max: 1200,
    defaultValue: 720,
    admin: {
      step: 4,
      description:
        '拖曳滑桿或輸入像素值；手機版仍會自動縮到畫面寬度內，不會超出文章。',
      components: {
        Field: '@/components/admin/BlogImageSizeField',
      },
    },
  },
  {
    name: 'displayAlignment',
    label: '圖片對齊',
    type: 'select',
    defaultValue: 'center',
    options: [
      { label: '靠左', value: 'left' },
      { label: '置中', value: 'center' },
      { label: '靠右', value: 'right' },
    ],
  },
]

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
  labels: { singular: '部落格文章', plural: '部落格文章' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'publishToKimLafayette', 'publishedAt'],
    group: '⑥ 內容與頁面',
    listSearchableFields: ['title', 'slug', 'excerpt'],
    pagination: {
      defaultLimit: 25,
      limits: [10, 25, 50, 100],
    },
    components: {
      beforeListTable: ['@/components/admin/BlogListDashboard'],
    },
    preview: (doc) => {
      const slug = typeof doc.slug === 'string' ? doc.slug.trim() : ''
      if (!slug || doc.status !== 'published' || doc.publishToKimLafayette !== true) {
        return null
      }
      const baseUrl = (process.env.KIM_BLOG_PUBLIC_URL || 'https://blog.kimlafayette.com').replace(
        /\/$/,
        '',
      )
      return `${baseUrl}/blog/${encodeURIComponent(slug)}/`
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
      async ({ doc, previousDoc }) => {
        const current = doc as Record<string, unknown>
        const previous = previousDoc as Record<string, unknown> | undefined
        const currentlyPublished =
          current.publishToKimLafayette === true && current.status === 'published'
        const previouslyPublished =
          previous?.publishToKimLafayette === true && previous.status === 'published'
        if (currentlyPublished) {
          await triggerKimBlogDeploy('published', current)
        } else if (previouslyPublished) {
          await triggerKimBlogDeploy('unpublished', current)
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidateBlog(slug)
      },
      async ({ doc }) => {
        const deleted = doc as Record<string, unknown>
        if (deleted.publishToKimLafayette === true) {
          await triggerKimBlogDeploy('deleted', deleted)
        }
      },
    ],
  },
  fields: [
    {
      name: 'blogEditorHeader',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/BlogEditorHeader',
        },
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: '文章內容',
          description: '文章標題、網址、摘要、內文與封面',
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
                //   4. UploadFeature — 內嵌圖片，另加顯示寬度與對齊控制
                //   5. BlocksFeature — 「商品按鈕」與 PIXNET 搬移的「表情圖案」
                // 其它 defaults（Heading/Bold/Italic/Underline/Strikethrough/InlineCode/
                // Subscript/Superscript/Link/AutoLink/Lists/Checklist/Blockquote/Align/
                // Indent/Relationship/ParagraphFeature）照用。
                features: ({ defaultFeatures }) => [
                  ...defaultFeatures,
                  FixedToolbarFeature(),
                  HorizontalRuleFeature(),
                  EXPERIMENTAL_TableFeature(),
                  UploadFeature({
                    collections: {
                      media: { fields: blogImageDisplayFields },
                    },
                  }),
                  BlocksFeature({
                    blocks: [
                      {
                        slug: 'productButton',
                        labels: { singular: '商品按鈕', plural: '商品按鈕' },
                        fields: [
                          {
                            name: 'product',
                            label: '商品',
                            type: 'relationship',
                            relationTo: 'products',
                            required: true,
                          },
                          {
                            name: 'label',
                            label: '按鈕文字',
                            type: 'text',
                            defaultValue: '立即購買',
                            admin: {
                              description: '預設「立即購買」，可自訂為「前往選購」「搶先購買」等',
                            },
                          },
                          {
                            name: 'variant',
                            label: '按鈕樣式',
                            type: 'select',
                            required: true,
                            defaultValue: 'primary',
                            options: [
                              { label: '金色實心（主按鈕）', value: 'primary' },
                              {
                                label: '米色外框（次按鈕）',
                                value: 'secondary',
                              },
                            ],
                          },
                          {
                            name: 'fullWidth',
                            label: '整行寬度',
                            type: 'checkbox',
                            defaultValue: false,
                            admin: {
                              description: '勾選後按鈕會佔滿整行寬度，適合段落之間的強調 CTA',
                            },
                          },
                        ],
                      },
                      {
                        slug: 'emoticon',
                        labels: {
                          singular: '表情圖案',
                          plural: '表情圖案',
                        },
                        fields: [
                          {
                            name: 'image',
                            label: '選擇表情圖案',
                            type: 'upload',
                            relationTo: 'media',
                            required: true,
                            filterOptions: {
                              folderName: { equals: EMOTICON_FOLDER_NAME },
                            },
                            admin: {
                              description:
                                '只顯示從 PIXNET 相簿 117824267 搬入的表情圖案。',
                            },
                          },
                          {
                            name: 'displayWidth',
                            label: '表情圖案大小',
                            type: 'number',
                            min: 24,
                            max: 800,
                            defaultValue: 96,
                            required: true,
                            admin: {
                              step: 4,
                              description:
                                '可自由縮放 24–800px；手機版會自動限制在文章寬度內。',
                              components: {
                                Field: '@/components/admin/BlogImageSizeField',
                              },
                            },
                          },
                          {
                            name: 'displayAlignment',
                            label: '對齊方式',
                            type: 'select',
                            defaultValue: 'center',
                            required: true,
                            options: [
                              { label: '靠左', value: 'left' },
                              { label: '置中', value: 'center' },
                              { label: '靠右', value: 'right' },
                            ],
                          },
                        ],
                      },
                    ],
                  }),
                ],
              }),
              admin: {
                description:
                  '支援標題（H1–H6）、粗體 / 斜體 / 底線 / 刪除線、引言、條列、核取清單、超連結、' +
                  '表格、水平線、圖片、左右對齊與縮排。插入圖片後可編輯顯示寬度與對齊；' +
                  '頂部工具列永遠顯示，選取文字可叫出浮動選單。另可用「區塊」插入商品按鈕或表情圖案。',
              },
            },
            {
              name: 'featuredImage',
              label: '封面圖片',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: '顯示於文章列表及文章頁首圖；建議使用橫式照片。',
              },
            },
          ],
        },
        {
          label: '相簿與影音',
          description: '多圖相簿、置頂內容、影片與音訊',
          fields: [
            {
              name: 'gallery',
              label: '文章相簿',
              type: 'upload',
              relationTo: 'media',
              hasMany: true,
              admin: {
                description:
                  '可一次選擇多張已上傳圖片，操作方式接近 PIXNET 文章相簿。圖片也可直接插入上方文章內容。',
              },
            },
            // ── 釘選 / 影音 hero（PR: 品牌主題曲 blog post 用） ─────────────────
            {
              name: 'featured',
              label: '釘選在 /blog 頂部',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  '勾選後該文章會以大尺寸 hero card 顯示在 /blog 列表最頂部；只能釘選一篇',
              },
            },
            {
              name: 'heroVideo',
              label: 'Hero 影片（可選）',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  '上傳 MP4 後，blog/[slug] 頁頂會出現 lightbox 影片播放器；用於品牌 MV/主題曲',
              },
            },
            {
              name: 'heroAudio',
              label: 'Hero 音檔（可選）',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: '上傳 MP3 後，blog/[slug] 頁會在影片下方加入純音樂播放器',
              },
            },
            {
              name: 'lyrics',
              label: '歌詞（heroAudio 時可選）',
              type: 'textarea',
              admin: {
                description:
                  '只在文章中含 heroVideo / heroAudio 時顯示。直接貼入歌詞文字（保留換行），前台會用 monospace serif 排版',
                rows: 12,
              },
            },
            {
              name: 'mediaCredit',
              label: '影音署名 / Credit line',
              type: 'text',
              admin: { description: '例：作詞作曲 / 監製：Alan Miao' },
            },
          ],
        },
        {
          label: '分類與發佈',
          description: '作者、分類、標籤、同步及發佈狀態',
          fields: [
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
                { label: '時尚流行', value: 'fashion' },
                { label: '美容彩妝', value: 'beauty' },
                { label: '購物情報', value: 'shopping' },
                { label: '美食料理', value: 'food' },
                { label: '生活綜合', value: 'lifestyle' },
                { label: '親子育兒', value: 'parenting' },
                { label: '旅遊紀錄', value: 'travel' },
              ],
              admin: {
                description: '分類會顯示在文章列表與文章頁，選擇方式與 PIXNET 個人分類相同。',
              },
            },
            {
              type: 'collapsible',
              label: '發佈網站（務必確認）',
              admin: {
                description:
                  '未勾選＝只發佈在購物網站；勾選＝發佈至金老佛爺部落格 blog.kimlafayette.com。兩站文章分開管理。',
              },
              fields: [
                {
                  name: 'publishToKimLafayette',
                  label: '發佈到金老佛爺部落格 blog.kimlafayette.com',
                  type: 'checkbox',
                  defaultValue: false,
                  index: true,
                  admin: {
                    description:
                      '勾選後，只有「已發佈」狀態會出現在金老佛爺部落格；不勾選則保留為購物網站文章。',
                    components: {
                      Cell: '@/components/admin/BlogSyncCell',
                    },
                  },
                },
                {
                  name: 'sourceUrl',
                  label: '原始文章網址（選填）',
                  type: 'text',
                  admin: {
                    description:
                      'PIXNET 搬家文章可保留原始網址；新文章留空即可使用 Kim 部落格正式網址。',
                  },
                  validate: (value: unknown) => {
                    if (value == null || value === '') return true
                    try {
                      const url = new URL(String(value))
                      return url.protocol === 'https:' || url.protocol === 'http:'
                        ? true
                        : '網址必須使用 http 或 https'
                    } catch {
                      return '請輸入完整網址'
                    }
                  },
                },
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
                { label: '草稿（不公開）', value: 'draft' },
                { label: '已發佈', value: 'published' },
              ],
              admin: {
                description:
                  '建議先儲存草稿並完成檢查，再改為已發佈；仍需勾選 Kim 同步才會出現在正式部落格。',
                components: {
                  Cell: '@/components/admin/BlogStatusCell',
                },
              },
            },
            {
              name: 'publishedAt',
              label: '發佈日期',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: '設定文章顯示的發佈日期與時間。',
                components: {
                  Cell: '@/components/admin/BlogPublishedAtCell',
                },
              },
            },
          ],
        },
        {
          label: 'SEO',
          description: '搜尋結果標題、摘要與社群分享圖片',
          fields: [
            // ── SEO ──
            {
              name: 'seo',
              label: 'SEO 設定',
              type: 'group',
              fields: [
                { name: 'metaTitle', label: 'Meta 標題', type: 'text' },
                {
                  name: 'metaDescription',
                  label: 'Meta 描述',
                  type: 'textarea',
                },
                {
                  name: 'metaImage',
                  label: 'OG 圖片',
                  type: 'upload',
                  relationTo: 'media',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
