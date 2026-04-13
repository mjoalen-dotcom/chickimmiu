/**
 * DB 查詢：分類和商品分類分配
 * PAYLOAD_SECRET=H2Ca1PcPtUMqKgAfJ0VEWbgN0hMMiX5g6SRniQdev01 npx tsx src/seed/queryDB.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })

  // Categories
  const cats = await payload.find({ collection: 'categories', limit: 100, sort: 'name' })
  console.log(`\n=== CATEGORIES (${cats.docs.length}) ===`)
  for (const c of cats.docs) {
    const p = (c as unknown as Record<string, unknown>).parent
    const parentName = p ? (typeof p === 'object' ? (p as Record<string, unknown>).name : `#${p}`) : '-'
    console.log(`  ${c.id} | ${(c as unknown as Record<string, unknown>).slug} | ${c.name} | parent: ${parentName}`)
  }

  // Products
  const prods = await payload.find({ collection: 'products', limit: 200, depth: 0 })
  console.log(`\n=== PRODUCTS (${prods.docs.length}) ===`)
  let withCat = 0, noCat = 0
  const catCounts: Record<string, number> = {}
  for (const p of prods.docs) {
    const cat = (p as unknown as Record<string, unknown>).category as number | null
    if (cat) {
      withCat++
      catCounts[String(cat)] = (catCounts[String(cat)] || 0) + 1
    } else {
      noCat++
      console.log(`  NO CAT: #${p.id} ${p.name}`)
    }
  }
  console.log(`\nWith category: ${withCat}, Without: ${noCat}`)
  console.log(`\nCategory distribution (by ID):`)
  for (const [catId, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    const cat = cats.docs.find(c => String(c.id) === catId)
    console.log(`  ${cat ? cat.name : 'Unknown #' + catId}: ${count}`)
  }

  process.exit(0)
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
