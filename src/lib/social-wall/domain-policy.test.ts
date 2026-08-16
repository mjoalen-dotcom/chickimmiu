import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isWidgetHostAllowed,
  normalizeAllowedHostPattern,
  normalizeWidgetHost,
} from './domain-policy'

test('normalizes URL casing, a trailing dot, and default HTTPS port', () => {
  assert.equal(
    normalizeWidgetHost('HTTPS://Shop.Example.COM.:443/path/to/embed?campaign=summer'),
    'shop.example.com',
  )
  assert.equal(normalizeWidgetHost('shop.example.com.'), 'shop.example.com')
})

test('normalizes internationalized domains to ASCII and preserves a non-default port', () => {
  assert.equal(
    normalizeWidgetHost('https://例子.測試:8443/embed'),
    'xn--fsqu00a.xn--g6w251d:8443',
  )
  assert.equal(
    normalizeAllowedHostPattern('*.例子.測試', { environment: 'production' }),
    '*.xn--fsqu00a.xn--g6w251d',
  )
})

test('rejects global wildcards while allowing a bounded subdomain wildcard', () => {
  for (const unsafePattern of ['*', '*.*']) {
    assert.throws(
      () => normalizeAllowedHostPattern(unsafePattern, { environment: 'production' }),
      /wildcard|萬用/i,
    )
  }

  assert.equal(
    isWidgetHostAllowed('store.example.com', ['*.example.com'], {
      environment: 'production',
    }),
    true,
  )
  assert.equal(
    isWidgetHostAllowed('example.com', ['*.example.com'], { environment: 'production' }),
    false,
  )
  assert.equal(
    isWidgetHostAllowed('evil-example.com', ['*.example.com'], {
      environment: 'production',
    }),
    false,
  )
})

test('permits loopback hosts only in development', () => {
  assert.equal(
    normalizeAllowedHostPattern('LOCALHOST:3000', { environment: 'development' }),
    'localhost:3000',
  )
  assert.equal(
    isWidgetHostAllowed('http://localhost:3000/preview', ['localhost:3000'], {
      environment: 'development',
    }),
    true,
  )

  for (const loopback of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000']) {
    assert.throws(
      () => normalizeAllowedHostPattern(loopback, { environment: 'production' }),
      /localhost|loopback|開發/i,
    )
  }
})

test('treats an explicit non-default port as part of the licensed host', () => {
  const options = { environment: 'production' } as const

  assert.equal(isWidgetHostAllowed('shop.example.com:8443', ['shop.example.com:8443'], options), true)
  assert.equal(isWidgetHostAllowed('shop.example.com', ['shop.example.com:8443'], options), false)
  assert.equal(isWidgetHostAllowed('shop.example.com:9443', ['shop.example.com:8443'], options), false)
  assert.equal(isWidgetHostAllowed('https://shop.example.com:443/embed', ['shop.example.com'], options), true)
})

test('fails closed for an empty allowlist or malformed host input', () => {
  assert.equal(
    isWidgetHostAllowed('shop.example.com', [], { environment: 'production' }),
    false,
  )
  assert.throws(() => normalizeWidgetHost('https://'), /host|invalid|無效/i)
})

test('rejects non-web schemes, credentials, control characters, and wildcard host input', () => {
  for (const unsafeHost of [
    '',
    'ftp://example.com',
    'https://user:pass@example.com',
    'bad\u0000host.example',
    '*.example.com',
  ]) {
    assert.throws(() => normalizeWidgetHost(unsafeHost), /host|invalid|無效/i)
  }
})

test('rejects malformed or unbounded subdomain wildcard patterns', () => {
  const options = { environment: 'production' } as const
  for (const pattern of ['foo*bar.example.com', '*.*.example.com', 'https://*.example.com', '*.com', '*.example.com:8443']) {
    assert.throws(() => normalizeAllowedHostPattern(pattern, options), /wildcard|萬用|bounded|DNS/i)
  }
})

test('fails closed when the request is loopback in production or the allowlist contains bad data', () => {
  assert.equal(isWidgetHostAllowed('localhost:3000', ['localhost:3000'], { environment: 'production' }), false)
  assert.equal(isWidgetHostAllowed('shop.example.com', ['*'], { environment: 'production' }), false)
  assert.equal(isWidgetHostAllowed('shop.example.com:8443', ['*.example.com'], { environment: 'production' }), false)
})
