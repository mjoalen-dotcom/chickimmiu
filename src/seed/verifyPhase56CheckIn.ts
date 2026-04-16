/**
 * Phase 5.6 verification — computeCheckinOutcome (pure) + getTpeDateString
 *
 * 純邏輯測試，不 init Payload（避開 sqliteAdapter dev-push 對 script 的
 * index conflict 副作用）。performDailyCheckin 的副作用（DB update / record
 * 插入 / 加分）由現成 payload.update / recordGamePlay 機制處理，此處只驗
 * 核心決策分支。
 *
 * 使用方式：npx tsx src/seed/verifyPhase56CheckIn.ts
 */
import { computeCheckinOutcome, getTpeDateString } from '../lib/games/gameEngine'

function tpeDateMinusDays(days: number): string {
  const todayTpe = getTpeDateString()
  const base = new Date(`${todayTpe}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() - days)
  return base.toISOString().split('T')[0]
}

const todayTpe = getTpeDateString()
console.log(`📅 Asia/Taipei 今日：${todayTpe}`)
console.log('')

let failures = 0
const pass = (label: string) => console.log(`  ✅ ${label}`)
const fail = (label: string, actual: unknown, expected: unknown) => {
  console.log(`  ❌ ${label}`)
  console.log(`     expected: ${JSON.stringify(expected)}`)
  console.log(`     actual:   ${JSON.stringify(actual)}`)
  failures++
}

// === Case 1: first time ===
console.log('[Case 1] first time（lastCheckInDate=""）')
{
  const r = computeCheckinOutcome({ lastDate: '', prevTotal: 0, prevConsec: 0, todayTpe })
  r.newTotal === 1 ? pass('newTotal=1') : fail('newTotal', r.newTotal, 1)
  r.newConsec === 1 ? pass('newConsec=1') : fail('newConsec', r.newConsec, 1)
  !r.streakReset ? pass('streakReset=false') : fail('streakReset', r.streakReset, false)
  !r.streakBonus ? pass('streakBonus=false') : fail('streakBonus', r.streakBonus, false)
  r.prizeAmount === 10 ? pass('prizeAmount=10') : fail('prizeAmount', r.prizeAmount, 10)
}
console.log('')

// === Case 2: same day ===
console.log('[Case 2] same day（lastDate=todayTpe 應 throw）')
try {
  computeCheckinOutcome({ lastDate: todayTpe, prevTotal: 5, prevConsec: 3, todayTpe })
  fail('應該 throw', 'no-throw', '今日已簽到 error')
} catch (e) {
  const msg = e instanceof Error ? e.message : ''
  msg === '今日已簽到' ? pass('reject with "今日已簽到"') : fail('error msg', msg, '今日已簽到')
}
console.log('')

// === Case 3: next day (consec continues) ===
console.log('[Case 3] next day（lastDate=昨天, consec=1）→ consec=2, total+1, no reset')
{
  const r = computeCheckinOutcome({
    lastDate: tpeDateMinusDays(1),
    prevTotal: 1,
    prevConsec: 1,
    todayTpe,
  })
  r.newTotal === 2 ? pass('newTotal=2') : fail('newTotal', r.newTotal, 2)
  r.newConsec === 2 ? pass('newConsec=2') : fail('newConsec', r.newConsec, 2)
  !r.streakReset ? pass('streakReset=false') : fail('streakReset', r.streakReset, false)
  !r.streakBonus ? pass('streakBonus=false') : fail('streakBonus', r.streakBonus, false)
  r.prizeAmount === 10 ? pass('prizeAmount=10') : fail('prizeAmount', r.prizeAmount, 10)
}
console.log('')

// === Case 4: gap > 1 day ===
console.log('[Case 4] gap=3 days（lastDate=3天前, consec=5）→ newConsec=1 reset, newTotal=6')
{
  const r = computeCheckinOutcome({
    lastDate: tpeDateMinusDays(3),
    prevTotal: 5,
    prevConsec: 5,
    todayTpe,
  })
  r.newTotal === 6 ? pass('newTotal=6 (累計不重設)') : fail('newTotal', r.newTotal, 6)
  r.newConsec === 1 ? pass('newConsec=1 (reset)') : fail('newConsec', r.newConsec, 1)
  r.streakReset ? pass('streakReset=true') : fail('streakReset', r.streakReset, true)
  !r.streakBonus ? pass('streakBonus=false') : fail('streakBonus', r.streakBonus, false)
  r.prizeAmount === 10 ? pass('prizeAmount=10 (reset 後不給 7 天獎)') : fail('prizeAmount', r.prizeAmount, 10)
}
console.log('')

// === Case 5: 7th consecutive day ===
console.log('[Case 5] 連續 7 天（lastDate=昨天, consec=6）→ consec=7, streakBonus=true, prize=50')
{
  const r = computeCheckinOutcome({
    lastDate: tpeDateMinusDays(1),
    prevTotal: 6,
    prevConsec: 6,
    todayTpe,
  })
  r.newConsec === 7 ? pass('newConsec=7') : fail('newConsec', r.newConsec, 7)
  r.streakBonus ? pass('streakBonus=true') : fail('streakBonus', r.streakBonus, true)
  r.prizeAmount === 50 ? pass('prizeAmount=50 (獎勵加倍)') : fail('prizeAmount', r.prizeAmount, 50)
  r.prizeDescription.includes('連續簽到 7 天') ? pass('prizeDescription 含「連續簽到 7 天」') : fail('desc', r.prizeDescription, 'contains 連續簽到 7 天')
}
console.log('')

// === Case 6: getTpeDateString format ===
console.log('[Case 6] getTpeDateString 格式檢查')
{
  const dateRe = new RegExp('^\\d{4}-\\d{2}-\\d{2}$')
  dateRe.test(todayTpe) ? pass(`格式 YYYY-MM-DD (${todayTpe})`) : fail('format', todayTpe, 'YYYY-MM-DD')
}
console.log('')

// === Case 7: gap 2 days ===
console.log('[Case 7] gap=2 days（lastDate=2天前, consec=4）→ reset, consec=1')
{
  const r = computeCheckinOutcome({
    lastDate: tpeDateMinusDays(2),
    prevTotal: 4,
    prevConsec: 4,
    todayTpe,
  })
  r.newConsec === 1 ? pass('gap=2 也 reset') : fail('gap=2 reset', r.newConsec, 1)
  r.streakReset ? pass('streakReset=true') : fail('streakReset', r.streakReset, true)
}
console.log('')

// === Case 8: consec=8 (已過 7 天，一般獎勵) ===
console.log('[Case 8] 連續 8 天（prevConsec=7, lastDate=昨天）→ newConsec=8, no bonus, prize=10')
{
  const r = computeCheckinOutcome({
    lastDate: tpeDateMinusDays(1),
    prevTotal: 7,
    prevConsec: 7,
    todayTpe,
  })
  r.newConsec === 8 ? pass('newConsec=8') : fail('newConsec', r.newConsec, 8)
  !r.streakBonus ? pass('streakBonus=false (只在第 7 天觸發)') : fail('streakBonus', r.streakBonus, false)
  r.prizeAmount === 10 ? pass('prizeAmount=10') : fail('prizeAmount', r.prizeAmount, 10)
}
console.log('')

console.log('')
if (failures === 0) {
  console.log('🎉 全部 pass（Phase 5.6 computeCheckinOutcome 驗證通過）')
  process.exit(0)
} else {
  console.log(`❌ ${failures} 個 assertion 失敗`)
  process.exit(1)
}
