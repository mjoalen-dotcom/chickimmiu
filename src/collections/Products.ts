import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { createExportEndpoint, createImportEndpoint, type FieldMapping } from '../endpoints/importExport'
import { revalidateAllEndpoint } from '../endpoints/revalidateAll'
import { shoplineXlsxImportEndpoint } from '../endpoints/shoplineXlsxImport'
import { revalidateProduct } from '../lib/revalidate'

const productFieldMappings: FieldMapping[] = [
  { key: 'name', label: '商品名稱' },
  { key: 'slug', label: '網址代碼' },
  { key: 'productSku', label: '商品總 SKU' },
  { key: 'brand', label: '品牌' },
  { key: 'price', label: '原價' },
  { key: 'salePrice', label: '特價' },
  { key: 'stock', label: '庫存' },
  { key: 'status', label: '狀態' },
  { key: 'isNew', label: '新品' },
  { key: 'isHot', label: '熱銷' },
  { key: 'weight', label: '重量' },
  { key: 'material', label: '材質' },
  { key: 'productOrigin', label: '原產地' },
  { key: 'variants', label: '變體（JSON）' },
  { key: 'tags', label: '標籤（JSON）' },
]

/**
 * Products Collection
 * ───────────────────
 * CHIC KIM & MIU 女裝電商核心 collection。採用 Tabs 結構讓後台人員
 * 快速定位：基本資訊 / 媒體與圖庫 / 變體與庫存 / 穿搭資訊 / SEO。
 * 採購與內部欄位置於 sidebar，與一般編輯流程分離。
 *
 * 資料同步：
 *   - afterChange / afterDelete 自動 revalidate 前台相關頁面
 *   - Next.js App Router 的 revalidatePath/revalidateTag 會讓 /products
 *     和 /products/[slug] 的 fetch cache 失效，下一次請求重新拉最新資料
 *
 * 驗證：
 *   - beforeValidate 自動從 name 產生 slug（若留空）
 *   - beforeChange 擋下「特價 >= 原價」和「變體 SKU 重複」
 *   - beforeChange 自動計算 isLowStock
 */
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'price',
      'salePrice',
      'stock',
      'isLowStock',
      'status',
      'isHot',
      'isNew',
      'updatedAt',
    ],
    group: '商品管理',
    description: '商品資料管理（含變體、庫存、分類、CSV/Excel 匯入匯出）',
    listSearchableFields: ['name', 'slug', 'productSku'],
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/ProductBulkActions',
        },
        {
          path: '@/components/admin/ShoplineXlsxImporter',
        },
        {
          path: '@/components/admin/SinsangImporter',
        },
        {
          path: '@/components/admin/ShoplineImportPanel',
        },
        {
          path: '@/components/admin/ImageMigrationPanel',
        },
        {
          path: '@/components/admin/ImportExportButtons',
          clientProps: { collectionSlug: 'products' },
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
  endpoints: [
    createExportEndpoint('products', productFieldMappings),
    createImportEndpoint('products', productFieldMappings),
    revalidateAllEndpoint,
    shoplineXlsxImportEndpoint,
  ],
  hooks: {
    /* ── 1. 驗證前：自動 slug + 資料正規化 ── */
    beforeValidate: [
      ({ data }) => {
        if (!data) return data

        // 自動 slug from name（若未填）
        if (!data.slug && typeof data.name === 'string') {
          data.slug = String(data.name)
            .toLowerCase()
            .trim()
            // 保留英數、中日韓字、空白、連字號
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
        }

        // 去除 slug 前後空白與兩端連字號
        if (typeof data.slug === 'string') {
          data.slug = data.slug.trim().replace(/^-+|-+$/g, '')
        }

        return data
      },
    ],

    /* ── 2. 存檔前：驗證 + 自動計算低庫存 ── */
    beforeChange: [
      ({ data }) => {
        if (!data) return data

        // 特價不可大於等於原價
        if (
          data.salePrice != null &&
          data.salePrice !== '' &&
          data.price != null &&
          Number(data.salePrice) >= Number(data.price)
        ) {
          throw new APIError('特價必須小於原價（目前特價 ≥ 原價）', 400)
        }

        // 變體 SKU 必須在此商品內唯一
        const variants = data.variants as { sku?: string; stock?: number }[] | undefined
        if (variants && variants.length > 0) {
          const skus = variants
            .map((v) => (typeof v.sku === 'string' ? v.sku.trim() : ''))
            .filter((s): s is string => Boolean(s))
          const seen = new Set<string>()
          const dupes = new Set<string>()
          for (const sku of skus) {
            if (seen.has(sku)) dupes.add(sku)
            seen.add(sku)
          }
          if (dupes.size > 0) {
            throw new APIError(
              '變體 SKU 重複：' + Array.from(dupes).join(', '),
              400,
            )
          }
        }

        // 自動計算低庫存狀態
        const threshold = data.lowStockThreshold ?? 5
        if (variants && variants.length > 0) {
          const totalStock = variants.reduce(
            (sum: number, v: { stock?: number }) => sum + (v.stock ?? 0),
            0,
          )
          data.isLowStock = totalStock <= threshold
          // 同步寫回總庫存欄位（方便列表 sort/filter）
          data.stock = totalStock
        } else {
          data.isLowStock = (data.stock ?? 0) <= threshold
        }

        return data
      },
    ],

    /* ── 3. 存檔後：revalidate 前台 ── */
    afterChange: [
      ({ doc, previousDoc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        const prevSlug = (previousDoc as Record<string, unknown> | undefined)?.slug as
          | string
          | undefined
        revalidateProduct(slug)
        // 如果 slug 改掉，舊 slug 的頁也要 revalidate 一次（讓它 404）
        if (prevSlug && prevSlug !== slug) {
          revalidateProduct(prevSlug)
        }
      },
    ],

    /* ── 4. 刪除後：revalidate 前台（讓舊頁變 404） ── */
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidateProduct(slug)
      },
    ],
  },
  fields: [
    /* ════════════════════════════════════════════════
     *  SIDEBAR：上架狀態 / 標記 / 採購資訊
     * ════════════════════════════════════════════════ */
    {
      name: 'status',
      label: '上架狀態',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已上架', value: 'published' },
        { label: '已下架', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
        description: '僅「已上架」的商品會出現在前台',
      },
    },
    {
      name: 'isNew',
      label: '新品標記',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'isHot',
      label: '熱銷標記',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'productSku',
      label: '商品總 SKU',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: '商品層級的總 SKU（變體 SKU 在下方變體區填寫）',
      },
    },
    {
      name: 'isLowStock',
      label: '低庫存警示',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: '系統自動判斷，無需手動修改',
      },
    },
    {
      name: 'sourcing',
      label: '採購來源資訊',
      type: 'group',
      admin: {
        description: '⚠️ 內部採購資訊，僅後台人員可見，前台完全隱藏',
        position: 'sidebar',
      },
      fields: [
        {
          name: 'sourceId',
          label: '來源商品 ID',
          type: 'text',
          admin: { description: 'Sinsang Market 商品 ID' },
        },
        {
          name: 'supplierName',
          label: '供應商名稱',
          type: 'text',
          admin: { description: '例如 BBOOM UP' },
        },
        {
          name: 'supplierLocation',
          label: '供應商位置代碼',
          type: 'text',
          admin: { description: '例如 Studio W 1F 특7' },
        },
        {
          name: 'costKRW',
          label: '進貨成本（韓元）',
          type: 'number',
          min: 0,
          admin: { description: '韓元原價' },
        },
        {
          name: 'costTWD',
          label: '參考台幣成本',
          type: 'number',
          min: 0,
          admin: {
            readOnly: true,
            description: '= 韓元 × 換算係數（匯入時自動計算）',
          },
        },
        {
          name: 'exchangeRate',
          label: '匯入時換算係數',
          type: 'number',
          admin: { readOnly: true, description: '匯入當下使用的換算係數' },
        },
        {
          name: 'originalDescription',
          label: '韓文原始描述',
          type: 'textarea',
          admin: {
            description: '僅供翻譯參考，不自動成為前台商品說明',
          },
        },
        {
          name: 'fabricInfo',
          label: '布料資訊',
          type: 'group',
          fields: [
            {
              name: 'material',
              label: '材質說明',
              type: 'text',
              admin: { description: '例如 棉 60%、聚酯纖維 40%' },
            },
            { name: 'thickness', label: '厚度', type: 'text' },
            { name: 'transparency', label: '透明度', type: 'text' },
            { name: 'elasticity', label: '彈性', type: 'text' },
            { name: 'madeIn', label: '製造國', type: 'text' },
          ],
        },
      ],
    },

    /* ════════════════════════════════════════════════
     *  TABS：主編輯區
     * ════════════════════════════════════════════════ */
    {
      type: 'tabs',
      tabs: [
        /* ── Tab 1：基本資訊 ── */
        {
          label: '基本資訊',
          description: '商品名稱、描述、價格、分類、標籤',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'name',
                  label: '商品名稱',
                  type: 'text',
                  required: true,
                  admin: { width: '60%' },
                },
                {
                  name: 'slug',
                  label: '網址代碼',
                  type: 'text',
                  required: true,
                  unique: true,
                  admin: {
                    width: '40%',
                    description: '留空自動產生。例如 /products/elegant-dress',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'brand',
                  label: '品牌',
                  type: 'text',
                  defaultValue: 'CHIC KIM & MIU',
                  admin: { width: '50%' },
                },
                {
                  name: 'productOrigin',
                  label: '原產地',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: '例如 韓國 / 台灣 / 中國',
                  },
                },
              ],
            },
            {
              name: 'description',
              label: '商品描述',
              type: 'richText',
              admin: { description: '前台商品詳細頁的主要說明內容' },
            },
            {
              name: 'shortDescription',
              label: '簡短描述',
              type: 'textarea',
              admin: {
                description: '列表頁 hover 預覽、購物車、分享卡片會使用（純文字，約 50-100 字）',
              },
            },
            /* 價格 */
            {
              type: 'row',
              fields: [
                {
                  name: 'price',
                  label: '原價（新台幣）',
                  type: 'number',
                  required: true,
                  min: 0,
                  admin: { width: '50%' },
                },
                {
                  name: 'salePrice',
                  label: '特價（新台幣）',
                  type: 'number',
                  min: 0,
                  admin: {
                    width: '50%',
                    description: '留空表示無特價。系統會擋下「特價 ≥ 原價」',
                  },
                },
              ],
            },
            /* 分類 & 標籤 */
            {
              name: 'category',
              label: '商品分類',
              type: 'relationship',
              relationTo: 'categories',
              required: true,
            },
            {
              name: 'tags',
              label: '商品標籤',
              type: 'array',
              fields: [
                { name: 'tag', label: '標籤', type: 'text', required: true },
              ],
              admin: {
                description: '自由輸入，例如：韓版、通勤、度假、派對',
              },
            },
            {
              name: 'collectionTags',
              label: '主題專區標籤',
              type: 'select',
              hasMany: true,
              options: [
                { label: '金老佛爺 Live', value: 'jin-live' },
                { label: '金金同款專區', value: 'jin-style' },
                { label: '主播同款專區', value: 'host-style' },
                { label: '品牌自訂款', value: 'brand-custom' },
                { label: '婚禮洋裝/正式洋裝', value: 'formal-dresses' },
                { label: '現貨速到 Rush', value: 'rush' },
                { label: '藝人穿搭', value: 'celebrity-style' },
              ],
              admin: {
                description: '選擇此商品所屬的主題專區（可多選）',
              },
            },
            /* 重量 */
            {
              name: 'weight',
              label: '商品重量（公克）',
              type: 'number',
              min: 0,
              admin: { description: '用於運費計算' },
            },
          ],
        },

        /* ── Tab 2：媒體與圖庫 ── */
        {
          label: '媒體與圖庫',
          description: '封面圖、商品圖庫',
          fields: [
            {
              name: 'featuredImage',
              label: '封面主圖',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  '列表頁與首頁展示的主要圖片。若留空會使用下方圖庫第一張。',
              },
            },
            {
              name: 'images',
              label: '商品圖庫',
              type: 'array',
              minRows: 1,
              admin: {
                description:
                  '商品詳細頁的圖片輪播（至少 1 張）。建議 4-8 張，包含：正面、背面、側面、細節、模特兒穿著。',
              },
              fields: [
                {
                  name: 'image',
                  label: '圖片',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
                {
                  name: 'caption',
                  label: '圖說（選填）',
                  type: 'text',
                  admin: { description: '例如：背面細節、模特兒身高 168cm 穿 M' },
                },
              ],
            },
          ],
        },

        /* ── Tab 3：變體與庫存 ── */
        {
          label: '變體與庫存',
          description: '顏色、尺寸、每變體庫存、尺寸表、預購設定',
          fields: [
            {
              name: 'variantMatrixTool',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/admin/VariantMatrixGenerator',
                },
              },
            },
            {
              name: 'variants',
              label: '商品變體',
              type: 'array',
              admin: {
                description:
                  '每一個變體 = 一個顏色 × 尺寸組合。若商品只有一個款式，可留空，改用下方「總庫存」欄位。',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'colorName',
                      label: '顏色名稱',
                      type: 'text',
                      required: true,
                      admin: { width: '35%', description: '例如 米杏白' },
                    },
                    {
                      name: 'colorCode',
                      label: '色碼',
                      type: 'text',
                      admin: {
                        width: '30%',
                        description: 'HEX 色碼，例如 #F5E8D0',
                      },
                    },
                    {
                      name: 'colorSwatch',
                      label: '色塊圖',
                      type: 'upload',
                      relationTo: 'media',
                      admin: {
                        width: '35%',
                        description: '選填。上傳後前台會優先顯示此圖而非 HEX',
                      },
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'size',
                      label: '尺寸',
                      type: 'text',
                      required: true,
                      admin: {
                        width: '25%',
                        description: '例如 S / M / L / XL / F',
                      },
                    },
                    {
                      name: 'sku',
                      label: 'SKU 編號',
                      type: 'text',
                      required: true,
                      admin: {
                        width: '35%',
                        description: '此商品內不可重複',
                      },
                    },
                    {
                      name: 'stock',
                      label: '庫存數量',
                      type: 'number',
                      required: true,
                      min: 0,
                      defaultValue: 0,
                      admin: { width: '20%' },
                    },
                    {
                      name: 'priceOverride',
                      label: '此變體價格',
                      type: 'number',
                      min: 0,
                      admin: {
                        width: '20%',
                        description: '留空 = 用商品原價',
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'stock',
                  label: '總庫存（無變體時使用）',
                  type: 'number',
                  min: 0,
                  defaultValue: 0,
                  admin: {
                    width: '50%',
                    description: '若有設定變體，系統自動用變體加總覆蓋此欄位',
                  },
                },
                {
                  name: 'lowStockThreshold',
                  label: '低庫存警示門檻',
                  type: 'number',
                  min: 0,
                  defaultValue: 5,
                  admin: {
                    width: '50%',
                    description: '庫存低於此數量時在後台顯示警示',
                  },
                },
              ],
            },
            {
              name: 'sizeChart',
              label: '尺寸表',
              type: 'relationship',
              relationTo: 'size-charts',
              admin: {
                description:
                  '從「商品管理 → 尺寸表」選擇一張。前台會顯示「尺寸建議」按鈕彈出此表。',
              },
            },
            {
              name: 'allowPreOrder',
              label: '允許預購',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: '庫存為 0 時仍可下單' },
            },
            {
              name: 'preOrderNote',
              label: '預購說明',
              type: 'textarea',
              admin: {
                description:
                  '例如：預購流程 → 下單→收到訂單→搭飛機中→清關→包裝→寄出（約 10-14 天）',
                condition: (data) => Boolean(data?.allowPreOrder),
              },
            },
          ],
        },

        /* ── Tab 4：穿搭資訊 ── */
        {
          label: '穿搭資訊',
          description: '材質、洗滌說明、模特兒資訊（會顯示在前台商品詳細頁）',
          fields: [
            {
              name: 'material',
              label: '材質',
              type: 'text',
              admin: {
                description:
                  '例如「棉 60% / 聚酯纖維 40%」。與採購區的 fabric.material 不同，這個是要顯示在前台的。',
              },
            },
            {
              name: 'careInstructions',
              label: '洗滌與保養說明',
              type: 'textarea',
              admin: {
                description: '例如：手洗冷水、不可漂白、低溫熨燙、不可烘乾',
              },
            },
            {
              name: 'modelInfo',
              label: '模特兒資訊',
              type: 'group',
              admin: {
                description: '給消費者參考尺寸用',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'height',
                      label: '身高',
                      type: 'text',
                      admin: { width: '33%', description: '例如 168cm' },
                    },
                    {
                      name: 'weight',
                      label: '體重',
                      type: 'text',
                      admin: { width: '33%', description: '例如 50kg' },
                    },
                    {
                      name: 'wearingSize',
                      label: '穿著尺寸',
                      type: 'text',
                      admin: { width: '34%', description: '例如 M' },
                    },
                  ],
                },
                {
                  name: 'bodyShape',
                  label: '體型',
                  type: 'text',
                  admin: { description: '例如 梨形、鐘型、標準' },
                },
              ],
            },
            {
              name: 'stylingTips',
              label: '穿搭建議',
              type: 'textarea',
              admin: {
                description:
                  '品牌建議的搭配方式，例如：搭配高跟鞋變身優雅通勤，搭配球鞋更顯甜美',
              },
            },
          ],
        },

        /* ── Tab 5：SEO ── */
        {
          label: 'SEO',
          description: '搜尋引擎顯示標題、描述、Open Graph 分享圖',
          fields: [
            {
              name: 'seo',
              label: 'SEO 設定',
              type: 'group',
              fields: [
                {
                  name: 'metaTitle',
                  label: 'Meta 標題',
                  type: 'text',
                  admin: { description: '留空時使用商品名稱。建議 60 字以內。' },
                },
                {
                  name: 'metaDescription',
                  label: 'Meta 描述',
                  type: 'textarea',
                  admin: { description: '建議 155 字以內。' },
                },
                {
                  name: 'metaImage',
                  label: 'OG 分享圖',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    description:
                      '社群分享時的預覽圖。留空時使用封面主圖。建議 1200×630。',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
