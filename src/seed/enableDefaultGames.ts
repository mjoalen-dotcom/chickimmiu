/**
 * 開啟預設遊戲：每日簽到、幸運轉盤、刮刮樂、抽卡片比大小
 * 使用方式：npx tsx src/seed/enableDefaultGames.ts
 */
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
        cardBattleEnabled: true,
      },
    },
  })
  console.log('✅ 已開啟預設遊戲：')
  console.log('   1. 每日簽到')
  console.log('   2. 幸運轉盤')
  console.log('   3. 刮刮樂')
  console.log('   6. 抽卡片比大小')
  console.log('')
  console.log('💡 提示：')
  console.log('   • 電影票抽獎 → 建議等會員升級系統完善後開啟')
  console.log('   • 穿搭挑戰/PK/接龍等 → 可配合活動期間限時開啟')
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 錯誤:', e.message)
  process.exit(1)
})
