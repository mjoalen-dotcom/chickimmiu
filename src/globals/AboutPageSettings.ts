import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * 關於我們頁面設定
 * ──────────────
 * 管理品牌故事、品牌理念、品牌歷程、聯繫資訊等區塊
 */
export const AboutPageSettings: GlobalConfig = {
  slug: 'about-page-settings',
  label: '關於我們',
  admin: {
    group: '頁面管理',
    description: '管理「關於我們 / 商店介紹」頁面的所有區塊內容',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    // ── Hero Banner ──
    {
      name: 'hero',
      label: '頂部橫幅',
      type: 'group',
      fields: [
        {
          name: 'image',
          label: '背景圖片',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: '建議尺寸 1920×600 以上，橫幅圖片',
          },
        },
        {
          name: 'subtitle',
          label: '英文副標題',
          type: 'text',
          defaultValue: 'About Us',
        },
        {
          name: 'title',
          label: '主標題',
          type: 'text',
          defaultValue: '商店介紹',
        },
        {
          name: 'description',
          label: '描述文字',
          type: 'text',
          defaultValue: 'Chic, Kind & Mindful — 為每位女性打造優雅與可愛兼具的穿搭風格',
        },
      ],
    },

    // ── Brand Story ──
    {
      name: 'brandStory',
      label: '品牌故事',
      type: 'group',
      fields: [
        {
          name: 'title',
          label: '標題',
          type: 'text',
          defaultValue: '品牌故事',
        },
        {
          name: 'content',
          label: '內容',
          type: 'richText',
          admin: {
            description: '品牌故事的完整內容，支援粗體、連結等格式',
          },
        },
        {
          name: 'contentFallback',
          label: '純文字內容（若未填 richText）',
          type: 'textarea',
          admin: {
            description: '如不需要富文本格式，可在此輸入純文字。系統優先使用上方 richText 欄位。',
          },
        },
      ],
    },

    // ── Brand Values ──
    {
      name: 'brandValues',
      label: '品牌理念',
      type: 'array',
      minRows: 1,
      maxRows: 8,
      admin: {
        description: '品牌核心價值，建議 3-6 個',
      },
      fields: [
        {
          name: 'icon',
          label: '圖示',
          type: 'select',
          required: true,
          options: [
            { label: '✨ 精選品質 (Sparkles)', value: 'sparkles' },
            { label: '🌏 全球 (Globe)', value: 'globe' },
            { label: '❤️ 愛心 (Heart)', value: 'heart' },
            { label: '👥 用戶 (Users)', value: 'users' },
            { label: '🛡️ 盾牌 (Shield)', value: 'shield' },
            { label: '🚚 配送 (Truck)', value: 'truck' },
            { label: '⭐ 星星 (Star)', value: 'star' },
            { label: '🎁 禮物 (Gift)', value: 'gift' },
            { label: '💎 鑽石 (Gem)', value: 'gem' },
            { label: '🏆 獎盃 (Trophy)', value: 'trophy' },
          ],
        },
        {
          name: 'title',
          label: '標題',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          label: '說明',
          type: 'textarea',
          required: true,
        },
      ],
    },

    // ── Brand Timeline ──
    {
      name: 'timeline',
      label: '品牌歷程',
      type: 'array',
      admin: {
        description: '品牌里程碑時間軸，依時間排序',
      },
      fields: [
        {
          name: 'year',
          label: '年份',
          type: 'text',
          required: true,
          admin: { width: '20%' },
        },
        {
          name: 'title',
          label: '標題',
          type: 'text',
          required: true,
          admin: { width: '30%' },
        },
        {
          name: 'description',
          label: '說明',
          type: 'textarea',
          required: true,
          admin: { width: '50%' },
        },
      ],
    },

    // ── Contact CTA ──
    {
      name: 'contactCta',
      label: '聯繫我們區塊',
      type: 'group',
      fields: [
        {
          name: 'title',
          label: '標題',
          type: 'text',
          defaultValue: '與我們聯繫',
        },
        {
          name: 'description',
          label: '描述',
          type: 'textarea',
          defaultValue: '無論是商品諮詢、合作洽談、還是穿搭建議，歡迎隨時透過以下方式聯繫我們。',
        },
        {
          name: 'buttons',
          label: '按鈕',
          type: 'array',
          maxRows: 4,
          fields: [
            {
              name: 'label',
              label: '按鈕文字',
              type: 'text',
              required: true,
            },
            {
              name: 'url',
              label: '連結',
              type: 'text',
              required: true,
            },
            {
              name: 'style',
              label: '樣式',
              type: 'select',
              defaultValue: 'outline',
              options: [
                { label: 'LINE 綠色', value: 'line' },
                { label: '邊框白色', value: 'outline' },
              ],
            },
            {
              name: 'external',
              label: '外部連結',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
      ],
    },

    // ── SEO ──
    {
      name: 'seo',
      label: 'SEO 設定',
      type: 'group',
      admin: {
        description: '此頁面的搜尋引擎優化設定',
      },
      fields: [
        {
          name: 'title',
          label: '頁面標題',
          type: 'text',
          defaultValue: '商店介紹',
        },
        {
          name: 'description',
          label: 'Meta Description',
          type: 'textarea',
          defaultValue: '認識 CHIC KIM & MIU — 源自韓國的精緻女裝品牌，為每位女性打造優雅與可愛兼具的穿搭風格。',
        },
      ],
    },
  ],
}
