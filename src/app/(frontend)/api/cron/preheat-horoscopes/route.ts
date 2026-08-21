import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { verifyCronAuth } from '@/lib/cron/auth'
import { ensureHoroscope } from '@/lib/horoscope/generate'
import { ZODIAC_SIGNS, todayInTaipei, type HoroscopeGender } from '@/lib/horoscope/zodiac'

/**
 * POST /api/cron/preheat-horoscopes
 * ─────────────────────────────────
 * 預先生成「今天 + 明天」12 星座 × 2 性別的運勢（共 48 筆 / 天），
 * 讓當日第一位會員直接 cache hit、不必等 Groq 延遲。
 *
 * 成本控制：HOROSCOPE_LLM_PROVIDER!=groq 時自動走 seed（零成本）。
 * 冪等：ensureHoroscope 只在不存在時生成。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const GENDERS: HoroscopeGender[] = ['female', 'male']

export async function POST(request: Request) {
  const authFail = verifyCronAuth(request)
  if (authFail) return authFail

  const started = Date.now()
  const payload = await getPayload({ config })

  const now = new Date()
  const today = todayInTaipei(now)
  const tomorrow = todayInTaipei(new Date(now.getTime() + 86_400_000))
  const dates = Array.from(new Set([today, tomorrow]))

  let created = 0
  let skipped = 0
  const errors: Array<{ key: string; error: string }> = []

  // 節流：Groq 免費層 RPM 有限，48 筆連發會 429 讓大半掉回 seed（2026-08-22
  // 實測）。只在真的呼叫過 LLM（didCreate）後 pace；skip 不用等。
  // 48 × 1.2s ≈ 58s + 生成時間，遠低於 maxDuration 300s。
  const usesLLM = process.env.HOROSCOPE_LLM_PROVIDER === 'groq'
  const PACE_MS = 1200

  for (const date of dates) {
    for (const sign of ZODIAC_SIGNS) {
      for (const gender of GENDERS) {
        try {
          const { created: didCreate } = await ensureHoroscope(payload, { sign, gender, date })
          if (didCreate) {
            created++
            if (usesLLM) await new Promise((r) => setTimeout(r, PACE_MS))
          } else {
            skipped++
          }
        } catch (err) {
          errors.push({
            key: `${date}/${sign}/${gender}`,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dates,
    created,
    skipped,
    errors: errors.slice(0, 20),
    duration_ms: Date.now() - started,
  })
}
