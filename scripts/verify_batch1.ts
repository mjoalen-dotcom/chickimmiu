/**
 * Batch 1 (engagement crons) 驗證 — 乾淨 temp DB。
 *
 * 跑法（dev DB schema drift，務必用乾淨 temp DB）：
 *   rm -f data/_b1.db*
 *   DATABASE_URI=file:./data/_b1.db NODE_OPTIONS=--no-deprecation yes y | \
 *     DATABASE_URI=file:./data/_b1.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
 *   DATABASE_URI=file:./data/_b1.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/verify_batch1.ts
 *
 * 覆蓋：settleStyleRoom / expireOpenWishes / settleDueLeaderboards / ensureHoroscope /
 *       runApplyProductSchedules。
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  settleExpiredRooms,
  expireOpenWishes,
} from '@/lib/games/socialGameActions'
import { settleDueLeaderboards } from '@/lib/games/leaderboardSettle'
import { ensureHoroscope } from '@/lib/horoscope/generate'
import { runApplyProductSchedules } from '@/lib/products/applySchedules'
import { getTpeDateString } from '@/lib/games/gameEngine'

const results: Array<{ name: string; ok: boolean; detail: string }> = []
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`)
}

// 1x1 透明 PNG（給 style-submissions.images 必填用）
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let counter = 0
function uniqEmail(tag: string): string {
  counter += 1
  return `b1_${tag}_${Date.now()}_${counter}@test.local`
}

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  async function mkUser(tag: string, points = 0): Promise<string | number> {
    const u = await p.create({
      collection: 'users',
      data: { email: uniqEmail(tag), password: 'Test12345!', name: `B1 ${tag}`, points },
      disableVerificationEmail: true,
      overrideAccess: true,
    })
    return u.id as string | number
  }

  async function userPoints(id: string | number): Promise<number> {
    const u = await p.findByID({ collection: 'users', id, depth: 0 })
    return Number(u.points) || 0
  }

  // ── Test 1: settleStyleRoom（房間結算）──
  try {
    const host = await mkUser('host')
    const member = await mkUser('member')

    const media = await p.create({
      collection: 'media',
      data: { alt: 'b1-test' },
      file: { data: PNG_1x1, mimetype: 'image/png', name: 'b1.png', size: PNG_1x1.length },
      overrideAccess: true,
    })

    const pastExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const room = await p.create({
      collection: 'style-game-rooms',
      data: {
        gameType: 'style_pk',
        host,
        participants: [
          { user: host, role: 'host', status: 'active' },
          { user: member, role: 'member', status: 'active' },
        ],
        capacity: 2,
        visibility: 'public',
        status: 'active',
        expiresAt: pastExpiry,
      },
      overrideAccess: true,
    })

    // host 作品 5 票、member 作品 9 票 → member 應獲勝
    await p.create({
      collection: 'style-submissions',
      data: {
        player: host, gameType: 'style_pk', room: room.id,
        images: [{ image: media.id }], status: 'submitted', voteCount: 5,
      },
      overrideAccess: true,
    })
    const memberSub = await p.create({
      collection: 'style-submissions',
      data: {
        player: member, gameType: 'style_pk', room: room.id,
        images: [{ image: media.id }], status: 'submitted', voteCount: 9,
      },
      overrideAccess: true,
    })

    const memberBefore = await userPoints(member)
    const res = await settleExpiredRooms()
    check('settleExpiredRooms settled=1', res.settled === 1, `settled=${res.settled} errors=${JSON.stringify(res.errors)}`)

    const settledRoom = await p.findByID({ collection: 'style-game-rooms', id: room.id, depth: 0 })
    check('room.status=settled', settledRoom.status === 'settled', `status=${settledRoom.status}`)
    const winnerId = typeof settledRoom.result?.winner === 'object'
      ? settledRoom.result?.winner?.id
      : settledRoom.result?.winner
    check('winner = member (most votes)', String(winnerId) === String(member), `winner=${winnerId} expected=${member}`)
    check('result.totalSubmissions=2', settledRoom.result?.totalSubmissions === 2, `=${settledRoom.result?.totalSubmissions}`)
    check('result.totalVotes=14', settledRoom.result?.totalVotes === 14, `=${settledRoom.result?.totalVotes}`)

    const memberAfter = await userPoints(member)
    check('winner awarded 50 pts', memberAfter - memberBefore === 50, `delta=${memberAfter - memberBefore}`)

    const winSub = await p.findByID({ collection: 'style-submissions', id: memberSub.id, depth: 0 })
    check('winner submission status=winner', winSub.status === 'winner', `status=${winSub.status}`)
    check('winner submission rank=1', winSub.rank === 1, `rank=${winSub.rank}`)

    // 冪等：再跑一次不應重複發獎
    const res2 = await settleExpiredRooms()
    const memberAfter2 = await userPoints(member)
    check('idempotent re-run (no re-settle)', res2.settled === 0 && memberAfter2 === memberAfter, `settled=${res2.settled} pts=${memberAfter2}`)
  } catch (e) {
    check('settleStyleRoom suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 2: expireOpenWishes（許願過期退點）──
  try {
    const seeker = await mkUser('seeker', 100) // 假設已預扣後剩 100
    const pastExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const wish = await p.create({
      collection: 'style-wishes',
      data: {
        seeker, title: '測試願望', description: '退點測試',
        bountyPoints: 30, status: 'open', expiresAt: pastExpiry,
      },
      overrideAccess: true,
    })
    const before = await userPoints(seeker)
    const res = await expireOpenWishes()
    check('expireOpenWishes expired=1', res.expired === 1, `expired=${res.expired}`)
    check('refundedPoints=30', res.refundedPoints === 30, `=${res.refundedPoints}`)
    const after = await userPoints(seeker)
    check('seeker refunded +30', after - before === 30, `delta=${after - before}`)
    const expiredWish = await p.findByID({ collection: 'style-wishes', id: wish.id, depth: 0 })
    check('wish.status=expired', expiredWish.status === 'expired', `status=${expiredWish.status}`)
    // 冪等
    const res2 = await expireOpenWishes()
    check('expireOpenWishes idempotent', res2.expired === 0, `expired=${res2.expired}`)
  } catch (e) {
    check('expireOpenWishes suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 3: settleDueLeaderboards（排行榜前三名發獎）──
  try {
    const yKey = getTpeDateString(new Date(Date.now() - 86_400_000)) // 昨天 daily key
    const players: Array<{ id: string | number; pts: number }> = []
    for (const pts of [100, 80, 60, 40]) {
      const id = await mkUser(`lb${pts}`, 0)
      players.push({ id, pts })
      await p.create({
        collection: 'mini-game-records',
        data: {
          player: id, gameType: 'leaderboard_daily', status: 'completed',
          result: { outcome: 'completed', prizeType: 'none', prizeAmount: 0 },
          metadata: { periodKey: yKey, totalPoints: pts },
        },
        overrideAccess: true,
      })
    }
    const before = await Promise.all(players.map((pl) => userPoints(pl.id)))
    const res = await settleDueLeaderboards()
    const daily = res.results.find((r) => r.period === 'daily')
    check('leaderboard daily awarded=3', daily?.awarded === 3, `awarded=${daily?.awarded} ${JSON.stringify(daily)}`)
    const after = await Promise.all(players.map((pl) => userPoints(pl.id)))
    check('top3 each +100 bonus', after[0] - before[0] === 100 && after[1] - before[1] === 100 && after[2] - before[2] === 100, `deltas=${after.map((a, i) => a - before[i]).join(',')}`)
    check('4th place no bonus', after[3] - before[3] === 0, `delta=${after[3] - before[3]}`)
    // 冪等
    const res2 = await settleDueLeaderboards()
    const daily2 = res2.results.find((r) => r.period === 'daily')
    check('leaderboard idempotent (alreadySettled=3)', daily2?.awarded === 0 && daily2?.alreadySettled === 3, JSON.stringify(daily2))
  } catch (e) {
    check('settleDueLeaderboards suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 4: ensureHoroscope（預熱）──
  try {
    const args = { sign: 'aries' as const, gender: 'female' as const, date: '2026-06-08' }
    const r1 = await ensureHoroscope(payload, args)
    check('ensureHoroscope first=created', r1.created === true, `created=${r1.created}`)
    const r2 = await ensureHoroscope(payload, args)
    check('ensureHoroscope second=skipped', r2.created === false, `created=${r2.created}`)
    const row = await p.find({
      collection: 'daily-horoscopes',
      where: { and: [{ zodiacSign: { equals: 'aries' } }, { date: { equals: '2026-06-08' } }, { gender: { equals: 'female' } }] },
      limit: 1, overrideAccess: true,
    })
    check('horoscope row persisted w/ content', row.docs.length === 1 && Boolean(row.docs[0]?.workFortune), `docs=${row.docs.length}`)
  } catch (e) {
    check('ensureHoroscope suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Test 5: runApplyProductSchedules（限時上下架）──
  try {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const cat = await p.create({
      collection: 'categories',
      data: { name: 'B1 測試分類', slug: `b1-cat-${Date.now()}` },
      overrideAccess: true,
    })
    const draftProd = await p.create({
      collection: 'products',
      data: { name: 'B1 排程上架', slug: `b1-pub-${Date.now()}`, price: 100, category: cat.id, status: 'draft', publishAt: past },
      overrideAccess: true,
    })
    const liveProd = await p.create({
      collection: 'products',
      data: { name: 'B1 排程下架', slug: `b1-arc-${Date.now()}`, price: 100, category: cat.id, status: 'published', unpublishAt: past },
      overrideAccess: true,
    })
    const res = await runApplyProductSchedules(payload)
    check('apply-schedules published>=1', res.published >= 1, `published=${res.published}`)
    check('apply-schedules archived>=1', res.archived >= 1, `archived=${res.archived}`)
    const d2 = await p.findByID({ collection: 'products', id: draftProd.id, depth: 0 })
    const l2 = await p.findByID({ collection: 'products', id: liveProd.id, depth: 0 })
    check('draft → published', d2.status === 'published', `status=${d2.status}`)
    check('published → archived', l2.status === 'archived', `status=${l2.status}`)
  } catch (e) {
    check('runApplyProductSchedules suite', false, e instanceof Error ? e.message : String(e))
  }

  // ── Summary ──
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`\n=== Batch 1 verify: ${passed} PASS / ${failed} FAIL (of ${results.length}) ===\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
