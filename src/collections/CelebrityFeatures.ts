import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * Celebrity Features — 藝人媒體曝光（CKMU ON SHOW）
 * ─────────────────────────────────────────────────
 * 後台直接 CRUD 18+ 位媒體曝光藝人，每筆獨立卡片，含：
 *   - 姓名 / 節目 / 形象照
 *   - tagline 一句介紹（卡片副標）
 *   - bio 藝人簡介（hover 浮現）
 *   - brandQuote CKMU 致敬詞（hover 浮現的好聽話）
 *   - 連結：PDP 商品 / 自訂 URL / 不可點
 *
 * 渲染：透過 Pages.layout 的 `celebrity-grid` block 自動載入 status=published
 *      的藝人 sort by sortOrder asc，asyncly 在 server component 中 query。
 *
 * Hooks：afterChange/afterDelete revalidate `/pages/ckmu-on-show`
 *        + 未來 Stage 2 個別 `/pages/ckmu-on-show-{slug}` 子頁。
 */

function revalidateCKMUOnShow(slug?: string | null) {
  const paths = ['/pages/ckmu-on-show']
  if (slug) paths.push(`/celebrity/${slug}`)
  safeRevalidate(paths, ['celebrity-features'])
}

export const CelebrityFeatures: CollectionConfig = {
  slug: 'celebrity-features',
  labels: { singular: '藝人媒體曝光', plural: '藝人媒體曝光' },
  admin: {
    group: '⑥ 內容與頁面',
    useAsTitle: 'name',
    defaultColumns: ['photo', 'name', 'program', 'sortOrder', 'status'],
    description:
      'CKMU ON SHOW 媒體曝光牆 — 後台新增/編輯/刪除藝人卡片；status=published 才會顯示在前台',
    listSearchableFields: ['name', 'program'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user && (user as unknown as Record<string, unknown>).role === 'admin') return true
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
        revalidateCKMUOnShow(slug)
        if (prevSlug && prevSlug !== slug) revalidateCKMUOnShow(prevSlug)
      },
    ],
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidateCKMUOnShow(slug)
      },
    ],
  },
  fields: [
    // ── 基本資料 ─────────────────────────────────────────────
    {
      name: 'slug',
      label: '網址代碼（子頁 URL）',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          '專屬頁面 URL 為 /celebrity/{slug}。建議用編號或姓名拼音，例：01、02、chenmeifeng',
      },
    },
    {
      name: 'name',
      label: '藝人姓名',
      type: 'text',
      required: true,
      admin: { description: '中文姓名，會顯示在卡片大字' },
    },
    {
      name: 'program',
      label: '節目 / 媒體',
      type: 'text',
      required: true,
      admin: { description: '例：美鳳有約、東森新聞台。會顯示為卡片上的小字 tag' },
    },
    {
      name: 'photo',
      label: '形象照',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: { description: '建議 3:4 直幅構圖、人物清晰；上傳後會自動產縮圖' },
    },
    {
      name: 'tagline',
      label: '一句介紹（顯示在名字下方）',
      type: 'text',
      admin: {
        description: '7-12 字精煉短句。例：「國民阿姐的優雅日常」、「主播台的精準氣場」',
      },
    },
    {
      name: 'bio',
      label: '藝人/節目介紹',
      type: 'textarea',
      admin: {
        description: '30-50 字短文，hover 卡片時浮現。介紹節目背景或藝人特色',
      },
    },
    {
      name: 'brandQuote',
      label: 'CKMU 致敬詞（好聽的話）',
      type: 'textarea',
      admin: {
        description: '20-30 字 CKMU 風格致敬詞，hover 時浮現。把藝人特色與 CKMU 服飾連結起來',
      },
    },

    // ── 導購連結 ─────────────────────────────────────────────
    {
      name: 'linkType',
      label: '卡片點擊連結類型',
      type: 'select',
      required: true,
      defaultValue: 'pdp',
      options: [
        { label: '連商品 PDP（精準導購）', value: 'pdp' },
        { label: '連自訂 URL（分類頁 / 活動頁 / 外部）', value: 'url' },
        { label: '不可點（純展示形象代言）', value: 'none' },
      ],
    },
    {
      name: 'linkedProduct',
      label: '對應商品（linkType=pdp 時使用）',
      type: 'relationship',
      relationTo: 'products',
      admin: {
        condition: (data) => data?.linkType === 'pdp',
        description: '點擊卡片直跳該商品 PDP',
      },
    },
    {
      name: 'linkUrl',
      label: '自訂連結 URL（linkType=url 時使用）',
      type: 'text',
      admin: {
        condition: (data) => data?.linkType === 'url',
        description: '例：/category/dresses、/pages/ckmu-on-show-01、外部 https://...',
      },
    },

    // ── 排序與狀態 ───────────────────────────────────────────
    {
      name: 'sortOrder',
      label: '排序權重',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: '數字越小越前面（0,1,2,...）；同數字依 createdAt 倒序',
      },
    },
    {
      name: 'status',
      label: '發佈狀態',
      type: 'select',
      required: true,
      defaultValue: 'published',
      options: [
        { label: '草稿（前台不顯示）', value: 'draft' },
        { label: '已發佈', value: 'published' },
      ],
    },

    // ── 整輯穿搭照（Stage 2 — 從原 Shopline 子頁搬遷） ────────
    {
      name: 'galleryImages',
      label: '節目穿搭整輯照片（原 Shopline 子頁全部照片）',
      type: 'array',
      admin: {
        description:
          '該檔節目藝人穿著 CKMU 的完整照片庫 — 上傳藝人於節目中的形象照、穿搭組合、商品 try-on 照等。子頁 /celebrity/{slug} 會以 masonry 網格展示。',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'image',
          label: '照片',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          label: '說明文字（可選）',
          type: 'text',
          admin: { description: '例：節目片段、商品名、穿搭組合' },
        },
        {
          name: 'linkedProduct',
          label: '對應商品（可選）',
          type: 'relationship',
          relationTo: 'products',
          admin: { description: '點圖跳該商品 PDP；留空就只是純展示' },
        },
      ],
    },

    // ── 社群連結（互惠導流） ─────────────────────────────────
    {
      name: 'socialLinks',
      label: '藝人社群連結（互惠導流給藝人）',
      type: 'array',
      admin: {
        description:
          '加上藝人的 IG / FB / YouTube 連結，會顯示在專屬子頁底部 — 替藝人導流回去，建立合作關係',
      },
      fields: [
        {
          name: 'platform',
          label: '平台',
          type: 'select',
          required: true,
          options: [
            { label: 'Instagram', value: 'instagram' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'Threads', value: 'threads' },
            { label: 'LINE', value: 'line' },
            { label: '個人網站 / 部落格', value: 'website' },
          ],
        },
        { name: 'url', label: '完整網址', type: 'text', required: true },
        {
          name: 'handle',
          label: '顯示名（可選）',
          type: 'text',
          admin: { description: '例：@chickimmiu、Sophia Ting；留空就顯示平台名' },
        },
      ],
    },

    // ── Admin 備註 ──────────────────────────────────────────
    {
      name: 'adminNote',
      label: '後台備註',
      type: 'textarea',
      admin: { description: '只在後台可見，例：合作授權狀態、節目播出日期等內部記錄' },
    },
  ],
  timestamps: true,
}
