/**
 * Phase 5.6 — getTpeDateString 時區轉換驗證
 * 模擬不同 UTC 時間，確認 Asia/Taipei 日期正確
 * Usage: pnpm dlx tsx src/seed/verifyPhase56Tz.ts
 */
import { getTpeDateString } from '../lib/games/gameEngine'

const testTimes = [
  { utc: '2026-04-16T16:00:00.000Z', expectedTpe: '2026-04-17', note: 'UTC 16:00 = Taipei 00:00 次日' },
  { utc: '2026-04-16T15:59:59.000Z', expectedTpe: '2026-04-16', note: 'UTC 15:59 = Taipei 23:59 當日' },
  { utc: '2026-04-17T00:00:00.000Z', expectedTpe: '2026-04-17', note: 'UTC 00:00 = Taipei 08:00' },
  { utc: '2026-01-01T00:00:00.000Z', expectedTpe: '2026-01-01', note: 'UTC 年初' },
  { utc: '2026-12-31T23:59:00.000Z', expectedTpe: '2027-01-01', note: 'UTC 跨年 = Taipei 跨年後' },
]

let fails = 0
for (const { utc, expectedTpe, note } of testTimes) {
  const actual = getTpeDateString(new Date(utc))
  const ok = actual === expectedTpe
  const mark = ok ? '✅' : '❌'
  console.log(`${mark} UTC=${utc} → TPE=${actual}  (${note})`)
  if (!ok) {
    console.log(`   expected: ${expectedTpe}`)
    fails++
  }
}
console.log('')
if (fails === 0) {
  console.log('🎉 getTpeDateString 跨時區驗證通過')
  process.exit(0)
} else {
  console.log(`❌ ${fails} 個失敗`)
  process.exit(1)
}
