import { resolveSocialAuth, type SocialProviderFlags } from './socialCredentials'

/**
 * 社群登入按鈕開關解析（server-only）
 * ---------------------------------
 * 顯示條件 = 憑證齊全（後台 GlobalSettings 優先、.env fallback）AND 後台開關。
 * 實際判斷收斂在 socialCredentials.resolveSocialAuth() —— auth.ts 註冊 provider
 * 用同一份，所以「按鈕出現」⟺「provider 有註冊」，不會出現點了必失敗的按鈕。
 */
export type { SocialProviderFlags }

export async function getEnabledSocialProviders(): Promise<SocialProviderFlags> {
  return (await resolveSocialAuth()).enabled
}
