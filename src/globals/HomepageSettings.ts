import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { safeRevalidate } from '../lib/revalidate'

/**
 * 首頁設定 Global
 * ---------------
 * 管理首頁所有區塊的內容：輪播、快捷選單、服務亮點、品牌橫幅、穿搭誌、電子報等
 * 商品區塊（新品、熱銷）由系統自動抓取，此處僅控制顯示參數
 */
export const HomepageSettings: GlobalConfig = {
  slug: 'homepage-settings',
  label: '首頁設定',
  admin: {
    group: '頁面管理',
    description: '管理首頁所有區塊的內容與顯示設定',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        // 首頁所有區塊由 HomepageSettings 驅動，存檔後失效首頁快取
        safeRevalidate(['/'])
      },
    ],
  },
  fields: [
    // ── 輪播橫幅 ──
    {
      name: 'heroBanners',
      label: '輪播橫幅',
      type: 'array',
      minRows: 1,
      maxRows: 8,
      admin: {
        description: '首頁頂部輪播圖片，建議至少3張。若未設定則自動使用最新商品圖片。',
        initCollapsed: false,
      },
      fields: [
        { name: 'image', label: '圖片', type: 'upload', relationTo: 'media', required: true },
        { name: 'title', label: '標題文字', type: 'text' },
        { name: 'subtitle', label: '副標題', type: 'text' },
        { name: 'link', label: '連結網址', type: 'text', defaultValue: '/products' },
        { name: 'ctaText', label: '按鈕文字', type: 'text', defaultValue: '立即選購' },
      ],
    },

    // ── 快捷選單 ──
    {
      name: 'quickMenu',
      label: '快捷選單',
      type: 'array',
      minRows: 2,
      maxRows: 6,
      admin: {
        description: '輪播下方的快捷入口按鈕（建議4個）',
        initCollapsed: true,
      },
      fields: [
        { name: 'label', label: '名稱', type: 'text', required: true },
        { name: 'href', label: '連結', type: 'text', required: true },
        {
          name: 'icon',
          label: '圖示',
          type: 'select',
          defaultValue: 'Sparkles',
          options: [
            { label: '✨ 閃亮 (Sparkles)', value: 'Sparkles' },
            { label: '👑 皇冠 (Crown)', value: 'Crown' },
            { label: '🎮 遊戲 (Gamepad2)', value: 'Gamepad2' },
            { label: '🎁 禮物 (Gift)', value: 'Gift' },
            { label: '👥 好友 (Users)', value: 'Users' },
            { label: '🛍️ 購物袋 (ShoppingBag)', value: 'ShoppingBag' },
            { label: '❤️ 愛心 (Heart)', value: 'Heart' },
            { label: '🏷️ 標籤 (Tag)', value: 'Tag' },
            { label: '🔥 火焰 (Flame)', value: 'Flame' },
            { label: '⭐ 星星 (Star)', value: 'Star' },
          ],
        },
        { name: 'color', label: '圖示顏色 CSS', type: 'text', defaultValue: 'text-gold-500', admin: { description: '例如 text-gold-500、text-pink-500、text-purple-500' } },
      ],
    },

    // ── 服務亮點 ──
    {
      name: 'serviceHighlights',
      label: '服務亮點',
      type: 'array',
      minRows: 1,
      maxRows: 6,
      admin: {
        description: '快捷選單下方的服務特色橫條（建議4個）',
        initCollapsed: true,
      },
      fields: [
        { name: 'label', label: '標題', type: 'text', required: true },
        { name: 'desc', label: '說明', type: 'text' },
        {
          name: 'icon',
          label: '圖示',
          type: 'select',
          defaultValue: 'Truck',
          options: [
            { label: '🚚 貨車 (Truck)', value: 'Truck' },
            { label: '🔄 退換 (RefreshCw)', value: 'RefreshCw' },
            { label: '🛡️ 安全 (Shield)', value: 'Shield' },
            { label: '✨ 閃亮 (Sparkles)', value: 'Sparkles' },
            { label: '❤️ 愛心 (Heart)', value: 'Heart' },
            { label: '📦 包裝 (Package)', value: 'Package' },
            { label: '⏰ 時鐘 (Clock)', value: 'Clock' },
            { label: '🌍 全球 (Globe)', value: 'Globe' },
          ],
        },
      ],
    },

    // ── 新品上市區塊 ──
    {
      name: 'newProductsSection',
      label: '新品上市區塊',
      type: 'group',
      admin: { description: '自動抓取最新商品，此處控制顯示參數' },
      fields: [
        { name: 'tag', label: '英文標籤', type: 'text', defaultValue: 'NEW IN' },
        { name: 'title', label: '中文標題', type: 'text', defaultValue: '新品上市' },
        { name: 'href', label: '查看全部連結', type: 'text', defaultValue: '/products?tag=new' },
        { name: 'limit', label: '顯示數量', type: 'number', defaultValue: 8, min: 4, max: 16 },
        { name: 'visible', label: '顯示此區塊', type: 'checkbox', defaultValue: true },
      ],
    },

    // ── 熱銷推薦區塊 ──
    {
      name: 'hotProductsSection',
      label: '熱銷推薦區塊',
      type: 'group',
      admin: { description: '自動抓取熱銷商品（isHot 標記），此處控制顯示參數' },
      fields: [
        { name: 'tag', label: '英文標籤', type: 'text', defaultValue: 'BEST SELLERS' },
        { name: 'title', label: '中文標題', type: 'text', defaultValue: '熱銷推薦' },
        { name: 'href', label: '查看全部連結', type: 'text', defaultValue: '/products?tag=hot' },
        { name: 'limit', label: '顯示數量', type: 'number', defaultValue: 8, min: 4, max: 16 },
        { name: 'visible', label: '顯示此區塊', type: 'checkbox', defaultValue: true },
      ],
    },

    // ── 品牌形象橫幅 ──
    {
      name: 'brandBanner',
      label: '品牌形象橫幅',
      type: 'group',
      fields: [
        { name: 'visible', label: '顯示此區塊', type: 'checkbox', defaultValue: true },
        { name: 'image', label: '背景圖片', type: 'upload', relationTo: 'media' },
        { name: 'tagline', label: '小標籤', type: 'text', defaultValue: 'SPECIAL EVENT' },
        { name: 'title', label: '主標題', type: 'textarea', defaultValue: '專屬你美好的\n時尚優雅' },
        { name: 'subtitle', label: '副標題', type: 'text', defaultValue: '精選百件春夏商品限時特惠，搶購你的命定單品！' },
        { name: 'ctaText', label: '按鈕文字', type: 'text', defaultValue: '立即搶購' },
        { name: 'ctaLink', label: '按鈕連結', type: 'text', defaultValue: '/products?tag=sale' },
      ],
    },

    // ── 穿搭誌區塊 ──
    {
      name: 'styleJournalSection',
      label: '穿搭誌區塊',
      type: 'group',
      admin: { description: '預設自動抓取最新部落格文章，也可手動指定精選文章' },
      fields: [
        { name: 'visible', label: '顯示此區塊', type: 'checkbox', defaultValue: true },
        { name: 'tag', label: '英文標籤', type: 'text', defaultValue: 'STYLE JOURNAL' },
        { name: 'title', label: '中文標題', type: 'text', defaultValue: '穿搭誌' },
        { name: 'href', label: '查看全部連結', type: 'text', defaultValue: '/blog' },
        {
          name: 'mode',
          label: '內容來源',
          type: 'select',
          defaultValue: 'auto',
          // 允許 null — 防止舊 global 記錄缺少此欄位時觸發 validation error
          validate: (val: unknown) => {
            if (!val || val === 'auto' || val === 'manual') return true
            return '請選擇「自動」或「手動精選」'
          },
          options: [
            { label: '自動（最新文章）', value: 'auto' },
            { label: '手動精選', value: 'manual' },
          ],
        },
        {
          name: 'manualPosts',
          label: '手動精選文章',
          type: 'array',
          maxRows: 6,
          admin: {
            condition: (_, siblingData) => siblingData?.mode === 'manual',
            description: '手動選擇要在首頁顯示的文章',
          },
          fields: [
            { name: 'post', label: '文章', type: 'relationship', relationTo: 'blog-posts', required: true },
          ],
        },
        { name: 'limit', label: '顯示數量', type: 'number', defaultValue: 3, min: 1, max: 6 },
      ],
    },

    // ── UGC 穿搭靈感區塊 ──
    {
      name: 'ugcSection',
      label: '穿搭靈感（UGC）區塊',
      type: 'group',
      fields: [
        { name: 'visible', label: '顯示此區塊', type: 'checkbox', defaultValue: true },
        { name: 'maxItems', label: '顯示數量', type: 'number', defaultValue: 6, min: 3, max: 12 },
      ],
    },

    // ── 電子報訂閱區塊 ──
    {
      name: 'newsletterSection',
      label: '電子報訂閱區塊',
      type: 'group',
      fields: [
        { name: 'visible', label: '顯示此區塊', type: 'checkbox', defaultValue: true },
        { name: 'tag', label: '英文標籤', type: 'text', defaultValue: 'STAY CONNECTED' },
        { name: 'title', label: '中文標題', type: 'text', defaultValue: '訂閱最新消息' },
        { name: 'subtitle', label: '副標題', type: 'text', defaultValue: '搶先收到新品上市、限時優惠與專屬會員好禮通知' },
        { name: 'placeholder', label: '輸入欄位提示', type: 'text', defaultValue: 'your@email.com' },
        { name: 'buttonText', label: '按鈕文字', type: 'text', defaultValue: '訂閱' },
      ],
    },

    // ── SEO 設定 ──
    {
      name: 'seo',
      label: 'SEO 設定',
      type: 'group',
      admin: { description: '首頁的搜尋引擎優化設定' },
      fields: [
        { name: 'metaTitle', label: 'Meta 標題', type: 'text', defaultValue: 'CHIC KIM & MIU ｜ 韓系質感女裝' },
        { name: 'metaDescription', label: 'Meta 描述', type: 'textarea', defaultValue: '探索 CHIC KIM & MIU 精選韓系質感女裝，專屬你的時尚優雅。' },
        { name: 'ogImage', label: 'OG 圖片', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}
