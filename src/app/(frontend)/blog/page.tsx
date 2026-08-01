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
  let categories: Array<{ value: string; label: string }> = []
  let featuredPost: Record<string, unknown> | null = null

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      // 釘選文章 featured=true → hero card 顯示在頂部
      const featResult = await payload.find({
        collection: 'blog-posts',
        where: {
          status: { equals: 'published' },
          visibility: { equals: 'public' },
          featured: { equals: true },
        },
        sort: '-publishedAt',
        limit: 1,
        depth: 2,
      })
      featuredPost = (featResult.docs[0] as unknown as Record<string, unknown>) || null

      // 其他文章列表（排除已釘選的）
      const result = await payload.find({
        collection: 'blog-posts',
        where: {
          status: { equals: 'published' },
          visibility: { equals: 'public' },
          ...(featuredPost ? { id: { not_equals: featuredPost.id } } : {}),
        },
        sort: '-publishedAt',
        limit: 20,
        depth: 2,
      })
      posts = result.docs as unknown as Record<string, unknown>[]

      // 分類獨立 collection（為空 / 表未建時，client 退回後備靜態分類）
      try {
        const catRes = await payload.find({
          collection: 'blog-categories',
          sort: 'displayOrder',
          limit: 50,
          depth: 0,
        })
        categories = (catRes.docs as unknown as Array<Record<string, unknown>>).map((c) => ({
          value: String(c.value),
          label: String(c.name),
        }))
      } catch {
        // blog-categories 表尚未 migrate — 用後備
      }
    } catch {
      // DB not ready
    }
  }

  return <BlogListClient initialPosts={posts} categories={categories} featuredPost={featuredPost} />
}
