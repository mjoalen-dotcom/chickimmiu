import assert from 'node:assert/strict'
import test from 'node:test'

import { loadKimWallFeed } from './kim-wall-feed'

const jsonResponse = (body: unknown, ok = true) =>
  ({
    ok,
    async json() {
      return body
    },
  }) as Response

test('優先使用 Meta Instagram 正式貼文，且不讀取部落格備援', async () => {
  const requested: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input)
    requested.push(url)
    return jsonResponse({
      configured: true,
      items: [
        {
          id: 'ig-1',
          caption: '首則正式貼文',
          mediaType: 'CAROUSEL_ALBUM',
          mediaUrl: 'https://scontent.cdninstagram.com/ig-1.jpg',
          permalink: 'https://www.instagram.com/p/ig-1/',
          timestamp: '2026-08-17T00:00:00Z',
        },
      ],
    })
  }) as typeof fetch

  const feed = await loadKimWallFeed({ fetchImpl, serviceBase: 'http://service.test:3000' })

  assert.equal(feed.source, 'instagram')
  assert.equal(feed.sourceLabel, 'Instagram 官方連線')
  assert.equal(feed.items.length, 1)
  assert.equal(feed.items[0]?.permalink, 'https://www.instagram.com/p/ig-1/')
  assert.deepEqual(requested, ['http://service.test:3000/api/kim-blog/instagram'])
})

test('Meta 尚未授權時改用真實 Kim 部落格內容，不使用固定示範讚數', async () => {
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/api/kim-blog/instagram')) {
      return jsonResponse({ configured: false, items: [] })
    }
    return jsonResponse({
      posts: [
        {
          id: 101,
          slug: 'ME30',
          title: '真實文章一',
          visibility: 'public',
          featuredImage: 'https://pre.chickimmiu.com/api/media/file/one.webp',
          publishedAt: '2026-08-17T01:00:00Z',
        },
        {
          id: 102,
          slug: 'private-post',
          title: '私人文章',
          visibility: 'private',
          featuredImage: 'https://pre.chickimmiu.com/api/media/file/private.webp',
        },
        {
          id: 103,
          slug: 'no-image',
          title: '沒有圖片',
          visibility: 'public',
          featuredImage: '',
        },
      ],
    })
  }) as typeof fetch

  const feed = await loadKimWallFeed({
    fetchImpl,
    serviceBase: 'http://service.test:3000',
    blogBase: 'https://blog.kimlafayette.com',
  })

  assert.equal(feed.source, 'kim-blog')
  assert.equal(feed.sourceLabel, 'Kim 部落格同步 · Meta 授權待完成')
  assert.equal(feed.items.length, 1)
  assert.deepEqual(feed.items[0], {
    id: 'blog-101',
    caption: '真實文章一',
    mediaType: 'IMAGE',
    mediaUrl: 'https://pre.chickimmiu.com/api/media/file/one.webp',
    permalink: 'https://blog.kimlafayette.com/blog/ME30/',
    timestamp: '2026-08-17T01:00:00Z',
  })
  assert.equal('likes' in feed.items[0], false)
})

test('外部回應無效或全部失敗時回傳明確 unavailable，不塞假貼文', async () => {
  const fetchImpl = (async () => {
    throw new Error('network down')
  }) as typeof fetch

  const feed = await loadKimWallFeed({ fetchImpl, serviceBase: 'http://service.test:3000' })

  assert.equal(feed.source, 'unavailable')
  assert.equal(feed.items.length, 0)
  assert.match(feed.sourceLabel, /暫時無法載入/)
})

test('最多輸出指定數量，並排除非 http(s) 圖片與連結', async () => {
  const posts = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    slug: `post-${index + 1}`,
    title: `文章 ${index + 1}`,
    visibility: 'public',
    featuredImage:
      index === 0 ? 'javascript:alert(1)' : `https://pre.chickimmiu.com/api/media/file/${index + 1}.webp`,
  }))
  const fetchImpl = (async (input: string | URL | Request) =>
    String(input).endsWith('/api/kim-blog/instagram')
      ? jsonResponse({ configured: false, items: [] })
      : jsonResponse({ posts })) as typeof fetch

  const feed = await loadKimWallFeed({ fetchImpl, serviceBase: 'http://service.test:3000', maxItems: 4 })

  assert.equal(feed.items.length, 4)
  assert.ok(feed.items.every((item) => item.mediaUrl.startsWith('https://')))
  assert.ok(feed.items.every((item) => item.permalink.startsWith('https://blog.kimlafayette.com/')))
})

test('預設最多輸出 32 則，讓八欄雙列首屏保有下一組可切換', async () => {
  const posts = Array.from({ length: 40 }, (_, index) => ({
    id: index + 1,
    slug: `post-${index + 1}`,
    title: `文章 ${index + 1}`,
    visibility: 'public',
    featuredImage: `https://pre.chickimmiu.com/api/media/file/${index + 1}.webp`,
    publishedAt: new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
  }))
  const fetchImpl = (async (input: string | URL | Request) =>
    String(input).endsWith('/api/kim-blog/instagram')
      ? jsonResponse({ configured: false, items: [] })
      : jsonResponse({ posts })) as typeof fetch

  const feed = await loadKimWallFeed({ fetchImpl, serviceBase: 'http://service.test:3000' })

  assert.equal(feed.items.length, 32)
})
