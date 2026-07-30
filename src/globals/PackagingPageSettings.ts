import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * PackagingPageSettings — /packaging（商品包裝）頁的可編輯內容。
 *
 * 比照 PolicyPagesSettings 的慣例：前台 src/app/(frontend)/packaging/page.tsx
 * 讀此 global 渲染，欄位 defaultValue = 原本寫死的文案，所以：
 *   - 後台表單一打開就是現有內容（非空白），可直接改。
 *   - global 從未存過時 findGlobal 回 defaultValue，前台畫面零變化。
 *   - 前台另包 try/catch fallback（見 page.tsx），table 還沒 migrate 也不會壞。
 *
 * Hero 背景圖用 text URL（現況是外部 shoplineimg 連結），避免 upload 關聯表，
 * 也方便直接貼圖網址。
 */

const ICON_OPTIONS = [
  { label: '✨ 閃亮 (Sparkles)', value: 'Sparkles' },
  { label: '🛡️ 盾牌 (ShieldCheck)', value: 'ShieldCheck' },
  { label: '🍃 葉子 (Leaf)', value: 'Leaf' },
  { label: '🎁 禮物 (Gift)', value: 'Gift' },
  { label: '📦 包裹 (Package)', value: 'Package' },
  { label: '♻️ 回收 (Recycle)', value: 'Recycle' },
  { label: '❤️ 愛心 (Heart)', value: 'Heart' },
  { label: '⭐ 星星 (Star)', value: 'Star' },
]

export const PackagingPageSettings: GlobalConfig = {
  slug: 'packaging-page-settings',
  label: '商品包裝頁',
  admin: {
    group: '⑥ 內容與頁面',
    description: '管理前台「商品包裝」頁（/packaging）的所有文案與特色卡、出貨流程內容',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        safeRevalidate(['/packaging'])
      },
    ],
  },
  fields: [
    {
      name: 'hero',
      label: '頁首主視覺 (Hero)',
      type: 'group',
      fields: [
        {
          name: 'backgroundImageUrl',
          label: '背景圖網址',
          type: 'text',
          defaultValue:
            'https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png',
          admin: { description: '可貼任何圖片網址；建議寬版橫圖。' },
        },
        { name: 'eyebrow', label: '上方小標 (英文)', type: 'text', defaultValue: 'Packaging' },
        { name: 'title', label: '主標題', type: 'text', defaultValue: '商品包裝' },
        {
          name: 'subtitle',
          label: '副標題',
          type: 'text',
          defaultValue: '精心包裝每一份心意，從拆封的那一刻開始享受',
        },
      ],
    },
    {
      name: 'philosophy',
      label: '包裝理念',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: '上方小標 (英文)', type: 'text', defaultValue: 'Philosophy' },
        { name: 'heading', label: '標題', type: 'text', defaultValue: '包裝理念' },
        {
          name: 'body',
          label: '內文（每空一行為一段）',
          type: 'textarea',
          defaultValue:
            '在 CKMU，我們相信包裝不只是保護商品的外衣，更是品牌與顧客之間的第一次觸感溝通。從包裝設計、材質選擇到封裝流程，每一個環節都經過用心規劃，希望您收到包裹時，能感受到我們對品質的堅持與對您的重視。\n\n同時，我們持續優化包裝方式，在維持商品保護力的前提下，盡可能減少不必要的包材，選用環保可回收材質，為永續發展盡一份心力。',
        },
      ],
    },
    {
      name: 'features',
      label: '包裝特色',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: '上方小標 (英文)', type: 'text', defaultValue: 'Features' },
        { name: 'heading', label: '標題', type: 'text', defaultValue: '包裝特色' },
        {
          name: 'items',
          label: '特色卡',
          type: 'array',
          admin: { description: '每張卡片：圖示 + 標題 + 說明。' },
          defaultValue: [
            { icon: 'Sparkles', title: '品牌專屬包裝', description: '每件商品均使用 CKMU 品牌專屬包裝袋/盒，燙金 Logo 設計，從拆封的第一刻起就感受品牌質感。' },
            { icon: 'ShieldCheck', title: '防護與保護', description: '服飾以獨立防塵袋包裝，搭配防潮紙、氣泡袋等保護材料，確保商品在運送過程中不受損傷。' },
            { icon: 'Leaf', title: '環保材質', description: '包裝材料優先選用可回收、可分解的環保材質，減少塑膠使用量，為地球盡一份心力。' },
            { icon: 'Gift', title: '禮物包裝服務', description: '提供加購禮物包裝服務，精美禮盒搭配緞帶與小卡，送禮更有心意。下單時備註即可。' },
            { icon: 'Package', title: '出貨檢查', description: '每筆訂單出貨前均經過品質檢查，確認商品完整性、尺寸正確性，附上出貨明細與售後說明卡。' },
            { icon: 'Recycle', title: '包裝回收', description: '鼓勵顧客將包裝材料回收再利用。品牌包裝袋可作為日常收納使用，延續它的生命週期。' },
          ],
          fields: [
            { name: 'icon', label: '圖示', type: 'select', options: ICON_OPTIONS, defaultValue: 'Sparkles' },
            { name: 'title', label: '標題', type: 'text', required: true },
            { name: 'description', label: '說明', type: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      name: 'process',
      label: '出貨流程',
      type: 'group',
      fields: [
        { name: 'eyebrow', label: '上方小標 (英文)', type: 'text', defaultValue: 'Process' },
        { name: 'heading', label: '標題', type: 'text', defaultValue: '出貨流程' },
        {
          name: 'steps',
          label: '流程步驟',
          type: 'array',
          defaultValue: [
            { step: '01', title: '品質檢查', description: '專員逐件檢查商品品質、顏色、尺寸是否與訂單一致。' },
            { step: '02', title: '獨立包裝', description: '每件服飾以防塵袋獨立包裝，避免交叉染色與摩擦。' },
            { step: '03', title: '保護填充', description: '使用環保填充材料固定商品位置，防止運送中碰撞。' },
            { step: '04', title: '品牌封裝', description: 'CKMU 品牌包裝袋/盒封裝，附上出貨明細與感謝卡。' },
            { step: '05', title: '安心出貨', description: '交由合作物流，提供即時追蹤碼，讓您掌握包裹動態。' },
          ],
          fields: [
            { name: 'step', label: '步驟編號', type: 'text', required: true, admin: { description: "例：01" } },
            { name: 'title', label: '標題', type: 'text', required: true },
            { name: 'description', label: '說明', type: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      name: 'giftCta',
      label: '禮物包裝 CTA',
      type: 'group',
      fields: [
        { name: 'heading', label: '標題', type: 'text', defaultValue: '禮物包裝服務' },
        {
          name: 'description',
          label: '說明',
          type: 'textarea',
          defaultValue:
            '送禮給重要的人？我們提供精美禮物包裝加購服務。結帳時於備註欄填寫「禮物包裝」，我們將為您的商品換上專屬禮盒、緞帶與祝福小卡。',
        },
        { name: 'badgeText', label: '價格標籤文字', type: 'text', defaultValue: '加購禮物包裝 NT$ 80 / 件' },
      ],
    },
    {
      name: 'seo',
      label: 'SEO',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta Title', type: 'text', defaultValue: '商品包裝' },
        {
          name: 'metaDescription',
          label: 'Meta Description',
          type: 'textarea',
          defaultValue: 'CHIC KIM & MIU 商品包裝說明 — 了解我們精心設計的包裝細節與環保理念。',
        },
      ],
    },
  ],
}
