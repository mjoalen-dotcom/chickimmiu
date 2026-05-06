/**
 * i18n 設定常數
 * ──────────────
 *
 * 這檔案是「locale 真相」單一來源，next-intl request config / dictionaries /
 * localeStore / LanguageSwitcher 都從這裡讀，避免 hardcoded scattered。
 *
 * 加新語系流程：
 *   1. 把 code 加進 LOCALES
 *   2. 加 src/i18n/dictionaries/<code>.json（複製 zh-TW.json 翻譯）
 *   3. localeStore 的 LocaleCode type 跟著加（src/stores/localeStore.ts）
 *   4. LanguageSwitcher LANGUAGES 加 flag/label
 */

export const LOCALES = ['zh-TW', 'zh-CN', 'en', 'ja', 'ko'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'zh-TW'

/** 客戶端 cookie 名稱（與 stores/localeStore.ts writeCookie 相同） */
export const LOCALE_COOKIE_NAME = 'ckm_locale'

/** 收到不認得的 locale 字串 → 落到 DEFAULT_LOCALE，避免 dynamic import 爆 */
export function normalizeLocale(input: string | undefined | null): Locale {
  if (!input) return DEFAULT_LOCALE
  return (LOCALES as readonly string[]).includes(input) ? (input as Locale) : DEFAULT_LOCALE
}
