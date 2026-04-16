import type { GlobalConfig, Field } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 政策頁面設定
 * ────────────
 * 統一管理「服務條款」「隱私權政策」「退換貨政策」「購物說明」等法規/說明頁面
 */

const policySectionFields: Field[] = [
  {
    name: 'title',
    label: '章節標題',
    type: 'text',
    required: true,
    admin: { width: '100%' },
  },
  {
    name: 'richContent',
    label: '段落內容（圖文編輯）',
    type: 'richText',
    admin: {
      description: '支援粗體、連結、圖片等格式。若此欄位有內容，將優先使用。',
    },
  },
  {
    name: 'content',
    label: '段落內容（純文字備用）',
    type: 'textarea',
    admin: {
      description: '純文字版本。若上方圖文欄位有內容，將優先顯示圖文版。',
    },
  },
  {
    name: 'items',
    label: '條列項目',
    type: 'array',
    admin: {
      description: '有序清單項目（會顯示編號圓圈）',
    },
    fields: [
      {
        name: 'text',
        label: '項目內容',
        type: 'text',
        required: true,
      },
    ],
  },
]

function policyPageGroup(name: string, label: string, enLabel: string): Field {
  return {
    name,
    label,
    type: 'group',
    admin: {
      description: `「${label}」頁面的內容設定`,
    },
    fields: [
      {
        name: 'pageTitle',
        label: '頁面標題',
        type: 'text',
        defaultValue: label,
      },
      {
        name: 'enTitle',
        label: '英文副標題',
        type: 'text',
        defaultValue: enLabel,
      },
      {
        name: 'effectiveDate',
        label: '生效日期',
        type: 'text',
        admin: { description: '例如：2026年4月12日' },
      },
      {
        name: 'version',
        label: '版本號',
        type: 'text',
        defaultValue: '1.0',
      },
      {
        name: 'sections',
        label: '內容章節',
        type: 'array',
        minRows: 1,
        fields: policySectionFields,
      },
      {
        name: 'seoTitle',
        label: 'SEO 頁面標題',
        type: 'text',
        defaultValue: label,
      },
      {
        name: 'seoDescription',
        label: 'SEO Meta Description',
        type: 'textarea',
      },
    ],
  }
}

export const PolicyPagesSettings: GlobalConfig = {
  slug: 'policy-pages-settings',
  label: '政策與說明頁面',
  admin: {
    group: '頁面管理',
    description: '管理服務條款、隱私權政策、退換貨政策、購物說明等頁面內容',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        // 4 個 section 都在同一個 global，存檔後 4 條路徑都要失效
        // 注意：/packaging 是純靜態頁（hardcoded const），不吃這個 global
        safeRevalidate(['/terms', '/privacy-policy', '/return-policy', '/shopping-guide'])
      },
    ],
  },
  fields: [
    policyPageGroup('terms', '服務條款', 'Terms of Service'),
    policyPageGroup('privacyPolicy', '隱私權政策', 'Privacy Policy'),
    policyPageGroup('returnPolicy', '退換貨政策', 'Return & Exchange Policy'),
    policyPageGroup('shoppingGuide', '購物說明', 'Shopping Guide'),
  ],
}
