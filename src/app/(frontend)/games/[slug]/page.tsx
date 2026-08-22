import { notFound } from 'next/navigation'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getGameSettings } from '@/lib/games/getEnabledGames'
import { GAME_CONFIGS, checkDailyPlays, getEffectiveGameConfig } from '@/lib/games/gameEngine'
import { GamePageClient } from '@/components/games/GamePageClient'
import type { GamePrecheck } from '@/components/games/PointsPrecheckBanner'

export const dynamic = 'force-dynamic'

/**
 * 遊玩前點數預檢（2026-08-22）：server 端先算好「餘額 / 本次消耗 /
 * 免費次數」給 GamePageClient 顯示，玩家按開始前就知道扣不扣得起。
 * 引擎管的 5 款遊戲（GAME_CONFIGS）走 checkDailyPlays 拿免費次數；
 * 其他（MBTI 測驗等）讀 settings.pointsCostPerPlay，免費次數不適用。
 */
async function buildPrecheck(
  gameSlug: string,
  settings: Record<string, unknown>,
): Promise<GamePrecheck> {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList }).catch(() => ({ user: null }))
  if (!user) return { loggedIn: false }

  const userData = user as unknown as Record<string, unknown>
  const points = (userData.points as number) || 0

  const gameType = gameSlug.replace(/-/g, '_')
  if (GAME_CONFIGS[gameType]) {
    const [eff, daily] = await Promise.all([
      getEffectiveGameConfig(gameType),
      checkDailyPlays(String(user.id), gameType),
    ])
    return {
      loggedIn: true,
      points,
      pointsCost: eff?.pointsCost ?? 0,
      freePlaysLeft: daily.freePlaysLeft,
      dailyRemaining: daily.remaining,
    }
  }

  const rawCost = settings.pointsCostPerPlay ?? settings.pointsCost
  const pointsCost = Number(rawCost)
  return {
    loggedIn: true,
    points,
    pointsCost: Number.isFinite(pointsCost) ? pointsCost : 0,
    freePlaysLeft: null,
    dailyRemaining: null,
  }
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await getGameSettings(slug)

  if (!game) {
    notFound()
  }

  const precheck = await buildPrecheck(slug, game.settings)

  return <GamePageClient game={game} precheck={precheck} />
}
