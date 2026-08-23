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
 *   4. AdsCatalogSettings.meta.catalogPushEnabled ≠ false（後台手動總開關）
 *
 * 失敗永遠不丟錯（admin 存檔成功優先，廣告同步 best-effort）。
 *
 * 變體展開：複用 `feedBuilder.buildItemsForProduct` 同 SKU 邏輯，feed XML 跟 batch
 * push 看到的 catalog item 結構保持一致（Meta 後台不會出現「feed 跟 batch 對不上」
 * 的錯誤）。
 *
 * ── 熔斷器（2026-08-24 加）──
 * 這條路徑的失敗有兩種完全不同的性質，舊版一律「印一行 500 字錯誤然後下次照打」：
 *   - 設定型錯誤（catalog 不存在／系統使用者沒被指派該目錄／token 失效）：
 *     沒有人去 Meta 後台處理就永遠不會好。實際後果是自 2026-05-05 建立
 *     catalog 993253493044710 卻沒完成資產指派之後，每一次商品存檔都對 Meta
 *     打一發必敗的 POST，錯誤只沉在 pm2 log 裡沒人看見（分類重整那種批次腳本
 *     一跑就是幾百發）。
 *   - 暫時性錯誤（5xx / is_transient / 429 / 網路）：等一下就會好。
 * 現在兩者分開處理：設定型錯誤一次就跳閘冷卻 6 小時、暫時性錯誤連續 5 次才跳閘
 * 冷卻 5 分鐘；跳閘期間直接 no-op 不打 API，並把可讀狀態寫回後台
 * `廣告目錄設定 → Meta → 最近推送狀態`，Alan 不必翻 log 就看得到。
 * 熔斷狀態的 key 綁 catalogId + token 尾碼——後台一改設定立刻重試，不用重啟 pm2。
 */

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-sqlite'

import type { AdsCatalogSetting, Category, Product } from '../../payload-types'
import { runSql } from '../db/dialectSafeSql'
import { buildItemsForProduct, type FeedItem } from './feedBuilder'

const META_API_VERSION = 'v25.0'

/** 設定型錯誤：非人工處理不會好，冷卻久一點 */
const PERMANENT_COOLDOWN_MS = 6 * 60 * 60 * 1000
/** 暫時性錯誤：Meta 自己會恢復，冷卻短一點 */
const TRANSIENT_COOLDOWN_MS = 5 * 60 * 1000
/** 暫時性錯誤連續幾次才跳閘 */
const TRANSIENT_STRIKES = 5
/** 跳閘期間最多多久印一次「已略過 N 次」摘要 */
const SUPPRESS_LOG_INTERVAL_MS = 30 * 60 * 1000
/** 成功狀態最多多久回寫後台一次（批次改商品時不要每件都寫 DB） */
const SUCCESS_STATUS_INTERVAL_MS = 10 * 60 * 1000
/** 寫回後台的狀態字串長度上限 */
const STATUS_MAX_LEN = 500

interface BatchPushConfig {
  catalogId: string
  accessToken: string
  source: 'env' | 'db'
}

type FailureKind = 'permanent' | 'transient'

interface BreakerState {
  /** catalogId + token 尾碼；設定一改就整組重置 */
  key: string
  openUntil: number
  kind: FailureKind | null
  summary: string
  /** 跳閘期間被略過的推送次數 */
  suppressed: number
  transientStrikes: number
  lastSuppressLogAt: number
  lastSuccessStatusAt: number
}

const breaker: BreakerState = {
  key: '',
  openUntil: 0,
  kind: null,
  summary: '',
  suppressed: 0,
  transientStrikes: 0,
  lastSuppressLogAt: 0,
  lastSuccessStatusAt: 0,
}

function resetBreaker(key: string) {
  breaker.key = key
  breaker.openUntil = 0
  breaker.kind = null
  breaker.summary = ''
  breaker.suppressed = 0
  breaker.transientStrikes = 0
  breaker.lastSuppressLogAt = 0
  breaker.lastSuccessStatusAt = 0
}

function breakerKeyOf(cfg: BatchPushConfig): string {
  return `${cfg.catalogId}::${cfg.accessToken.slice(-8)}::${cfg.source}`
}

/**
 * 把狀態寫回 AdsCatalogSettings.meta.lastPushStatus。
 *
 * 刻意走原子 SQL 而不是 payload.updateGlobal：updateGlobal 會觸發該 global 的
 * afterChange（裡面有 revalidatePath），在 hook 的 fire-and-forget 情境下跑
 * revalidatePath 沒有 request context，而且推送狀態只是給人看的欄位，不該把
 * 整個 feed cache 打掉。寫失敗完全吞掉——這是觀測性欄位，不能反過來害到推送。
 */
async function persistStatus(payload: Payload, status: string): Promise<void> {
  try {
    await runSql(
      payload,
      sql`UPDATE ads_catalog_settings SET meta_last_push_status = ${status.slice(0, STATUS_MAX_LEN)}`,
    )
  } catch {
    /* 觀測性欄位，寫不進去不影響推送本身 */
  }
}

function nowStamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * 判斷 Meta 這次的失敗要不要當成「設定型」。
 *
 * 判準以 error 物件為主、HTTP status 為輔：
 *   - `is_transient: true` → 一律暫時性（Meta 自己標的最準）
 *   - code 100 / subcode 33 → 物件不存在或無權限（我們現在踩的就是這個）
 *   - code 190 / 102 → token 失效或 session 過期
 *   - code 10 / 200 / 3   → 權限不足、缺 scope
 *   - 429 / 5xx / 其他網路層 → 暫時性
 *   - 其餘 4xx → 當成設定型（request 本身有問題，重打不會變好）
 */
function classifyMetaFailure(
  status: number,
  rawBody: string,
): { kind: FailureKind; summary: string } {
  let code: number | undefined
  let subcode: number | undefined
  let message = ''
  let isTransient = false

  try {
    const parsed = JSON.parse(rawBody) as {
      error?: {
        code?: number
        error_subcode?: number
        message?: string
        is_transient?: boolean
      }
    }
    code = parsed?.error?.code
    subcode = parsed?.error?.error_subcode
    message = parsed?.error?.message ?? ''
    isTransient = parsed?.error?.is_transient === true
  } catch {
    message = rawBody.slice(0, 200)
  }

  const shortMessage = (message || `HTTP ${status}`).slice(0, 200)
  const codeLabel = code == null ? `HTTP ${status}` : `code ${code}${subcode == null ? '' : `/${subcode}`}`

  if (isTransient || status === 429 || status >= 500) {
    return { kind: 'transient', summary: `${codeLabel}：${shortMessage}` }
  }

  if (code === 100 && subcode === 33) {
    return {
      kind: 'permanent',
      summary:
        `${codeLabel}：目錄不存在或系統使用者無權限。請到 Meta 企業設定 → 使用者 → ` +
        `系統使用者 → 指派資產 → 目錄，把該目錄加給這條 token 的系統使用者並勾選「管理目錄」；` +
        `或把後台的 Catalog ID 換成已授權的目錄。`,
    }
  }

  if (code === 190 || code === 102) {
    return { kind: 'permanent', summary: `${codeLabel}：存取權杖失效或已過期，需重新產生 System User Token。` }
  }

  if (code === 10 || code === 200 || code === 3) {
    return { kind: 'permanent', summary: `${codeLabel}：權限不足（缺 catalog_management 等 scope）。${shortMessage}` }
  }

  if (status >= 400 && status < 500) {
    return { kind: 'permanent', summary: `${codeLabel}：${shortMessage}` }
  }

  return { kind: 'transient', summary: `${codeLabel}：${shortMessage}` }
}

/**
 * 記一次失敗，必要時跳閘。
 * @returns 這次有沒有從「正常」轉成「跳閘」（只有轉態才印完整錯誤 + 寫後台）
 */
async function recordFailure(
  payload: Payload,
  catalogId: string,
  kind: FailureKind,
  summary: string,
): Promise<void> {
  const now = Date.now()

  if (kind === 'transient') {
    breaker.transientStrikes += 1
    if (breaker.transientStrikes < TRANSIENT_STRIKES) {
      console.warn(
        `[CatalogBatch] 暫時性失敗 ${breaker.transientStrikes}/${TRANSIENT_STRIKES}（catalog=${catalogId}）：${summary}`,
      )
      return
    }
  }

  const cooldown = kind === 'permanent' ? PERMANENT_COOLDOWN_MS : TRANSIENT_COOLDOWN_MS
  const wasOpen = breaker.openUntil > now
  breaker.openUntil = now + cooldown
  breaker.kind = kind
  breaker.summary = summary
  breaker.transientStrikes = 0

  if (wasOpen) return

  const label = kind === 'permanent' ? '設定問題' : '連續暫時性失敗'
  const minutes = Math.round(cooldown / 60000)
  const line =
    `❌ ${nowStamp()} 已熔斷（${label}）：${summary} ` +
    `→ 暫停即時推送 ${minutes} 分鐘；改後台 Catalog ID／Token 會立刻重試。`

  console.error(`[CatalogBatch] ${line} (catalog=${catalogId})`)
  await persistStatus(payload, line)
}

/**
 * 推送成功：關閘 + 清計數。
 *
 * 狀態欄位只在「剛從失敗恢復」或「距上次寫入超過節流間隔」時才寫——批次腳本
 * 一次改幾百件商品時，不該連帶產生幾百筆 global UPDATE。
 */
async function recordSuccess(payload: Payload, catalogId: string, sent: number): Promise<void> {
  const recovered = breaker.openUntil > 0 || breaker.transientStrikes > 0
  breaker.openUntil = 0
  breaker.kind = null
  breaker.summary = ''
  breaker.transientStrikes = 0
  breaker.suppressed = 0
  breaker.lastSuppressLogAt = 0

  if (recovered) {
    console.log(`[CatalogBatch] 已恢復（catalog=${catalogId}）`)
  }

  const now = Date.now()
  if (!recovered && now - breaker.lastSuccessStatusAt < SUCCESS_STATUS_INTERVAL_MS) return
  breaker.lastSuccessStatusAt = now
  await persistStatus(payload, `✅ ${nowStamp()} 推送成功，本次 ${sent} 筆 SKU（catalog ${catalogId}）`)
}

/**
 * 跳閘中就直接擋掉，並做 log 節流。
 * @returns true = 這次要跳過推送
 */
function shouldSkipForBreaker(key: string, catalogId: string): boolean {
  if (breaker.key !== key) {
    // catalogId / token 換過了 → 視為新設定，立刻重試
    resetBreaker(key)
    return false
  }

  const now = Date.now()
  if (breaker.openUntil <= now) return false

  breaker.suppressed += 1
  if (now - breaker.lastSuppressLogAt >= SUPPRESS_LOG_INTERVAL_MS) {
    breaker.lastSuppressLogAt = now
    console.warn(
      `[CatalogBatch] 熔斷中，已略過 ${breaker.suppressed} 次推送（catalog=${catalogId}）：${breaker.summary}`,
    )
  }
  return true
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
  // 後台手動總開關：只有明確關掉才停（NULL / undefined = 沿用既有行為）
  if (settings?.meta?.catalogPushEnabled === false) return null

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
      console.log('[CatalogBatch] no-op: missing catalogId or accessToken or push disabled')
    }
    return { ok: false, reason: 'missing_config' }
  }
  const { cfg, settings } = resolved

  // 熔斷中就不要再打 Meta——這一步刻意放在展開變體之前，跳閘期間連
  // findByID / buildItemsForProduct 的成本都省掉。
  if (shouldSkipForBreaker(breakerKeyOf(cfg), cfg.catalogId)) {
    return { ok: false, reason: 'circuit_open' }
  }

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
      const { kind, summary } = classifyMetaFailure(res.status, text)
      await recordFailure(payload, cfg.catalogId, kind, summary)
      return { ok: false, reason: `http_${res.status}` }
    }

    const body = (await res.json()) as { handles?: string[]; validation_status?: unknown }
    await recordSuccess(payload, cfg.catalogId, requests.length)
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[CatalogBatch] ${method} sent ${requests.length} items (productId=${productId} source=${cfg.source})`,
        body,
      )
    }
    return { ok: true, sent: requests.length, handles: body.handles }
  } catch (err) {
    await recordFailure(
      payload,
      cfg.catalogId,
      'transient',
      `連線失敗：${err instanceof Error ? err.message : String(err)}`,
    )
    return { ok: false, reason: 'fetch_failed' }
  }
}

/** 測試用：把熔斷器歸零（正式流程不呼叫） */
export function __resetCatalogBreakerForTest(): void {
  resetBreaker('')
}
