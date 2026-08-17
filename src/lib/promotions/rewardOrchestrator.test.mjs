import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'

/**
 * Reward Orchestrator 測試（P0-B 效果類補完）。
 * 跑法：node --test src/lib/promotions/rewardOrchestrator.test.mjs
 * 只測純函式部分（intent 讀取 / 倍率連乘）；grantIntentRewards 需要 payload，
 * 用假 payload 驗冪等與 enum 合法性。
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw err
    }
  },
})

const { readRewardIntents, campaignPointsMultiplier, grantIntentRewards } = await import(
  './rewardOrchestrator.ts'
)

// ── readRewardIntents ───────────────────────────────────────────────────────

test('readRewardIntents：缺 promotion / 非陣列 → 空陣列（不炸）', () => {
  assert.deepEqual(readRewardIntents(null), [])
  assert.deepEqual(readRewardIntents({}), [])
  assert.deepEqual(readRewardIntents({ promotion: {} }), [])
  assert.deepEqual(readRewardIntents({ promotion: { rewardIntents: 'nope' } }), [])
})

test('readRewardIntents：濾掉結構不對的項目', () => {
  const out = readRewardIntents({
    promotion: { rewardIntents: [null, 'x', { type: 'gift_item' }, { noType: 1 }] },
  })
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'gift_item')
})

// ── campaignPointsMultiplier ────────────────────────────────────────────────

test('倍率：沒有 points_multiplier → 1（不影響既有計算）', () => {
  assert.equal(campaignPointsMultiplier([]), 1)
  assert.equal(campaignPointsMultiplier([{ type: 'gift_item' }]), 1)
})

test('倍率：多條連乘', () => {
  assert.equal(
    campaignPointsMultiplier([
      { type: 'points_multiplier', multiplier: 2 },
      { type: 'points_multiplier', multiplier: 1.5 },
    ]),
    3,
  )
})

test('倍率：非法值（0/負數/NaN/undefined）一律忽略，不會把點數歸零', () => {
  assert.equal(
    campaignPointsMultiplier([
      { type: 'points_multiplier', multiplier: 0 },
      { type: 'points_multiplier', multiplier: -3 },
      { type: 'points_multiplier', multiplier: NaN },
      { type: 'points_multiplier' },
      { type: 'points_multiplier', multiplier: 2 },
    ]),
    2,
  )
})

// ── grantIntentRewards ──────────────────────────────────────────────────────

function fakePayload({ existing = [] } = {}) {
  const created = []
  return {
    created,
    logger: { error: () => {} },
    find: async () => ({ docs: existing }),
    create: async ({ collection, data }) => {
      created.push({ collection, data })
      return { id: created.length }
    },
  }
}

const REWARD_TYPES = new Set([
  'free_shipping_coupon',
  'movie_ticket_physical',
  'movie_ticket_digital',
  'coupon',
  'gift_physical',
  'badge',
  'voucher',
])

test('grant_reward：寫進 user-rewards，rewardType 必為合法 enum', async () => {
  const p = fakePayload()
  const res = await grantIntentRewards(p, {
    userId: 7,
    orderId: 99,
    intents: [{ type: 'grant_reward', ruleKey: 'c:r:v1', rewardKey: 'Mystery Key', quantity: 2 }],
  })
  assert.equal(res.granted, 1)
  assert.equal(p.created.length, 1)
  const d = p.created[0].data
  assert.equal(p.created[0].collection, 'user-rewards')
  assert.equal(d.displayName, 'Mystery Key')
  assert.equal(d.amount, 2)
  assert.equal(d.state, 'unused')
  assert.equal(d.attachedToOrder, 99)
  assert.ok(REWARD_TYPES.has(d.rewardType), `rewardType 必須合法，得到 ${d.rewardType}`)
})

test('grant_reward：指定 rewardType 時照用', async () => {
  const p = fakePayload()
  await grantIntentRewards(p, {
    userId: 7,
    orderId: 99,
    intents: [
      { type: 'grant_reward', ruleKey: 'c:r:v1', rewardKey: '限定徽章', quantity: 1, rewardType: 'badge' },
    ],
  })
  assert.equal(p.created[0].data.rewardType, 'badge')
})

test('grant_reward：同訂單同獎項已存在 → 跳過（冪等，付款 hook 重跑不重複發）', async () => {
  const p = fakePayload({ existing: [{ id: 1 }] })
  const res = await grantIntentRewards(p, {
    userId: 7,
    orderId: 99,
    intents: [{ type: 'grant_reward', ruleKey: 'c:r:v1', rewardKey: 'Mystery Key', quantity: 1 }],
  })
  assert.equal(res.granted, 0)
  assert.equal(res.skipped, 1)
  assert.equal(p.created.length, 0)
})

test('grant_reward：rewardKey 空白 → 略過，不建垃圾紀錄', async () => {
  const p = fakePayload()
  const res = await grantIntentRewards(p, {
    userId: 7,
    orderId: 99,
    intents: [{ type: 'grant_reward', ruleKey: 'c:r:v1', rewardKey: '   ', quantity: 1 }],
  })
  assert.equal(res.granted, 0)
  assert.equal(p.created.length, 0)
})

test('grant_reward：其他 intent 型別不會被誤發', async () => {
  const p = fakePayload()
  await grantIntentRewards(p, {
    userId: 7,
    orderId: 99,
    intents: [
      { type: 'gift_item', ruleKey: 'c:g:v1', productId: 5, quantity: 1 },
      { type: 'points_multiplier', ruleKey: 'c:m:v1', multiplier: 2 },
    ],
  })
  assert.equal(p.created.length, 0)
})

test('grant_reward：create 失敗只記 log 不拋出（不擋付款流程）', async () => {
  const p = fakePayload()
  p.create = async () => {
    throw new Error('db down')
  }
  const res = await grantIntentRewards(p, {
    userId: 7,
    orderId: 99,
    intents: [{ type: 'grant_reward', ruleKey: 'c:r:v1', rewardKey: 'X', quantity: 1 }],
  })
  assert.equal(res.granted, 0)
})
