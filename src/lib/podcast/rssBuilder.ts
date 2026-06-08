import type { Payload } from 'payload'

/**
 * Podcast RSS 2.0 + iTunes namespace feed builder。
 * 供 /feeds/podcast.xml 提交 Apple Podcasts / Spotify。
 *
 * channel-level metadata 取自 GlobalSettings（site / businessInfo），不另開 global。
 * ⚠️ 封面圖以 site.ogImage / logo fallback，可能 < 1400×1400（Apple 要求 1400-3000 方形）；
 *    正式上架前建議在 GlobalSettings 放一張 ≥1400 的方形圖到 ogImage。
 */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function lexicalToText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const out: string[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (typeof n.text === 'string') out.push(n.text)
    if (Array.isArray(n.children)) n.children.forEach(visit)
  }
  const root = (value as Record<string, unknown>).root
  if (root && typeof root === 'object' && Array.isArray((root as Record<string, unknown>).children)) {
    ;((root as Record<string, unknown>).children as unknown[]).forEach(visit)
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

function resolveMediaUrl(media: unknown, siteUrl: string): string | null {
  if (!media || typeof media !== 'object') return null
  const url = (media as { url?: string }).url
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

/** 秒 → HH:MM:SS（< 1h 用 MM:SS） */
function fmtDuration(secs?: number): string {
  if (!secs || secs <= 0) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function mimeForAudio(media: { mimeType?: string; filename?: string } | null): string {
  const mt = media?.mimeType
  if (typeof mt === 'string' && mt) return mt
  const name = (media?.filename || '').toLowerCase()
  if (name.endsWith('.m4a') || name.endsWith('.mp4') || name.endsWith('.aac')) return 'audio/mp4'
  if (name.endsWith('.mp3')) return 'audio/mpeg'
  if (name.endsWith('.wav')) return 'audio/wav'
  if (name.endsWith('.ogg')) return 'audio/ogg'
  return 'audio/mpeg'
}

export interface PodcastFeedResult {
  xml: string
  episodeCount: number
}

export async function buildPodcastFeed(opts: {
  payload: Payload
  siteUrl: string
}): Promise<PodcastFeedResult> {
  const { payload, siteUrl } = opts

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gs = (await payload.findGlobal({ slug: 'global-settings', depth: 1 })) as any
  const site = gs?.site || {}
  const biz = gs?.businessInfo || {}

  const showTitle = `${site.siteName || 'CHIC KIM & MIU'} Podcast`
  const showDesc = String(site.siteDescription || '')
  const author = String(site.siteName || biz.legalName || 'CHIC KIM & MIU')
  const ownerName = String(biz.legalName || author)
  const ownerEmail =
    typeof biz.email === 'string' && biz.email.trim() ? biz.email.trim() : 'hello@chickimmiu.com'
  const channelImg = resolveMediaUrl(site.ogImage, siteUrl) || resolveMediaUrl(site.logo, siteUrl) || ''
  const feedUrl = `${siteUrl}/feeds/podcast.xml`
  const link = `${siteUrl}/podcast`

  const res = await payload.find({
    collection: 'podcasts',
    where: { status: { equals: 'published' } },
    sort: '-episodeNumber',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eps = res.docs as any[]

  const items = eps
    .map((ep) => {
      const epUrl = `${siteUrl}/podcast/${ep.slug}`
      const audio = ep.audioFile && typeof ep.audioFile === 'object' ? ep.audioFile : null
      const audioUrl = resolveMediaUrl(audio, siteUrl)
      const cover = resolveMediaUrl(ep.coverImage, siteUrl) || channelImg
      const pub = ep.publishedAt || ep.createdAt
      const pubDate = pub ? new Date(pub).toUTCString() : new Date().toUTCString()
      const summary = [ep.excerpt, lexicalToText(ep.showNotes)].filter(Boolean).join('\n\n')
      const dur = fmtDuration(ep.duration)
      const enclosureLen = Number(audio?.filesize) || 0
      const enclosureType = mimeForAudio(audio)

      const lines: string[] = ['    <item>']
      lines.push(`      <title>${xmlEscape(String(ep.title || ''))}</title>`)
      lines.push(`      <link>${xmlEscape(epUrl)}</link>`)
      lines.push(`      <guid isPermaLink="false">podcast-${ep.id}</guid>`)
      lines.push(`      <pubDate>${pubDate}</pubDate>`)
      if (ep.episodeNumber) lines.push(`      <itunes:episode>${Number(ep.episodeNumber)}</itunes:episode>`)
      if (dur) lines.push(`      <itunes:duration>${dur}</itunes:duration>`)
      if (summary) {
        lines.push(`      <description>${xmlEscape(summary)}</description>`)
        lines.push(`      <itunes:summary>${xmlEscape(summary)}</itunes:summary>`)
      }
      if (cover) lines.push(`      <itunes:image href="${xmlEscape(cover)}"/>`)
      if (audioUrl)
        lines.push(`      <enclosure url="${xmlEscape(audioUrl)}" type="${enclosureType}" length="${enclosureLen}"/>`)
      lines.push(`      <itunes:explicit>false</itunes:explicit>`)
      lines.push('    </item>')
      return lines.join('\n')
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(showTitle)}</title>
    <link>${xmlEscape(link)}</link>
    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>zh-tw</language>
    <description>${xmlEscape(showDesc)}</description>
    <copyright>${xmlEscape(ownerName)}</copyright>
    <itunes:author>${xmlEscape(author)}</itunes:author>
    <itunes:summary>${xmlEscape(showDesc)}</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${xmlEscape(ownerName)}</itunes:name>
      <itunes:email>${xmlEscape(ownerEmail)}</itunes:email>
    </itunes:owner>${channelImg ? `\n    <itunes:image href="${xmlEscape(channelImg)}"/>` : ''}
    <itunes:category text="Arts">
      <itunes:category text="Fashion &amp; Beauty"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
${items}
  </channel>
</rss>`

  return { xml, episodeCount: eps.length }
}
