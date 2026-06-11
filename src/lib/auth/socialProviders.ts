import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * 社群登入按鈕開關解析（server-only）
 * ---------------------------------
 * 顯示條件 = GlobalSettings.socialLogin 開關 AND env 憑證齊全。
 * env 缺憑證時 auth.ts 根本不會註冊該 provider，按鈕點了必失敗，
 * 所以無論後台開關為何一律隱藏。
 */
export type SocialProviderFlags = {
  google: boolean
  facebook: boolean
  line: boolean
  apple: boolean
}

export async function getEnabledSocialProviders(): Promise<SocialProviderFlags> {
  const creds: SocialProviderFlags = {
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    facebook: Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET),
    line: Boolean(process.env.AUTH_LINE_CHANNEL_ID && process.env.AUTH_LINE_CHANNEL_SECRET),
    apple: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
  }

  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({
      slug: 'global-settings',
      depth: 0,
    })) as unknown as {
      socialLogin?: {
        enableGoogle?: boolean
        enableFacebook?: boolean
        enableLine?: boolean
        enableApple?: boolean
      }
    }
    const sl = settings?.socialLogin || {}
    return {
      google: creds.google && (sl.enableGoogle ?? true),
      facebook: creds.facebook && (sl.enableFacebook ?? true),
      line: creds.line && (sl.enableLine ?? true),
      apple: creds.apple && (sl.enableApple ?? false),
    }
  } catch (error) {
    console.error('[socialProviders] 讀取 global-settings 失敗，fallback 用 env 憑證判斷:', error)
    return creds
  }
}
