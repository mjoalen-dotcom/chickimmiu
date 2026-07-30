import { createSign } from 'node:crypto'

import type { KimBlogAnalytics } from './kimBlogAnalytics'

type ServiceAccountKey = {
  client_email: string
  private_key: string
  token_uri?: string
}

type GA4Report = {
  dimensionHeaders?: { name?: string }[]
  metricHeaders?: { name?: string }[]
  rowCount?: number
  rows?: {
    dimensionValues?: { value?: string }[]
    metricValues?: { value?: string }[]
  }[]
}

type ReportRecord = {
  dimensions: Record<string, string>
  metrics: Record<string, number>
}

export type KimGa4AnalyticsResult = {
  analytics?: KimBlogAnalytics
  configured: boolean
  error?: string
}

const ANALYTICS_SCOPE =
  'https://www.googleapis.com/auth/analytics.readonly'
const ANALYTICS_DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const DEFAULT_HOST_NAME = 'blog.kimlafayette.com'
const CACHE_TTL_MS = 5 * 60 * 1000
const TIME_ZONE = 'Asia/Taipei'

const reportCache = new Map<
  string,
  { analytics: KimBlogAnalytics; expiresAt: number }
>()

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function parseServiceAccount(raw: string): ServiceAccountKey | null {
  try {
    const trimmed = raw.trim()
    const text = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf8')
    const json = JSON.parse(text) as Partial<ServiceAccountKey>

    if (
      typeof json.client_email === 'string' &&
      typeof json.private_key === 'string'
    ) {
      return {
        client_email: json.client_email,
        private_key: json.private_key,
        token_uri: json.token_uri,
      }
    }
  } catch {
    // Configuration errors are surfaced without exposing key material.
  }

  return null
}

async function mintAccessToken(serviceAccount: ServiceAccountKey) {
  const tokenUri =
    serviceAccount.token_uri || 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  )
  const claims = base64url(
    JSON.stringify({
      aud: tokenUri,
      exp: now + 3600,
      iat: now,
      iss: serviceAccount.client_email,
      scope: ANALYTICS_SCOPE,
    }),
  )
  const signingInput = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()
  const privateKey = serviceAccount.private_key.includes('\\n')
    ? serviceAccount.private_key.replace(/\\n/g, '\n')
    : serviceAccount.private_key
  const assertion = `${signingInput}.${base64url(
    signer.sign(privateKey),
  )}`

  const response = await fetch(tokenUri, {
    method: 'POST',
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Google OAuth HTTP ${response.status}`)
  }

  const json = (await response.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new Error('Google OAuth did not return an access token')
  }

  return json.access_token
}

function hostFilter(hostName: string) {
  return {
    filter: {
      fieldName: 'hostName',
      stringFilter: {
        matchType: 'EXACT',
        value: hostName,
      },
    },
  }
}

async function runReport(
  accessToken: string,
  propertyId: string,
  hostName: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `${ANALYTICS_DATA_API}/properties/${encodeURIComponent(
      propertyId,
    )}:runReport`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        dimensionFilter: hostFilter(hostName),
      }),
      cache: 'no-store',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    },
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `Analytics Data API HTTP ${response.status}: ${errorText.slice(
        0,
        300,
      )}`,
    )
  }

  return (await response.json()) as GA4Report
}

function reportRecords(report: GA4Report): ReportRecord[] {
  const dimensionNames =
    report.dimensionHeaders?.map((header) => header.name || '') || []
  const metricNames =
    report.metricHeaders?.map((header) => header.name || '') || []

  return (report.rows || []).map((row) => ({
    dimensions: Object.fromEntries(
      dimensionNames.map((name, index) => [
        name,
        row.dimensionValues?.[index]?.value || '',
      ]),
    ),
    metrics: Object.fromEntries(
      metricNames.map((name, index) => {
        const value = Number(row.metricValues?.[index]?.value)
        return [name, Number.isFinite(value) ? value : 0]
      }),
    ),
  }))
}

function dateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TIME_ZONE,
    year: 'numeric',
  }).format(date)
}

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00+08:00`)
  return new Intl.DateTimeFormat('zh-TW', {
    day: 'numeric',
    month: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date)
}

function gaDateKey(value: string) {
  if (!/^\d{8}$/.test(value)) return value
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(
    6,
    8,
  )}`
}

function aggregateRows(
  records: ReportRecord[],
  dimension: string,
  metric: string,
  limit = 10,
) {
  const totals = new Map<string, number>()

  for (const record of records) {
    const label = record.dimensions[dimension]?.trim() || '未知'
    totals.set(label, (totals.get(label) || 0) + (record.metrics[metric] || 0))
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, pageviews]) => ({
      label,
      pageviews: Math.round(pageviews),
    }))
}

function buildAnalytics(args: {
  calendarReport: GA4Report
  dailyReport: GA4Report
  days: number
  generatedAt: string
  geoReport: GA4Report
  hostName: string
  hourlyReport: GA4Report
  pagesReport: GA4Report
  propertyId: string
  sourcesReport: GA4Report
  techReport: GA4Report
  totalsReport: GA4Report
  weekdayReport: GA4Report
}): KimBlogAnalytics {
  const {
    calendarReport,
    dailyReport,
    days,
    generatedAt,
    geoReport,
    hostName,
    hourlyReport,
    pagesReport,
    propertyId,
    sourcesReport,
    techReport,
    totalsReport,
    weekdayReport,
  } = args
  const totalsRecord = reportRecords(totalsReport)[0] || {
    dimensions: {},
    metrics: {},
  }
  const dailyRecords = reportRecords(dailyReport)
  const dailyMap = new Map(
    dailyRecords.map((record) => [
      gaDateKey(record.dimensions.date),
      record,
    ]),
  )
  const now = new Date()
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(now)
    date.setUTCDate(now.getUTCDate() - (days - index - 1))
    const key = dateKey(date)
    const record = dailyMap.get(key)
    return {
      date: key,
      label: dateLabel(key),
      pageviews: Math.round(record?.metrics.screenPageViews || 0),
      visitors: Math.round(record?.metrics.activeUsers || 0),
    }
  })

  const weekdayNames = [
    '週日',
    '週一',
    '週二',
    '週三',
    '週四',
    '週五',
    '週六',
  ]
  const weekdayRecords = new Map(
    reportRecords(weekdayReport).map((record) => [
      Number(record.dimensions.dayOfWeek),
      record,
    ]),
  )
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
    const record = weekdayRecords.get(dayIndex)
    return {
      label: weekdayNames[dayIndex],
      pageviews: Math.round(record?.metrics.screenPageViews || 0),
      visitors: Math.round(record?.metrics.activeUsers || 0),
    }
  })

  const hourlyRecords = new Map(
    reportRecords(hourlyReport).map((record) => [
      Number(record.dimensions.hour),
      record,
    ]),
  )
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const record = hourlyRecords.get(hour)
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      pageviews: Math.round(record?.metrics.screenPageViews || 0),
      visitors: Math.round(record?.metrics.activeUsers || 0),
    }
  })

  const heatmapMap = new Map(
    reportRecords(calendarReport).map((record) => [
      `${record.dimensions.dayOfWeek}:${Number(record.dimensions.hour)}`,
      Math.round(record.metrics.screenPageViews || 0),
    ]),
  )
  const heatmap = [1, 2, 3, 4, 5, 6, 0].flatMap((dayIndex) =>
    Array.from({ length: 24 }, (_, hour) => ({
      dayIndex,
      hour,
      pageviews: heatmapMap.get(`${dayIndex}:${hour}`) || 0,
    })),
  )

  const techRecords = reportRecords(techReport)
  const geoRecords = reportRecords(geoReport)
  const sourceRecords = reportRecords(sourcesReport)
  const pageRecords = reportRecords(pagesReport)
  const pageMap = new Map<
    string,
    { pageviews: number; title: string; visitors: number }
  >()

  for (const record of pageRecords) {
    const path = record.dimensions.pagePath || ''
    if (!/^\/blog\/[^/?]+\/?/.test(path)) continue
    const current = pageMap.get(path) || {
      pageviews: 0,
      title: '',
      visitors: 0,
    }
    current.pageviews += record.metrics.screenPageViews || 0
    current.visitors += record.metrics.activeUsers || 0
    if (!current.title) current.title = record.dimensions.pageTitle || path
    pageMap.set(path, current)
  }

  const popularPages = [...pageMap.entries()]
    .sort((left, right) => right[1].pageviews - left[1].pageviews)
    .slice(0, 10)
    .map(([path, page]) => ({
      pageviews: Math.round(page.pageviews),
      path,
      title: page.title,
      visitors: Math.round(page.visitors),
    }))

  const cities = geoRecords
    .map((record) => ({
      city: record.dimensions.city || '未知',
      country: record.dimensions.country || '未知',
      label: `${record.dimensions.city || '未知'}, ${
        record.dimensions.country || '未知'
      }`,
      pageviews: Math.round(record.metrics.screenPageViews || 0),
      visitors: Math.round(record.metrics.activeUsers || 0),
    }))
    .sort((left, right) => right.pageviews - left.pageviews)
    .slice(0, 10)

  return {
    browsers: aggregateRows(techRecords, 'browser', 'screenPageViews', 8),
    cities,
    configured: true,
    countries: aggregateRows(
      geoRecords,
      'country',
      'screenPageViews',
      8,
    ),
    daily,
    days,
    devices: aggregateRows(
      techRecords,
      'deviceCategory',
      'screenPageViews',
      6,
    ).map((row) => ({
      ...row,
      value: row.label.toLocaleLowerCase(),
    })),
    ga4Error: null,
    generatedAt,
    heatmap,
    hostName,
    hourly,
    operatingSystems: aggregateRows(
      techRecords,
      'operatingSystem',
      'screenPageViews',
      8,
    ),
    popularPages,
    propertyId,
    source: 'ga4',
    sources: sourceRecords
      .map((record) => ({
        label: record.dimensions.sessionSource || 'direct',
        pageviews: Math.round(record.metrics.sessions || 0),
        visitors: Math.round(record.metrics.activeUsers || 0),
      }))
      .sort((left, right) => right.pageviews - left.pageviews)
      .slice(0, 10),
    totals: {
      averageDwellSeconds: Math.round(
        totalsRecord.metrics.averageSessionDuration || 0,
      ),
      comments: 0,
      engagedSessions: Math.round(
        totalsRecord.metrics.engagedSessions || 0,
      ),
      interactions: Math.round(totalsRecord.metrics.eventCount || 0),
      likes: 0,
      pageviews: Math.round(totalsRecord.metrics.screenPageViews || 0),
      visitors: Math.round(totalsRecord.metrics.activeUsers || 0),
    },
    truncated: false,
    weekdays,
  }
}

export async function getKimGa4Analytics(
  days: number,
): Promise<KimGa4AnalyticsResult> {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim()
  const serviceAccountRaw =
    process.env.GA4_SERVICE_ACCOUNT_JSON?.trim()
  const hostName =
    process.env.GA4_KIM_BLOG_HOSTNAME?.trim() || DEFAULT_HOST_NAME

  if (!propertyId || !serviceAccountRaw) {
    return { configured: false }
  }

  const serviceAccount = parseServiceAccount(serviceAccountRaw)
  if (!serviceAccount) {
    return {
      configured: true,
      error:
        'GA4_SERVICE_ACCOUNT_JSON must be raw or base64-encoded service account JSON.',
    }
  }

  const safeDays = Math.max(7, Math.min(90, Math.round(days)))
  const cacheKey = `${propertyId}:${hostName}:${safeDays}`
  const cached = reportCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { analytics: cached.analytics, configured: true }
  }

  try {
    const accessToken = await mintAccessToken(serviceAccount)
    const dateRanges = [
      { endDate: 'today', startDate: `${safeDays - 1}daysAgo` },
    ]
    const metrics = (...names: string[]) =>
      names.map((name) => ({ name }))
    const dimensions = (...names: string[]) =>
      names.map((name) => ({ name }))
    const query = (body: Record<string, unknown>) =>
      runReport(accessToken, propertyId, hostName, {
        dateRanges,
        keepEmptyRows: true,
        ...body,
      })

    const [
      totalsReport,
      dailyReport,
      weekdayReport,
      hourlyReport,
      calendarReport,
      techReport,
      geoReport,
      sourcesReport,
      pagesReport,
    ] = await Promise.all([
      query({
        metrics: metrics(
          'activeUsers',
          'screenPageViews',
          'engagedSessions',
          'eventCount',
          'averageSessionDuration',
        ),
      }),
      query({
        dimensions: dimensions('date'),
        limit: 100,
        metrics: metrics('activeUsers', 'screenPageViews'),
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      query({
        dimensions: dimensions('dayOfWeek'),
        limit: 7,
        metrics: metrics('activeUsers', 'screenPageViews'),
      }),
      query({
        dimensions: dimensions('hour'),
        limit: 24,
        metrics: metrics('activeUsers', 'screenPageViews'),
      }),
      query({
        dimensions: dimensions('dayOfWeek', 'hour'),
        limit: 168,
        metrics: metrics('screenPageViews'),
      }),
      query({
        dimensions: dimensions(
          'deviceCategory',
          'operatingSystem',
          'browser',
        ),
        limit: 1000,
        metrics: metrics('screenPageViews'),
      }),
      query({
        dimensions: dimensions('country', 'city'),
        limit: 1000,
        metrics: metrics('activeUsers', 'screenPageViews'),
      }),
      query({
        dimensions: dimensions('sessionSource'),
        limit: 100,
        metrics: metrics('activeUsers', 'sessions'),
        orderBys: [{ desc: true, metric: { metricName: 'sessions' } }],
      }),
      query({
        dimensions: dimensions('pageTitle', 'pagePath'),
        limit: 1000,
        metrics: metrics('activeUsers', 'screenPageViews'),
        orderBys: [
          { desc: true, metric: { metricName: 'screenPageViews' } },
        ],
      }),
    ])

    const analytics = buildAnalytics({
      calendarReport,
      dailyReport,
      days: safeDays,
      generatedAt: new Date().toISOString(),
      geoReport,
      hostName,
      hourlyReport,
      pagesReport,
      propertyId,
      sourcesReport,
      techReport,
      totalsReport,
      weekdayReport,
    })

    reportCache.set(cacheKey, {
      analytics,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return { analytics, configured: true }
  } catch (error) {
    return {
      configured: true,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown Google Analytics error',
    }
  }
}
