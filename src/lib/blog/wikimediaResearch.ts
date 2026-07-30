import type { ImageLicenseKind } from './articleStudio'

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

type WikimediaMetadata = Record<string, { value?: string } | undefined>

interface WikimediaImageInfo {
  extmetadata?: WikimediaMetadata
  height?: number
  mime?: string
  size?: number
  thumburl?: string
  url?: string
  width?: number
}

interface WikimediaPage {
  extract?: string
  fullurl?: string
  imageinfo?: WikimediaImageInfo[]
  title?: string
}

export interface WikimediaImageCandidate {
  alt: string
  creator: string
  credit: string
  downloadUrl: string
  height: number | null
  licenseKind: ImageLicenseKind
  licenseLabel: string
  licenseUrl: string
  mimeType: string
  originalUrl: string
  pageTitle: string
  sourceLabel: 'Wikimedia Commons'
  sourceUrl: string
  width: number | null
}

export interface KpopResearchResult {
  checkedAt: string
  images: WikimediaImageCandidate[]
  query: string
  sources: Array<{
    extract: string
    label: string
    provider: 'Wikipedia'
    url: string
  }>
}

function stripHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function safeHttpUrl(value: unknown): string {
  const source = String(value ?? '').trim()
  if (!source) return ''
  try {
    const parsed = new URL(source)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : ''
  } catch {
    return ''
  }
}

function licenseKindFor(label: string): ImageLicenseKind {
  const normalized = label.toUpperCase().replace(/[‐‑‒–—]/g, '-')
  if (normalized.includes('PUBLIC DOMAIN') || normalized === 'PDM') {
    return 'public-domain'
  }
  if (normalized.includes('CC0')) return 'cc0'
  if (normalized.includes('CC BY-NC')) return 'cc-by-nc'
  if (normalized.includes('CC BY-SA')) return 'cc-by-sa'
  if (normalized.includes('CC BY')) return 'cc-by'
  return 'unknown'
}

export function isWhitelistedCommonsLicense(value: unknown): boolean {
  const normalized = stripHtml(value).toUpperCase().replace(/[‐‑‒–—]/g, '-')
  if (!normalized || normalized.includes('NC') || normalized.includes('ND')) {
    return false
  }
  return (
    normalized.includes('CC0') ||
    normalized.includes('PUBLIC DOMAIN') ||
    normalized === 'PDM' ||
    normalized.includes('CC BY')
  )
}

export function isSafeCommonsDownloadUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && url.hostname === 'upload.wikimedia.org'
  } catch {
    return false
  }
}

function isAutoUsableCommonsCandidate(
  candidate: WikimediaImageCandidate,
): boolean {
  const completeLicenseMetadata =
    candidate.licenseKind === 'public-domain' ||
    candidate.licenseKind === 'cc0'
      ? Boolean(candidate.sourceUrl)
      : candidate.licenseKind === 'cc-by' ||
          candidate.licenseKind === 'cc-by-sa'
        ? Boolean(candidate.sourceUrl && candidate.licenseUrl)
        : false
  return (
    isWhitelistedCommonsLicense(candidate.licenseLabel) &&
    isSafeCommonsDownloadUrl(candidate.downloadUrl) &&
    completeLicenseMetadata
  )
}

export function normalizeCommonsCandidate(
  page: WikimediaPage,
): WikimediaImageCandidate | null {
  const info = page.imageinfo?.[0]
  const metadata = info?.extmetadata || {}
  const pageTitle = String(page.title || '').trim()
  const originalUrl = safeHttpUrl(info?.url)
  const downloadUrl = safeHttpUrl(info?.thumburl) || originalUrl
  const licenseLabel = stripHtml(metadata.LicenseShortName?.value)
  if (!info || !pageTitle || !originalUrl || !downloadUrl || !licenseLabel) {
    return null
  }

  return {
    alt:
      stripHtml(metadata.ObjectName?.value) ||
      pageTitle.replace(/^File:/i, '').replace(/\.[^.]+$/, ''),
    creator: stripHtml(metadata.Artist?.value) || '作者未標示',
    credit: stripHtml(metadata.Credit?.value),
    downloadUrl,
    height:
      Number.isFinite(Number(info.height)) && Number(info.height) > 0
        ? Number(info.height)
        : null,
    licenseKind: licenseKindFor(licenseLabel),
    licenseLabel,
    licenseUrl: safeHttpUrl(metadata.LicenseUrl?.value),
    mimeType: String(info.mime || ''),
    originalUrl,
    pageTitle,
    sourceLabel: 'Wikimedia Commons',
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(pageTitle)}`,
    width:
      Number.isFinite(Number(info.width)) && Number(info.width) > 0
        ? Number(info.width)
        : null,
  }
}

async function fetchJson(fetchImpl: FetchLike, url: URL) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'KimLafayetteBlogStudio/1.0 (https://blog.kimlafayette.com)',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new Error(`Wikimedia request returned HTTP ${response.status}`)
  }
  return (await response.json()) as {
    query?: { pages?: WikimediaPage[] }
  }
}

export async function getCommonsImageCandidate(
  input: string,
  options: { fetchImpl?: FetchLike } = {},
): Promise<WikimediaImageCandidate> {
  const pageTitle = String(input || '').trim()
  if (
    !/^File:/i.test(pageTitle) ||
    pageTitle.length > 240 ||
    /[\u0000\r\n]/.test(pageTitle)
  ) {
    throw new Error('無效的 Wikimedia Commons 圖片頁。')
  }
  const fetchImpl = options.fetchImpl || fetch
  const commonsUrl = new URL('https://commons.wikimedia.org/w/api.php')
  commonsUrl.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '1000',
    origin: '*',
    prop: 'imageinfo',
    redirects: '1',
    titles: pageTitle,
  }).toString()
  const result = await fetchJson(fetchImpl, commonsUrl)
  const candidate = normalizeCommonsCandidate(result.query?.pages?.[0] || {})
  if (
    !candidate ||
    !isAutoUsableCommonsCandidate(candidate)
  ) {
    throw new Error('圖片授權不在自動使用白名單，請改用其他圖片。')
  }
  return candidate
}

export async function researchKpopTopic(
  input: string,
  options: { fetchImpl?: FetchLike } = {},
): Promise<KpopResearchResult> {
  const query = String(input || '').trim()
  if (query.length < 2 || query.length > 80) {
    throw new Error('團體名稱須為 2 至 80 個字。')
  }
  const fetchImpl = options.fetchImpl || fetch

  const wikipediaUrl = new URL('https://zh.wikipedia.org/w/api.php')
  wikipediaUrl.search = new URLSearchParams({
    action: 'query',
    exchars: '12000',
    explaintext: '1',
    exsectionformat: 'plain',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrlimit: '1',
    gsrnamespace: '0',
    gsrsearch: query,
    inprop: 'url',
    origin: '*',
    prop: 'extracts|info',
    redirects: '1',
  }).toString()

  const commonsUrl = new URL('https://commons.wikimedia.org/w/api.php')
  commonsUrl.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrlimit: '16',
    gsrnamespace: '6',
    gsrsearch: `${query} filetype:bitmap`,
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '1000',
    origin: '*',
    prop: 'imageinfo',
  }).toString()

  const wikipedia = await fetchJson(fetchImpl, wikipediaUrl)
  const commons = await fetchJson(fetchImpl, commonsUrl)
  const wikiPage = wikipedia.query?.pages?.[0]
  const wikiUrl = safeHttpUrl(wikiPage?.fullurl)
  const extract = String(wikiPage?.extract || '').trim()

  const sources =
    wikiPage?.title && wikiUrl && extract
      ? [
          {
            extract,
            label: wikiPage.title,
            provider: 'Wikipedia' as const,
            url: wikiUrl,
          },
        ]
      : []
  const images = (commons.query?.pages || [])
    .map(normalizeCommonsCandidate)
    .filter((candidate): candidate is WikimediaImageCandidate =>
      Boolean(
        candidate &&
          isAutoUsableCommonsCandidate(candidate) &&
          candidate.mimeType.startsWith('image/'),
      ),
    )

  return {
    checkedAt: new Date().toISOString(),
    images,
    query,
    sources,
  }
}
