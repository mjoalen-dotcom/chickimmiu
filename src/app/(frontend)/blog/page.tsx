import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { BlogListClient } from './BlogListClient'

export const metadata: Metadata = {
  title: '穿搭誌',
  description: 'CHIC KIM & MIU 穿搭靈感、時尚趨勢與生活風格分享。',
}

export default async function BlogPage() {
  let posts: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'blog-posts',
        where: { status: { equals: 'published' } },
        sort: '-publishedAt',
        limit: 20,
        depth: 2,
      })
      posts = result.docs as unknown as Record<string, unknown>[]
    } catch {
      // DB not ready
    }
  }

  return <BlogListClient initialPosts={posts} />
}
