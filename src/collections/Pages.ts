import type { CollectionConfig, Block } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

// SSR consumer (as of Phase 5.1 Batch 3, 2026-04-16):
//   - /pages/[slug]  (src/app/(frontend)/pages/[slug]/page.tsx) — uses getPayload().find()
// Full-route cache is invalidated via revalidatePath.
function revalidateCustomPage(slug?: string | null) {
  if (!slug) return
  safeRevalidate([`/pages/${slug}`], ['pages'])
}

/* ================================================================
   Block 定義 — 活動一頁式網頁的模組化 Section Builder
   ================================================================ */

const HeroBanner: Block = {
  slug: 'hero-banner',
  labels: { singular: '主視覺橫幅', plural: '主視覺橫幅' },
  fields: [
    { name: 'heading', label: '主標題', type: 'text', required: true },
    { name: 'subheading', label: '副標題', type: 'text' },
    { name: 'backgroundImage', label: '背景圖片', type: 'upload', relationTo: 'media' },
    { name: 'ctaText', label: 'CTA 按鈕文字', type: 'text' },
    { name: 'ctaLink', label: 'CTA 連結', type: 'text' },
    {
      name: 'overlay',
      label: '背景遮罩透明度（%）',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 30,
    },
  ],
}

const RichContent: Block = {
  slug: 'rich-content',
  labels: { singular: '富文字區塊', plural: '富文字區塊' },
  fields: [
    { name: 'content', label: '內容', type: 'richText', required: true },
  ],
}

const ImageGallery: Block = {
  slug: 'image-gallery',
  labels: { singular: '圖片展示', plural: '圖片展示' },
  fields: [
    {
      name: 'layout',
      label: '版面配置',
      type: 'select',
      defaultValue: 'grid',
      options: [
        { label: '網格', value: 'grid' },
        { label: '輪播', value: 'carousel' },
        { label: '瀑布流', value: 'masonry' },
      ],
    },
    {
      name: 'images',
      label: '圖片',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'image', label: '圖片', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', label: '說明', type: 'text' },
        { name: 'link', label: '連結', type: 'text' },
      ],
    },
  ],
}

const ProductShowcase: Block = {
  slug: 'product-showcase',
  labels: { singular: '精選商品', plural: '精選商品' },
  fields: [
    { name: 'heading', label: '標題', type: 'text' },
    {
      name: 'products',
      label: '商品',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
    },
    {
      name: 'displayStyle',
      label: '顯示方式',
      type: 'select',
      defaultValue: 'grid',
      options: [
        { label: '網格', value: 'grid' },
        { label: '輪播', value: 'carousel' },
      ],
    },
  ],
}

const CallToAction: Block = {
  slug: 'cta',
  labels: { singular: '行動呼籲 CTA', plural: '行動呼籲 CTA' },
  fields: [
    { name: 'heading', label: '標題', type: 'text', required: true },
    { name: 'description', label: '說明文字', type: 'textarea' },
    { name: 'buttonText', label: '按鈕文字', type: 'text', required: true },
    { name: 'buttonLink', label: '按鈕連結', type: 'text', required: true },
    { name: 'backgroundImage', label: '背景圖片', type: 'upload', relationTo: 'media' },
    {
      name: 'style',
      label: '樣式',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: '主要（金色）', value: 'primary' },
        { label: '次要（米白）', value: 'secondary' },
        { label: '深色', value: 'dark' },
      ],
    },
  ],
}

const FAQ: Block = {
  slug: 'faq',
  labels: { singular: '常見問答', plural: '常見問答' },
  fields: [
    { name: 'heading', label: '標題', type: 'text', defaultValue: '常見問題' },
    {
      name: 'questions',
      label: '問答',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'question', label: '問題', type: 'text', required: true },
        { name: 'answer', label: '回答', type: 'richText', required: true },
      ],
    },
  ],
}

const Testimonial: Block = {
  slug: 'testimonial',
  labels: { singular: '顧客見證', plural: '顧客見證' },
  fields: [
    { name: 'heading', label: '標題', type: 'text', defaultValue: '顧客好評' },
    {
      name: 'testimonials',
      label: '見證',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'name', label: '姓名', type: 'text', required: true },
        { name: 'content', label: '評價內容', type: 'textarea', required: true },
        { name: 'avatar', label: '頭像', type: 'upload', relationTo: 'media' },
        { name: 'rating', label: '評分（1-5）', type: 'number', min: 1, max: 5 },
      ],
    },
  ],
}

const Countdown: Block = {
  slug: 'countdown',
  labels: { singular: '倒數計時', plural: '倒數計時' },
  fields: [
    { name: 'heading', label: '標題', type: 'text', required: true },
    { name: 'description', label: '說明', type: 'text' },
    { name: 'endDate', label: '結束時間', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'backgroundImage', label: '背景圖片', type: 'upload', relationTo: 'media' },
    { name: 'ctaText', label: 'CTA 按鈕文字', type: 'text' },
    { name: 'ctaLink', label: 'CTA 連結', type: 'text' },
  ],
}

const VideoEmbed: Block = {
  slug: 'video',
  labels: { singular: '影片嵌入', plural: '影片嵌入' },
  fields: [
    { name: 'url', label: '影片網址', type: 'text', required: true, admin: { description: 'YouTube 或 Vimeo 網址' } },
    { name: 'caption', label: '說明文字', type: 'text' },
  ],
}

const Divider: Block = {
  slug: 'divider',
  labels: { singular: '分隔線 / 留白', plural: '分隔線 / 留白' },
  fields: [
    {
      name: 'style',
      label: '樣式',
      type: 'select',
      defaultValue: 'line',
      options: [
        { label: '線條', value: 'line' },
        { label: '留白', value: 'space' },
        { label: '裝飾線', value: 'ornament' },
      ],
    },
    { name: 'height', label: '高度（px）', type: 'number', defaultValue: 40 },
  ],
}

/* ────────────────────────────────────────────────────────────────
   Magazine 類 blocks（PR #136 新增 — 真實雜誌風視覺差異化）
   對應 migration 20260427_220000_add_pages_magazine_blocks.ts
   ──────────────────────────────────────────────────────────────── */

const MagazineCover: Block = {
  slug: 'magazine-cover',
  labels: { singular: '雜誌封面 Hero', plural: '雜誌封面 Hero' },
  fields: [
    {
      name: 'issueLabel',
      label: '上方期號小標（可選）',
      type: 'text',
      admin: {
        description:
          '頁面最上方主視覺。含人物臉部的圖建議選「左右分欄」layout；純風景圖才用「覆蓋」layout。期號例：ISSUE 04 · APR 2026 / CKMU ON SHOW',
      },
    },
    { name: 'heading', label: '主標題（大字）', type: 'text', required: true },
    { name: 'subheading', label: '副標題（一行）', type: 'text' },
    {
      name: 'image',
      label: '封面主圖',
      type: 'upload',
      relationTo: 'media',
      admin: { description: '左右分欄 layout 建議直幅 3:4 或 4:5；覆蓋 layout 建議橫幅 16:9' },
    },
    {
      name: 'cornerLabels',
      label: '邊角小字（僅覆蓋 layout 顯示）',
      type: 'array',
      fields: [{ name: 'text', type: 'text', required: true }],
    },
    {
      name: 'layout',
      label: '排版風格',
      type: 'select',
      defaultValue: 'banner',
      options: [
        {
          label: '完整 Banner 圖（推薦：圖本身已含品牌文字 / Logo / 標語）',
          value: 'banner',
        },
        {
          label: '左圖右文（建議：純人物肖像，無文字疊上）',
          value: 'split-left',
        },
        {
          label: '左文右圖（建議：純人物肖像，無文字疊上）',
          value: 'split-right',
        },
        { label: '圖片覆蓋全寬・左對齊文字（雜誌風）', value: 'left' },
        { label: '圖片覆蓋全寬・置中文字（典雅）', value: 'center' },
        { label: '圖片覆蓋全寬・底部對齊（Vogue 式）', value: 'bottom' },
      ],
      admin: {
        description:
          '⚠️ 圖中已含文字/品牌 → 用「Banner」；純人物肖像 → 用「分欄」；風景/抽象 → 用「覆蓋」',
      },
    },
    {
      name: 'theme',
      label: '色調',
      type: 'select',
      defaultValue: 'light',
      options: [
        { label: '淺色（米白）', value: 'light' },
        { label: '深色（黑底）', value: 'dark' },
        { label: '金色點綴', value: 'gold' },
      ],
    },
    {
      name: 'objectPosition',
      label: '圖片裁切焦點（僅覆蓋 layout 用）',
      type: 'select',
      defaultValue: 'center',
      options: [
        { label: '置中', value: 'center' },
        { label: '上方（人臉在圖片上半部用此）', value: 'top' },
        { label: '下方', value: 'bottom' },
        { label: '左', value: 'left' },
        { label: '右', value: 'right' },
      ],
      admin: { description: '只在「圖片覆蓋全寬」三種 layout 下生效；分欄 layout 圖會完整呈現不裁切' },
    },
  ],
}

const PullQuote: Block = {
  slug: 'pull-quote',
  labels: { singular: '大引言', plural: '大引言' },
  fields: [
    { name: 'quote', label: '引言文字', type: 'textarea', required: true },
    { name: 'source', label: '出處 / 作者', type: 'text' },
    {
      name: 'font',
      label: '字體',
      type: 'select',
      defaultValue: 'serif',
      options: [
        { label: '襯線（典雅）', value: 'serif' },
        { label: '無襯線（俐落）', value: 'sans' },
      ],
    },
    {
      name: 'alignment',
      label: '對齊',
      type: 'select',
      defaultValue: 'center',
      options: [
        { label: '左對齊', value: 'left' },
        { label: '置中', value: 'center' },
        { label: '右對齊', value: 'right' },
      ],
    },
  ],
}

const EditorialSpread: Block = {
  slug: 'editorial-spread',
  labels: { singular: '圖文交錯', plural: '圖文交錯' },
  fields: [
    { name: 'heading', label: '區塊標題（可選）', type: 'text' },
    {
      name: 'rows',
      label: '段落',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'image', label: '圖片', type: 'upload', relationTo: 'media' },
        { name: 'heading', label: '小標題', type: 'text' },
        { name: 'body', label: '內容', type: 'richText' },
        {
          name: 'imagePosition',
          label: '圖片位置',
          type: 'select',
          defaultValue: 'left',
          options: [
            { label: '左圖 / 右文', value: 'left' },
            { label: '右圖 / 左文', value: 'right' },
            { label: '上圖 / 下文', value: 'top' },
            { label: '全寬背景', value: 'full' },
          ],
        },
        {
          name: 'background',
          label: '背景色',
          type: 'select',
          defaultValue: 'cream',
          options: [
            { label: '米白', value: 'cream' },
            { label: '純白', value: 'white' },
            { label: '深色', value: 'dark' },
            { label: '粉紅', value: 'blush' },
          ],
        },
      ],
    },
  ],
}

const LookbookGrid: Block = {
  slug: 'lookbook-grid',
  labels: { singular: 'Lookbook 網格', plural: 'Lookbook 網格' },
  fields: [
    { name: 'heading', label: '區塊標題', type: 'text' },
    {
      name: 'columns',
      label: '欄數',
      type: 'select',
      defaultValue: '3',
      options: [
        { label: '2 欄', value: '2' },
        { label: '3 欄', value: '3' },
        { label: '4 欄', value: '4' },
      ],
    },
    {
      name: 'items',
      label: '單品',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'image', label: '主圖', type: 'upload', relationTo: 'media', required: true },
        { name: 'name', label: '名稱', type: 'text' },
        {
          name: 'tags',
          label: '標籤',
          type: 'array',
          fields: [{ name: 'text', type: 'text', required: true }],
        },
        {
          name: 'linkedProduct',
          label: '對應商品（可選）',
          type: 'relationship',
          relationTo: 'products',
        },
        {
          name: 'linkUrl',
          label: '自訂連結（優先於對應商品）',
          type: 'text',
          admin: {
            description: '若想連到分類頁、活動頁、外部網址等非商品 URL，填這裡；留空時 fallback 用上面的對應商品。例：/category/dresses、/pages/ckmu-on-show-01',
          },
        },
      ],
    },
  ],
}

const KOLPersona: Block = {
  slug: 'kol-persona',
  labels: { singular: 'KOL 個人介紹', plural: 'KOL 個人介紹' },
  fields: [
    { name: 'avatar', label: '頭像', type: 'upload', relationTo: 'media' },
    { name: 'name', label: '名稱', type: 'text', required: true },
    {
      name: 'title',
      label: '稱號',
      type: 'text',
      admin: { description: '如：時尚編輯 / 風格達人 / @ig_handle' },
    },
    { name: 'bio', label: 'Bio 介紹', type: 'richText' },
    { name: 'signatureQuote', label: '招牌引言', type: 'textarea' },
    {
      name: 'socialLinks',
      label: '社群連結',
      type: 'array',
      fields: [
        {
          name: 'platform',
          label: '平台',
          type: 'select',
          required: true,
          options: [
            { label: 'Instagram', value: 'instagram' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'Threads', value: 'threads' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'LINE', value: 'line' },
            { label: '個人網站', value: 'website' },
          ],
        },
        { name: 'url', label: '網址', type: 'text', required: true },
      ],
    },
  ],
}

const CelebrityGrid: Block = {
  slug: 'celebrity-grid',
  labels: { singular: '藝人媒體曝光牆', plural: '藝人媒體曝光牆' },
  fields: [
    {
      name: 'heading',
      label: '區塊標題',
      type: 'text',
      admin: { description: '例：CKMU ON SHOW · 18 位藝人穿搭' },
    },
    {
      name: 'subheading',
      label: '區塊副標',
      type: 'text',
      admin: { description: '例：點圖直跳同款商品。形象代言會浮現品牌致敬詞' },
    },
    {
      name: 'columns',
      label: '欄數（桌面版）',
      type: 'select',
      defaultValue: '4',
      options: [
        { label: '3 欄', value: '3' },
        { label: '4 欄', value: '4' },
        { label: '5 欄', value: '5' },
      ],
      admin: { description: '行動裝置固定 2 欄' },
    },
    {
      name: 'showBioOnHover',
      label: 'Hover 顯示介紹文案',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: '勾選後滑鼠移到卡片浮現 bio + brandQuote；關掉只顯示姓名+節目' },
    },
    {
      name: 'maxItems',
      label: '最多顯示幾筆',
      type: 'number',
      admin: { description: '留空 = 全部 status=published 的藝人；填數字 = 取前 N 筆（按 sortOrder asc）' },
    },
  ],
}

/* ================================================================
   Pages Collection
   ================================================================ */

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: '頁面', plural: '頁面' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'updatedAt'],
    group: '⑥ 內容與頁面',
    description: '活動一頁式網頁（模組化 Section Builder）— 五種快速樣板可一鍵建立',
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/PageTemplatePicker',
        },
      ],
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
        revalidateCustomPage(slug)
        if (prevSlug && prevSlug !== slug) revalidateCustomPage(prevSlug)
      },
    ],
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidateCustomPage(slug)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      label: '頁面標題',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: '網址代碼',
      type: 'text',
      required: true,
      unique: true,
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
      name: 'layout',
      label: '頁面區塊',
      type: 'blocks',
      blocks: [
        HeroBanner,
        MagazineCover,
        PullQuote,
        EditorialSpread,
        LookbookGrid,
        CelebrityGrid,
        KOLPersona,
        RichContent,
        ImageGallery,
        ProductShowcase,
        CallToAction,
        FAQ,
        Testimonial,
        Countdown,
        VideoEmbed,
        Divider,
      ],
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
