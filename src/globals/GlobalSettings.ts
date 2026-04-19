import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { revalidateLayout } from '../lib/revalidate'

/**
 * 全站設定 Global
 * ---------------
 * 管理客服、追蹤碼、金流、Cookie 同意、運費等全站通用設定
 * 所有設定皆可在後台 CRUD 調整
 */
export const GlobalSettings: GlobalConfig = {
  slug: 'global-settings',
  label: '全站設定',
  admin: {
    description: '管理全站通用設定：客服、追蹤碼、金流、Cookie 同意等',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        // 客服資訊 / 追蹤碼 / Cookie banner / 金流 在全站 layout 使用
        revalidateLayout()
      },
    ],
  },
  fields: [
    // ── 網站基本資訊 ──
    {
      name: 'site',
      label: '網站基本資訊',
      type: 'group',
      fields: [
        {
          name: 'sitePreview',
          type: 'ui',
          admin: {
            components: {
              Field: '@/components/admin/SiteBrandPreview',
            },
          },
        },
        { name: 'siteName', label: '網站名稱', type: 'text', defaultValue: 'CHIC KIM & MIU' },
        { name: 'siteDescription', label: '網站描述', type: 'textarea', defaultValue: '融合高級極簡優雅與韓系可愛活力的台灣女裝品牌' },
        {
          name: 'logo',
          label: '網站 Logo',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              '顯示於前台 header 與後台 top-nav。建議橫式比例：480-800 × 96-160 像素。' +
              '優先使用 SVG（可任意放大不失真）或透明 PNG；JPG / WebP 亦可。',
          },
        },
        {
          name: 'favicon',
          label: 'Favicon',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              '瀏覽器分頁圖示。建議 32×32 或 64×64 像素的 .ico（多尺寸最佳）或 .png。' +
              '亦會顯示於後台 sidebar 收合時的小圖示。',
          },
        },
        {
          name: 'appleTouchIcon',
          label: 'Apple Touch Icon',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              'iPhone / iPad「加入主畫面」書籤圖示。建議 180×180 像素 PNG，' +
              '背景需為不透明（iOS 不支援透明背景）。',
          },
        },
        {
          name: 'ogImage',
          label: '預設社群分享圖片（OG Image）',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              '頁面未自訂分享圖時的預設圖片。建議 1200×630 像素（2:1 比例），JPG 或 PNG，' +
              '檔案大小建議 < 1 MB 以利 Facebook / X / LINE 預覽載入。',
          },
        },
      ],
    },

    // ── SEO 通用設定 ──
    {
      name: 'seo',
      label: 'SEO 通用設定',
      type: 'group',
      admin: { description: '網頁標題、關鍵字、搜尋引擎驗證碼等全站 SEO 設定' },
      fields: [
        { name: 'titleTemplate', label: '網頁標題模板', type: 'text', defaultValue: '%s｜CHIC KIM & MIU', admin: { description: '各頁面標題格式，%s 會被頁面標題取代。例如：%s｜CHIC KIM & MIU' } },
        { name: 'defaultTitle', label: '首頁標題', type: 'text', defaultValue: 'CHIC KIM & MIU｜韓系質感女裝｜靚秀國際', admin: { description: '首頁（無頁面標題時）的完整 SEO 標題' } },
        { name: 'metaDescription', label: '全站預設描述', type: 'textarea', defaultValue: '融合高級極簡優雅與韓系可愛活力的台灣女裝品牌，米白／米杏／金色調，包容性尺碼，打造每一位女性的日常優雅。', admin: { description: '搜尋結果中顯示的網站描述（建議 60-160 字）' } },
        {
          name: 'keywords',
          label: '全站關鍵字',
          type: 'textarea',
          defaultValue: '韓系女裝,質感穿搭,韓國女裝,名媛風洋裝,通勤穿搭,約會穿搭,直播選品,台灣女裝品牌,CHIC KIM & MIU,靚秀國際,包容性尺碼,春夏女裝,秋冬女裝,韓風洋裝,氣質女裝',
          admin: { description: '逗號分隔的 SEO 關鍵字，用於 meta keywords 標籤' },
        },
        { name: 'author', label: '網站作者', type: 'text', defaultValue: 'CHIC KIM & MIU｜靚秀國際有限公司' },
        {
          name: 'googleSiteVerification',
          label: 'Google Search Console 驗證碼',
          type: 'text',
          admin: { description: '從 Google Search Console 取得的驗證碼（不含 meta 標籤，僅填入 content 值）' },
        },
        {
          name: 'bingSiteVerification',
          label: 'Bing Webmaster 驗證碼',
          type: 'text',
          admin: { description: '從 Bing Webmaster Tools 取得的驗證碼' },
        },
        {
          name: 'naverSiteVerification',
          label: 'Naver Webmaster 驗證碼',
          type: 'text',
          admin: { description: '（可選）Naver 搜尋引擎驗證碼' },
        },
      ],
    },

    // ── 社群連結 ──
    {
      name: 'socialLinks',
      label: '社群媒體連結',
      type: 'group',
      admin: { description: '品牌社群連結，用於 Schema.org 結構化資料及頁尾顯示' },
      fields: [
        { name: 'instagram', label: 'Instagram', type: 'text', admin: { description: '完整網址，例如 https://www.instagram.com/chickimmiu' } },
        { name: 'facebook', label: 'Facebook', type: 'text', admin: { description: '完整網址，例如 https://www.facebook.com/chickimmiu' } },
        { name: 'line', label: 'LINE 官方帳號連結', type: 'text' },
        { name: 'youtube', label: 'YouTube', type: 'text' },
        { name: 'tiktok', label: 'TikTok', type: 'text' },
        { name: 'shopee', label: '蝦皮賣場', type: 'text' },
      ],
    },

    // ── 公司/商家資訊（Schema.org 用）──
    {
      name: 'businessInfo',
      label: '公司 / 商家資訊',
      type: 'group',
      admin: { description: '用於 Google 商家結構化資料、發票、頁尾等' },
      fields: [
        { name: 'legalName', label: '公司全名', type: 'text', defaultValue: '靚秀國際有限公司' },
        { name: 'taxId', label: '統一編號', type: 'text', defaultValue: '24540533' },
        { name: 'phone', label: '客服電話', type: 'text', defaultValue: '02-2718-9488' },
        { name: 'email', label: '客服信箱', type: 'text' },
        { name: 'address', label: '公司地址', type: 'text', defaultValue: '台北市基隆路一段68號9樓' },
        { name: 'businessHours', label: '營業時間', type: 'text', defaultValue: '週一至週五 09:30-18:00' },
      ],
    },
    // ── 客服設定 ──
    {
      name: 'customerService',
      label: '客服設定',
      type: 'group',
      fields: [
        {
          name: 'lineOaId',
          label: 'LINE Official Account ID',
          type: 'text',
          admin: { description: '用於右下角 LINE 客服按鈕' },
        },
        {
          name: 'lineOaUrl',
          label: 'LINE 加好友連結',
          type: 'text',
          admin: { description: '例如 https://lin.ee/xxxxxxx' },
        },
        {
          name: 'metaPageId',
          label: 'Meta (Facebook) Page ID',
          type: 'text',
          admin: { description: '用於 Messenger Plugin' },
        },
        {
          name: 'metaAppId',
          label: 'Meta App ID',
          type: 'text',
          admin: { description: 'Messenger Plugin 所需的 App ID' },
        },
        {
          name: 'enableLineWidget',
          label: '啟用 LINE 客服按鈕',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'enableMessenger',
          label: '啟用 Messenger Plugin',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
    // ── 廣告追蹤 ──
    {
      name: 'tracking',
      label: '廣告追蹤碼',
      type: 'group',
      fields: [
        { name: 'gtmId', label: 'Google Tag Manager ID', type: 'text', admin: { description: '例如 GTM-XXXXXXX' } },
        { name: 'metaPixelId', label: 'Meta Pixel ID', type: 'text' },
        { name: 'metaCapiToken', label: 'Meta CAPI Token', type: 'text', admin: { description: 'Conversions API 存取權杖' } },
        { name: 'ga4Id', label: 'GA4 Measurement ID', type: 'text', admin: { description: '例如 G-XXXXXXXXXX' } },
        { name: 'googleAdsId', label: 'Google Ads ID', type: 'text', admin: { description: '例如 AW-XXXXXXXXX' } },
        { name: 'googleAdsConversionLabel', label: 'Google Ads 轉換標籤', type: 'text', admin: { description: '例如 AbCdEfGhIjK' } },
      ],
    },
    // ── 金流設定 ──
    {
      name: 'payment',
      label: '金流設定',
      type: 'group',
      fields: [
        {
          name: 'enabledMethods',
          label: '啟用的付款方式',
          type: 'select',
          hasMany: true,
          defaultValue: ['ecpay', 'cash_cod', 'cash_meetup'],
          options: [
            { label: 'PayPal', value: 'paypal' },
            { label: '綠界科技 ECPay', value: 'ecpay' },
            { label: '藍新支付 NewebPay', value: 'newebpay' },
            { label: 'LINE Pay', value: 'linepay' },
            { label: 'Apple Pay', value: 'applepay' },
            { label: 'Google Pay', value: 'googlepay' },
            { label: '現金—宅配貨到付款', value: 'cash_cod' },
            { label: '現金—到辦公室取貨付款', value: 'cash_meetup' },
          ],
          admin: {
            description:
              '可複選。「現金—宅配貨到付款」需配合宅配/超商物流（物流 cashOnDelivery=true）；' +
              '「現金—到辦公室取貨付款」需配合「到辦公室取貨」物流（carrier=meetup）。未勾選的付款方式在結帳頁不會顯示。',
          },
        },
        { name: 'currency', label: '預設幣別', type: 'text', defaultValue: 'TWD' },
        { name: 'taxRate', label: '稅率（%）', type: 'number', defaultValue: 0 },
        {
          name: 'codDefaultFee',
          label: '貨到付款預設手續費（新台幣）',
          type: 'number',
          defaultValue: 30,
          admin: { description: '台灣 COD 物流司機代收手續費，常見 30 元；admin 可在單張訂單覆蓋' },
        },
        {
          name: 'codMaxAmount',
          label: '貨到付款訂單金額上限（新台幣）',
          type: 'number',
          defaultValue: 20000,
          admin: { description: '訂單總額（含運費）超過此值時前台不允許選擇 COD；0 = 不限制' },
        },
      ],
    },
    // ── Cookie 同意 ──
    {
      name: 'cookieConsent',
      label: 'Cookie 同意橫幅',
      type: 'group',
      fields: [
        { name: 'enabled', label: '啟用 Cookie 同意橫幅', type: 'checkbox', defaultValue: true },
        {
          name: 'bannerText',
          label: '橫幅文字',
          type: 'textarea',
          defaultValue: '本網站使用 Cookie 以提供更好的瀏覽體驗。繼續使用即表示您同意我們的 Cookie 政策。',
        },
        { name: 'privacyPolicyUrl', label: '隱私權政策連結', type: 'text' },
        { name: 'acceptButtonText', label: '同意按鈕文字', type: 'text', defaultValue: '我知道了' },
      ],
    },
    // ── Sinsang Market 匯入設定 ──
    {
      name: 'sinsangMarket',
      label: 'Sinsang Market 匯入設定',
      type: 'group',
      admin: { description: '韓國批貨平台 Sinsang Market API 連線設定' },
      fields: [
        {
          name: 'accessToken',
          label: 'Access Token',
          type: 'text',
          admin: { description: '登入 Sinsang Market 後取得的 API Token（加密儲存）' },
        },
        {
          name: 'krwToTwdRate',
          label: '韓元→台幣換算係數',
          type: 'number',
          defaultValue: 0.023,
          admin: { description: '預設換算係數，例如 0.023 表示 ₩1 = NT$0.023（₩7000 ≈ NT$161）。匯入時可單次覆蓋修改。' },
        },
      ],
    },

    // ── 運費設定 ──
    {
      name: 'shipping',
      label: '運費設定',
      type: 'group',
      fields: [
        { name: 'defaultShippingFee', label: '預設運費（新台幣）', type: 'number', defaultValue: 60 },
        {
          name: 'globalFreeShippingThreshold',
          label: '全站免運門檻',
          type: 'number',
          defaultValue: 1000,
          admin: { description: '訂單滿此金額免運（不分會員等級）' },
        },
      ],
    },

    // ── AI SEO 優化設定 ──
    {
      name: 'aiSeo',
      label: 'AI SEO 優化設定',
      type: 'group',
      admin: { description: '針對 AI 搜尋引擎（ChatGPT、Claude、Perplexity 等）的 SEO 優化設定' },
      fields: [
        {
          name: 'enableLlmsTxt',
          label: '啟用 llms.txt',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: '產生 /llms.txt 檔案，讓 AI 爬蟲更好理解網站內容' },
        },
        {
          name: 'llmsSiteDescription',
          label: '網站 AI 摘要',
          type: 'textarea',
          defaultValue: 'CHIC KIM & MIU（靚秀國際）是台灣韓系質感女裝電商品牌，提供日常通勤、約會穿搭、名媛風洋裝等精選韓國女裝。主打直播選品、獨家設計款，提供會員點數、遊戲互動、推薦獎勵等多元購物體驗。',
          admin: { description: '用於 llms.txt 的網站介紹，AI 搜尋引擎會優先使用此摘要' },
        },
        {
          name: 'llmsKeyTopics',
          label: 'AI 關鍵主題',
          type: 'textarea',
          defaultValue: '韓系女裝, 質感穿搭, 直播選品, 名媛風洋裝, 通勤穿搭, 約會穿搭, 韓國女裝, 會員制度, 訂閱方案',
          admin: { description: '逗號分隔的關鍵字，幫助 AI 理解網站核心主題' },
        },
        {
          name: 'aiCrawlerPolicy',
          label: 'AI 爬蟲政策',
          type: 'select',
          defaultValue: 'allow_all',
          options: [
            { label: '全部允許（推薦）', value: 'allow_all' },
            { label: '僅允許商品與部落格', value: 'products_blog_only' },
            { label: '全部封鎖', value: 'block_all' },
          ],
          admin: { description: '控制 GPTBot、ClaudeBot、PerplexityBot 等 AI 爬蟲的存取權限' },
        },
        {
          name: 'enableStructuredData',
          label: '啟用 AI 結構化資料',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: '在商品頁自動產生 JSON-LD 結構化資料（Product、Offer、Review 等）' },
        },
        {
          name: 'brandKnowledgeBase',
          label: '品牌知識庫',
          type: 'textarea',
          admin: {
            description: '額外的品牌資訊，AI 搜尋引擎回答問題時會參考此內容（例如：退換貨政策摘要、配送資訊、品牌故事等）',
          },
        },
        {
          name: 'competitorDifferentiation',
          label: '品牌差異化描述',
          type: 'textarea',
          admin: { description: '說明品牌相較其他競品的獨特優勢，幫助 AI 搜尋引擎在比較時推薦本品牌' },
        },
        {
          name: 'faqForAi',
          label: 'AI 常見問答',
          type: 'array',
          maxRows: 20,
          admin: { description: '為 AI 搜尋引擎準備的常見問答，會自動納入 llms.txt 和 FAQ 結構化資料' },
          fields: [
            { name: 'question', label: '問題', type: 'text', required: true },
            { name: 'answer', label: '答案', type: 'textarea', required: true },
          ],
        },
      ],
    },

    // ── 會員登入設定 ──
    {
      name: 'socialLogin',
      label: '社群登入設定',
      type: 'group',
      admin: { description: '管理前台會員可使用的社群登入方式' },
      fields: [
        { name: 'enableGoogle', label: '啟用 Google 登入', type: 'checkbox', defaultValue: true },
        { name: 'enableFacebook', label: '啟用 Facebook 登入', type: 'checkbox', defaultValue: true },
        { name: 'enableLine', label: '啟用 LINE 登入', type: 'checkbox', defaultValue: true },
        { name: 'enableApple', label: '啟用 Apple 登入', type: 'checkbox', defaultValue: false, admin: { description: '需先在 Apple Developer 設定 Sign in with Apple 服務' } },
      ],
    },
    // ── Email 註冊/驗證設定 ──
    {
      name: 'emailAuth',
      label: 'Email 註冊/驗證',
      type: 'group',
      admin: {
        description: '控制前台 email 註冊後是否需要驗證信才能登入。OAuth 登入不受此設定影響（一律視為已驗證）',
      },
      fields: [
        {
          name: 'requireEmailVerification',
          label: '註冊需 email 驗證',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              '開啟：新會員註冊後需點擊信中連結驗證才能登入；關閉（預設）：註冊後立即可登入，跳過驗證。' +
              'prod 建議開啟；封測期視 Resend 設定狀況決定。',
          },
        },
      ],
    },
  ],
}
