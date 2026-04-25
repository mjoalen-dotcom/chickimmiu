/**
 * Zodiac sign helpers for daily horoscope feature.
 *
 * Western zodiac (12 signs) computed from Gregorian birthday.
 * Centralizes the date-range table so /api/horoscope/today and the
 * admin DailyHoroscopes collection share one source of truth.
 */

export type ZodiacSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces'

export const ZODIAC_SIGNS: ZodiacSign[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
]

export const ZODIAC_LABELS: Record<
  ZodiacSign,
  { zh: string; emoji: string; dateRange: string; element: '火' | '土' | '風' | '水' }
> = {
  aries:       { zh: '牡羊座', emoji: '♈', dateRange: '3/21–4/19',  element: '火' },
  taurus:      { zh: '金牛座', emoji: '♉', dateRange: '4/20–5/20',  element: '土' },
  gemini:      { zh: '雙子座', emoji: '♊', dateRange: '5/21–6/21',  element: '風' },
  cancer:      { zh: '巨蟹座', emoji: '♋', dateRange: '6/22–7/22',  element: '水' },
  leo:         { zh: '獅子座', emoji: '♌', dateRange: '7/23–8/22',  element: '火' },
  virgo:       { zh: '處女座', emoji: '♍', dateRange: '8/23–9/22',  element: '土' },
  libra:       { zh: '天秤座', emoji: '♎', dateRange: '9/23–10/23', element: '風' },
  scorpio:     { zh: '天蠍座', emoji: '♏', dateRange: '10/24–11/22',element: '水' },
  sagittarius: { zh: '射手座', emoji: '♐', dateRange: '11/23–12/21',element: '火' },
  capricorn:   { zh: '摩羯座', emoji: '♑', dateRange: '12/22–1/19', element: '土' },
  aquarius:    { zh: '水瓶座', emoji: '♒', dateRange: '1/20–2/18',  element: '風' },
  pisces:      { zh: '雙魚座', emoji: '♓', dateRange: '2/19–3/20',  element: '水' },
}

export function getZodiacFromBirthday(birthday: string | Date | null | undefined): ZodiacSign | null {
  if (!birthday) return null
  const d = birthday instanceof Date ? birthday : new Date(birthday)
  if (isNaN(d.getTime())) return null
  const m = d.getMonth() + 1
  const day = d.getDate()
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'aries'
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'taurus'
  if ((m === 5 && day >= 21) || (m === 6 && day <= 21)) return 'gemini'
  if ((m === 6 && day >= 22) || (m === 7 && day <= 22)) return 'cancer'
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'leo'
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'virgo'
  if ((m === 9 && day >= 23) || (m === 10 && day <= 23)) return 'libra'
  if ((m === 10 && day >= 24) || (m === 11 && day <= 22)) return 'scorpio'
  if ((m === 11 && day >= 23) || (m === 12 && day <= 21)) return 'sagittarius'
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 'capricorn'
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'aquarius'
  if ((m === 2 && day >= 19) || (m === 3 && day <= 20)) return 'pisces'
  return null
}

export type HoroscopeGender = 'female' | 'male'

/** Users.gender ('female'|'male'|'other'|null) → 'female'|'male' (other/null → 'female'). */
export function normalizeGender(raw: unknown): HoroscopeGender {
  return raw === 'male' ? 'male' : 'female'
}

/** YYYY-MM-DD in Asia/Taipei (UTC+8) — closed-beta server is set to TPE display. */
export function todayInTaipei(now: Date = new Date()): string {
  const tpe = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return tpe.toISOString().slice(0, 10)
}
