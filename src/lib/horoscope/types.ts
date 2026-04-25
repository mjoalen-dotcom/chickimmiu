import type { HoroscopeGender, ZodiacSign } from './zodiac'

/**
 * Shape returned by /api/horoscope/today and the LLM/seed generators.
 * Server stores `luckyColors` and `styleKeywords` as comma-separated text;
 * API parses to arrays before returning to the client.
 */
export interface HoroscopeContent {
  workFortune: string
  relationshipFortune: string
  moneyFortune: string
  cautionFortune: string
  outfitAdvice: string
  luckyColors: string[]
  styleKeywords: string[]
}

export interface HoroscopeGenInput {
  sign: ZodiacSign
  gender: HoroscopeGender
  /** YYYY-MM-DD */
  date: string
  /** 出生時間 HH:mm（24 小時制，選填）— 給 LLM 推算上升星座/月座；seed 不使用 */
  birthTime?: string | null
}

/**
 * `collectionTags` enum on Products.ts that styleKeywords MUST come from.
 * LLM prompt restricts output to this list so DB joins always hit.
 */
export const STYLE_KEYWORDS_VOCAB = [
  'jin-live',
  'jin-style',
  'host-style',
  'brand-custom',
  'formal-dresses',
  'rush',
  'celebrity-style',
] as const
export type StyleKeyword = (typeof STYLE_KEYWORDS_VOCAB)[number]
