import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildPodcastFeed } from '@/lib/podcast/rssBuilder'

/**
 * /feeds/podcast.xml
 * ──────────────────
 * Podcast RSS 2.0 + iTunes namespace feed。提交 Apple Podcasts Connect /
 * Spotify for Podcasters 用此 URL。每天爬一次即可（HTTP cache 1h）。
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getPayload({ config })
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://chickimmiu.com'

  const { xml, episodeCount } = await buildPodcastFeed({ payload, siteUrl })

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Podcast-Episodes': String(episodeCount),
    },
  })
}
