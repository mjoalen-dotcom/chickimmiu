/**
 * Meta Commerce Catalog — Batch API push
 * ───────────────────────────────────────
 * Real-time 推送商品變動到 Meta Catalog（避開 daily feed 爬取延遲）。
 *
 * 用 Meta `items_batch` endpoint 一次推一個商品的所有變體 SKU：
 *   POST /v25.0/{catalog-id}/items_batch
 *
 * 啟用條件（任一缺 = no-op）：
 *   1. token: env META_CAPI_ACCESS_TOKEN OR AdsCatalogSettings.meta.systemUserToken
 *      （JinHow 那條 System User token 已含 catalog_management scope，可複用）
 *   2. catalog_id: AdsCatalogSettings.meta.catalogId
 *   3. AdsCatalogSettings.general.enabled = true
 *
 * 失敗永遠不丟錯（admin 存檔成功優先，廣告同步 best-effort）。
 *
 * 變體展開：複用 `feedBuilder.buildItemsForProduct` 同 SKU 邏輯，feed XML 跟 batch
 * push 看到的 catalog item 結構保持一致（Meta 後台不會出現「feed 跟 batch 對不上」
 * 的錯誤）。
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'

import type { AdsCatalogSetting, Category, Product } from '../../payload-types'
import { buildItemsForProduct, type FeedItem } from './feedBuilder'

const META_API_VERSION = 'v25.0'

interface BatchPushConfig {
  catalogId: string
  accessToken: string
  source: 'env' | 'db'
}

async function resolveBatchPushConfig(
  payload: Payload,
): Promise<{ cfg: BatchPushConfig; settings: AdsCatalogSetting } | null> {
  let settings: AdsCatalogSetting
  try {
    settings = (await payload.findGlobal({
      slug: 'ads-catalog-settings',
      depth: 0,
    })) as AdsCatalogSetting
  } catch (err) {
    console.warn('[CatalogBatch] AdsCatalogSettings lookup failed', err)
    return null
  }

  if (!settings?.general?.enabled) return null

  const catalogId = settings?.meta?.catalogId?.trim()
  if (!catalogId) return null

  const envToken = process.env.META_CAPI_ACCESS_TOKEN || ''
  if (envToken) {
    return { cfg: { catalogId, accessToken: envToken, source: 'env' }, settings }
  }

  const dbToken = settings?.meta?.systemUserToken?.trim()
  if (dbToken) {
    return { cfg: { catalogId, accessToken: dbToken, source: 'db' }, settings }
  }

  return null
}

/**
 * Map FeedItem (RSS/feed shape) → Meta Catalog items_batch data shape.
 *
 * Meta items_batch 跟 RSS feed 欄位 90% 重疊但 key 名稱微異：
 *   feed `image_link`           → batch `image_url`
 *   feed `additional_image_link` → batch `additional_image_link` (array)
 *   feed `g:availability`       → batch `availability` (snake_case 都認)
 *   feed `g:identifier_exists` false → batch 略過 / 不送
 */
function feedItemToCatalogData(item: FeedItem): Record<string, unknown> {
  const data: Record<string, unknown> = {
    availability: item.availability,
    brand: item.brand,
    category: item.googleProductCategory ?? undefined,
    condition: item.condition,
    description: item.description,
    image_url: item.imageLink ?? undefined,
    link: item.link,
    price: item.price,
    title: item.title,
    age_group: item.ageGroup,
    gender: item.gender,
  }

  if (item.itemGroupId) data.item_group_id = item.itemGroupId
  if (item.salePrice) data.sale_price = item.salePrice
  if (item.color) data.color = item.color
  if (item.size) data.size = item.size
  if (item.gtin) data.gtin = item.gtin
  if (item.mpn) data.mpn = item.mpn
  if (item.productType) data.product_type = item.productType
  if (item.additionalImageLinks.length > 0) {
    data.additional_image_link = item.additionalImageLinks
  }

  return data
}

export type BatchMethod = 'CREATE' | 'UPDATE' | 'DELETE'

interface BatchRequest {
  method: BatchMethod
  retailer_id: string
  data?: Record<string, unknown>
}

/**
 * 推送單一商品到 Meta Catalog（變體會展成多個 batch entries，shared item_group_id）。
 *
 * - method='UPDATE'（含 CREATE 語意，Meta 會自動 upsert by retailer_id）
 *   用於 Products.afterChange
 *
 * - method='DELETE'
 *   用於 Products.afterDelete（或商品 unpublished）
 *   會送一筆 retailer_id = product slug 把 catalog 整組刪掉；變體則由
 *   Meta 自己 cascade 刪除（因為共用 item_group_id）
 *
 * @returns 推送結果 — 永不丟錯，只 console.log/warn
 */
export async function pushProductToCatalog(
  productId: number | string,
  method: 'UPDATE' | 'DELETE',
  options?: { siteUrl?: string },
): Promise<{ ok: boolean; sent?: number; reason?: string; handles?: string[] }> {
  let payload: Payload
  try {
    payload = await getPayload({ config })
  } catch (err) {
    console.warn('[CatalogBatch] getPayload failed', err)
    return { ok: false, reason: 'payload_init_failed' }
  }

  const resolved = await resolveBatchPushConfig(payload)
  if (!resolved) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CatalogBatch] no-op: missing catalogId or accessToken or feed disabled')
    }
    return { ok: false, reason: 'missing_config' }
  }
  const { cfg, settings } = resolved

  const siteUrl =
    options?.siteUrl?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://chickimmiu.com'

  // ── Build batch ──
  let requests: BatchRequest[] = []

  if (method === 'DELETE') {
    // 商品被刪 → 用 product slug 當 retailer_id 拼裝可能的 SKU id 也行，
    // 但 Meta 比較好處理的方式：DELETE 整個 item_group_id（slug）；
    // 個別變體 SKU 由 Meta 一起回收
    let product: Product | null = null
    try {
      product = (await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 1,
      })) as Product
    } catch {
      // 已不存在 = 用 productId 當 retailer_id 試刪
    }

    if (product) {
      const items = buildItemsForProduct(
        product,
        product.category && typeof product.category === 'object'
          ? (product.category as Category)
          : null,
        settings,
        siteUrl,
      )
      requests = items.map((item) => ({
        method: 'DELETE' as BatchMethod,
        retailer_id: item.id,
      }))
    } else {
      requests = [{ method: 'DELETE' as BatchMethod, retailer_id: String(productId) }]
    }
  } else {
    // UPDATE / CREATE
    let product: Product
    try {
      product = (await payload.findByID({
        collection: 'products',
        id: productId,
        depth: 1,
      })) as Product
    } catch (err) {
      console.warn('[CatalogBatch] product not found', productId, err)
      return { ok: false, reason: 'product_not_found' }
    }

    // Skip rules: excluded / unpublished / draft
    if (product.excludeFromAdsCatalog) {
      return { ok: false, reason: 'excluded_from_ads_catalog' }
    }
    if (product.status !== 'published') {
      // Unpublished → DELETE from catalog (don't show in ads)
      return pushProductToCatalog(productId, 'DELETE', options)
    }

    const items = buildItemsForProduct(
      product,
      product.category && typeof product.category === 'object'
        ? (product.category as Category)
        : null,
      settings,
      siteUrl,
    )

    const includeOutOfStock = settings.general?.includeOutOfStock !== false
    const filtered = includeOutOfStock
      ? items
      : items.filter((i) => i.availability !== 'out of stock')

    if (filtered.length === 0) {
      return { ok: false, reason: 'no_items_after_filter' }
    }

    requests = filtered.map((item) => ({
      method: 'UPDATE' as BatchMethod, // Meta upsert
      retailer_id: item.id,
      data: feedItemToCatalogData(item),
    }))
  }

  if (requests.length === 0) {
    return { ok: false, reason: 'no_requests' }
  }

  // ── POST to Meta ──
  const url = `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(
    cfg.catalogId,
  )}/items_batch`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: cfg.accessToken,
        item_type: 'PRODUCT_ITEM',
        requests,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(
        `[CatalogBatch] Meta API ${res.status}: ${text.slice(0, 500)} (productId=${productId} method=${method})`,
      )
      return { ok: false, reason: `http_${res.status}` }
    }

    const body = (await res.json()) as { handles?: string[]; validation_status?: unknown }
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[CatalogBatch] ${method} sent ${requests.length} items (productId=${productId} source=${cfg.source})`,
        body,
      )
    }
    return { ok: true, sent: requests.length, handles: body.handles }
  } catch (err) {
    console.error('[CatalogBatch] fetch error', err)
    return { ok: false, reason: 'fetch_failed' }
  }
}
