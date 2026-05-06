import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, normalizeLocale } from './config'

/**
 * next-intl 伺服端設定
 * ──────────────────────
 *
 * Cookie-based locale（無 /en/ /ja/ URL 前綴 routing）：
 *   - 從 ckm_locale cookie 讀目前語系（由 client 端 localeStore 寫入）
 *   - 動態 import 對應 dictionary JSON
 *   - 失敗 fallback 到 zh-TW
 *
 * 為什麼不走 routing prefix（/en/products）：
 *   1. 全站已上線一段時間，URL 變動會炸 SEO + admin 後台連結
 *   2. 多 URL 等於多 SSG 變體，build 時間倍增
 *   3. 封測階段以「顯示語系切換」為主，SEO locale 路由列入 PR 4 範圍
 *
 * 若 PR 4 需要 SEO locale 路由，把這檔換成 next-intl 標準 `routing.ts` +
 * 加 middleware 即可，dictionary 結構不用動。
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  const locale = normalizeLocale(raw)

  let messages: AbstractIntlMessages
  try {
    messages = (await import(`./dictionaries/${locale}.json`)).default as AbstractIntlMessages
  } catch {
    // 翻譯檔不存在或壞了 → 退回 zh-TW，避免整頁 500
    // eslint-disable-next-line no-console
    console.warn(`[i18n] dictionary for "${locale}" missing, falling back to ${DEFAULT_LOCALE}`)
    messages = (await import(`./dictionaries/${DEFAULT_LOCALE}.json`)).default as AbstractIntlMessages
  }

  return {
    locale,
    messages,
    // 時區 / 格式可在 PR 3 細化；現用瀏覽器預設
  }
})
