import { notFound } from 'next/navigation'
import { getGameSettings } from '@/lib/games/getEnabledGames'
import { GamePageClient } from '@/components/games/GamePageClient'

export const dynamic = 'force-dynamic'

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await getGameSettings(slug)

  if (!game) {
    notFound()
  }

  return <GamePageClient game={game} />
}
