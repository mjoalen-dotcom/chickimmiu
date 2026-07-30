import type { Payload } from 'payload'

import { getKimGa4Analytics } from './kimGa4Analytics'

export const KIM_BLOG_PATH_PREFIX = 'kim-blog:'

type EventRow = {
  eventType?: string | null
  sessionId?: string | null
  pagePath?: string | null
  elementKey?: string | null
  durationMs?: number | null
  scrollPctMax?: number | null
  referrer?: string | null
  deviceType?: string | null
  countryCode?: string | null
  meta?: Record<string, unknown> | null
  createdAt?: string | null
}

export type KimBlogAnalytics = {
  source: 'ga4' | 'internal'
  configured: boolean
  ga4Error: string | null
  propertyId?: string
  hostName?: string
  days: number
  generatedAt: string
  truncated: boolean
  totals: {
    visitors: number
    pageviews: number
    engagedSessions: number
    interactions: number
    averageDwellSeconds: number
    likes: number
    comments: number
  }
  daily: {
    date: string
    label: string
    visitors: number
    pageviews: number
  }[]
  weekdays: { label: string; pageviews: number; visitors: number }[]
  hourly: {
    hour: number
    label: string
    pageviews: number
    visitors: number
  }[]
  heatmap: { dayIndex: number; hour: number; pageviews: number }[]
  devices: { label: string; value: string; pageviews: number }[]
  operatingSystems: { label: string; pageviews: number }[]
  browsers: { label: string; pageviews: number }[]
  sources: { label: string; pageviews: number; visitors: number }[]
  countries: { label: string; pageviews: number }[]
  cities: {
    city: string
    country: string
    label: string
    pageviews: number
    visitors: number
  }[]
  popularPages: {
    path: string
    title: string
    pageviews: number
    visitors: number
  }[]
}

const TIME_ZONE = 'Asia/Taipei'
const MAX_EVENTS = 20_000

function dateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date)
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date)
}

function weekdayLabel(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    weekday: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date(value))
}

function localHour(value: string) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).format(new Date(value))
  const hour = Number(formatted)
  return Number.isFinite(hour) ? hour : 0
}

function weekdayIndex(value: string) {
  const label = weekdayLabel(value)
  return ['週日', '週一', '週二', '週三', '週四', '週五', '週六'].indexOf(
    label,
  )
}

function increment<Key>(map: Map<Key, number>, key: Key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

function sourceLabel(referrer?: string | null) {
  if (!referrer) return '直接進入'
  try {
    const host = new URL(referrer).hostname.toLocaleLowerCase()
    if (host === 'blog.kimlafayette.com') return '站內連結'
    if (host.includes('google.')) return 'Google'
    if (host.includes('facebook.com') || host.includes('fb.com')) return 'Facebook'
    if (host.includes('instagram.com')) return 'Instagram'
    if (host.includes('line.me')) return 'LINE'
    if (host.includes('pixnet.net')) return 'PIXNET'
    return host.replace(/^www\./, '')
  } catch {
    return '其他來源'
  }
}

function deviceLabel(value: string) {
  if (value === 'mobile') return '手機'
  if (value === 'tablet') return '平板'
  if (value === 'desktop') return '桌機'
  return '其他'
}

function sortedRows(map: Map<string, number>, limit = 8) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
}

async function getInternalKimBlogAnalytics(
  payload: Payload,
  days = 30,
): Promise<KimBlogAnalytics> {
  const now = new Date()
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - Math.max(1, days - 1))
  start.setUTCHours(0, 0, 0, 0)

  const events: EventRow[] = []
  let page = 1
  let totalPages = 1

  try {
    do {
      const result = await payload.find({
        collection: 'behavior-events',
        depth: 0,
        limit: 500,
        page,
        sort: 'createdAt',
        where: {
          and: [
            { createdAt: { greater_than_equal: start.toISOString() } },
            { pagePath: { contains: KIM_BLOG_PATH_PREFIX } },
          ],
        },
      })
      events.push(...(result.docs as EventRow[]))
      totalPages = result.totalPages
      page += 1
    } while (page <= totalPages && events.length < MAX_EVENTS)
  } catch (error) {
    payload.logger.warn({
      err: error,
      msg: '[kim-blog/analytics] analytics collection unavailable; returning empty report',
    })
  }

  const pageviews = events.filter((event) => event.eventType === 'pageview')
  const visitors = new Set(pageviews.map((event) => event.sessionId).filter(Boolean))
  const engagedSessions = new Set<string>()
  const dailyViews = new Map<string, number>()
  const dailyVisitors = new Map<string, Set<string>>()
  const weekdayViews = new Map<string, number>()
  const weekdayVisitors = new Map<string, Set<string>>()
  const hourlyViews = new Map<number, number>()
  const hourlyVisitors = new Map<number, Set<string>>()
  const heatmapViews = new Map<string, number>()
  const deviceViews = new Map<string, number>()
  const sourceViews = new Map<string, number>()
  const sourceVisitors = new Map<string, Set<string>>()
  const countryViews = new Map<string, number>()
  const pageViewCounts = new Map<string, number>()
  const pageVisitors = new Map<string, Set<string>>()
  const pageTitles = new Map<string, string>()
  const dwellValues: number[] = []
  let interactions = 0

  for (const event of events) {
    const sid = event.sessionId || ''
    if (
      sid &&
      (event.eventType === 'click' ||
        (event.eventType === 'scroll' && (event.scrollPctMax || 0) >= 50) ||
        (event.eventType === 'dwell' && (event.durationMs || 0) >= 10_000))
    ) {
      engagedSessions.add(sid)
    }
    if (event.eventType === 'click') interactions += 1
    if (event.eventType === 'dwell' && typeof event.durationMs === 'number') {
      dwellValues.push(event.durationMs)
    }
  }

  for (const event of pageviews) {
    if (!event.createdAt || !event.pagePath) continue
    const date = dateKey(event.createdAt)
    const path = event.pagePath.slice(KIM_BLOG_PATH_PREFIX.length)
    increment(dailyViews, date)
    if (event.sessionId) {
      const set = dailyVisitors.get(date) || new Set<string>()
      set.add(event.sessionId)
      dailyVisitors.set(date, set)
    }
    const weekday = weekdayLabel(event.createdAt)
    const dayIndex = weekdayIndex(event.createdAt)
    const hour = localHour(event.createdAt)
    const source = sourceLabel(event.referrer)
    increment(weekdayViews, weekday)
    increment(hourlyViews, hour)
    increment(heatmapViews, `${dayIndex}:${hour}`)
    if (event.sessionId) {
      const weekdaySet = weekdayVisitors.get(weekday) || new Set<string>()
      weekdaySet.add(event.sessionId)
      weekdayVisitors.set(weekday, weekdaySet)
      const hourSet = hourlyVisitors.get(hour) || new Set<string>()
      hourSet.add(event.sessionId)
      hourlyVisitors.set(hour, hourSet)
      const sourceSet = sourceVisitors.get(source) || new Set<string>()
      sourceSet.add(event.sessionId)
      sourceVisitors.set(source, sourceSet)
    }
    increment(deviceViews, event.deviceType || 'other')
    increment(sourceViews, source)
    increment(countryViews, event.countryCode || '未知')
    increment(pageViewCounts, path)
    if (event.sessionId) {
      const set = pageVisitors.get(path) || new Set<string>()
      set.add(event.sessionId)
      pageVisitors.set(path, set)
    }
    const title = typeof event.meta?.title === 'string' ? event.meta.title.trim() : ''
    if (title) pageTitles.set(path, title)
  }

  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = dateKey(date)
    return {
      date: key,
      label: dayLabel(date),
      visitors: dailyVisitors.get(key)?.size || 0,
      pageviews: dailyViews.get(key) || 0,
    }
  })

  const weekdayOrder = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
  const weekdays = weekdayOrder.map((label) => ({
    label,
    pageviews: weekdayViews.get(label) || 0,
    visitors: weekdayVisitors.get(label)?.size || 0,
  }))

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    pageviews: hourlyViews.get(hour) || 0,
    visitors: hourlyVisitors.get(hour)?.size || 0,
  }))

  const heatmap = [1, 2, 3, 4, 5, 6, 0].flatMap((dayIndex) =>
    Array.from({ length: 24 }, (_, hour) => ({
      dayIndex,
      hour,
      pageviews: heatmapViews.get(`${dayIndex}:${hour}`) || 0,
    })),
  )

  const devices = ['mobile', 'desktop', 'tablet', 'other'].map((value) => ({
    value,
    label: deviceLabel(value),
    pageviews: deviceViews.get(value) || 0,
  }))

  const popularPages = [...pageViewCounts.entries()]
    .filter(([path]) => /^\/blog\/[^/?]+\/?/.test(path))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([path, count]) => ({
      path,
      title: pageTitles.get(path) || decodeURIComponent(path.split('/').filter(Boolean).at(-1) || path),
      pageviews: count,
      visitors: pageVisitors.get(path)?.size || 0,
    }))

  const averageDwellSeconds =
    dwellValues.length === 0
      ? 0
      : Math.round(
          dwellValues.reduce((sum, value) => sum + value, 0) /
            dwellValues.length /
            1000,
        )

  return {
    source: 'internal',
    configured: false,
    ga4Error: null,
    days,
    generatedAt: now.toISOString(),
    truncated: events.length >= MAX_EVENTS && page <= totalPages,
    totals: {
      visitors: visitors.size,
      pageviews: pageviews.length,
      engagedSessions: engagedSessions.size,
      interactions,
      averageDwellSeconds,
      likes: 0,
      comments: 0,
    },
    daily,
    weekdays,
    hourly,
    heatmap,
    devices,
    operatingSystems: [],
    browsers: [],
    sources: sortedRows(sourceViews).map(([label, count]) => ({
      label,
      pageviews: count,
      visitors: sourceVisitors.get(label)?.size || 0,
    })),
    countries: sortedRows(countryViews, 6).map(([label, count]) => ({
      label,
      pageviews: count,
    })),
    cities: [],
    popularPages,
  }
}

export async function getKimBlogAnalytics(
  payload: Payload,
  days = 30,
): Promise<KimBlogAnalytics> {
  const ga4 = await getKimGa4Analytics(days)
  if (ga4.analytics) return ga4.analytics

  if (ga4.error) {
    payload.logger.warn({
      msg: '[kim-blog/analytics] GA4 unavailable; using internal analytics',
      reason: ga4.error,
    })
  }

  const fallback = await getInternalKimBlogAnalytics(payload, days)
  return {
    ...fallback,
    configured: ga4.configured,
    ga4Error: ga4.error || null,
  }
}
