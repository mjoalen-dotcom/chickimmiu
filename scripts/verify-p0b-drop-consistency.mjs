/**
 * 促銷效果型別的四方一致性稽核
 * ────────────────────────────
 * 跑法：node scripts/verify-p0b-drop-consistency.mjs
 *
 * 為什麼要有這支：加一種促銷效果型別要同時改四個地方 ——
 *   ① src/lib/promotions/types.ts        的 PromotionEffect union
 *   ② src/collections/PromotionRules.ts  的 effectType select options
 *   ③ src/lib/promotions/snapshots.ts    的 ruleDocToSnapshot switch case
 *   ④ PG enum_promotion_rules_effect_effect_type 的值
 *
 * 漏掉任何一個都**不會報錯**，而是靜默失效：規則在後台存得進去、狀態顯示
 * active、evaluator 卻永遠收不到，零錯誤訊息。這正是本專案踩過的
 * 「PG select 欄位字面值系統性稽核」那一類坑。人工比對四份清單遲早會漏，
 * 所以寫成斷言腳本。
 *
 * 純文字解析、不連 DB，可在 CI 與本機任何時候跑。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// ① types.ts：PromotionEffect union 裡的 `type: '...'` 字面值
function fromTypes() {
  const src = read('src/lib/promotions/types.ts')
  const start = src.indexOf('export type PromotionEffect =')
  const end = src.indexOf('export type BenefitClass')
  if (start < 0 || end < 0) throw new Error('types.ts：找不到 PromotionEffect union 的邊界')
  const block = src.slice(start, end)
  return new Set([...block.matchAll(/\btype:\s*'([a-z_]+)'/g)].map((m) => m[1]))
}

// ② PromotionRules.ts：effectType select 的 options value
function fromCollection() {
  const src = read('src/collections/PromotionRules.ts')
  const start = src.indexOf("name: 'effectType'")
  if (start < 0) throw new Error('PromotionRules.ts：找不到 effectType 欄位')
  const optStart = src.indexOf('options: [', start)
  const optEnd = src.indexOf('],', optStart)
  const block = src.slice(optStart, optEnd)
  return new Set([...block.matchAll(/value:\s*'([a-z_]+)'/g)].map((m) => m[1]))
}

// ③ snapshots.ts：ruleDocToSnapshot 的 switch case
function fromSnapshots() {
  const src = read('src/lib/promotions/snapshots.ts')
  const start = src.indexOf('switch (effectType)')
  const end = src.indexOf('// 條件', start)
  if (start < 0 || end < 0) throw new Error('snapshots.ts：找不到 effectType switch 的邊界')
  const block = src.slice(start, end)
  return new Set([...block.matchAll(/case\s+'([a-z_]+)'/g)].map((m) => m[1]))
}

// ④ PG enum：baseline 的 CREATE TYPE + 後續所有 ALTER TYPE ADD VALUE
function fromMigrations() {
  const dir = 'src/migrations-pg'
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  const values = new Set()
  for (const f of files.sort()) {
    const src = read(join(dir, f))
    const created = src.match(
      /CREATE TYPE "public"\."enum_promotion_rules_effect_effect_type" AS ENUM\(([^)]*)\)/,
    )
    if (created) {
      for (const m of created[1].matchAll(/'([a-z_]+)'/g)) values.add(m[1])
    }
    for (const m of src.matchAll(
      /ALTER TYPE "public"\."enum_promotion_rules_effect_effect_type" ADD VALUE (?:IF NOT EXISTS )?'([a-z_]+)'/g,
    )) {
      values.add(m[1])
    }
  }
  if (values.size === 0) throw new Error('migrations-pg：完全找不到 effect_effect_type 的 enum 定義')
  return values
}

const sources = {
  'types.ts (PromotionEffect union)': fromTypes(),
  'PromotionRules.ts (select options)': fromCollection(),
  'snapshots.ts (switch case)': fromSnapshots(),
  'PG enum (migrations-pg)': fromMigrations(),
}

const union = new Set(Object.values(sources).flatMap((s) => [...s]))
let failed = 0

console.log('促銷效果型別四方一致性稽核')
console.log('─'.repeat(70))
for (const [name, set] of Object.entries(sources)) {
  console.log(`  ${String(set.size).padStart(2)} 個  ${name}`)
}
console.log('─'.repeat(70))

for (const value of [...union].sort()) {
  const missing = Object.entries(sources)
    .filter(([, set]) => !set.has(value))
    .map(([name]) => name)
  if (missing.length === 0) {
    console.log(`  ✅ ${value}`)
  } else {
    failed += 1
    console.log(`  ❌ ${value} —— 缺少於：${missing.join('、')}`)
  }
}

console.log('─'.repeat(70))
if (failed > 0) {
  console.error(
    `\n${failed} 個效果型別四方不一致。這不會在執行期報錯，只會靜默失效：\n` +
      '規則存得進後台、狀態顯示 active、evaluator 永遠收不到、沒有任何錯誤訊息。',
  )
  process.exit(1)
}
console.log(`\n全部 ${union.size} 個效果型別四方一致 ✅`)
