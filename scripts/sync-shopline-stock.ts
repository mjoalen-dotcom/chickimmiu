/**
 * Shopline XLSX 庫存同步 — payload run 腳本（LB-04）
 * ──────────────────────────────────────────────────
 * 從 Shopline 匯出的 BulkUpdateForm .xlsx 只同步「庫存數字」到既有商品：
 *   - 有變體的商品：逐變體按 SKU 對 stock
 *   - 無變體的商品：對 product.stock
 *   - 絕不 create 商品/變體、絕不動價格/文案/圖片/slug 等其他欄位
 *
 * 對齊邏輯與 scripts/import-shopline-xlsx.ts 相同的 3-tier match：
 *   sourcing.sourceId → productSku → variants.sku
 * 對不到的商品一律跳過並列入報告。
 *
 * 用法（在 prod，cd /var/www/chickimmiu）：
 *   # 預設 dry run，只列 diff 不寫 DB
 *   IMPORT_FILE=/tmp/shopline-stock.xlsx pnpm payload run scripts/sync-shopline-stock.ts
 *   # 確認 diff 沒問題後真寫入
 *   IMPORT_FILE=/tmp/shopline-stock.xlsx IMPORT_DRY_RUN=0 pnpm payload run scripts/sync-shopline-stock.ts
 *
 * Env vars:
 *   IMPORT_FILE      - 單一 xlsx 檔（優先於 IMPORT_DIR）
 *   IMPORT_DIR       - 目錄內所有 .xlsx 依檔名排序處理
 *   IMPORT_DRY_RUN   - 預設 1（dry run）；設 0 才會真的寫入 DB
 *   IMPORT_LIMIT     - 每檔最多處理 N 筆商品（測試用，預設 0=全跑）
 *
 * 報告：
 *   - console 摘要：同步/跳過/失敗筆數、增/減/歸零分布、>0→0 清單（防呆抽查）
 *   - 完整 JSON 報告寫到 xlsx 同目錄 sync-stock-report-<timestamp>.json
 *
 * 注意：
 *   - Shopline 匯出的空白 Quantity 視為 0（與 parser 對變體的處理一致）。
 *     所以「庫存 >0 會變 0」清單一定要人工抽查過再跑 IMPORT_DRY_RUN=0。
 *   - 變體更新會把既有 variants array 整組帶回（含 row id），只改 stock 欄位，
 *     其他欄位（colorName/colorSwatch/priceOverride/gtin…）原樣保留。
 *   - Products.beforeChange hook 會自動用變體加總覆蓋 product.stock 與 isLowStock。
 */

import fs from 'fs'
import path from 'path'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import config from '@payload-config'
import { parseShoplineXlsx, type ShoplineProduct } from '../src/lib/shopline/xlsxParser'

type ProductData = RequiredDataFromCollectionSlug<'products'>

const DRY_RUN = process.env.IMPORT_DRY_RUN !== '0' // 預設 dry run
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '0', 10) || 0
const SINGLE_FILE = process.env.IMPORT_FILE
const IMPORT_DIR = process.env.IMPORT_DIR

const log = (msg: string) => {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`[${t}] ${msg}`)
}

function listFiles(): string[] {
  if (SINGLE_FILE) {
    if (!fs.existsSync(SINGLE_FILE)) throw new Error(`IMPORT_FILE 不存在: ${SINGLE_FILE}`)
    return [SINGLE_FILE]
  }
  if (!IMPORT_DIR) throw new Error('需設定 IMPORT_DIR 或 IMPORT_FILE env')
  if (!fs.existsSync(IMPORT_DIR)) throw new Error(`IMPORT_DIR 不存在: ${IMPORT_DIR}`)
  return fs
    .readdirSync(IMPORT_DIR)
    .filter((f) => f.toLowerCase().endsWith('.xlsx'))
    .sort()
    .map((f) => path.join(IMPORT_DIR, f))
}

/* ── 既有商品 doc 的最小型別（depth:0） ── */
type ExistingVariant = {
  id?: string | number
  colorName?: string
  colorCode?: string
  colorSwatch?: number | null
  size?: string
  sku?: string
  stock?: number
  priceOverride?: number | null
  costOverride?: number | null
  gtin?: string | null
}
type ExistingDoc = {
  id: number
  name?: string
  productSku?: string
  stock?: number
  variants?: ExistingVariant[]
}

/* ── 報告資料結構 ── */
interface StockChange {
  productId: number
  productName: string
  shoplineProductId: string
  sku: string // 變體 SKU；無變體商品用 '(product)'
  oldStock: number
  newStock: number
}
interface SkippedProduct {
  shoplineProductId: string
  name: string
  productSku?: string
  reason: string
}
interface SyncReport {
  mode: 'dry-run' | 'write'
  files: string[]
  startedAt: string
  finishedAt?: string
  totals: {
    parsedProducts: number
    matchedProducts: number
    productsWithChanges: number
    productsUnchanged: number
    skippedProducts: number
    failedProducts: number
    variantChanges: number
    productStockChanges: number
    increases: number
    decreases: number
    zeroed: number // >0 → 0
    unitsAdded: number
    unitsRemoved: number
  }
  changes: StockChange[]
  zeroedList: StockChange[] // >0 → 0 防呆抽查清單
  skipped: SkippedProduct[]
  unmatchedVariantSkus: { shoplineProductId: string; productName: string; skus: string[] }[]
  errors: string[]
  warnings: string[]
}

/** 3-tier 商品對齊：sourcing.sourceId → productSku → variants.sku（與 import 腳本一致，絕不 create） */
async function findExisting(
  payload: Awaited<ReturnType<typeof getPayload>>,
  p: ShoplineProduct,
): Promise<{ doc: ExistingDoc | undefined; tier: string }> {
  let existing = await payload.find({
    collection: 'products',
    where: { 'sourcing.sourceId': { equals: p.shoplineProductId } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs.length > 0) {
    return { doc: existing.docs[0] as unknown as ExistingDoc, tier: 'sourceId' }
  }

  if (p.productSku) {
    existing = await payload.find({
      collection: 'products',
      where: { productSku: { equals: p.productSku } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      return { doc: existing.docs[0] as unknown as ExistingDoc, tier: 'productSku' }
    }
  }

  if (p.variants.length > 0) {
    const incomingVariantSkus = p.variants
      .map((v) => v.sku)
      .filter((s): s is string => Boolean(s && s.trim()))
    if (incomingVariantSkus.length > 0) {
      existing = await payload.find({
        collection: 'products',
        where: { 'variants.sku': { in: incomingVariantSkus } },
        limit: 1,
        depth: 0,
      })
      if (existing.docs.length > 0) {
        return { doc: existing.docs[0] as unknown as ExistingDoc, tier: 'variants.sku' }
      }
    }
  }

  return { doc: undefined, tier: 'none' }
}

async function processFile(
  payload: Awaited<ReturnType<typeof getPayload>>,
  filePath: string,
  report: SyncReport,
): Promise<void> {
  const fileName = path.basename(filePath)
  log(`▶ 開始 ${fileName}`)

  const buffer = fs.readFileSync(filePath)
  const parsed = await parseShoplineXlsx(buffer)

  if (parsed.globalErrors.length > 0) {
    const msg = `${fileName} 全域錯誤: ${parsed.globalErrors.join('; ')}`
    log(`  ✗ ${msg}`)
    report.errors.push(msg)
    return
  }

  const batch: ShoplineProduct[] = LIMIT > 0 ? parsed.products.slice(0, LIMIT) : parsed.products
  log(
    `  ✓ 解析 ${parsed.totalProducts} 商品 / ${parsed.totalVariants} 變體，將處理 ${batch.length} 筆`,
  )
  report.totals.parsedProducts += batch.length

  let processed = 0
  for (const p of batch) {
    processed++
    // 注意：不看 p.errors（那是 import 用的價格/欄位驗證）——庫存同步只需要
    // 商品身份 + SKU + 數量，缺價格照樣同步。

    try {
      const { doc: existingDoc } = await findExisting(payload, p)

      if (!existingDoc) {
        report.totals.skippedProducts++
        report.skipped.push({
          shoplineProductId: p.shoplineProductId,
          name: p.name,
          productSku: p.productSku,
          reason: '3-tier 都對不到既有商品（不建新品，跳過）',
        })
        continue
      }

      const existingVariants = existingDoc.variants ?? []
      const changes: StockChange[] = []
      let updateData: Record<string, unknown> | null = null

      if (existingVariants.length > 0) {
        /* ── 有變體：逐變體按 SKU 對 stock ── */
        const incomingBySku = new Map<string, number>()
        for (const v of p.variants) {
          const sku = (v.sku || '').trim()
          if (!sku) continue
          if (incomingBySku.has(sku)) {
            report.warnings.push(
              `${p.shoplineProductId} ${p.name}: xlsx 內變體 SKU 重複 ${sku}，取最後一筆`,
            )
          }
          incomingBySku.set(sku, v.stock)
        }
        // 無變體的 Shopline 商品對到我們的變體商品：shape 不一致，不猜測對應，跳過
        if (incomingBySku.size === 0) {
          report.totals.skippedProducts++
          report.skipped.push({
            shoplineProductId: p.shoplineProductId,
            name: p.name,
            productSku: p.productSku,
            reason: `shape 不一致：Shopline 無變體，本站有 ${existingVariants.length} 個變體，跳過`,
          })
          continue
        }

        const matchedSkus = new Set<string>()
        const newVariants = existingVariants.map((v) => {
          const sku = (v.sku || '').trim()
          if (sku && incomingBySku.has(sku)) {
            matchedSkus.add(sku)
            const newStock = Math.max(0, Math.round(incomingBySku.get(sku)!))
            if (newStock !== (v.stock ?? 0)) {
              changes.push({
                productId: existingDoc.id,
                productName: existingDoc.name || p.name,
                shoplineProductId: p.shoplineProductId,
                sku,
                oldStock: v.stock ?? 0,
                newStock,
              })
              // 只改 stock，其他欄位（含 row id）原樣帶回
              return { ...v, stock: newStock }
            }
          }
          return v
        })

        const unmatched = Array.from(incomingBySku.keys()).filter((s) => !matchedSkus.has(s))
        if (unmatched.length > 0) {
          report.unmatchedVariantSkus.push({
            shoplineProductId: p.shoplineProductId,
            productName: existingDoc.name || p.name,
            skus: unmatched,
          })
        }

        if (changes.length > 0) {
          updateData = { variants: newVariants }
          report.totals.variantChanges += changes.length
        }
      } else {
        /* ── 無變體：對 product.stock ── */
        // Shopline 有變體但本站沒有 → 用變體加總對 product.stock
        // Shopline 也無變體 → 用 Quantity 欄（parser 空白/0 都回 undefined，視為 0）
        const incomingStock =
          p.variants.length > 0
            ? p.variants.reduce((sum, v) => sum + Math.max(0, Math.round(v.stock)), 0)
            : Math.max(0, Math.round(p.stock ?? 0))
        if (p.variants.length > 0) {
          report.warnings.push(
            `${p.shoplineProductId} ${p.name}: 本站無變體、Shopline 有 ${p.variants.length} 個變體，以加總 ${incomingStock} 同步 product.stock`,
          )
        }

        const oldStock = existingDoc.stock ?? 0
        if (incomingStock !== oldStock) {
          changes.push({
            productId: existingDoc.id,
            productName: existingDoc.name || p.name,
            shoplineProductId: p.shoplineProductId,
            sku: '(product)',
            oldStock,
            newStock: incomingStock,
          })
          updateData = { stock: incomingStock }
          report.totals.productStockChanges++
        }
      }

      report.totals.matchedProducts++

      if (!updateData) {
        report.totals.productsUnchanged++
        continue
      }

      for (const c of changes) {
        report.changes.push(c)
        if (c.newStock > c.oldStock) {
          report.totals.increases++
          report.totals.unitsAdded += c.newStock - c.oldStock
        } else {
          report.totals.decreases++
          report.totals.unitsRemoved += c.oldStock - c.newStock
        }
        if (c.oldStock > 0 && c.newStock === 0) {
          report.totals.zeroed++
          report.zeroedList.push(c)
        }
      }
      report.totals.productsWithChanges++

      if (!DRY_RUN) {
        await payload.update({
          collection: 'products',
          id: existingDoc.id,
          data: updateData as Partial<ProductData>,
        })
      }
    } catch (err) {
      report.totals.failedProducts++
      const msg = err instanceof Error ? err.message : String(err)
      report.errors.push(`${p.shoplineProductId} ${p.name}: ${msg}`)
    }

    if (processed % 100 === 0) {
      log(
        `    … ${processed}/${batch.length}（改 ${report.totals.productsWithChanges} / 跳 ${report.totals.skippedProducts} / 失 ${report.totals.failedProducts}）`,
      )
    }
  }

  log(`  ✓ ${fileName} 完成`)
}

function printSummary(report: SyncReport) {
  const t = report.totals
  log(``)
  log(`═══════════════════════════════════════════════`)
  log(`${report.mode === 'dry-run' ? 'DRY RUN 預覽（未寫入 DB）' : '同步完成（已寫入 DB）'}`)
  log(`  解析商品:       ${t.parsedProducts}`)
  log(`  對到既有商品:   ${t.matchedProducts}`)
  log(`  ${report.mode === 'dry-run' ? '將更新' : '已更新'}商品:     ${t.productsWithChanges}（變體層 ${t.variantChanges} 筆 + 商品層 ${t.productStockChanges} 筆）`)
  log(`  庫存無變化:     ${t.productsUnchanged}`)
  log(`  跳過（對不到）: ${t.skippedProducts}`)
  log(`  失敗:           ${t.failedProducts}`)
  log(``)
  log(`  增/減分布:`)
  log(`    增加: ${t.increases} 筆（+${t.unitsAdded} 件）`)
  log(`    減少: ${t.decreases} 筆（-${t.unitsRemoved} 件）`)
  log(`    其中 >0 → 歸零: ${t.zeroed} 筆 ⚠️`)

  if (report.zeroedList.length > 0) {
    log(``)
    log(`  ⚠️ 庫存 >0 → 0 清單（防呆抽查，前 50 筆）:`)
    for (const c of report.zeroedList.slice(0, 50)) {
      log(`    - [${c.shoplineProductId}] ${c.productName} | ${c.sku} | ${c.oldStock} → 0`)
    }
    if (report.zeroedList.length > 50) {
      log(`    …共 ${report.zeroedList.length} 筆，完整清單見 JSON 報告`)
    }
  }

  if (report.skipped.length > 0) {
    log(``)
    log(`  跳過清單（SKU 對不到，前 30 筆）:`)
    for (const s of report.skipped.slice(0, 30)) {
      log(`    - [${s.shoplineProductId}] ${s.name}${s.productSku ? ` (SKU ${s.productSku})` : ''} — ${s.reason}`)
    }
    if (report.skipped.length > 30) {
      log(`    …共 ${report.skipped.length} 筆，完整清單見 JSON 報告`)
    }
  }

  if (report.unmatchedVariantSkus.length > 0) {
    log(``)
    log(`  商品有對到、但部分變體 SKU 對不到（前 30 筆）:`)
    for (const u of report.unmatchedVariantSkus.slice(0, 30)) {
      log(`    - [${u.shoplineProductId}] ${u.productName}: ${u.skus.join(', ')}`)
    }
    if (report.unmatchedVariantSkus.length > 30) {
      log(`    …共 ${report.unmatchedVariantSkus.length} 筆，完整清單見 JSON 報告`)
    }
  }

  if (report.errors.length > 0) {
    log(``)
    log(`  ✗ 錯誤（前 10 條）:`)
    for (const e of report.errors.slice(0, 10)) log(`    - ${e}`)
  }
  if (report.warnings.length > 0) {
    log(``)
    log(`  ⚠ 警告（前 10 條）:`)
    for (const w of report.warnings.slice(0, 10)) log(`    - ${w}`)
  }
  log(`═══════════════════════════════════════════════`)
}

async function main() {
  log(`Shopline 庫存同步啟動（只動 stock，絕不 create / 絕不改其他欄位）`)
  log(`  DRY_RUN=${DRY_RUN ? 'YES（預設；設 IMPORT_DRY_RUN=0 才寫入）' : 'NO — 會真的寫入 DB'}  LIMIT=${LIMIT || 'unlimited'}`)

  const files = listFiles()
  log(`  找到 ${files.length} 個 xlsx 檔案`)
  for (const f of files) log(`    - ${path.basename(f)}`)

  const payload = await getPayload({ config })

  const report: SyncReport = {
    mode: DRY_RUN ? 'dry-run' : 'write',
    files: files.map((f) => path.basename(f)),
    startedAt: new Date().toISOString(),
    totals: {
      parsedProducts: 0,
      matchedProducts: 0,
      productsWithChanges: 0,
      productsUnchanged: 0,
      skippedProducts: 0,
      failedProducts: 0,
      variantChanges: 0,
      productStockChanges: 0,
      increases: 0,
      decreases: 0,
      zeroed: 0,
      unitsAdded: 0,
      unitsRemoved: 0,
    },
    changes: [],
    zeroedList: [],
    skipped: [],
    unmatchedVariantSkus: [],
    errors: [],
    warnings: [],
  }

  const startedAt = Date.now()
  for (const f of files) {
    await processFile(payload, f, report)
  }
  report.finishedAt = new Date().toISOString()

  printSummary(report)

  // 完整 JSON 報告寫到 xlsx 同目錄
  const reportDir = path.dirname(files[0])
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = path.join(
    reportDir,
    `sync-stock-report-${stamp}${DRY_RUN ? '-dryrun' : ''}.json`,
  )
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  const elapsed = Math.round((Date.now() - startedAt) / 1000)
  log(`完整報告: ${reportPath}（耗時 ${elapsed}s）`)
}

// payload run 腳本結尾必須 top-level await，否則 silent death
await main()
