import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  await (payload.updateGlobal as Function)({
    slug: 'game-settings',
    data: {
      enabled: true,
      gameList: {
        dailyCheckinEnabled: true,
        spinWheelEnabled: true,
        scratchCardEnabled: true,
        movieLotteryEnabled: true,
        fashionChallengeEnabled: true,
        cardBattleEnabled: true,
        stylePKEnabled: true,
        styleRelayEnabled: true,
        weeklyChallengeEnabled: true,
        coCreateEnabled: true,
        wishPoolEnabled: true,
        blindBoxEnabled: true,
        queenVoteEnabled: true,
        teamStyleEnabled: true,
      },
    },
  })
  console.log('✅ All 14 games enabled')
  process.exit(0)
}
main().catch(e => { console.error(e.message); process.exit(1) })
