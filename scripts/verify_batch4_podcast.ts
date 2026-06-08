/**
 * Batch 4 — Podcast RSS feed 驗證（乾淨 temp DB）。
 *
 *   rm -f data/_b4.db*
 *   DATABASE_URI=file:./data/_b4.db NODE_OPTIONS=--no-deprecation yes y | \
 *     DATABASE_URI=file:./data/_b4.db NODE_OPTIONS=--no-deprecation pnpm exec payload migrate
 *   DATABASE_URI=file:./data/_b4.db NODE_OPTIONS=--no-deprecation pnpm exec payload run scripts/verify_batch4_podcast.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildPodcastFeed } from '@/lib/podcast/rssBuilder'

const results: Array<{ name: string; ok: boolean; detail: string }> = []
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail })
  process.stdout.write(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}\n`)
}

// 極小 mp3-ish buffer（內容不重要；media 接受非圖片不做 sharp resize）
const AUDIO = Buffer.from('SUQzAAAAAAAfTXAAAAAA', 'base64')

async function main() {
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  try {
    const media = await p.create({
      collection: 'media',
      data: { alt: 'b4-audio' },
      file: { data: AUDIO, mimetype: 'audio/mpeg', name: 'b4ep.mp3', size: AUDIO.length },
      overrideAccess: true,
    })

    await p.create({
      collection: 'podcasts',
      data: {
        title: '東大門 2026 SS 採購筆記',
        slug: `b4-ep-${Date.now()}`,
        episodeNumber: 1,
        excerpt: '本集聊聊春夏採購重點 & 風格趨勢',
        category: 'sourcing',
        audioFile: media.id,
        duration: 845,
        status: 'published',
        publishedAt: new Date('2026-06-01T10:00:00+08:00').toISOString(),
      },
      overrideAccess: true,
    })

    const { xml, episodeCount } = await buildPodcastFeed({ payload, siteUrl: 'https://pre.chickimmiu.com' })

    check('episodeCount=1', episodeCount === 1, `count=${episodeCount}`)
    check('valid RSS + itunes ns', xml.includes('<rss') && xml.includes('xmlns:itunes='), '')
    check('channel itunes:author', xml.includes('<itunes:author>'), '')
    check('channel itunes:owner + email', xml.includes('<itunes:owner>') && xml.includes('<itunes:email>'), '')
    check('channel itunes:category Fashion & Beauty', xml.includes('Fashion &amp; Beauty'), '')
    check('atom:self feed link', xml.includes('/feeds/podcast.xml') && xml.includes('rel="self"'), '')
    check('item title present', xml.includes('東大門 2026 SS 採購筆記'), '')
    check('item enclosure (audio)', /<enclosure url="https?:\/\/[^"]+\.mp3" type="audio\/mpeg" length="\d+"/.test(xml), '')
    check('item itunes:duration 14:05', xml.includes('<itunes:duration>14:05</itunes:duration>'), `(845s → 14:05)`)
    check('item itunes:episode 1', xml.includes('<itunes:episode>1</itunes:episode>'), '')
    check('item pubDate RFC822', /<pubDate>\w{3}, \d{2} \w{3} \d{4}/.test(xml), '')
    check('well-formed (balanced item tags)', (xml.match(/<item>/g) || []).length === (xml.match(/<\/item>/g) || []).length, '')
  } catch (e) {
    check('podcast feed suite', false, e instanceof Error ? e.message : String(e))
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  process.stdout.write(`\n=== Batch 4 (podcast) verify: ${passed} PASS / ${failed} FAIL (of ${results.length}) ===\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
