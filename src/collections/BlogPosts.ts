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
import { BlogImageResizeFeature } from '../components/admin/lexical/BlogImageResizeFeature'
import {
  evaluateImageRights,
  validateArticleImageVariant,
  type ImageRightsMetadata,
} from '../lib/blog/articleStudio'
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
        '可在文章畫布點選圖片後拖曳四角調整；此欄位可輸入精確像素值。',
      components: {
        Field: '@/components/admin/BlogImageSizeField',
      },
    },
  },
  {
    name: 'displayHeight',
    label: '圖片顯示高度',
    type: 'number',
    min: 1,
    max: 12000,
    admin: {
      hidden: true,
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
    defaultColumns: [
      'title',
      'category',
      'viewCount',
      'status',
      'publishToKimLafayette',
      'publishedAt',
    ],
    group: 'Ⓚ 金老佛爺部落格',
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
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const next = {
          ...((originalDoc || {}) as Record<string, unknown>),
          ...((data || {}) as Record<string, unknown>),
        }
        const studio =
          next.articleStudio && typeof next.articleStudio === 'object'
            ? (next.articleStudio as Record<string, unknown>)
            : null
        if (
          next.status !== 'published' ||
          studio?.generatedByStudio !== true
        ) {
          return data
        }

        const relationId = (value: unknown): number | string | null => {
          if (typeof value === 'number' || typeof value === 'string') return value
          if (value && typeof value === 'object') {
            const id = (value as { id?: unknown }).id
            if (typeof id === 'number' || typeof id === 'string') return id
          }
          return null
        }
        const gallery = Array.isArray(next.gallery) ? next.gallery : []
        const featuredImageId = relationId(next.featuredImage)
        const mediaIds = [
          featuredImageId,
          ...gallery.map(relationId),
        ].filter((value): value is number | string => value != null)
        const uniqueMediaIds = [...new Set(mediaIds.map(String))]
        if (uniqueMediaIds.length === 0) {
          throw new Error('自動文章至少需要一張已確認來源的圖片才能發布。')
        }

        const mediaDocs = await Promise.all(
          uniqueMediaIds.map((id) =>
            req.payload.findByID({
              collection: 'media',
              id,
              depth: 0,
            }),
          ),
        )
        const errors = mediaDocs.flatMap((media, index) => {
          const rights =
            media.usageRights && typeof media.usageRights === 'object'
              ? (media.usageRights as Record<string, unknown>)
              : {}
          const decision = evaluateImageRights({
            creator:
              typeof rights.creator === 'string' ? rights.creator : undefined,
            evidenceUrl:
              typeof rights.evidenceUrl === 'string'
                ? rights.evidenceUrl
                : undefined,
            licenseKind:
              typeof rights.licenseKind === 'string'
                ? rights.licenseKind
                : 'unknown',
            licenseUrl:
              typeof rights.licenseUrl === 'string'
                ? rights.licenseUrl
                : undefined,
            promotionalUseAllowed: rights.promotionalUseAllowed === true,
            sourceLabel:
              typeof rights.sourceLabel === 'string'
                ? rights.sourceLabel
                : undefined,
            sourceUrl:
              typeof rights.sourceUrl === 'string'
                ? rights.sourceUrl
                : undefined,
          } as ImageRightsMetadata)
          const isFeatured =
            featuredImageId != null &&
            String(media.id) === String(featuredImageId)
          const forcedSizeValid = isFeatured
            ? validateArticleImageVariant('hero', media).valid
            : validateArticleImageVariant('member', media).valid ||
              validateArticleImageVariant('story', media).valid
          return [
            ...(decision.allowed
              ? []
              : [`圖片 ${index + 1}：${decision.reason}`]),
            ...(forcedSizeValid
              ? []
              : [
                  `圖片 ${index + 1}：缺少實際 800px／1000px 部落格版本，請重新上傳。`,
                ]),
          ]
        })
        if (errors.length > 0) {
          throw new Error(
            `自動文章仍有圖片授權待確認，請先保留草稿：${errors.join('；')}`,
          )
        }
        return data
      },
    ],
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
              admin: {
                description:
                  '顯示在文章列表的簡短說明；http / https 網址會自動變成可點擊連結。',
              },
            },
            {
              type: 'collapsible',
              label: '摘要團購按鈕',
              admin: {
                description:
                  '可在文章摘要下方顯示購買按鈕；點擊成效會出現在部落格流量儀表板。',
                initCollapsed: true,
              },
              fields: [
                {
                  name: 'excerptCtaEnabled',
                  label: '顯示團購購買按鈕',
                  type: 'checkbox',
                  defaultValue: false,
                },
                {
                  name: 'excerptCtaLabel',
                  label: '按鈕文字',
                  type: 'text',
                  defaultValue: '立即購買',
                  admin: {
                    condition: (_, siblingData) =>
                      Boolean(siblingData?.excerptCtaEnabled),
                    description: '例如：立即選購 ME30',
                  },
                },
                {
                  name: 'excerptCtaUrl',
                  label: '購買頁面網址',
                  type: 'text',
                  admin: {
                    condition: (_, siblingData) =>
                      Boolean(siblingData?.excerptCtaEnabled),
                    description: '必須是完整的 http 或 https 網址。',
                  },
                  validate: (
                    value: unknown,
                    { data }: { data?: Record<string, unknown> },
                  ) => {
                    if (value == null || value === '') {
                      return data?.excerptCtaEnabled
                        ? '啟用團購按鈕時必須填寫購買頁面網址'
                        : true
                    }
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
              type: 'row',
              admin: {
                className: 'kim-blog-editor-layout',
              },
              fields: [
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
                  BlogImageResizeFeature(),
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
                        admin: {
                          components: {
                            Block: '@/components/admin/EmoticonResizeBlock',
                          },
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
                                '在文章畫布點選表情圖案後，可拖曳四角自由縮放；此欄位可輸入精確像素值。',
                              components: {
                                Field: '@/components/admin/BlogImageSizeField',
                              },
                            },
                          },
                          {
                            name: 'displayHeight',
                            label: '表情圖案顯示高度',
                            type: 'number',
                            min: 1,
                            max: 12000,
                            admin: {
                              hidden: true,
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
                    width: '72%',
                    className: 'kim-blog-editor-canvas',
                    description:
                      '支援標題（H1–H6）、粗體 / 斜體 / 底線 / 刪除線、引言、條列、核取清單、超連結、' +
                      '表格、水平線、圖片、左右對齊與縮排。插入圖片後，點選圖片即可拖曳四角縮放；' +
                      '頂部工具列永遠顯示，選取文字可叫出浮動選單。另可用「區塊」插入商品按鈕或表情圖案。',
                  },
                },
                {
                  type: 'collapsible',
                  label: '文章設定',
                  admin: {
                    width: '28%',
                    className: 'kim-blog-editor-settings',
                    initCollapsed: false,
                  },
                  fields: [
                    {
                      name: 'featuredImage',
                      label: '封面圖片',
                      type: 'upload',
                      relationTo: 'media',
                      admin: {
                        description: '顯示於文章列表及文章頁首圖；建議使用橫式照片。',
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
                    {
                      name: 'viewCount',
                      label: '閱讀次數',
                      type: 'number',
                      min: 0,
                      defaultValue: 0,
                      index: true,
                      admin: {
                        description:
                          '顯示在金老佛爺部落格文章旁，可手動輸入 PIXNET 原始人氣或校正數字。',
                      },
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
                        { label: '時尚流行', value: 'fashion' },
                        { label: '美容彩妝', value: 'beauty' },
                        { label: '購物情報', value: 'shopping' },
                        { label: '美食料理', value: 'food' },
                        { label: '生活綜合', value: 'lifestyle' },
                        { label: '親子育兒', value: 'parenting' },
                        { label: '旅遊紀錄', value: 'travel' },
                        { label: 'KPOP 男團介紹', value: 'kpop-boy-groups' },
                        { label: 'KPOP 女團介紹', value: 'kpop-girl-groups' },
                      ],
                    },
                    {
                      name: 'publishToKimLafayette',
                      label: '發佈到金老佛爺部落格',
                      type: 'checkbox',
                      defaultValue: false,
                      index: true,
                      admin: {
                        description:
                          '勾選＝blog.kimlafayette.com；不勾選＝購物網站部落格。兩站文章分開管理。',
                        components: {
                          Cell: '@/components/admin/BlogSyncCell',
                        },
                      },
                    },
                    {
                      name: 'status',
                      label: '文章狀態',
                      type: 'select',
                      required: true,
                      defaultValue: 'draft',
                      options: [
                        { label: '草稿（不公開）', value: 'draft' },
                        { label: '已發佈', value: 'published' },
                      ],
                      admin: {
                        components: {
                          Cell: '@/components/admin/BlogStatusCell',
                        },
                      },
                    },
                  ],
                },
              ],
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
          label: '自動文章紀錄',
          description: '文章模板、查核來源、圖片權利與下架聯絡資訊',
          fields: [
            {
              name: 'articleStudio',
              label: '自動文章工具',
              type: 'group',
              fields: [
                {
                  name: 'generatedByStudio',
                  label: '由自動文章工具建立',
                  type: 'checkbox',
                  defaultValue: false,
                  index: true,
                },
                {
                  name: 'templateKey',
                  label: '文章模板',
                  type: 'select',
                  options: [
                    { label: '金老佛爺時尚文章', value: 'fashion' },
                    { label: 'KPOP 男團介紹', value: 'kpop-boy-group' },
                    { label: 'KPOP 女團介紹', value: 'kpop-girl-group' },
                  ],
                },
                {
                  name: 'researchCheckedAt',
                  label: '資料最後查核時間',
                  type: 'date',
                  admin: {
                    date: { pickerAppearance: 'dayAndTime' },
                  },
                },
                {
                  name: 'researchSources',
                  label: '資料來源',
                  type: 'array',
                  fields: [
                    {
                      name: 'label',
                      label: '來源名稱',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'url',
                      label: '來源網址',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'provider',
                      label: '來源類型',
                      type: 'select',
                      defaultValue: 'manual',
                      options: [
                        { label: '官方來源', value: 'official' },
                        { label: 'Wikipedia', value: 'wikipedia' },
                        { label: 'Wikidata', value: 'wikidata' },
                        { label: '人工補充', value: 'manual' },
                      ],
                    },
                  ],
                },
                {
                  name: 'takedownEmail',
                  label: '圖片下架聯絡信箱',
                  type: 'email',
                  defaultValue: 'service@chickimmiu.com',
                },
                {
                  name: 'rightsNotice',
                  label: '圖片用途與下架說明',
                  type: 'textarea',
                  defaultValue:
                    '本文圖片用於團體介紹與宣傳資訊整理，圖片權利歸原權利人所有。如您為權利人並認為使用不妥，請來信告知，我們將儘速確認並下架。',
                  admin: {
                    rows: 4,
                    description:
                      '此說明是聯絡與處理機制，不取代圖片授權。',
                  },
                },
              ],
            },
          ],
        },
        {
          label: '進階設定',
          description: '文章標籤與舊站來源',
          fields: [
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
          ],
        },
        {
          label: 'SEO',
          description: '搜尋結果標題、摘要與社群分享圖片',
          fields: [
            {
              name: 'seoGenerator',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/admin/BlogSeoGenerator',
                },
              },
            },
            // ── SEO ──
            {
              name: 'seo',
              label: 'SEO 設定',
              type: 'group',
              fields: [
                {
                  name: 'metaTitle',
                  label: 'Meta 標題',
                  type: 'text',
                  maxLength: 60,
                },
                {
                  name: 'metaDescription',
                  label: 'Meta 描述',
                  type: 'textarea',
                  maxLength: 160,
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
