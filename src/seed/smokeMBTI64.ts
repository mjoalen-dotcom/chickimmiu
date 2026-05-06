/**
 * Smoke test: MBTI64 computeMBTI64() — payload run
 *
 * 跑法：pnpm payload run src/seed/smokeMBTI64.ts
 *
 * 驗證：
 *   1. 全選 E/S/T/J + 4 題全 urban → 推算出 ESTJ-urban
 *   2. 全選 I/N/F/P + 4 題全 cozy  → 推算出 INFP-cozy
 *   3. 4 題場合票數平手 → 預設 urban（OCCASION_LIST 順序）
 *   4. 64 個 sub-personality 全部有定義
 *   5. getSubResult() 每組都返回有效資料
 */

import {
  computeMBTI64,
  type LifestyleAnswers,
  type MBTIAnswers,
} from '../lib/games/mbtiQuizEngine'
import {
  MBTI_SUB_RESULTS,
  OCCASION_LIST,
  getSubResult,
  oppositeOccasion,
} from '../lib/games/mbtiOccasions'
import { MBTI_TYPE_LIST, type MBTIType } from '../lib/games/mbtiResults'
import { MBTI_QUESTIONS, MBTI_LIFESTYLE_QUESTIONS } from '../lib/games/mbtiQuestions'

function buildAnswers(picks: { E?: boolean; S?: boolean; T?: boolean; J?: boolean }): MBTIAnswers {
  const answers: MBTIAnswers = {}
  for (const q of MBTI_QUESTIONS) {
    if (q.dimension === 'EI') answers[q.id] = picks.E ? 'E' : 'I'
    else if (q.dimension === 'SN') answers[q.id] = picks.S ? 'S' : 'N'
    else if (q.dimension === 'TF') answers[q.id] = picks.T ? 'T' : 'F'
    else if (q.dimension === 'JP') answers[q.id] = picks.J ? 'J' : 'P'
  }
  return answers
}

function buildLifestyle(occasion: 'urban' | 'vacation' | 'party' | 'cozy'): LifestyleAnswers {
  const out: LifestyleAnswers = {}
  for (const q of MBTI_LIFESTYLE_QUESTIONS) {
    out[q.id] = occasion
  }
  return out
}

let pass = 0
let fail = 0

function expect(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
    pass++
  } else {
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
    fail++
  }
}

// ─── 1. 全 E/S/T/J + urban → ESTJ-urban
{
  const r = computeMBTI64(
    buildAnswers({ E: true, S: true, T: true, J: true }),
    buildLifestyle('urban'),
  )
  expect('case1: ESTJ-urban', r.type === 'ESTJ' && r.primaryOccasion === 'urban', JSON.stringify({ type: r.type, occ: r.primaryOccasion }))
  expect('case1: subResult.subTagline 存在', Boolean(r.subResult.subTagline))
}

// ─── 2. 全 I/N/F/P + cozy → INFP-cozy
{
  const r = computeMBTI64(
    buildAnswers({ E: false, S: false, T: false, J: false }),
    buildLifestyle('cozy'),
  )
  expect('case2: INFP-cozy', r.type === 'INFP' && r.primaryOccasion === 'cozy', JSON.stringify({ type: r.type, occ: r.primaryOccasion }))
}

// ─── 3. 場合票平手 → 預設 urban
{
  const lifestyle: LifestyleAnswers = {
    [MBTI_LIFESTYLE_QUESTIONS[0].id]: 'urban',
    [MBTI_LIFESTYLE_QUESTIONS[1].id]: 'vacation',
    [MBTI_LIFESTYLE_QUESTIONS[2].id]: 'party',
    [MBTI_LIFESTYLE_QUESTIONS[3].id]: 'cozy',
  }
  const r = computeMBTI64(buildAnswers({ E: true, S: true, T: true, J: true }), lifestyle)
  expect('case3: 平手→urban', r.primaryOccasion === 'urban', `actual=${r.primaryOccasion}`)
  expect('case3: occasionScores 各 1', JSON.stringify(r.occasionScores) === JSON.stringify({ urban: 1, vacation: 1, party: 1, cozy: 1 }))
}

// ─── 4. 64 sub-personality 全部 defined
const expectedKeys: string[] = []
for (const t of MBTI_TYPE_LIST) {
  for (const occ of OCCASION_LIST) {
    expectedKeys.push(`${t}-${occ}`)
  }
}
expect('case4: 共 64 sub-personalities', expectedKeys.length === 64)
const missing = expectedKeys.filter((k) => !(k in MBTI_SUB_RESULTS))
expect('case4: 全部 64 個 key 在 MBTI_SUB_RESULTS', missing.length === 0, `缺：${missing.slice(0, 10).join(', ')}`)

// ─── 5. getSubResult() 每組都有效
let validCount = 0
for (const t of MBTI_TYPE_LIST) {
  for (const occ of OCCASION_LIST) {
    const r = getSubResult(t as MBTIType, occ)
    if (r && r.subTagline && Array.isArray(r.outfitTips) && r.outfitTips.length > 0) {
      validCount++
    }
  }
}
expect('case5: 64 個 getSubResult 結構完整', validCount === 64, `valid=${validCount}/64`)

// ─── 6. oppositeOccasion 可逆
expect('case6a: opposite(urban)===vacation', oppositeOccasion('urban') === 'vacation')
expect('case6b: opposite(party)===cozy', oppositeOccasion('party') === 'cozy')
expect('case6c: opposite(opposite(x))===x', oppositeOccasion(oppositeOccasion('urban')) === 'urban')

console.log(`\n──────────\n通過：${pass}　失敗：${fail}\n──────────`)
process.exit(fail > 0 ? 1 : 0)
