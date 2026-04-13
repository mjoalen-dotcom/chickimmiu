'use server'

import { getPayload } from 'payload'
import config from '../../payload.config'
import { GAME_DEFS, type GameDef } from './gameConfig'

export interface EnabledGame extends GameDef {
  settings: Record<string, unknown>
}

/**
 * 取得所有已啟用的遊戲清單 + 對應設定
 * 前台呼叫此函式來決定顯示哪些遊戲
 */
export async function getEnabledGames(): Promise<EnabledGame[]> {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>

  // 總開關
  if (!gameSettings.enabled) return []

  const gameList = (gameSettings.gameList || {}) as Record<string, boolean>
  const enabledGames: EnabledGame[] = []

  for (const def of GAME_DEFS) {
    if (gameList[def.enabledKey]) {
      enabledGames.push({
        ...def,
        settings: (gameSettings[def.settingsKey] || {}) as unknown as Record<string, unknown>,
      })
    }
  }

  return enabledGames
}

/**
 * 取得單一遊戲設定（含啟用狀態檢查）
 */
export async function getGameSettings(gameSlug: string) {
  const payload = await getPayload({ config })
  const gameSettings = await payload.findGlobal({ slug: 'game-settings' }) as unknown as Record<string, unknown>

  if (!gameSettings.enabled) return null

  const def = GAME_DEFS.find((d) => d.slug === gameSlug)
  if (!def) return null

  const gameList = (gameSettings.gameList || {}) as Record<string, boolean>
  if (!gameList[def.enabledKey]) return null

  return {
    ...def,
    settings: (gameSettings[def.settingsKey] || {}) as unknown as Record<string, unknown>,
    globalDailyPointsLimit: gameSettings.globalDailyPointsLimit as number,
  }
}
