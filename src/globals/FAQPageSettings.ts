import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * FAQ 頁面設定
 * ───────────
 * 管理常見問題分類與問答內容，支援分類 icon、排序
 */
export const FAQPageSettings: GlobalConfig = {
  slug: 'faq-page-settings',
  label: '常見問題 FAQ',
  admin: {
    group: '頁面管理',
    description: '管理常見問題頁面的分類與問答內容',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        safeRevalidate(['/faq'])
      },
    ],
  },
  fields: [
    // ── Hero ──
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
        },
        {
          name: 'title',
          label: '主標題',
          type: 'text',
          defaultValue: '常見問題',
        },
        {
          name: 'description',
          label: '描述文字',
          type: 'text',
          defaultValue: '快速找到您需要的答案',
        },
      ],
    },

    // ── FAQ Categories ──
    {
      name: 'categories',
      label: 'FAQ 分類',
      type: 'array',
      minRows: 1,
      maxRows: 12,
      admin: {
        description: '常見問題分類，每個分類下可新增多個問答',
      },
      fields: [
        {
          name: 'icon',
          label: '圖示',
          type: 'select',
          required: true,
          options: [
            { label: '🛍️ 購物袋 (訂購)', value: 'shopping-bag' },
            { label: '🚚 配送車 (配送)', value: 'truck' },
            { label: '🔄 退換 (退換貨)', value: 'rotate-ccw' },
            { label: '💳 信用卡 (付款)', value: 'credit-card' },
            { label: '⭐ 星星 (會員)', value: 'star' },
            { label: '🎁 禮物 (其他)', value: 'gift' },
            { label: '❓ 問號 (一般)', value: 'help-circle' },
            { label: '💬 對話 (客服)', value: 'message-circle' },
            { label: '📦 包裝 (包裝)', value: 'package' },
            { label: '🏷️ 標籤 (優惠)', value: 'tag' },
          ],
        },
        {
          name: 'title',
          label: '分類名稱',
          type: 'text',
          required: true,
        },
        {
          name: 'items',
          label: '問答內容',
          type: 'array',
          minRows: 1,
          fields: [
            {
              name: 'question',
              label: '問題',
              type: 'text',
              required: true,
            },
            {
              name: 'richAnswer',
              label: '回答（圖文編輯）',
              type: 'richText',
              admin: {
                description: '支援粗體、連結、圖片等格式。若此欄位有內容，將優先使用。',
              },
            },
            {
              name: 'answer',
              label: '回答（純文字備用）',
              type: 'textarea',
              admin: {
                description: '純文字版本。若上方圖文欄位有內容，將優先顯示圖文版。',
              },
            },
          ],
        },
      ],
    },

    // ── Contact CTA ──
    {
      name: 'contactCta',
      label: '聯繫客服區塊',
      type: 'group',
      fields: [
        {
          name: 'title',
          label: '標題',
          type: 'text',
          defaultValue: '還是找不到答案？',
        },
        {
          name: 'description',
          label: '描述',
          type: 'textarea',
          defaultValue: '歡迎直接聯繫我們的客服團隊，我們很樂意為您解答任何問題。',
        },
      ],
    },

    // ── SEO ──
    {
      name: 'seo',
      label: 'SEO 設定',
      type: 'group',
      fields: [
        {
          name: 'title',
          label: '頁面標題',
          type: 'text',
          defaultValue: '常見問題 FAQ',
        },
        {
          name: 'description',
          label: 'Meta Description',
          type: 'textarea',
          defaultValue: '關於 CHIC KIM & MIU 的訂購流程、付款方式、配送時間、退換貨政策等常見問題解答。',
        },
      ],
    },
  ],
}
