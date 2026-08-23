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
    group: '⑥ 內容與頁面',
    description: '管理首頁所有區塊的內容與顯示設定。「即時預覽」分頁 = 左邊改、右邊立刻看到歡迎頁效果。',
    // livePreview 統一在 payload.config.ts 頂層 admin.livePreview 註冊
    // （⑥ 內容與頁面全數納入）；/ 封面的打字級同步在 CoverView useLivePreview。
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        // 首頁所有區塊由 HomepageSettings 驅動，存檔後失效首頁快取
        // （/ 封面與 /home 都吃這份 global）
        safeRevalidate(['/', '/home'])
      },
    ],
  },
  fields: [
    // ── 歡迎頁（/ 封面）──（2026-08-23 需求：後台可自行設定大圖/大影片）
    {
      name: 'coverPage',
      label: '歡迎頁（/ 封面）',
      type: 'group',
      admin: {
        description:
          '進站第一眼的展示封面：極簡 header + 大圖或大影片，點任何區域進 /home 賣場首頁。素材未設定時自動用內建品牌影片與輪播圖，不會開天窗。🎨 推薦用「畫布編輯器」直接在版面上點著改：/cover-editor（需以後台帳號登入）。',
      },
      fields: [
        {
          name: 'heroMode',
          label: '主視覺型式',
          type: 'select',
          defaultValue: 'video',
          options: [
            { label: '大影片', value: 'video' },
            { label: '大圖', value: 'image' },
          ],
        },
        {
          name: 'heroVideo',
          label: '主視覺影片（桌機建議 16:9）',
          type: 'upload',
          relationTo: 'media',
          admin: { description: '型式選「大影片」時使用；未設定用內建品牌影片' },
        },
        {
          name: 'heroVideoMobile',
          label: '主視覺影片（手機建議 9:16）',
          type: 'upload',
          relationTo: 'media',
          admin: { description: '未設定用內建手機版品牌影片' },
        },
        {
          name: 'heroImage',
          label: '主視覺大圖',
          type: 'upload',
          relationTo: 'media',
          admin: { description: '型式選「大圖」時使用；未設定 fallback 下方輪播橫幅第一張' },
        },
        // ── 展示媒體牆（LV collection 式，2026-08-23 需求）──
        {
          name: 'sections',
          label: '展示媒體牆（由上而下）',
          type: 'array',
          maxRows: 20,
          admin: {
            description:
              'Hero 下方的展示區塊，像 LV 系列頁那樣一列一列排。每列選「整幅」放 1 格、或「左右雙欄」放 2 格；每格都可以放圖片或影片（自動判別）。沒設定任何列時，會用下面的「預設雙欄」+ 形象 banner 圖組出精簡版。',
            initCollapsed: true,
          },
          fields: [
            {
              name: 'layout',
              label: '版型',
              type: 'select',
              defaultValue: 'full',
              options: [
                { label: '整幅（一格滿版）', value: 'full' },
                { label: '左右雙欄（兩格）', value: 'split' },
              ],
            },
            {
              name: 'media',
              label: '素材（整幅／雙欄左）',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: { description: '圖片或影片皆可（影片自動靜音循環播放）' },
            },
            {
              name: 'mediaRight',
              label: '素材（雙欄右）',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: '版型選「左右雙欄」時使用',
                condition: (_data, siblingData) => siblingData?.layout === 'split',
              },
            },
            {
              name: 'heading',
              label: '區塊標題（選填）',
              type: 'text',
              admin: { description: 'chuu 式大標，顯示在該列上方（例：New In / Editorial / Lookbook）' },
            },
            {
              name: 'caption',
              label: '疊字（選填）',
              type: 'text',
              admin: { description: '顯示在該列左下角的小字，例如系列名稱' },
            },
          ],
        },
        {
          name: 'sideImage',
          label: '預設雙欄：照片（左）',
          type: 'upload',
          relationTo: 'media',
          admin: { description: '上面媒體牆沒設定列時的預設雙欄照片；未設定用輪播第二張或新品圖' },
        },
        {
          name: 'sideVideo',
          label: '預設雙欄：影片（右）',
          type: 'upload',
          relationTo: 'media',
          admin: { description: '預設雙欄影片；未設定用內建品牌直式影片' },
        },
      ],
    },

    // ── Hero 版型覆寫 ──
    {
      name: 'heroLayoutOverride',
      label: 'Hero 版型覆寫',
      type: 'select',
      defaultValue: 'inherit',
      admin: {
        description: '保持「沿用主題」可讓主題（春/夏/秋/冬）切換時 hero 版型自動跟著換；若想固定某一版型不受主題影響，選下面 4 個之一。',
      },
      options: [
        { label: '沿用主題設定', value: 'inherit' },
        { label: 'Split — 左文右圖', value: 'split' },
        { label: 'Editorial — 全幅 + 左下標題', value: 'editorial' },
        { label: 'Cinematic — 全幅 + 中央 + 黑色 bar', value: 'cinematic' },
        { label: 'Magazine — 全幅 + 金色細框', value: 'magazine' },
      ],
    },

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
          // 任何 legacy 或不合法值（如舊資料裡的 'latest'）自愈為 'auto'，
          // 避免使用者在編輯其他欄位時因這個欄位值不在 options 白名單內而被擋下。
          // 只要使用者按一次儲存，DB 即被正規化。
          hooks: {
            beforeValidate: [
              ({ value }) => (value === 'auto' || value === 'manual' ? value : 'auto'),
            ],
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
