import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { getEnabledGames } from '@/lib/games/getEnabledGames'
import { GamesHub, type LeaderboardEntry, type UserBadge } from '@/components/games/GamesHub'

export const dynamic = 'force-dynamic'

type HubStats = {
  todayGamePoints: number | null
  badgeCount: number | null
}

type PageData = HubStats & {
  leaderboard: LeaderboardEntry[]
  userBadges: UserBadge[] | null
}

function maskName(raw: string): string {
  if (raw.length <= 1) return raw
  return raw[0] + '**'
}

async function getPageData(): Promise<PageData> {
  const empty: PageData = { todayGamePoints: null, badgeCount: null, leaderboard: [], userBadges: null }
  if (!process.env.DATABASE_URI) return empty

  try {
    const payload = await getPayload({ config })
    const headersList = await nextHeaders()
    const { user } = await payload.auth({ headers: headersList })

    const start = new Date()
    start.setHours(0, 0, 0, 0)

    // Always fetch leaderboard (public)
    const lbPromise = payload.find({
      collection: 'game-leaderboard',
      where: { period: { equals: 'all_time' } } as Where,
      sort: 'rank',
      limit: 10,
      depth: 1,
    })

    if (!user) {
      const lbRes = await lbPromise
      const leaderboard = buildLeaderboard(lbRes.docs as unknown as Record<string, unknown>[])
      return { ...empty, leaderboard, userBadges: null }
    }

    const userId = user.id as unknown as string

    const [pointsRes, badgesRes, lbRes, userBadgesRes] = await Promise.all([
      payload.find({
        collection: 'mini-game-records',
        where: {
          and: [
            { player: { equals: userId } },
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
            { player: { equals: userId } },
            { 'result.prizeType': { equals: 'badge' } },
          ],
        } as Where,
        limit: 0,
        depth: 0,
      }),
      lbPromise,
      payload.find({
        collection: 'user-rewards',
        where: {
          and: [
            { user: { equals: userId } },
            { rewardType: { equals: 'badge' } },
          ],
        } as Where,
        sort: '-createdAt',
        limit: 50,
        depth: 0,
      }),
    ])

    const todayGamePoints = pointsRes.docs.reduce((sum, doc) => {
      const r = (doc as unknown as Record<string, unknown>).result as Record<string, unknown> | undefined
      return sum + ((r?.prizeAmount as number | undefined) ?? 0)
    }, 0)

    const leaderboard = buildLeaderboard(lbRes.docs as unknown as Record<string, unknown>[])

    const userBadges: UserBadge[] = (userBadgesRes.docs as unknown as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: (r.displayName as string) || '徽章',
      state: (r.state as string) || 'unused',
    }))

    return {
      todayGamePoints,
      badgeCount: badgesRes.totalDocs,
      leaderboard,
      userBadges,
    }
  } catch {
    return empty
  }
}

function buildLeaderboard(docs: Record<string, unknown>[]): LeaderboardEntry[] {
  return docs.map((doc, i) => {
    const player = (doc.player as Record<string, unknown> | null) ?? null
    const rawName = typeof player?.name === 'string' ? player.name : '會員'
    return {
      rank: (doc.rank as number) ?? i + 1,
      name: maskName(rawName),
      points: (doc.totalPoints as number) ?? 0,
      tier: (doc.playerTier as string) ?? '',
      badgeIcon: (doc.badges as { badgeIcon?: string }[])?.[0]?.badgeIcon ?? '',
    }
  })
}

export default async function GamesPage() {
  const [enabledGames, data] = await Promise.all([getEnabledGames(), getPageData()])
  return (
    <GamesHub
      enabledGames={enabledGames}
      todayGamePoints={data.todayGamePoints}
      badgeCount={data.badgeCount}
      leaderboard={data.leaderboard}
      userBadges={data.userBadges}
    />
  )
}
