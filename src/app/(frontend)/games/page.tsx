import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { getEnabledGames } from '@/lib/games/getEnabledGames'
import { GamesHub, type LeaderboardEntry } from '@/components/games/GamesHub'

export const dynamic = 'force-dynamic'

type HubStats = {
  todayGamePoints: number | null
  badgeCount: number | null
}

async function getHubStats(): Promise<HubStats> {
  if (!process.env.DATABASE_URI) return { todayGamePoints: null, badgeCount: null }
  try {
    const payload = await getPayload({ config })
    const headersList = await nextHeaders()
    const { user } = await payload.auth({ headers: headersList })
    if (!user) return { todayGamePoints: null, badgeCount: null }

    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const [pointsRes, badgesRes] = await Promise.all([
      payload.find({
        collection: 'mini-game-records',
        where: {
          and: [
            { player: { equals: user.id } },
            { status: { equals: 'completed' } },
            { 'result.prizeType': { equals: 'points' } },
            { createdAt: { greater_than_equal: start.toISOString() } },
          ],
        } as Where,
        limit: 200,
        depth: 0,
      }),
      payload.find({
        collection: 'mini-game-records',
        where: {
          and: [
            { player: { equals: user.id } },
            { 'result.prizeType': { equals: 'badge' } },
          ],
        } as Where,
        limit: 0,
        depth: 0,
      }),
    ])

    const todayGamePoints = pointsRes.docs.reduce((sum, doc) => {
      const r = (doc as unknown as Record<string, unknown>).result as Record<string, unknown> | undefined
      return sum + ((r?.prizeAmount as number | undefined) ?? 0)
    }, 0)

    return { todayGamePoints, badgeCount: badgesRes.totalDocs }
  } catch {
    return { todayGamePoints: null, badgeCount: null }
  }
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!process.env.DATABASE_URI) return []
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'game-leaderboard',
      where: { period: { equals: 'alltime' } } as Where,
      sort: 'rank',
      limit: 10,
      depth: 1,
    })
    type LooseRecord = Record<string, unknown>
    return (result.docs as unknown as LooseRecord[]).map((doc) => {
      const player = doc.player as LooseRecord | null | undefined
      const badges = doc.badges as LooseRecord[] | null | undefined
      const firstBadge = badges?.[0]
      const tierEmoji = firstBadge?.badgeIcon as string | undefined
      return {
        rank: (doc.rank as number) ?? 0,
        name: (player?.name as string) || '會員',
        points: (doc.totalPoints as number) ?? 0,
        tier: (doc.playerTier as string) ?? '',
        badge: tierEmoji ?? '🌸',
      }
    })
  } catch {
    return []
  }
}

export default async function GamesPage() {
  const [enabledGames, stats, leaderboard] = await Promise.all([
    getEnabledGames(),
    getHubStats(),
    getLeaderboard(),
  ])
  return (
    <GamesHub
      enabledGames={enabledGames}
      todayGamePoints={stats.todayGamePoints}
      badgeCount={stats.badgeCount}
      leaderboard={leaderboard}
    />
  )
}
