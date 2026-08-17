import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { GET } from './route'

test('Meta 接通時最多回傳 32 則，供 SnapWidget 近似雙列輪播切換使用', async () => {
  const originalFetch = globalThis.fetch
  const originalUserId = process.env.KIM_INSTAGRAM_USER_ID
  const originalToken = process.env.KIM_INSTAGRAM_ACCESS_TOKEN
  const originalBase = process.env.KIM_INSTAGRAM_API_BASE
  const originalVersion = process.env.KIM_INSTAGRAM_GRAPH_VERSION
  let requestedUrl = ''

  process.env.KIM_INSTAGRAM_USER_ID = 'kim-user'
  process.env.KIM_INSTAGRAM_ACCESS_TOKEN = 'test-token-not-a-secret'
  process.env.KIM_INSTAGRAM_API_BASE = 'https://graph.example.test'
  process.env.KIM_INSTAGRAM_GRAPH_VERSION = 'v1.0'
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input)
    const data = Array.from({ length: 40 }, (_, index) => ({
      id: `ig-${index + 1}`,
      caption: `貼文 ${index + 1}`,
      media_type: 'IMAGE',
      media_url: `https://scontent.cdninstagram.com/${index + 1}.jpg`,
      permalink: `https://www.instagram.com/p/${index + 1}/`,
      timestamp: '2026-08-17T00:00:00Z',
    }))
    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }) as typeof fetch

  try {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/kim-blog/instagram', {
        headers: { origin: 'https://blog.kimlafayette.com' },
      }),
    )
    const body = (await response.json()) as { configured: boolean; items: unknown[] }

    assert.equal(response.status, 200)
    assert.equal(body.configured, true)
    assert.equal(body.items.length, 32)
    assert.equal(new URL(requestedUrl).searchParams.get('limit'), '32')
  } finally {
    globalThis.fetch = originalFetch
    if (originalUserId === undefined) delete process.env.KIM_INSTAGRAM_USER_ID
    else process.env.KIM_INSTAGRAM_USER_ID = originalUserId
    if (originalToken === undefined) delete process.env.KIM_INSTAGRAM_ACCESS_TOKEN
    else process.env.KIM_INSTAGRAM_ACCESS_TOKEN = originalToken
    if (originalBase === undefined) delete process.env.KIM_INSTAGRAM_API_BASE
    else process.env.KIM_INSTAGRAM_API_BASE = originalBase
    if (originalVersion === undefined) delete process.env.KIM_INSTAGRAM_GRAPH_VERSION
    else process.env.KIM_INSTAGRAM_GRAPH_VERSION = originalVersion
  }
})
