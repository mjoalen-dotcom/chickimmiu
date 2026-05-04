import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { PodcastListClient } from './PodcastListClient'

export const metadata: Metadata = {
  title: 'Podcast 節目',
  description: 'CHIC KIM & MIU Podcast：韓系時尚情報、東大門採購故事、AI 工具實戰、品牌洞察。',
}

export default async function PodcastListPage() {
  let episodes: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'podcasts',
        where: { status: { equals: 'published' } },
        sort: '-episodeNumber',
        limit: 50,
        depth: 2,
      })
      episodes = result.docs as unknown as Record<string, unknown>[]
    } catch {
      // DB 未就緒 / migrate 未跑 — 用 demo data 顯示
    }
  }

  return <PodcastListClient initialEpisodes={episodes} />
}
