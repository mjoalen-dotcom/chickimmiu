import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { signEmbedToken, verifyEmbedToken } from './embed-token'

const SECRET = '0123456789abcdef0123456789abcdef'
const NOW = 1_787_000_000

const verify = (token: string, overrides: Partial<Parameters<typeof verifyEmbedToken>[0]> = {}) =>
  verifyEmbedToken({
    token,
    secret: SECRET,
    expectedAudience: 'social-wall-embed',
    expectedWidgetId: 'widget_123',
    expectedHost: 'shop.example.com',
    now: NOW,
    ...overrides,
  })

test('issues an HS256 token bound to audience, widget, normalized host, and short expiry', () => {
  const token = signEmbedToken({
    widgetId: 'widget_123',
    host: 'HTTPS://Shop.Example.COM.:443/embed',
    secret: SECRET,
    now: NOW,
    ttlSeconds: 120,
  })
  const [encodedHeader] = token.split('.')
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'))

  assert.deepEqual(header, { alg: 'HS256', typ: 'JWT' })
  assert.deepEqual(verify(token), {
    aud: 'social-wall-embed',
    widgetId: 'widget_123',
    host: 'shop.example.com',
    iat: NOW,
    exp: NOW + 120,
  })
})

test('rejects a token when audience, widget, or host does not match the request', () => {
  const token = signEmbedToken({
    widgetId: 'widget_123',
    host: 'shop.example.com',
    secret: SECRET,
    now: NOW,
  })

  assert.throws(() => verify(token, { expectedAudience: 'another-service' }), /audience|aud/i)
  assert.throws(() => verify(token, { expectedWidgetId: 'widget_999' }), /widget/i)
  assert.throws(() => verify(token, { expectedHost: 'evil.example.com' }), /host|domain/i)
})

test('expires at the exact exp second', () => {
  const token = signEmbedToken({
    widgetId: 'widget_123',
    host: 'shop.example.com',
    secret: SECRET,
    now: NOW,
    ttlSeconds: 60,
  })

  assert.equal(verify(token, { now: NOW + 59 }).widgetId, 'widget_123')
  assert.throws(() => verify(token, { now: NOW + 60 }), /expired|expiry|到期/i)
})

test('rejects payload or signature tampering and a different HMAC secret', () => {
  const token = signEmbedToken({
    widgetId: 'widget_123',
    host: 'shop.example.com',
    secret: SECRET,
    now: NOW,
  })
  const [header, payload, signature] = token.split('.')
  const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...decodedPayload, host: 'evil.example.com' }),
  ).toString('base64url')
  const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`

  assert.throws(() => verify(`${header}.${tamperedPayload}.${signature}`), /signature|invalid|無效/i)
  assert.throws(() => verify(`${header}.${payload}.${tamperedSignature}`), /signature|invalid|無效/i)
  assert.throws(
    () => verify(token, { secret: 'fedcba9876543210fedcba9876543210' }),
    /signature|invalid|無效/i,
  )
})

test('enforces a positive TTL no longer than ten minutes', () => {
  for (const ttlSeconds of [0, -1, 601]) {
    assert.throws(
      () =>
        signEmbedToken({
          widgetId: 'widget_123',
          host: 'shop.example.com',
          secret: SECRET,
          now: NOW,
          ttlSeconds,
        }),
      /ttl|600|positive|短效/i,
    )
  }
})

function forgeToken(header: unknown, payload: unknown, secret = SECRET): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const body = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

test('requires strong secrets, a widget id, and valid integer timestamps', () => {
  assert.throws(
    () => signEmbedToken({ widgetId: 'widget_123', host: 'example.com', secret: 'short', now: NOW }),
    /secret|32/i,
  )
  assert.throws(
    () => signEmbedToken({ widgetId: ' ', host: 'example.com', secret: SECRET, now: NOW }),
    /widget/i,
  )
  assert.throws(
    () => signEmbedToken({ widgetId: 'widget_123', host: 'example.com', secret: SECRET, now: -1 }),
    /time|issued/i,
  )
  assert.throws(() => verify('', { secret: 'short' }), /secret|32/i)
  assert.throws(() => verify('', { now: -1 }), /time|verification/i)
})

test('uses the five-minute default and rejects malformed tokens before parsing claims', () => {
  const token = signEmbedToken({ widgetId: 'widget_123', host: 'shop.example.com', secret: SECRET, now: NOW })
  assert.equal(verify(token).exp, NOW + 300)
  for (const malformed of ['', 'one.part', 'one..three', 'one.two.three.four']) {
    assert.throws(() => verify(malformed), /invalid/i)
  }
})

test('rejects invalid JSON, algorithms, timestamps, future issuance, and overlong claims', () => {
  const validPayload = {
    aud: 'social-wall-embed',
    widgetId: 'widget_123',
    host: 'shop.example.com',
    iat: NOW,
    exp: NOW + 60,
  }
  const invalidJsonHeader = Buffer.from('{').toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(validPayload)).toString('base64url')
  const body = `${invalidJsonHeader}.${encodedPayload}`
  const signature = createHmac('sha256', SECRET).update(body).digest('base64url')
  assert.throws(() => verify(`${body}.${signature}`), /payload|invalid/i)

  assert.throws(() => verify(forgeToken({ alg: 'none', typ: 'JWT' }, validPayload)), /algorithm|invalid/i)
  assert.throws(
    () => verify(forgeToken({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, iat: 'now' })),
    /timestamp|invalid/i,
  )
  assert.throws(
    () => verify(forgeToken({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, iat: NOW + 31, exp: NOW + 90 })),
    /future/i,
  )
  assert.throws(
    () => verify(forgeToken({ alg: 'HS256', typ: 'JWT' }, { ...validPayload, exp: NOW + 601 })),
    /maximum|ttl|expiry/i,
  )
})
