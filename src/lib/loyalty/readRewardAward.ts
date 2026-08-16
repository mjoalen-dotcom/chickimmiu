import type { Payload } from 'payload'
// 相對路徑而非 '@/'：這條 import 鏈全是 type-only/純函式，讓 node --test 可直測
import {
  applyPointsMultiplier,
  readRewardConfig,
  readRewardDescription,
  taipeiStartOfToday,
} from '../sso/readReward'
import { resolvePointsMultiplier } from './pointsMultiplier'

/**
 * 金老佛爺「看文章賺點數」發點核心（server-only）
 * ---------------------------------------------
 * 兩個入口共用同一份規則，防濫用判斷不能有版本飄移：
 *   - /api/sso/points/read-reward  … blog.kimlafayette.com PHP 端（client_secret 認證）
 *   - /api/v1/points/read-reward   … 手機 App（Bearer token 認證）
 *
 * 防濫用三道閘（順序即檢查順序）：
 *   1. 停留時間 >= minDwellSeconds（呼叫端計時）
 *   2. 每人每篇終身一次（points-transactions 的 description 當防重複鍵）
 *   3. 每人每日上限 N 篇（台北時區換日）
 * 另：文章必須是 published + public + 已勾同步金老佛爺的真實文章。
 *
 * 呼叫端負責：驗身分（client secret 或 Bearer）、驗 slug 格式、把 user 以
 * depth>=1 查出來（memberTier 要 populate 給倍率解析用）。
 */

export type ReadRewardOutcome =
  | { status: 200; body: { awarded: number; points: number | null; reason: string | null } }
  | { status: 404 | 500; body: { error: string } }

export async function awardKimBlogReadReward(
  payload: Payload,
  user: Record<string, unknown>,
  slug: string,
  dwellSeconds: number,
): Promise<ReadRewardOutcome> {
  const rewardConfig = readRewardConfig()
  const dwell = Number(dwellSeconds)
  if (!Number.isFinite(dwell) || dwell < rewardConfig.minDwellSeconds) {
    return { status: 200, body: { awarded: 0, points: null, reason: 'dwell_too_short' } }
  }

  const article = await payload.find({
    collection: 'blog-posts',
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
        { visibility: { equals: 'public' } },
        { publishToKimLafayette: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
  })
  if (article.totalDocs === 0) {
    return { status: 404, body: { error: 'Unknown article' } }
  }

  const description = readRewardDescription(slug)
  const currentBalance = typeof user.points === 'number' ? user.points : 0

  const existing = await payload.find({
    collection: 'points-transactions',
    where: {
      and: [
        { user: { equals: user.id as string | number } },
        { source: { equals: 'kim_blog_read' } },
        { description: { equals: description } },
      ],
    },
    limit: 1,
    depth: 0,
  })
  if (existing.totalDocs > 0) {
    return { status: 200, body: { awarded: 0, points: currentBalance, reason: 'already_rewarded' } }
  }

  const todayCount = await payload.find({
    collection: 'points-transactions',
    where: {
      and: [
        { user: { equals: user.id as string | number } },
        { source: { equals: 'kim_blog_read' } },
        { createdAt: { greater_than: taipeiStartOfToday().toISOString() } },
      ],
    },
    limit: 0,
    depth: 0,
  })
  if (todayCount.totalDocs >= rewardConfig.dailyLimit) {
    return { status: 200, body: { awarded: 0, points: currentBalance, reason: 'daily_limit' } }
  }

  // 會員等級 + 訂閱點數倍率，與消費回饋同一套規則（Orders 付款 hook）
  const multiplier = await resolvePointsMultiplier(payload, user)
  const awardedPoints = applyPointsMultiplier(rewardConfig.points, multiplier)

  // local API 會被 PointsTransactions hooks 跳過（req.payloadAPI === 'local'），
  // 所以 users.points 要自己同步 — 與 gameActions 相同 pattern
  const newBalance = currentBalance + awardedPoints
  try {
    await (payload.create as (args: {
      collection: 'points-transactions'
      data: Record<string, unknown>
    }) => Promise<unknown>)({
      collection: 'points-transactions',
      data: {
        user: user.id,
        amount: awardedPoints,
        type: 'earn',
        source: 'kim_blog_read',
        description,
        balance: newBalance,
      },
    })
    await (payload.update as (args: {
      collection: 'customers'
      id: string | number
      data: Record<string, unknown>
    }) => Promise<unknown>)({
      collection: 'customers',
      id: user.id as string | number,
      data: { points: newBalance },
    })
  } catch (error) {
    console.error('[readRewardAward] award failed:', error)
    return { status: 500, body: { error: 'Reward could not be recorded' } }
  }

  return { status: 200, body: { awarded: awardedPoints, points: newBalance, reason: null } }
}
