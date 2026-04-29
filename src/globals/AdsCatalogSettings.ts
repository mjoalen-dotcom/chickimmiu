import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { revalidatePath } from 'next/cache'

/**
 * 廣告目錄設定 Global
 * ─────────────────────
 * 控制 /feeds/meta.xml 與 /feeds/google.xml 兩支商品 feed 的全站預設值與行為。
 *
 * Workflow：
 *   1. Meta / Google Shopping 後台填入 feed URL → 平台定時爬取
 *   2. 個別商品「廣告目錄」tab 留空欄位 → 用此 global 的預設值 fallback
 *   3. 變體展開：每個 SKU = 一筆 catalog item，共享 item_group_id (= product slug)
 *
 * 平台目錄爬取頻率：Meta 預設每天一次，Google 可設 1 天 / 7 天 / 30 天。
 * 即時性更高的需求請等 PR-F（API push）。
 */
export const AdsCatalogSettings: GlobalConfig = {
  slug: 'ads-catalog-settings',
  label: '廣告目錄設定',
  admin: {
    group: '④ 行銷推廣',
    description: 'Meta / Google Shopping 商品 feed 設定（feed URL、預設值、變體展開、out-of-stock 政策）',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  hooks: {
    afterChange: [
      () => {
        // feed 路徑 cache 設定改變後須讓客端重新爬
        revalidatePath('/feeds/meta.xml')
        revalidatePath('/feeds/google.xml')
      },
    ],
  },
  fields: [
    // ═══════════════════════════════════════
    // ── 一般設定 ──
    // ═══════════════════════════════════════
    {
      name: 'general',
      label: '一般設定',
      type: 'group',
      fields: [
        {
          name: 'enabled',
          label: '啟用商品 feed',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: '關閉後 /feeds/meta.xml 與 /feeds/google.xml 回 503，平台會抓不到商品。',
          },
        },
        {
          name: 'feedSecretToken',
          label: 'Feed 存取 Token（選填）',
          type: 'text',
          admin: {
            description:
              '若填入，feed URL 須加 `?token=<value>` 才能存取（防爬蟲）。' +
              'Meta/Google 後台的 feed URL 也要加上 token 參數。' +
              '留空 = 公開存取。',
          },
        },
        {
          name: 'feedCacheTtlMinutes',
          label: 'Feed 快取時間（分鐘）',
          type: 'number',
          defaultValue: 60,
          min: 5,
          max: 1440,
          admin: {
            description:
              '回應 HTTP Cache-Control max-age；Meta/Google 爬蟲依此快取。' +
              '建議 30-120 分鐘。商品改價即時性需求高 → 設低；流量大需減 server 壓力 → 設高。',
          },
        },
        {
          name: 'includeOutOfStock',
          label: '包含缺貨商品',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Meta/Google 接受 availability=out_of_stock，會顯示「補貨中」標籤。' +
              '關閉 = 缺貨商品從 feed 隱藏（無法投放）。封測期建議開啟以維持目錄完整。',
          },
        },
        {
          name: 'includeDraft',
          label: '包含草稿商品',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: '預設只輸出已上架（published）商品；開啟以包含草稿（測試用）' },
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── 預設值 ──
    // ═══════════════════════════════════════
    {
      name: 'defaults',
      label: '商品 feed 預設值',
      type: 'group',
      admin: {
        description:
          '個別商品「廣告目錄」tab 留空時的 fallback 值。改這裡可一次套用全站。',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'defaultBrand',
              label: '預設品牌',
              type: 'text',
              defaultValue: 'CHIC KIM & MIU',
              admin: { width: '50%', description: '商品 brand 欄位留空時用這個' },
            },
            {
              name: 'defaultCurrency',
              label: '預設幣別',
              type: 'text',
              defaultValue: 'TWD',
              admin: {
                width: '50%',
                description: 'ISO 4217 三碼幣別代號，例如 TWD / USD',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'defaultGender',
              label: '預設性別',
              type: 'select',
              defaultValue: 'female',
              options: [
                { label: '女性', value: 'female' },
                { label: '男性', value: 'male' },
                { label: '中性 / 不分性別', value: 'unisex' },
              ],
              admin: { width: '33%' },
            },
            {
              name: 'defaultAgeGroup',
              label: '預設年齡層',
              type: 'select',
              defaultValue: 'adult',
              options: [
                { label: '成人', value: 'adult' },
                { label: '青少年', value: 'teen' },
                { label: '兒童', value: 'kids' },
                { label: '幼兒', value: 'toddler' },
                { label: '嬰兒', value: 'infant' },
                { label: '新生兒', value: 'newborn' },
              ],
              admin: { width: '33%' },
            },
            {
              name: 'defaultCondition',
              label: '預設商品狀況',
              type: 'select',
              defaultValue: 'new',
              options: [
                { label: '全新', value: 'new' },
                { label: '整新品', value: 'refurbished' },
                { label: '二手', value: 'used' },
              ],
              admin: { width: '34%' },
            },
          ],
        },
        {
          name: 'defaultGoogleProductCategory',
          label: '預設 Google 商品分類',
          type: 'text',
          defaultValue: 'Apparel & Accessories > Clothing > Dresses',
          admin: {
            description:
              'Google Product Taxonomy 字串或數字 ID。例如：' +
              '「Apparel & Accessories > Clothing」(1604) / ' +
              '「Apparel & Accessories > Clothing > Dresses」(2271) / ' +
              '「Apparel & Accessories > Clothing > Skirts」(1581)。' +
              '完整列表：https://support.google.com/merchants/answer/6324436',
          },
        },
        {
          name: 'defaultProductTypePrefix',
          label: '商品類型前綴',
          type: 'text',
          defaultValue: '女裝 > 韓系',
          admin: {
            description: '自家 product_type 路徑前綴，後面會自動接 category 名稱',
          },
        },
        {
          name: 'defaultLocale',
          label: '預設語系',
          type: 'select',
          defaultValue: 'zh_TW',
          options: [
            { label: '繁體中文（台灣）zh_TW', value: 'zh_TW' },
            { label: '繁體中文（香港）zh_HK', value: 'zh_HK' },
            { label: '簡體中文 zh_CN', value: 'zh_CN' },
            { label: '英文 en_US', value: 'en_US' },
            { label: '日文 ja_JP', value: 'ja_JP' },
          ],
          admin: { description: 'Meta feed content_language 用' },
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── Meta 平台設定 ──
    // ═══════════════════════════════════════
    {
      name: 'meta',
      label: 'Meta（Facebook / Instagram）',
      type: 'group',
      admin: { description: 'Meta Commerce Manager 與 Pixel 對應 ID（feed-only 模式不需 token）' },
      fields: [
        {
          name: 'businessManagerId',
          label: 'Business Manager ID',
          type: 'text',
          admin: { description: '例如 2137781379827397' },
        },
        {
          name: 'catalogId',
          label: 'Catalog ID',
          type: 'text',
          admin: {
            description: 'Commerce Manager → 目錄 → 設定 → 目錄 ID（純數字）',
          },
        },
        {
          name: 'adAccountId',
          label: 'Ad Account ID',
          type: 'text',
          admin: { description: '例如 act_1234567890' },
        },
        {
          name: 'systemUserToken',
          label: 'System User Token（選填，PR-F 才用）',
          type: 'text',
          admin: {
            description:
              'Catalog Batch API 推送商品需要 catalog_management + business_management 權限。' +
              '純 feed 模式不需要這個 token。',
          },
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── Google 平台設定 ──
    // ═══════════════════════════════════════
    {
      name: 'google',
      label: 'Google（Merchant Center / Ads）',
      type: 'group',
      admin: { description: 'Google Merchant Center 與 Ads 對應 ID' },
      fields: [
        {
          name: 'merchantCenterId',
          label: 'Merchant Center Account ID',
          type: 'text',
          admin: { description: 'merchants.google.com 右上角 Account ID（純數字）' },
        },
        {
          name: 'serviceAccountEmail',
          label: 'Service Account Email（選填，PR-F 才用）',
          type: 'text',
          admin: {
            description: 'Content API for Shopping 推送商品用，feed-only 模式不需要',
          },
        },
      ],
    },

    // ═══════════════════════════════════════
    // ── Feed URL 顯示（read-only 提示）──
    // ═══════════════════════════════════════
    {
      name: 'feedUrls',
      label: 'Feed 公開網址',
      type: 'group',
      admin: {
        description:
          '把這些 URL 貼到 Meta Commerce Manager 與 Google Merchant Center 後台，' +
          '平台會定時爬取商品。Token 已設則需加上 ?token=xxx 參數。',
      },
      fields: [
        {
          name: 'metaFeedUrl',
          label: 'Meta 商品 Feed',
          type: 'text',
          defaultValue: 'https://chickimmiu.com/feeds/meta.xml',
          admin: { readOnly: true, description: '貼到 Commerce Manager → 目錄 → 資料來源 → 排程的 Feed' },
        },
        {
          name: 'googleFeedUrl',
          label: 'Google Shopping Feed',
          type: 'text',
          defaultValue: 'https://chickimmiu.com/feeds/google.xml',
          admin: { readOnly: true, description: '貼到 Merchant Center → 產品 → 動態消息 → 已排定的擷取' },
        },
      ],
    },
  ],
}
