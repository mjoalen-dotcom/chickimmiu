import assert from 'node:assert/strict'
import test from 'node:test'

const {
  applyPointsMultiplier,
  isValidReadSlug,
  readRewardConfig,
  readRewardDescription,
  taipeiStartOfToday,
} = await import('./readReward.ts')

test('config falls back to defaults and honours env overrides', () => {
  delete process.env.KIM_BLOG_READ_POINTS
  delete process.env.KIM_BLOG_READ_DAILY_LIMIT
  delete process.env.KIM_BLOG_READ_MIN_DWELL_SECONDS
  assert.deepEqual(readRewardConfig(), {
    points: 5,
    dailyLimit: 3,
    minDwellSeconds: 20,
  })

  process.env.KIM_BLOG_READ_POINTS = '10'
  process.env.KIM_BLOG_READ_DAILY_LIMIT = '5'
  process.env.KIM_BLOG_READ_MIN_DWELL_SECONDS = '45'
  assert.deepEqual(readRewardConfig(), {
    points: 10,
    dailyLimit: 5,
    minDwellSeconds: 45,
  })

  // 非法值退回預設，不會變 0 或負數
  process.env.KIM_BLOG_READ_POINTS = '-3'
  process.env.KIM_BLOG_READ_DAILY_LIMIT = 'abc'
  process.env.KIM_BLOG_READ_MIN_DWELL_SECONDS = '0'
  assert.deepEqual(readRewardConfig(), {
    points: 5,
    dailyLimit: 3,
    minDwellSeconds: 20,
  })

  delete process.env.KIM_BLOG_READ_POINTS
  delete process.env.KIM_BLOG_READ_DAILY_LIMIT
  delete process.env.KIM_BLOG_READ_MIN_DWELL_SECONDS
})

test('slug validation accepts real slugs and rejects junk', () => {
  assert.equal(isValidReadSlug('summer-2026-lookbook'), true)
  assert.equal(isValidReadSlug('923151569307236622'), true)
  assert.equal(isValidReadSlug('%E9%87%91%E8%80%81'), true)
  assert.equal(isValidReadSlug(''), false)
  assert.equal(isValidReadSlug('has space'), false)
  assert.equal(isValidReadSlug('line\nbreak'), false)
  assert.equal(isValidReadSlug('a'.repeat(201)), false)
  assert.equal(isValidReadSlug(null), false)
  assert.equal(isValidReadSlug(42), false)
})

test('reward description is deterministic (it doubles as the dedupe key)', () => {
  assert.equal(
    readRewardDescription('summer-2026'),
    '閱讀金老佛爺部落格〈summer-2026〉',
  )
  assert.equal(
    readRewardDescription('summer-2026'),
    readRewardDescription('summer-2026'),
  )
})

test('points multiplier floors, guards junk, and never zeroes a reward', () => {
  // 金牌 1.5x：5 → 7；白金 2x：5 → 10；訂閱疊乘 1.5×1.5=2.25：5 → 11
  assert.equal(applyPointsMultiplier(5, 1.5), 7)
  assert.equal(applyPointsMultiplier(5, 2), 10)
  assert.equal(applyPointsMultiplier(5, 2.25), 11)
  // 異常倍率退回基礎值
  assert.equal(applyPointsMultiplier(5, 0), 5)
  assert.equal(applyPointsMultiplier(5, -1), 5)
  assert.equal(applyPointsMultiplier(5, Number.NaN), 5)
  // 極小倍率至少發 1 點
  assert.equal(applyPointsMultiplier(5, 0.1), 1)
})

test('taipei day boundary is UTC+8', () => {
  // 台北 07-30 23:30 → 當日起點 = UTC 07-29 16:00
  const lateEvening = new Date('2026-07-30T15:30:00.000Z')
  assert.equal(
    taipeiStartOfToday(lateEvening).toISOString(),
    '2026-07-29T16:00:00.000Z',
  )
  // 台北 07-31 00:10（UTC 07-30 16:10）→ 起點跳到 UTC 07-30 16:00
  const justAfterMidnight = new Date('2026-07-30T16:10:00.000Z')
  assert.equal(
    taipeiStartOfToday(justAfterMidnight).toISOString(),
    '2026-07-30T16:00:00.000Z',
  )
})
