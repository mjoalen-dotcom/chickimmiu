export type KimWallFeedSource = 'instagram' | 'kim-blog' | 'unavailable'

export type KimWallMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'

export type KimWallFeedItem = {
  id: string
  caption?: string
  mediaType: KimWallMediaType
  mediaUrl: string
  thumbnailUrl?: string
  permalink: string
  timestamp?: string
}

export type KimWallFeed = {
  source: KimWallFeedSource
  sourceLabel: string
  handle: string
  profileUrl: string
  items: KimWallFeedItem[]
}

export type LoadKimWallFeedOptions = {
  fetchImpl?: typeof fetch
  serviceBase?: string
  blogBase?: string
  maxItems?: number
}

type InstagramResponse = {
  configured?: boolean
  error?: string
  items?: Array<Partial<KimWallFeedItem>>
}

type KimBlogPost = {
  id?: string | number
  slug?: string
  title?: string
  visibility?: string
  featuredImage?: string
  publishedAt?: string
}

type KimBlogFeedResponse = {
  posts?: KimBlogPost[]
}

const PROFILE_URL = 'https://www.instagram.com/kimlafayette/'
const HANDLE = 'kimlafayette'

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function unavailableFeed(): KimWallFeed {
  return {
    source: 'unavailable',
    sourceLabel: '社群內容暫時無法載入',
    handle: HANDLE,
    profileUrl: PROFILE_URL,
    items: [],
  }
}

function normalizeInstagramItems(items: InstagramResponse['items'], maxItems: number): KimWallFeedItem[] {
  if (!Array.isArray(items)) return []
  return items
    .filter((item) => {
      const mediaType = item.mediaType
      return Boolean(
        item.id &&
          (mediaType === 'IMAGE' || mediaType === 'VIDEO' || mediaType === 'CAROUSEL_ALBUM') &&
          isHttpUrl(item.mediaUrl) &&
          isHttpUrl(item.permalink),
      )
    })
    .slice(0, maxItems)
    .map((item) => ({
      id: String(item.id),
      caption: typeof item.caption === 'string' ? item.caption.slice(0, 500) : undefined,
      mediaType: item.mediaType as KimWallMediaType,
      mediaUrl: String(item.mediaUrl),
      thumbnailUrl: isHttpUrl(item.thumbnailUrl) ? item.thumbnailUrl : undefined,
      permalink: String(item.permalink),
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : undefined,
    }))
}

function normalizeBlogItems(posts: KimBlogFeedResponse['posts'], blogBase: string, maxItems: number): KimWallFeedItem[] {
  if (!Array.isArray(posts)) return []
  return posts
    .filter(
      (post) =>
        post.visibility === 'public' &&
        (typeof post.id === 'string' || typeof post.id === 'number') &&
        typeof post.slug === 'string' &&
        Boolean(post.slug.trim()) &&
        typeof post.title === 'string' &&
        isHttpUrl(post.featuredImage),
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.publishedAt || '') || 0
      const rightTime = Date.parse(right.publishedAt || '') || 0
      return rightTime - leftTime
    })
    .slice(0, maxItems)
    .map((post) => ({
      id: `blog-${post.id}`,
      caption: post.title?.slice(0, 500),
      mediaType: 'IMAGE' as const,
      mediaUrl: String(post.featuredImage),
      permalink: new URL(`/blog/${encodeURIComponent(String(post.slug))}/`, blogBase).toString(),
      timestamp: typeof post.publishedAt === 'string' ? post.publishedAt : undefined,
    }))
}

async function fetchJson<T>(fetchImpl: typeof fetch, url: string): Promise<T | null> {
  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function loadKimWallFeed(options: LoadKimWallFeedOptions = {}): Promise<KimWallFeed> {
  const fetchImpl = options.fetchImpl || fetch
  const serviceBase = String(
    options.serviceBase || process.env.SOCIAL_WALL_INTERNAL_BASE_URL || 'http://127.0.0.1:3000',
  ).replace(/\/$/, '')
  const blogBase = String(options.blogBase || 'https://blog.kimlafayette.com').replace(/\/$/, '')
  const maxItems = Math.min(32, Math.max(1, Math.trunc(options.maxItems || 32)))

  const instagram = await fetchJson<InstagramResponse>(fetchImpl, `${serviceBase}/api/kim-blog/instagram`)
  const instagramItems = normalizeInstagramItems(instagram?.items, maxItems)
  if (instagramItems.length > 0) {
    return {
      source: 'instagram',
      sourceLabel: 'Instagram 官方連線',
      handle: HANDLE,
      profileUrl: PROFILE_URL,
      items: instagramItems,
    }
  }

  const blog = await fetchJson<KimBlogFeedResponse>(fetchImpl, `${serviceBase}/api/kim-blog/feed`)
  const blogItems = normalizeBlogItems(blog?.posts, blogBase, maxItems)
  if (blogItems.length > 0) {
    return {
      source: 'kim-blog',
      sourceLabel:
        instagram?.configured === false
          ? 'Kim 部落格同步 · Meta 授權待完成'
          : 'Kim 部落格同步 · Meta 暫時無法讀取',
      handle: HANDLE,
      profileUrl: PROFILE_URL,
      items: blogItems,
    }
  }

  return unavailableFeed()
}
