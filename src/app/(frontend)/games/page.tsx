import { getEnabledGames } from '@/lib/games/getEnabledGames'
import { GamesHub } from '@/components/games/GamesHub'

export const dynamic = 'force-dynamic'

export default async function GamesPage() {
  const enabledGames = await getEnabledGames()
  return <GamesHub enabledGames={enabledGames} />
}
