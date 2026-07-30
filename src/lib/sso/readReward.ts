const DEFAULT_POINTS = 5
const DEFAULT_DAILY_LIMIT = 3
const DEFAULT_MIN_DWELL_SECONDS = 20

export interface ReadRewardConfig {
  points: number
  dailyLimit: number
  minDwellSeconds: number
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function readRewardConfig(): ReadRewardConfig {
  return {
    points: positiveInt('KIM_BLOG_READ_POINTS', DEFAULT_POINTS),
    dailyLimit: positiveInt('KIM_BLOG_READ_DAILY_LIMIT', DEFAULT_DAILY_LIMIT),
    minDwellSeconds: positiveInt(
      'KIM_BLOG_READ_MIN_DWELL_SECONDS',
      DEFAULT_MIN_DWELL_SECONDS,
    ),
  }
}

export function isValidReadSlug(slug: unknown): slug is string {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug.length <= 200 &&
    // eslint-disable-next-line no-control-regex
    !/[\s\x00-\x1f]/.test(slug)
  )
}

// 描述字串同時是防重複鍵：同會員 + 同 description 的 kim_blog_read
// 交易視為已領過。改動格式會讓既有紀錄失去防重複效果。
export function readRewardDescription(slug: string): string {
  return `閱讀金老佛爺部落格〈${slug}〉`
}

// 倍率套用：基礎點數 × 倍率無條件捨去；倍率異常（非正數/NaN）退回基礎值，
// 正常倍率下最少發 1 點
export function applyPointsMultiplier(base: number, multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return base
  return Math.max(1, Math.floor(base * multiplier))
}

// 每日上限以台北時區的一天為界（UTC+8，無日光節約）
export function taipeiStartOfToday(now = new Date()): Date {
  const tzOffsetMs = 8 * 60 * 60 * 1000
  const taipei = new Date(now.getTime() + tzOffsetMs)
  taipei.setUTCHours(0, 0, 0, 0)
  return new Date(taipei.getTime() - tzOffsetMs)
}
