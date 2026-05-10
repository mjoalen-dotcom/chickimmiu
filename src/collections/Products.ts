import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { createExportEndpoint, createImportEndpoint, type FieldMapping } from '../endpoints/importExport'
import { revalidateAllEndpoint } from '../endpoints/revalidateAll'
import { shoplineXlsxImportEndpoint } from '../endpoints/shoplineXlsxImport'
import { r2PilotEndpoint } from '../endpoints/r2Pilot'
import { linkIntegrityScanEndpoint } from '../endpoints/linkIntegrityScan'
import { applyProductSchedulesEndpoint } from '../endpoints/applyProductSchedules'
import { revalidateProduct } from '../lib/revalidate'
import { suggestPersonalityTypes } from '../lib/games/mbtiAutoRecommend'
import { bumpCategoryCount, getCategoryId } from '../lib/categoryCount'

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

const productBeforeDuplicateHook = {
  beforeDuplicate: [
    ({ data }: { data?: Record<string, unknown> | null }) => {
      if (!data || typeof data !== 'object') return data
      const ts = Date.now().toString(36)
      const mutable = data as Record<string, unknown>

      const baseSlug =
        typeof mutable.slug === 'string' && mutable.slug.trim()
          ? mutable.slug.trim()
          : 'product'
      const baseName =
        typeof mutable.name === 'string' && mutable.name.trim()
          ? mutable.name.trim()
          : '未命名商品'

      mutable.slug = `${baseSlug}-copy-${ts}`
      mutable.name = `${baseName}（複本）`
      mutable.status = 'draft'
      mutable.totalSold = 0
      mutable.publishAt = null
      mutable.unpublishAt = null
      mutable.aliasSlugs = []

      if (Array.isArray(mutable.variants)) {
        mutable.variants = mutable.variants.map((variant: unknown) => {
          if (!variant || typeof variant !== 'object') return variant
          const row = variant as Record<string, unknown>
          const sku =
            typeof row.sku === 'string' && row.sku.trim()
              ? row.sku.trim()
              : 'variant'
          return {
            ...row,
            sku: `${sku}-copy-${ts}`,
          }
        })
      }

      return mutable
    },
  ],
} as unknown as Partial<NonNullable<CollectionConfig['hooks']>>

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
  labels: { singular: '商品', plural: '商品' },
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
    group: '② 商品管理',
    description:
      '商品總管 — 變體 / 庫存 / 分類，6 種上方工具：批次操作、SHOPLINE BulkUpdateForm、Sinsang Market、Shopline 商品匯入、商品圖片遷移、CSV·Excel 匯入匯出。完整教學見 /admin/help。',
    listSearchableFields: ['name', 'slug', 'productSku'],
    components: {
      beforeListTable: [
        {
          path: '@/components/admin/ProductsUsageNotice',
        },
        {
          path: '@/components/admin/ProductMissingImagePanel',
        },
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
          path: '@/components/admin/R2PilotPanel',
        },
        {
          path: '@/components/admin/ImportExportButtons',
          clientProps: { collectionSlug: 'products' },
        },
      ],
      edit: {
        beforeDocumentControls: [
          { path: '@/components/admin/ProductCreateWizard' },
          { path: '@/components/admin/ProductTabBadges' },
          { path: '@/components/admin/ProductSaveToast' },
          { path: '@/components/admin/ProductDuplicateButton' },
        ],
      },
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
    r2PilotEndpoint,
    linkIntegrityScanEndpoint,
    applyProductSchedulesEndpoint,
  ],
  hooks: {
    ...productBeforeDuplicateHook,
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
      /* 2a. 自動計價：useAutoPricing=true 時用公式覆寫 price
       *     成本沒填 / 公式抓不到 / 匯率抓不到 → 跳過（不擋存檔）
       */
      async ({ data, req }) => {
        if (!data) return data
        const ap = data.autoPricing as
          | {
              useAutoPricing?: boolean
              costAmount?: number | null
              costCurrencyCode?: string
            }
          | undefined
        if (!ap?.useAutoPricing) return data
        const costAmount = Number(ap.costAmount)
        if (!Number.isFinite(costAmount) || costAmount <= 0) return data

        try {
          const formula = (await req.payload.findGlobal({
            slug: 'pricing-formula-settings',
            depth: 0,
          })) as unknown as Record<string, unknown> | null
          if (!formula) return data

          const code =
            ap.costCurrencyCode ||
            (formula.currencyCode as string | undefined) ||
            'KRW'

          // 取匯率：manualRateOverride 優先，否則查 currencies
          let rate: number | null = null
          const manual = formula.manualRateOverride
          if (manual != null && Number(manual) > 0) {
            rate = Number(manual)
          } else {
            const cur = await req.payload.find({
              collection: 'currencies',
              where: { code: { equals: code } },
              limit: 1,
              depth: 0,
            })
            const found = cur.docs[0] as { rateAgainstTwd?: number } | undefined
            if (found && Number(found.rateAgainstTwd) > 0) {
              rate = Number(found.rateAgainstTwd)
            }
          }
          if (!rate) return data

          const { computeSuggestedPrice } = await import(
            '@/lib/pricing/computeSuggestedPrice'
          )
          const result = computeSuggestedPrice({
            costInLocalCurrency: costAmount,
            weight: Number(data.weight ?? 0),
            rate,
            weightShippingPerGram: Number(formula.weightShippingPerGram),
            weightShippingFlatFee: Number(formula.weightShippingFlatFee),
            profitMode: formula.profitMode as
              | 'percent_only'
              | 'fixed_only'
              | 'whichever_higher',
            profitPercent: Number(formula.profitPercent),
            profitFixedFloor: Number(formula.profitFixedFloor),
            priceRoundTo: Number(formula.priceRoundTo),
          })
          if (result && result.suggestedPrice > 0) {
            data.price = result.suggestedPrice
          }
        } catch (e) {
          req.payload.logger?.warn?.(
            `[Products.beforeChange] auto pricing failed (non-fatal): ${
              (e as Error).message
            }`,
          )
        }
        return data
      },
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

        // 個性類型自動推薦：personalityTypes 為空時，依 tag/collection/分類/名稱
        // keyword 比對 16 型 keyword map，自動填入 top 3。Admin 已勾選則尊重不覆蓋。
        const existingPersonality = data.personalityTypes as unknown
        const isEmpty =
          existingPersonality == null ||
          (Array.isArray(existingPersonality) && existingPersonality.length === 0)
        if (isEmpty) {
          const suggested = suggestPersonalityTypes({
            name: data.name as string | undefined,
            description: data.description,
            tags: data.tags as Array<{ tag?: string | null }> | undefined,
            collectionTags: data.collectionTags as string[] | undefined,
            category: data.category as { title?: string | null } | string | number | null,
          })
          if (suggested.length > 0) {
            data.personalityTypes = suggested
          }
        }

        return data
      },
    ],
    /* ── 3. 存檔後：revalidate 前台 + 推 Meta Catalog ── */
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
      // Meta Commerce Catalog real-time push (PR-D)
      // 動態 import 避開 Payload init 階段的 circular dep；fire-and-forget。
      // 缺 token / catalog_id / feed disabled 自動 no-op，admin 存檔不受影響。
      ({ doc }) => {
        const id = (doc as Record<string, unknown>)?.id
        if (id == null) return
        void import('@/lib/ads/catalogBatchPusher')
          .then(({ pushProductToCatalog }) =>
            pushProductToCatalog(id as number | string, 'UPDATE'),
          )
          .catch((err) => {
            console.warn('[Products.afterChange] catalog push failed (non-fatal):', err)
          })
      },
      // PR-γ: 同步 categories.productCount（語意 = published 數量）
      // 用 (category, isPublished) 兩維度算貢獻：舊 -1、新 +1，差異才動 DB。
      // status 從 published ↔ draft/archived 切換也要正確 bump。
      // 任何 hook 失敗都不能擋商品存檔（包在 try/catch、log warn）。
      async ({ doc, previousDoc, req, operation }) => {
        try {
          const prev = previousDoc as Record<string, unknown> | undefined
          const next = doc as Record<string, unknown> | undefined
          const oldCat = operation === 'create' ? null : getCategoryId(prev?.category)
          const newCat = getCategoryId(next?.category)
          const wasPublished = operation !== 'create' && prev?.status === 'published'
          const isPublished = next?.status === 'published'
          const oldKey = wasPublished && oldCat ? oldCat : null
          const newKey = isPublished && newCat ? newCat : null
          if (oldKey === newKey) return
          if (oldKey) await bumpCategoryCount(req.payload, oldKey, -1)
          if (newKey) await bumpCategoryCount(req.payload, newKey, +1)
        } catch (e) {
          req.payload.logger?.warn?.(
            `[Products.afterChange] category count bump failed: ${(e as Error).message}`,
          )
        }
      },
    ],

    /* ── 4. 刪除後：revalidate 前台 + 從 Meta Catalog 移除 ── */
    afterDelete: [
      ({ doc }) => {
        const slug = (doc as Record<string, unknown>)?.slug as string | undefined
        revalidateProduct(slug)
      },
      // Meta Commerce Catalog DELETE
      ({ doc }) => {
        const id = (doc as Record<string, unknown>)?.id
        if (id == null) return
        void import('@/lib/ads/catalogBatchPusher')
          .then(({ pushProductToCatalog }) =>
            pushProductToCatalog(id as number | string, 'DELETE'),
          )
          .catch((err) => {
            console.warn('[Products.afterDelete] catalog delete failed (non-fatal):', err)
          })
      },
      // PR-γ: 同步 categories.productCount -1（只有 published 才扣，draft/archived 從不在計數中）
      async ({ doc, req }) => {
        try {
          const d = doc as Record<string, unknown> | undefined
          if (d?.status !== 'published') return
          const id = getCategoryId(d?.category)
          if (id) await bumpCategoryCount(req.payload, id, -1)
        } catch (e) {
          req.payload.logger?.warn?.(
            `[Products.afterDelete] category count bump failed: ${(e as Error).message}`,
          )
        }
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
        description: '僅「已上架」的商品會出現在前台。列表頁可一鍵切換。',
        components: {
          Cell: '@/components/admin/ProductStatusCell',
        },
      },
    },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'publishAt',
          label: '預定上架時間',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
            description: '到時自動由「草稿」轉「已上架」（每 10 分鐘掃一次）',
          },
        },
        {
          name: 'unpublishAt',
          label: '預定下架時間',
          type: 'date',
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayAndTime', timeFormat: 'HH:mm' },
            description: '到時自動由「已上架」轉「已下架」',
          },
        },
      ],
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
      name: 'totalSold',
      label: '累計售出件數',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description:
          '前台 PDP 顯示「累計售出 X+ 件」徽章（≥ 50 件才會顯示）。可手動填入或未來由訂單統計自動更新。',
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
    {
      name: 'imageMigration',
      label: '圖片遷移狀態',
      type: 'group',
      admin: {
        description:
          '⚠️ 內部欄位 — 記錄此商品圖片從 Shopline / Sinsang 等外部來源搬到 R2 的進度。' +
          'Idempotent 用：批次匯入腳本會檢查 status，已 done 的就跳過不重做。' +
          '前台完全隱藏，只在後台 sidebar 顯示給人工排查失敗用。',
        position: 'sidebar',
      },
      fields: [
        {
          name: 'status',
          label: '遷移狀態',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: '待處理 pending', value: 'pending' },
            { label: '處理中 in progress', value: 'in_progress' },
            { label: '已完成 done', value: 'done' },
            { label: '失敗 failed', value: 'failed' },
            { label: '跳過（已有圖）skipped', value: 'skipped' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'lastAttemptAt',
          label: '最後嘗試時間',
          type: 'date',
          admin: {
            readOnly: true,
            date: { displayFormat: 'yyyy-MM-dd HH:mm' },
          },
        },
        {
          name: 'lastError',
          label: '最後錯誤訊息',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'processedCount',
          label: '已處理圖數',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: { readOnly: true },
        },
        {
          name: 'totalCount',
          label: '總目標圖數',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'marginInsight',
      label: '毛利洞察',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/ProductMarginInsight',
        },
      },
    },
    {
      name: 'wizardLauncher',
      label: '建立精靈',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '@/components/admin/ProductWizardLauncher',
        },
      },
    },

    /* ════════════════════════════════════════════════
     *  TABS：主編輯區
     * ════════════════════════════════════════════════ */
    {
      type: 'tabs',
      tabs: [
        /* ── Tab 1：基本與價格 ── */
        {
          label: '① 基本與價格',
          description: '商品名稱、價格、分類、標籤與基礎內容設定',
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
              name: 'aliasSlugs',
              label: '舊 URL / 別名',
              type: 'array',
              admin: {
                description:
                  '從舊系統（如 Shopline）匯入的 URL slug。前台 PDP 找不到 slug 時會用這裡 fallback 並 301 redirect 到目前 slug。',
                initCollapsed: true,
              },
              fields: [
                {
                  name: 'slug',
                  type: 'text',
                  required: true,
                  admin: {
                    description:
                      '完整 slug 字串（不含 /products/），例如：現貨-率性反摺牛仔寬褲-藍色-free--ecbd15',
                  },
                },
                {
                  name: 'source',
                  type: 'select',
                  defaultValue: 'manual',
                  options: [
                    { label: '手動補', value: 'manual' },
                    { label: 'Shopline 匯入', value: 'shopline' },
                    { label: 'CSV 匯入', value: 'csv' },
                    { label: '其他舊系統', value: 'other' },
                  ],
                },
              ],
              hooks: {
                beforeValidate: [
                  ({ value }) => {
                    if (!Array.isArray(value)) return value
                    const seen = new Set<string>()
                    return value.filter((row: { slug?: string }) => {
                      const s = (row?.slug || '').trim()
                      if (!s || seen.has(s)) return false
                      seen.add(s)
                      return true
                    })
                  },
                ],
              },
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
            /* 自動計價（採購成本 → 建議售價） */
            {
              name: 'autoPricing',
              label: '🧮 自動計價（採購成本 → 建議售價）',
              type: 'group',
              admin: {
                description:
                  '填採購金額（韓元 / 日圓 / 美元 / 人民幣）+ 商品重量，系統自動算建議售價。' +
                  '勾「使用自動計價」存檔時自動覆寫「原價」；公式設定在「⑦ 系統與安全 → 商品計價公式」。',
              },
              fields: [
                {
                  name: 'useAutoPricing',
                  label: '使用自動計價（存檔時自動覆寫下方原價）',
                  type: 'checkbox',
                  defaultValue: false,
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'costAmount',
                      label: '採購金額',
                      type: 'number',
                      min: 0,
                      admin: {
                        width: '60%',
                        description: '採購幣別填寫（不填 = 跳過自動計價）',
                      },
                    },
                    {
                      name: 'costCurrencyCode',
                      label: '採購幣別',
                      type: 'select',
                      defaultValue: 'KRW',
                      options: [
                        { label: '韓元 KRW', value: 'KRW' },
                        { label: '日圓 JPY', value: 'JPY' },
                        { label: '美元 USD', value: 'USD' },
                        { label: '人民幣 CNY', value: 'CNY' },
                      ],
                      admin: { width: '40%' },
                    },
                  ],
                },
                {
                  name: 'pricingPreview',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/AutoPricingPreview',
                    },
                  },
                },
              ],
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
                  admin: {
                    width: '50%',
                    description:
                      '勾上方「使用自動計價」時存檔自動覆寫；不勾則手填',
                  },
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
            /* 稅務類別 */
            {
              name: 'taxCategory',
              label: '課稅類別',
              type: 'select',
              defaultValue: 'standard',
              options: [
                { label: '應稅 5%', value: 'standard' },
                { label: '優惠稅率 0%', value: 'reduced' },
                { label: '免稅', value: 'exempt' },
                { label: '零稅率（外銷）', value: 'zero_rated' },
              ],
              admin: {
                description: '預設為應稅 5%。詳細稅率設定在「稅務設定」global',
              },
            },
            /* 分類 & 標籤 — 主分類（單選）+ 其他分類（多選）由 TreePicker 統一操作 */
            {
              name: 'category',
              label: '主分類',
              type: 'relationship',
              relationTo: 'categories',
              required: true,
              admin: {
                description:
                  '主分類用於前台麵包屑 / SEO / productCount 統計（單選必填）',
                components: {
                  Field: '@/components/admin/ProductCategoryTreePicker',
                },
              },
            },
            {
              name: 'additionalCategories',
              label: '其他分類',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
              admin: {
                hidden: true,
                description:
                  '隱藏欄位 — 由「主分類」上方的 TreePicker 一併操作',
              },
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
                { label: '韓星同款', value: 'korean-celebrity' },
              ],
              admin: {
                description:
                  '選擇此商品所屬的主題專區（可多選）。「韓星同款」會在前台 PDP 顯示專屬徽章 + 出現在 /products?tag=korean-celebrity 篩選結果。',
              },
            },
            {
              name: 'koreanCelebrityRef',
              label: '韓星 / 韓劇參考（如為韓星同款）',
              type: 'group',
              admin: {
                description:
                  '若有勾選「韓星同款」，建議填入細節以強化單品故事性。前台 PDP 會在徽章 hover 顯示。',
                condition: (_data, siblingData) =>
                  Array.isArray(siblingData?.collectionTags) &&
                  siblingData.collectionTags.includes('korean-celebrity'),
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'celebrityName',
                      label: '韓星名稱',
                      type: 'text',
                      admin: { width: '50%', description: '例如 IU、Jennie、宋慧喬' },
                    },
                    {
                      name: 'dramaOrShow',
                      label: '出現的劇 / 節目',
                      type: 'text',
                      admin: { width: '50%', description: '例如 我的出走日記 第 5 集' },
                    },
                  ],
                },
                {
                  name: 'sourceBrand',
                  label: '原韓國品牌',
                  type: 'text',
                  admin: {
                    description: '例如 Mardi Mercredi / Stand Oil。便於 SEO 與信任感建立',
                  },
                },
              ],
            },
            /* 重量 + 尺寸（對應 dimensions_length/width/height） */
            {
              type: 'row',
              fields: [
                {
                  name: 'weight',
                  label: '商品重量（公克）',
                  type: 'number',
                  min: 0,
                  admin: {
                    width: '25%',
                    description: '用於運費計算',
                  },
                },
                {
                  name: 'dimensions',
                  label: '商品尺寸（cm）',
                  type: 'group',
                  admin: {
                    width: '75%',
                    description: '長 × 寬 × 高（公分）',
                  },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'length',
                          label: '長',
                          type: 'number',
                          min: 0,
                          admin: { width: '33%' },
                        },
                        {
                          name: 'width',
                          label: '寬',
                          type: 'number',
                          min: 0,
                          admin: { width: '33%' },
                        },
                        {
                          name: 'height',
                          label: '高',
                          type: 'number',
                          min: 0,
                          admin: { width: '34%' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: 'purchaseLimit',
              label: '單人限購數量',
              type: 'number',
              min: 0,
              defaultValue: 0,
              admin: {
                description: '單人單次最多購買數量。0 表示不限',
              },
            },
          ],
        },

        /* ── Tab 2：媒體與變體 ── */
        {
          label: '② 媒體與變體',
          description: '封面圖、圖庫、變體、庫存與預購設定',
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
              name: 'introVideo',
              label: '商品介紹影片',
              type: 'upload',
              relationTo: 'media',
              filterOptions: {
                mimeType: {
                  contains: 'video',
                },
              },
              admin: {
                description: '可放在 PDP 主圖上方（建議 9:16 或 4:5 直式短影片）',
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
                  type: 'row',
                  fields: [
                    {
                      name: 'category',
                      label: '圖片類型',
                      type: 'select',
                      defaultValue: 'detail',
                      options: [
                        { label: '封面', value: 'cover' },
                        { label: '正面', value: 'front' },
                        { label: '背面', value: 'back' },
                        { label: '側面', value: 'side' },
                        { label: '細節', value: 'detail' },
                        { label: '模特兒', value: 'model' },
                        { label: '搭配示意', value: 'styling' },
                        { label: '尺寸表', value: 'size_chart' },
                        { label: '其他', value: 'other' },
                      ],
                      admin: {
                        width: '40%',
                        description: '前台 PDP 可依此分類過濾顯示',
                      },
                    },
                    {
                      name: 'caption',
                      label: '圖說（選填）',
                      type: 'text',
                      admin: {
                        width: '60%',
                        description: '例如：背面細節、模特兒身高 168cm 穿 M',
                      },
                    },
                  ],
                },
              ],
            },
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
                components: {
                  Field: '@/components/admin/VariantInlineTable',
                },
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
                        description:
                          'HEX 色碼。可手填、從色塊圖滴管取色、或一鍵取主色（需先上傳右側色塊圖）',
                        components: {
                          Field: '@/components/admin/ColorEyedropperField',
                        },
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
                {
                  name: 'gtin',
                  label: 'GTIN / 條碼',
                  type: 'text',
                  admin: {
                    description:
                      '此變體（SKU）的 GTIN / EAN / UPC / ISBN。Meta / Google Shopping 動態廣告匹配商品時使用，沒有可留空但會降低廣告投放精準度。',
                  },
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

        /* ── Tab 3：穿搭與 SEO ── */
        {
          label: '③ 穿搭與 SEO',
          description: '材質、模特資訊、穿搭建議與 SEO 設定',
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
              name: 'materialDescription',
              label: '材質詳細說明',
              type: 'textarea',
              admin: {
                description:
                  '材質手感、織法、保暖度、適合季節等補充說明，會顯示在前台「商品資訊」區塊。',
              },
            },
            {
              name: 'materialImages',
              label: '材質說明圖片',
              type: 'array',
              admin: {
                description:
                  '材質特寫、織法圖、洗標、吊牌等補充圖；會顯示在前台「商品資訊」區塊。建議 1-4 張。',
                initCollapsed: true,
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
                  admin: { description: '例如：100% 純棉特寫、洗標說明' },
                },
              ],
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
            {
              name: 'personalityTypes',
              label: '適合的個性類型 (MBTI)',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'INTJ 建築師', value: 'INTJ' },
                { label: 'INTP 邏輯學家', value: 'INTP' },
                { label: 'ENTJ 指揮官', value: 'ENTJ' },
                { label: 'ENTP 辯論家', value: 'ENTP' },
                { label: 'INFJ 提倡者', value: 'INFJ' },
                { label: 'INFP 調停者', value: 'INFP' },
                { label: 'ENFJ 主人公', value: 'ENFJ' },
                { label: 'ENFP 競選者', value: 'ENFP' },
                { label: 'ISTJ 物流師', value: 'ISTJ' },
                { label: 'ISFJ 守衛者', value: 'ISFJ' },
                { label: 'ESTJ 總經理', value: 'ESTJ' },
                { label: 'ESFJ 執政官', value: 'ESFJ' },
                { label: 'ISTP 鑑賞家', value: 'ISTP' },
                { label: 'ISFP 探險家', value: 'ISFP' },
                { label: 'ESTP 企業家', value: 'ESTP' },
                { label: 'ESFP 表演者', value: 'ESFP' },
              ],
              admin: {
                description: '建議勾選 1-4 個此商品最適合的 MBTI 類型；新建商品儲存時會依 tag/分類自動推薦（已勾選則尊重不覆蓋）',
                components: {
                  Field: '@/components/admin/MBTIAutoRecommendField',
                },
              },
            },
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

        /* ── Tab 4：廣告與進階 ── */
        {
          label: '④ 廣告與進階',
          description:
            'Meta / Google Shopping 動態廣告所需欄位與進階投放設定。留空欄位會 fallback 到「廣告目錄設定」global 的預設值。',
          fields: [
            {
              name: 'excludeFromAdsCatalog',
              label: '排除在廣告目錄外',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description:
                  '勾選後此商品不會出現在 /feeds/meta.xml 與 /feeds/google.xml，動態廣告抓不到此商品。',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'adsGender',
                  label: '性別',
                  type: 'select',
                  defaultValue: 'female',
                  options: [
                    { label: '女性', value: 'female' },
                    { label: '男性', value: 'male' },
                    { label: '中性 / 不分性別', value: 'unisex' },
                  ],
                  admin: {
                    width: '33%',
                    description: 'Meta / Google 用來投放正確性別受眾',
                  },
                },
                {
                  name: 'adsAgeGroup',
                  label: '年齡層',
                  type: 'select',
                  defaultValue: 'adult',
                  options: [
                    { label: '成人 Adult', value: 'adult' },
                    { label: '青少年 Teen', value: 'teen' },
                    { label: '兒童 Kids', value: 'kids' },
                    { label: '幼兒 Toddler', value: 'toddler' },
                    { label: '嬰兒 Infant', value: 'infant' },
                    { label: '新生兒 Newborn', value: 'newborn' },
                  ],
                  admin: { width: '33%' },
                },
                {
                  name: 'adsCondition',
                  label: '商品狀況',
                  type: 'select',
                  defaultValue: 'new',
                  options: [
                    { label: '全新 New', value: 'new' },
                    { label: '整新品 Refurbished', value: 'refurbished' },
                    { label: '二手 Used', value: 'used' },
                  ],
                  admin: { width: '34%' },
                },
              ],
            },
            {
              name: 'googleProductCategory',
              label: 'Google 商品分類',
              type: 'text',
              admin: {
                description:
                  '依 Google Product Taxonomy 填寫，例如「Apparel & Accessories > Clothing > Dresses」' +
                  '或數字 ID「2271」。留空時用「廣告目錄設定」的全站預設值。' +
                  '完整列表：https://support.google.com/merchants/answer/6324436',
              },
            },
            {
              name: 'productType',
              label: '商品類型（自家分類）',
              type: 'text',
              admin: {
                description:
                  '品牌自訂的分類路徑，例如「女裝 > 洋裝 > 韓系小洋裝」。留空 = 用 category collection 名稱。',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'gtin',
                  label: 'GTIN / 條碼（商品層級）',
                  type: 'text',
                  admin: {
                    width: '33%',
                    description: '商品共用 GTIN（每個 SKU 變體可在「變體與庫存」分別覆寫）',
                  },
                },
                {
                  name: 'mpn',
                  label: 'MPN 製造商料號',
                  type: 'text',
                  admin: {
                    width: '33%',
                    description: '無 GTIN 時 Google 要求 brand + mpn 組合替代',
                  },
                },
                {
                  name: 'hsCode',
                  label: 'HS Code',
                  type: 'text',
                  admin: {
                    width: '34%',
                    description: '海關 HS code，跨境運送用',
                  },
                },
              ],
            },
            {
              name: 'adsTitleOverride',
              label: '廣告標題（覆寫）',
              type: 'text',
              admin: {
                description:
                  '留空 = 用商品名稱。Meta/Google 廣告標題建議塞入主要關鍵字（如「韓系小洋裝 V領 米杏色」），與前台商品名不同調性可在此覆寫。最多 150 字元。',
              },
              maxLength: 150,
            },
            {
              name: 'adsDescriptionOverride',
              label: '廣告描述（覆寫）',
              type: 'textarea',
              admin: {
                description:
                  '留空 = 用「簡短描述」或商品描述純文字。建議 200-500 字，含材質、版型、適合場合等關鍵字。',
              },
              maxLength: 5000,
            },
          ],
        }
      ],
    },
  ],
}
