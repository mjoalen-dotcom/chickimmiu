import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { BLOG_CATEGORY_OPTIONS } from '@/lib/blog/categoryTaxonomy'
import { BlogListClient, type BlogCategoryView } from './BlogListClient'
import {
  DEFAULT_BLOG_PAGE_SETTINGS,
  normalizeBlogPageSettings,
  type BlogPageSettingsView,
} from './blogPageSettings'

export const metadata: Metadata = {
  title: '穿搭誌',
  description: 'CHIC KIM & MIU 穿搭靈感、時尚趨勢與生活風格分享。',
}

/**
 * 2026-08-24 重寫：分類與分頁改走 server-side
 * ─────────────────────────────────────────
 * 舊版一次只撈最新 20 篇，分類篩選在 client 端對這 20 篇做 —— 82 篇已發布文章
 * 有 62 篇點不到，冷門分類點下去還會顯示「此分類目前沒有文章」。
 * 現在分類 / 分頁走 URL searchParams（?c=&page=），where 條件下到 DB，
 * 每個分類的真實篇數用 payload.count 取，零篇分類可由後台設定自動隱藏。
 */
export const dynamic = 'force-dynamic'

const BLOG_LIST_SELECT = {
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  publishedAt: true,
  featuredImage: true,
} as const

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/**
 * ?c= 是使用者可任意填的字串，而 blog_posts.category 在 PG 是嚴格 enum：
 * 非法字面值會讓整個 query 丟 invalid input value for enum，被外層 catch 吞掉後
 * 前台變成空白列表。白名單取自 taxonomy 常數（不是 DB 分類表——分類表查詢失敗時
 * 會回空陣列，拿它當白名單會讓所有篩選一起失效）。
 */
const VALID_CATEGORY_VALUES = new Set<string>(BLOG_CATEGORY_OPTIONS.map((o) => o.value))

function safeCategory(raw: string | undefined): string {
  return raw && VALID_CATEGORY_VALUES.has(raw) ? raw : 'all'
}

/** 上架且公開的文章（購物站與金老佛爺站文章自 2026-08-15 起互相可見） */
const PUBLIC_POST_WHERE: Where[] = [
  { status: { equals: 'published' } },
  { visibility: { equals: 'public' } },
]

/**
 * 分類清單＋各分類篇數。整份分類列每次請求都一樣（跟目前選哪個分類、第幾頁無關），
 * 但要跑十幾個 COUNT，故比照 /products 的做法 60s 快取；文章或分類異動時，既有
 * revalidate 的 'blog-posts' / 'blog-categories' tag 會清掉。
 */
const getCachedBlogCategories = unstable_cache(
  async (): Promise<{ categories: BlogCategoryView[]; total: number }> => {
    const payload = await getPayload({ config })

    // 同 value 在 store/kim 各有一筆（2026-08-14 分表遺產），以 value 去重，
    // 沿 displayOrder 取先出現者（兩站同名語意相同）。
    let deduped: Array<{ value: string; label: string; order: number }> = []
    try {
      const catRes = await payload.find({
        collection: 'blog-categories',
        sort: 'displayOrder',
        limit: 100,
        depth: 0,
        select: { name: true, value: true, displayOrder: true },
      })
      const seen = new Set<string>()
      deduped = (catRes.docs as unknown as Array<Record<string, unknown>>)
        .filter((c) => {
          const v = String(c.value ?? '')
          if (!v || seen.has(v)) return false
          seen.add(v)
          return true
        })
        .map((c, i) => ({
          value: String(c.value),
          label: String(c.name),
          order: Number(c.displayOrder) || i,
        }))
    } catch {
      // blog-categories 表尚未 migrate — client 會退回後備分類。
      // 這裡不能整個 return，否則會連帶把無關的「全部」總篇數也歸零，
      // 而且錯誤值還會被 unstable_cache 當成正常結果快取 60 秒。
      deduped = []
    }

    // 各分類真實篇數（COUNT 比把全部文章撈回來便宜太多）
    const [counts, total] = await Promise.all([
      Promise.all(
        deduped.map((c) =>
          payload
            .count({
              collection: 'blog-posts',
              where: { and: [...PUBLIC_POST_WHERE, { category: { equals: c.value } }] },
            })
            .then((r) => r.totalDocs)
            .catch(() => 0),
        ),
      ),
      payload
        .count({ collection: 'blog-posts', where: { and: PUBLIC_POST_WHERE } })
        .then((r) => r.totalDocs)
        .catch(() => 0),
    ])

    return {
      categories: deduped.map((c, i) => ({ ...c, count: counts[i] ?? 0 })),
      total,
    }
  },
  ['blog-page-categories'],
  { revalidate: 60, tags: ['blog-posts', 'blog-categories'] },
)

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const activeCategory = safeCategory(str(params.c))
  const requestedPage = Math.max(1, Number(str(params.page)) || 1)

  let settings: BlogPageSettingsView = DEFAULT_BLOG_PAGE_SETTINGS
  let posts: Record<string, unknown>[] = []
  let categories: BlogCategoryView[] = []
  let featuredPost: Record<string, unknown> | null = null
  let totalPages = 1
  let currentPage = requestedPage
  let totalPosts = 0

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })

      try {
        const raw = await payload.findGlobal({ slug: 'blog-page-settings', depth: 0 })
        settings = normalizeBlogPageSettings(raw)
      } catch {
        // global 尚未 migrate — 用預設值
      }

      const cached = await getCachedBlogCategories()
      categories = cached.categories
      totalPosts = cached.total

      // 釘選文章（featured=true）以 hero card 顯示；只在「全部 + 第一頁」出現，
      // 其餘情況讓它回到一般列表，避免被排除後整篇消失。
      // 釘選文章（featured=true）：查詢與渲染要脫鉤。
      // 只在第 1 頁「查」會讓第 1 頁對 81 筆分頁、第 2 頁起對 82 筆，
      // 導致第 1 頁最後一篇跟第 2 頁第一篇是同一篇；所以「全部」的每一頁都查、
      // 每一頁都從列表排除，只有 hero 卡片的渲染限定第 1 頁。
      let pinnedPost: Record<string, unknown> | null = null
      if (activeCategory === 'all') {
        try {
          const featResult = await payload.find({
            collection: 'blog-posts',
            where: { and: [...PUBLIC_POST_WHERE, { featured: { equals: true } }] },
            sort: '-publishedAt',
            limit: 1,
            depth: 2,
            select: BLOG_LIST_SELECT,
          })
          pinnedPost = (featResult.docs[0] as unknown as Record<string, unknown>) ?? null
        } catch {
          pinnedPost = null
        }
      }
      featuredPost = requestedPage === 1 ? pinnedPost : null

      const listWhere: Where = {
        and: [
          ...PUBLIC_POST_WHERE,
          ...(activeCategory !== 'all' ? [{ category: { equals: activeCategory } }] : []),
          ...(pinnedPost ? [{ id: { not_equals: pinnedPost.id } }] : []),
        ],
      }

      const result = await payload.find({
        collection: 'blog-posts',
        where: listWhere,
        sort: '-publishedAt',
        limit: settings.layout.pageSize,
        page: requestedPage,
        depth: 2,
        select: BLOG_LIST_SELECT,
      })

      posts = result.docs as unknown as Record<string, unknown>[]
      totalPages = result.totalPages || 1
      currentPage = result.page || requestedPage
    } catch {
      // DB not ready
    }
  }

  return (
    <BlogListClient
      posts={posts}
      categories={categories}
      featuredPost={featuredPost}
      settings={settings}
      activeCategory={activeCategory}
      currentPage={currentPage}
      totalPages={totalPages}
      totalPosts={totalPosts}
    />
  )
}
