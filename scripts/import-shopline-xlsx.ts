/**
 * Shopline XLSX Bulk Import — payload run script
 * ──────────────────────────────────────────────
 * 直接從 xlsx 檔案 batch import 商品，bypass HTTP endpoint 跟 admin auth。
 *
 * 用法（在 prod，cd /var/www/chickimmiu）：
 *   IMPORT_DIR=/tmp/shopline-import IMPORT_DRY_RUN=1 \
 *     pnpm payload run scripts/import-shopline-xlsx.ts
 *
 * Env vars:
 *   IMPORT_DIR       - 包含 xlsx 的目錄（必填）
 *   IMPORT_FILE      - 只跑單檔（覆寫 IMPORT_DIR）
 *   IMPORT_DRY_RUN   - 1=只 parse 不寫 DB（預設 0）
 *   IMPORT_LIMIT     - 每檔最多處理 N 筆（測試用，預設 0=全跑）
 *   IMPORT_STATUS    - draft|published|keep（預設 draft，封測安全）
 *
 * 邏輯與 src/endpoints/shoplineXlsxImport.ts 一致：
 *   - upsert key = sourcing.sourceId === Shopline Product ID
 *   - 既有就 update，沒有就 create
 *   - slug 在 update 時保留原有，避免破壞外部連結
 *   - PR-η: 新 aliasSlugs 欄位 — 建立時把 Shopline 計算 slug 寫入
 *           更新時合併既有別名，確保 Shopline 舊 URL 301 正確跳轉
 */

import fs from 'fs'
import path from 'path'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import config from '@payload-config'
import { parseShoplineXlsx, type ShoplineProduct } from '../src/lib/shopline/xlsxParser'

type ProductData = RequiredDataFromCollectionSlug<'products'>

const DRY_RUN = process.env.IMPORT_DRY_RUN === '1'
const LIMIT = parseInt(process.env.IMPORT_LIMIT || '0', 10) || 0
const STATUS_OVERRIDE = (process.env.IMPORT_STATUS || 'draft') as 'draft' | 'published' | 'keep'
const SINGLE_FILE = process.env.IMPORT_FILE
const IMPORT_DIR = process.env.IMPORT_DIR

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

const log = (msg: string) => {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`[${t}] ${msg}`)
}

async function processFile(
  payload: Awaited<ReturnType<typeof getPayload>>,
  filePath: string,
  catBySlug: Map<string, number>,
  fallbackCatId: number,
): Promise<{ created: number; updated: number; failed: number; unmapped: Set<string> }> {
  const fileName = path.basename(filePath)
  log(`▶ 開始 ${fileName}`)

  const buffer = fs.readFileSync(filePath)
  const report = await parseShoplineXlsx(buffer)

  if (report.globalErrors.length > 0) {
    log(`  ✗ 全域錯誤: ${report.globalErrors.join('; ')}`)
    return { created: 0, updated: 0, failed: 0, unmapped: new Set() }
  }

  const batch: ShoplineProduct[] = LIMIT > 0 ? report.products.slice(0, LIMIT) : report.products
  log(
    `  ✓ 解析 ${report.totalProducts} 商品 / ${report.totalVariants} 變體 / ${report.unmappedCategories.length} 未映射分類，將處理 ${batch.length} 筆`,
  )

  const unmapped = new Set(report.unmappedCategories)

  if (DRY_RUN) {
    log(`  ⊙ DRY RUN — 不寫入 DB`)
    log(`  Sample (前 3 筆):`)
    for (const p of batch.slice(0, 3)) {
      log(
        `    - ${p.shoplineProductId} ${p.name} | NT$${p.price}${p.salePrice ? '/特' + p.salePrice : ''} | ${p.variants.length} variants | cat=${p.categorySlug || '(none)'} | status=${p.status} | alias=${p.slug}`,
      )
    }
    return { created: 0, updated: 0, failed: 0, unmapped }
  }

  let created = 0
  let updated = 0
  let failed = 0
  let processed = 0
  const errors: string[] = []

  for (const p of batch) {
    processed++
    if (p.errors.length > 0) {
      failed++
      errors.push(`${p.shoplineProductId} ${p.name}: ${p.errors.join('; ')}`)
      continue
    }

    try {
      /* ── 3-tier upsert match：sourceId → productSku → variants.sku → create ──
       * 與 src/endpoints/shoplineXlsxImport.ts 同步，邏輯重複但各自有 typing 需要
       * 避免共用 helper（一個是 payload local API、一個是 PayloadRequest）。改了
       * 這邊記得也改另一邊。 */
      let existing = await payload.find({
        collection: 'products',
        where: { 'sourcing.sourceId': { equals: p.shoplineProductId } },
        limit: 1,
        depth: 0,
      })

      type ExistingDoc = {
        id: number
        slug?: string
        aliasSlugs?: { slug: string; source?: string }[]
      }

      // Tier 2: productSku
      if (existing.docs.length === 0 && p.productSku) {
        existing = await payload.find({
          collection: 'products',
          where: { productSku: { equals: p.productSku } },
          limit: 1,
          depth: 0,
        })
      }

      // Tier 3: variants.sku
      if (existing.docs.length === 0 && p.variants.length > 0) {
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
        }
      }

      const existingDoc = existing.docs[0] as unknown as ExistingDoc | undefined
      const categoryId = p.categorySlug ? catBySlug.get(p.categorySlug) || fallbackCatId : fallbackCatId
      const status = STATUS_OVERRIDE === 'keep' ? p.status : STATUS_OVERRIDE

      // Canonical slug: keep existing on update to preserve inbound links.
      const canonicalSlug = existingDoc?.slug || p.slug

      // aliasSlugs (PR-η): merge existing aliases + Shopline computed slug.
      // Shopline computed slug (p.slug) is written as source:'shopline' so
      // the PDP fallback can 301-redirect old Shopline product URLs.
      const aliasMap = new Map<string, string>()
      for (const a of existingDoc?.aliasSlugs ?? []) {
        if (a.slug) aliasMap.set(a.slug, a.source || 'shopline')
      }
      if (p.slug && p.slug !== canonicalSlug) {
        // only add if not identical to current canonical — no self-alias
        aliasMap.set(p.slug, 'shopline')
      }
      const aliasSlugs = Array.from(aliasMap.entries()).map(([slug, source]) => ({ slug, source }))

      const data: Record<string, unknown> = {
        name: p.name,
        slug: canonicalSlug,
        brand: p.brand,
        productSku: p.productSku,
        shortDescription: p.shortDescription,
        price: p.price,
        salePrice: p.salePrice,
        status,
        isNew: p.isNew,
        weight: p.weightGrams,
        category: categoryId,
        tags: p.tags.map((tag) => ({ tag })),
        allowPreOrder: p.allowPreOrder,
        preOrderNote: p.preOrderNote,
        variants: p.variants.map((v) => ({
          colorName: v.colorName || '預設',
          colorCode: '',
          size: v.size,
          sku: v.sku,
          stock: v.stock,
          priceOverride: v.priceOverride,
        })),
        ...(p.variants.length === 0 && typeof p.stock === 'number' ? { stock: p.stock } : {}),
        aliasSlugs,
        sourcing: {
          sourceId: p.sourcing.sourceId,
          supplierName: p.sourcing.supplierName,
          costTWD: p.sourcing.costTWD,
        },
        seo: {
          metaTitle: p.seo.metaTitle,
          metaDescription: p.seo.metaDescription,
        },
      }

      if (existingDoc) {
        await payload.update({
          collection: 'products',
          id: existingDoc.id,
          data: data as ProductData,
        })
        updated++
      } else {
        await payload.create({
          collection: 'products',
          data: data as ProductData,
        })
        created++
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${p.shoplineProductId} ${p.name}: ${msg}`)
    }

    if (processed % 50 === 0) {
      log(`    … ${processed}/${batch.length}（建 ${created} / 更 ${updated} / 失 ${failed}）`)
    }
  }

  log(`  ✓ ${fileName} 完成：建 ${created} / 更 ${updated} / 失 ${failed}`)
  if (errors.length > 0) {
    log(`  ✗ 錯誤前 5 條：`)
    for (const e of errors.slice(0, 5)) log(`    - ${e}`)
  }

  return { created, updated, failed, unmapped }
}

async function main() {
  log(`Shopline XLSX 批次匯入啟動`)
  log(
    `  DRY_RUN=${DRY_RUN ? 'YES' : 'NO'}  STATUS=${STATUS_OVERRIDE}  LIMIT=${LIMIT || 'unlimited'}`,
  )

  const files = listFiles()
  log(`  找到 ${files.length} 個 xlsx 檔案`)
  for (const f of files) log(`    - ${path.basename(f)}`)

  const payload = await getPayload({ config })

  // 預載分類
  const catList = await payload.find({
    collection: 'categories',
    limit: 500,
    depth: 0,
  })
  const catBySlug = new Map<string, number>()
  for (const c of catList.docs as unknown as { id: number; slug?: string }[]) {
    if (c.slug) catBySlug.set(c.slug, c.id)
  }
  log(`  載入 ${catBySlug.size} 個既有分類`)

  // 確保 fallback 分類存在
  let fallbackCatId = catBySlug.get('shopline-import')
  if (!fallbackCatId && !DRY_RUN) {
    const created = await payload.create({
      collection: 'categories',
      data: { name: 'Shopline 匯入', slug: 'shopline-import' },
    })
    fallbackCatId = (created as unknown as { id: number }).id
    catBySlug.set('shopline-import', fallbackCatId)
    log(`  建立 fallback 分類 'shopline-import' id=${fallbackCatId}`)
  }
  if (!fallbackCatId) {
    fallbackCatId = 0 // dry run only — won't actually use
  }

  let totalCreated = 0
  let totalUpdated = 0
  let totalFailed = 0
  const allUnmapped = new Set<string>()
  const startedAt = Date.now()

  for (const f of files) {
    const r = await processFile(payload, f, catBySlug, fallbackCatId)
    totalCreated += r.created
    totalUpdated += r.updated
    totalFailed += r.failed
    r.unmapped.forEach((c) => allUnmapped.add(c))
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000)
  log(``)
  log(`═══════════════════════════════════════════════`)
  log(`完成 — 耗時 ${elapsed}s`)
  log(`  建立: ${totalCreated}`)
  log(`  更新: ${totalUpdated}`)
  log(`  失敗: ${totalFailed}`)
  log(`  未映射分類: ${allUnmapped.size}`)
  if (allUnmapped.size > 0) {
    log(`  未映射分類清單（已 fallback 到 shopline-import）:`)
    for (const c of Array.from(allUnmapped).sort()) log(`    - ${c}`)
  }
  log(`═══════════════════════════════════════════════`)
}

await main()
