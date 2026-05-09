/**
 * 一次性 inspect script — 印出 Shopline ShoplineCustomerReport .xls 的：
 *   1. 工作表清單
 *   2. 第一個工作表的所有欄頭（第 1 列）
 *   3. 第一個工作表的前 3 列範例資料（第 2~4 列）
 *
 * 跑法：
 *   node scripts/inspect-shopline-customer-xls.mjs "<absolute path to .xls>"
 *
 * 用完即丟，不進 git。
 */
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/inspect-shopline-customer-xls.mjs <path>')
  process.exit(1)
}

const buf = readFileSync(filePath)
const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellNF: false, cellText: false })

console.log('=== Workbook ===')
console.log('Sheet names:', wb.SheetNames)

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName]
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')
  console.log(`\n=== Sheet: ${sheetName} ===`)
  console.log(`Range: ${ws['!ref']}  (rows=${range.e.r + 1}, cols=${range.e.c + 1})`)

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
  if (rows.length === 0) {
    console.log('(empty)')
    continue
  }

  console.log(`\n-- Row 1 (header, ${rows[0].length} cols) --`)
  rows[0].forEach((h, i) => console.log(`  [${i}] ${JSON.stringify(h)}`))

  for (let r = 1; r <= Math.min(3, rows.length - 1); r++) {
    console.log(`\n-- Row ${r + 1} sample --`)
    rows[r].forEach((v, i) => {
      if (v === '' || v == null) return
      const head = rows[0][i] || `col${i}`
      const display = String(v).length > 80 ? String(v).slice(0, 80) + '…' : String(v)
      console.log(`  ${head}: ${display}`)
    })
  }

  console.log(`\n-- Total data rows: ${rows.length - 1} --`)
}
