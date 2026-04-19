import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { getEnabledGames } from '@/lib/games/getEnabledGames'
import { GamesHub } from '@/components/games/GamesHub'

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

export default async function GamesPage() {
  const [enabledGames, stats] = await Promise.all([getEnabledGames(), getHubStats()])
  return (
    <GamesHub
      enabledGames={enabledGames}
      todayGamePoints={stats.todayGamePoints}
      badgeCount={stats.badgeCount}
    />
  )
}
