import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'

/**
 * awardKimBlogReadReward 的規則測試（stub payload）。
 * SSO 版與 App v1 版共用這一份邏輯 —— 這裡驗的是防濫用三道閘 + 倍率 + 寫入順序。
 *
 * node 的 TS type-stripping 不做副檔名解析，而 readRewardAward.ts 內部有
 * extensionless 相對 import（Next bundler 慣例）→ 這裡註冊 resolve hook，
 * 相對路徑解析失敗時補 `.ts` 重試。
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

const { awardKimBlogReadReward } = await import('./readRewardAward.ts')

const SLUG = 'seoul-fashion-week'

/**
 * 建 stub payload：
 *  - blog-posts.find → articleExists 控制
 *  - points-transactions.find → 第一次呼叫（防重複鍵）回 dupCount、第二次（今日計數）回 todayCount
 *  - findGlobal / getActiveMembership 路徑：loyalty-settings 給 tier 倍率；user-subscriptions 查詢回空
 */
function stubPayload({
  articleExists = true,
  dupCount = 0,
  todayCount = 0,
  tierMultiplier = null, // null = 不設定（用 1）
  failCreate = false,
} = {}) {
  const writes = { created: [], updated: [] }
  let ptFindCalls = 0
  const payload = {
    async find({ collection }) {
      if (collection === 'blog-posts') {
        return { totalDocs: articleExists ? 1 : 0, docs: articleExists ? [{ id: 9 }] : [] }
      }
      if (collection === 'points-transactions') {
        ptFindCalls += 1
        return ptFindCalls === 1
          ? { totalDocs: dupCount, docs: [] }
          : { totalDocs: todayCount, docs: [] }
      }
      // getActiveMembership 之類的其它查詢一律回空
      return { totalDocs: 0, docs: [] }
    },
    async findGlobal({ slug }) {
      if (slug === 'loyalty-settings' && tierMultiplier !== null) {
        return { tierMultipliers: { goldMultiplier: tierMultiplier } }
      }
      return {}
    },
    async create(args) {
      if (failCreate) throw new Error('db down')
      writes.created.push(args)
      return { id: 1 }
    },
    async update(args) {
      writes.updated.push(args)
      return { id: args.id }
    },
  }
  return { payload, writes }
}

const user = (over = {}) => ({ id: 42, points: 100, memberTier: { slug: 'gold' }, ...over })

test('dwell 不足 → dwell_too_short，不查 DB 不寫入', async () => {
  const { payload, writes } = stubPayload()
  const r = await awardKimBlogReadReward(payload, user(), SLUG, 3)
  assert.deepEqual(r, { status: 200, body: { awarded: 0, points: null, reason: 'dwell_too_short' } })
  assert.equal(writes.created.length, 0)
})

test('dwell 非數字（App 忘了帶）→ dwell_too_short 而非 crash', async () => {
  const { payload } = stubPayload()
  const r = await awardKimBlogReadReward(payload, user(), SLUG, Number(undefined))
  assert.equal(r.body.reason, 'dwell_too_short')
})

test('文章不存在/未同步金老佛爺 → 404', async () => {
  const { payload } = stubPayload({ articleExists: false })
  const r = await awardKimBlogReadReward(payload, user(), SLUG, 30)
  assert.equal(r.status, 404)
})

test('同篇已領過 → already_rewarded 帶現有餘額，不寫入', async () => {
  const { payload, writes } = stubPayload({ dupCount: 1 })
  const r = await awardKimBlogReadReward(payload, user({ points: 77 }), SLUG, 30)
  assert.deepEqual(r.body, { awarded: 0, points: 77, reason: 'already_rewarded' })
  assert.equal(writes.created.length, 0)
})

test('達每日上限 → daily_limit，不寫入', async () => {
  const { payload, writes } = stubPayload({ todayCount: 3 })
  const r = await awardKimBlogReadReward(payload, user(), SLUG, 30)
  assert.equal(r.body.reason, 'daily_limit')
  assert.equal(writes.created.length, 0)
})

test('正常領取 → 基礎 5 點入帳 + users.points 同步 + 交易列 balance', async () => {
  const { payload, writes } = stubPayload()
  const r = await awardKimBlogReadReward(payload, user({ points: 100 }), SLUG, 30)
  assert.deepEqual(r.body, { awarded: 5, points: 105, reason: null })
  assert.equal(writes.created.length, 1)
  const tx = writes.created[0].data
  assert.equal(tx.source, 'kim_blog_read')
  assert.equal(tx.amount, 5)
  assert.equal(tx.balance, 105)
  assert.ok(String(tx.description).includes(SLUG), 'description 是防重複鍵，必含 slug')
  assert.deepEqual(writes.updated[0], {
    collection: 'users',
    id: 42,
    data: { points: 105 },
  })
})

test('tier 倍率 1.5 → 5×1.5 無條件捨去 = 7 點', async () => {
  const { payload } = stubPayload({ tierMultiplier: 1.5 })
  const r = await awardKimBlogReadReward(payload, user({ points: 0 }), SLUG, 30)
  assert.deepEqual(r.body, { awarded: 7, points: 7, reason: null })
})

test('寫入失敗 → 500，不假裝成功', async () => {
  const { payload } = stubPayload({ failCreate: true })
  const r = await awardKimBlogReadReward(payload, user(), SLUG, 30)
  assert.equal(r.status, 500)
})
