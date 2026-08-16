/**
 * DB-PG-001 Phase 1 驗收：20 筆 products 深度比對（Prompt P2 DoD 第3項）
 * 依 DIFF_PRODUCT_IDS（逗號分隔）+ 目前 DATABASE_URI 指到哪個 DB，
 * dump 出 depth:2（含 category/variants/images 等關聯）的完整 JSON 到
 * DIFF_OUTPUT_FILE，供跑兩次（SQLite 一次、PG 一次）後外部 diff。
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import fs from 'node:fs'

const ids = (process.env.DIFF_PRODUCT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
const outputFile = process.env.DIFF_OUTPUT_FILE || '/tmp/products-diff.json'

async function main() {
  const payload = await getPayload({ config })
  const results: Record<string, unknown> = {}
  for (const id of ids) {
    try {
      const doc = await payload.findByID({ collection: 'products', id, depth: 2 })
      results[id] = doc
    } catch (err) {
      results[id] = { __error: String(err) }
    }
  }
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2))
  console.log(`[dump] wrote ${ids.length} products to ${outputFile}`)
}

await main()
