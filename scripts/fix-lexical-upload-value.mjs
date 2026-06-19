// One-off prod repair: Lexical `upload` nodes whose `value` was stored as a
// POPULATED OBJECT (`{id, alt, url, ...}`) instead of the canonical media id
// (a number). The import scripts (import-ckmu-shopline-page/blog.mjs) built
// upload nodes with `value: { id, alt, url, filename, ... }`. Payload's admin
// Lexical UploadFeature expects `value` to be the relationship id and throws
// when deserializing an object → 後台編輯頁壞；前台因 depth populate 仍正常。
//
// Fix: walk each rich-content row, for every upload node where value is an
// object, set value = value.id. Payload re-populates id→object on read.
//
// Usage (run from /var/www/chickimmiu):
//   node fix-lexical-upload-value.mjs --table pages_blocks_rich_content --dry
//   node fix-lexical-upload-value.mjs --table pages_blocks_rich_content
import { createClient } from '@libsql/client'

const DB_URL = process.env.FIX_DB_URL || 'file:./data/chickimmiu.db'
const DRY = process.argv.includes('--dry')
const tableArg = process.argv.indexOf('--table')
const TABLE = tableArg !== -1 ? process.argv[tableArg + 1] : 'pages_blocks_rich_content'
const COL = 'content'

const db = createClient({ url: DB_URL })

let fixedNodes = 0
function fixNode(node) {
  if (!node || typeof node !== 'object') return
  if (
    node.type === 'upload' &&
    node.value &&
    typeof node.value === 'object' &&
    node.value.id != null
  ) {
    node.value = node.value.id
    fixedNodes++
  }
  for (const child of node.children ?? []) fixNode(child)
}

const run = async () => {
  const res = await db.execute(
    `SELECT rowid AS rid, ${COL} AS content FROM ${TABLE} WHERE ${COL} LIKE '%"type":"upload"%' AND ${COL} LIKE '%"value":{%'`,
  )
  console.log(`Table ${TABLE}: ${res.rows.length} rows with object-valued upload nodes.`)

  let rowsUpdated = 0
  for (const row of res.rows) {
    fixedNodes = 0
    let doc
    try {
      doc = JSON.parse(row.content)
    } catch (e) {
      console.warn(`  rowid ${row.rid}: unparseable JSON, skipped`)
      continue
    }
    if (doc?.root) fixNode(doc.root)
    if (fixedNodes === 0) continue
    const out = JSON.stringify(doc)
    // sanity: parseable + no object-valued upload left
    JSON.parse(out)
    if (/"type":"upload"[^}]*"value":\{/.test(out)) throw new Error(`rowid ${row.rid}: object value remains`)

    if (DRY) {
      console.log(`  [DRY] rowid ${row.rid}: would fix ${fixedNodes} upload nodes`)
    } else {
      await db.execute({ sql: `UPDATE ${TABLE} SET ${COL} = ? WHERE rowid = ?`, args: [out, row.rid] })
      console.log(`  rowid ${row.rid}: fixed ${fixedNodes} upload nodes`)
    }
    rowsUpdated++
  }

  if (DRY) console.log(`[DRY] Would update ${rowsUpdated} rows. No writes.`)
  else {
    const chk = await db.execute(
      `SELECT count(*) AS c FROM ${TABLE} WHERE ${COL} LIKE '%"type":"upload"%' AND ${COL} LIKE '%"value":{%'`,
    )
    console.log(`Updated ${rowsUpdated} rows. Remaining object-valued upload rows: ${chk.rows[0].c}`)
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
