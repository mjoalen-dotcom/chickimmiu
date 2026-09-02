/**
 * 客服營業時間判斷（讀 cs-settings.businessHours）
 * ────────────────────────────────────────────
 * 伺服器時區不保證是 Asia/Taipei（Hetzner 是 UTC），所以一律用 Intl 依
 * 設定的 timezone 換算「當地星期幾 + 當地 HH:mm」，不能直接用 getDay()。
 */

export interface BusinessHoursConfig {
  timezone?: string
  schedule?: Array<{ dayOfWeek?: string | null; openTime?: string | null; closeTime?: string | null }>
  holidays?: Array<{ date?: string | null; reason?: string | null }>
  offHourAutoReply?: string | null
}

export interface BusinessHoursState {
  open: boolean
  /** 判斷依據：no_schedule = 後台沒設時段（視同全時段開放） */
  reason: 'open' | 'off_hours' | 'holiday' | 'no_schedule'
  localDate: string
  localTime: string
}

const DEFAULT_TZ = 'Asia/Taipei'

function localParts(tz: string, now: Date): { date: string; time: string; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  // hour 在 hour12:false 下跨午夜可能給 "24"
  const hour = get('hour') === '24' ? '00' : get('hour')
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
    weekday: weekdayMap[get('weekday')] ?? 0,
  }
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function evaluateBusinessHours(
  config: BusinessHoursConfig | null | undefined,
  now: Date = new Date(),
): BusinessHoursState {
  const tz = config?.timezone?.trim() || DEFAULT_TZ
  let parts: { date: string; time: string; weekday: number }
  try {
    parts = localParts(tz, now)
  } catch {
    parts = localParts(DEFAULT_TZ, now)
  }
  const base = { localDate: parts.date, localTime: parts.time }

  const holidays = (config?.holidays || []).map((h) => String(h?.date || '').slice(0, 10))
  if (holidays.includes(parts.date)) {
    return { open: false, reason: 'holiday', ...base }
  }

  const schedule = (config?.schedule || []).filter((s) => s?.dayOfWeek != null)
  if (!schedule.length) {
    return { open: true, reason: 'no_schedule', ...base }
  }

  const nowMin = toMinutes(parts.time)
  const todays = schedule.filter((s) => String(s.dayOfWeek) === String(parts.weekday))
  for (const slot of todays) {
    const open = toMinutes(String(slot.openTime || ''))
    const close = toMinutes(String(slot.closeTime || ''))
    if (open == null || close == null || nowMin == null) continue
    if (nowMin >= open && nowMin < close) {
      return { open: true, reason: 'open', ...base }
    }
  }

  return { open: false, reason: 'off_hours', ...base }
}
