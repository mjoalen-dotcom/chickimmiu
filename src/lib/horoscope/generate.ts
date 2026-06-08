import type { Payload } from 'payload'

import { getSeedHoroscope } from './seed'
import { generateViaGroq } from './groq'
import type { HoroscopeContent, HoroscopeGenInput } from './types'

/**
 * 共用運勢生成 — /api/horoscope/today（lazy）與 /api/cron/preheat-horoscopes（預熱）
 * 共用同一條生成 + 寫入路徑，避免兩邊邏輯漂移。
 *
 * 生成策略：HOROSCOPE_LLM_PROVIDER=groq 且有 key → Groq；否則 seed。
 * Groq 失敗自動 fallback seed，永不 throw。
 */

export async function generateHoroscopeContent(
  input: HoroscopeGenInput,
): Promise<{ content: HoroscopeContent; generatedBy: 'seed' | 'groq' }> {
  const wantsLLM = process.env.HOROSCOPE_LLM_PROVIDER === 'groq'
  if (wantsLLM) {
    try {
      const content = await generateViaGroq(input)
      return { content, generatedBy: 'groq' }
    } catch (err) {
      // Graceful degradation — never let LLM failure black out the UI
      // eslint-disable-next-line no-console
      console.warn('[horoscope] Groq failed, falling back to seed:', err)
    }
  }
  const content = getSeedHoroscope({ sign: input.sign, gender: input.gender, date: input.date })
  return { content, generatedBy: 'seed' }
}

/** content → daily-horoscopes data shape（luckyColors/styleKeywords 以逗號存） */
function toRowData(input: HoroscopeGenInput, content: HoroscopeContent, generatedBy: string) {
  return {
    zodiacSign: input.sign,
    date: input.date,
    gender: input.gender,
    workFortune: content.workFortune,
    relationshipFortune: content.relationshipFortune,
    moneyFortune: content.moneyFortune,
    cautionFortune: content.cautionFortune,
    outfitAdvice: content.outfitAdvice,
    luckyColors: content.luckyColors.join(','),
    styleKeywords: content.styleKeywords.join(','),
    generatedBy,
  }
}

/**
 * 生成並寫入快取（cache miss 時呼叫）。
 * DB 寫入失敗仍回傳 in-memory 內容（純讀情境不阻塞 UI）。
 */
export async function generateAndCacheHoroscope(
  payload: Payload,
  input: HoroscopeGenInput,
): Promise<{ entry: Record<string, unknown>; generatedBy: string }> {
  const { content, generatedBy } = await generateHoroscopeContent(input)
  const data = toRowData(input, content, generatedBy)
  try {
    const created = await payload.create({
      collection: 'daily-horoscopes',
      overrideAccess: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
    })
    return { entry: created as unknown as Record<string, unknown>, generatedBy }
  } catch (err) {
    // DB write failure — still serve fortune; another request will retry write
    // eslint-disable-next-line no-console
    console.warn('[horoscope] cache write failed:', err)
    return { entry: data as unknown as Record<string, unknown>, generatedBy }
  }
}

/**
 * 預熱用 — 不存在才生成。回傳是否新建。
 */
export async function ensureHoroscope(
  payload: Payload,
  input: HoroscopeGenInput,
): Promise<{ created: boolean }> {
  const existing = await payload.find({
    collection: 'daily-horoscopes',
    where: {
      and: [
        { zodiacSign: { equals: input.sign } },
        { date: { equals: input.date } },
        { gender: { equals: input.gender } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) return { created: false }
  await generateAndCacheHoroscope(payload, input)
  return { created: true }
}
