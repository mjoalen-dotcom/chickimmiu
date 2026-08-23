import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server'

import { GET } from './route'

test('公開 embedUrl 沿用反向代理網域，不洩漏 localhost', async () => {
  const request = new NextRequest(
    'http://localhost:3000/api/social-wall/embed-token?widget=kim-lafayette-demo&host=blog.kimlafayette.com',
    {
      headers: {
        origin: 'https://blog.kimlafayette.com',
        'x-forwarded-host': 'wall.ckmu.co',
        'x-forwarded-proto': 'https',
      },
    },
  )

  const response = await GET(request)
  const body = await response.json() as { embedUrl?: string }

  assert.equal(response.status, 200)
  assert.match(body.embedUrl || '', /^https:\/\/wall\.ckmu\.co\/embed\//)
  assert.doesNotMatch(body.embedUrl || '', /localhost/)
})
