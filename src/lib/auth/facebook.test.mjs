import assert from 'node:assert/strict'
import test from 'node:test'
import { facebookCredentials, facebookGraphVersion, facebookIdentityWhere, facebookProfile } from './facebook.ts'
import { createFacebookLinkIntent, verifyFacebookLinkIntent, isSameOriginRequest, readCookie, FACEBOOK_LINK_TTL } from './facebookLinkIntent.ts'
import { memberIdentitySummary } from '../memberIdentity.ts'

const secret = 'test-only-key-not-used-outside-these-tests'.repeat(2)
const binding = { customerId: '42', appId: '123456789012345', sessionToken: 'test-only-session' }

test('Facebook profile rejects errors and incomplete identity, and discards all unneeded personal data', () => {
  assert.deepEqual(facebookProfile({ id: '12345678', name: ' 小華 ', email: 'victim@example.com', email_verified: true, picture: { data: { url: 'https://example.com/private' } } }), {
    id: '12345678', name: '小華', email: null, image: null,
  })
  for (const value of [null, {}, { error: 'denied' }, { id: '' }, { id: 12345 }, { id: '../me' }]) {
    assert.throws(() => facebookProfile(value))
  }
  assert.equal(facebookProfile({ id: '12345678' }).name, 'Facebook 會員')
})

test('identical Facebook numbers in different apps never use the same membership query', () => {
  assert.notDeepEqual(facebookIdentityWhere('12345678', '11111111'), facebookIdentityWhere('12345678', '22222222'))
  assert.throws(() => facebookIdentityWhere('12345678', ''))
})

test('credentials are selected as an atomic pair and partial CMS credentials fail closed', () => {
  assert.deepEqual(facebookCredentials('', '', '12345678', 'a'.repeat(32)), { clientId: '12345678', clientSecret: 'a'.repeat(32) })
  assert.equal(facebookCredentials('87654321', '', '12345678', 'a'.repeat(32)), null)
  assert.equal(facebookCredentials('', 'b'.repeat(32), '12345678', 'a'.repeat(32)), null)
  assert.deepEqual(facebookCredentials('87654321', 'b'.repeat(32), '12345678', 'a'.repeat(32)), { clientId: '87654321', clientSecret: 'b'.repeat(32) })
  assert.equal(facebookCredentials('invalid', 'b'.repeat(32)), null)
})

test('fixed Facebook API host cannot be changed through the version setting', () => {
  assert.equal(facebookGraphVersion(), 'v25.0')
  for (const version of ['https://evil.example', 'v25.0/../../oauth', 'v25.0?access_token=x']) {
    assert.throws(() => facebookGraphVersion(version))
  }
})

test('link intent requires the same customer, same app and same authenticated browser session', () => {
  const intent = createFacebookLinkIntent(binding, secret, 1000)
  assert.equal(verifyFacebookLinkIntent(intent, binding, secret, 1100), true)
  for (const changed of [{ customerId: '43' }, { appId: '987654321098765' }, { sessionToken: 'other-session' }, { sessionToken: '' }]) {
    assert.equal(verifyFacebookLinkIntent(intent, { ...binding, ...changed }, secret, 1100), false)
  }
  assert.equal(verifyFacebookLinkIntent(intent, binding, `${secret}!`, 1100), false)
})

test('tampered, truncated, expired and future-dated link intents are rejected', () => {
  const intent = createFacebookLinkIntent(binding, secret, 1000)
  const [data, mac] = intent.split('.')
  const claim = JSON.parse(Buffer.from(data, 'base64url').toString())
  claim.customerId = '99'
  assert.equal(verifyFacebookLinkIntent(`${Buffer.from(JSON.stringify(claim)).toString('base64url')}.${mac}`, binding, secret, 1100), false)
  for (const value of ['x.y', intent + '.extra', intent.slice(1), 'a'.repeat(2500)]) {
    assert.equal(verifyFacebookLinkIntent(value, binding, secret, 1100), false)
  }
  assert.equal(verifyFacebookLinkIntent(intent, binding, secret, 1000 + FACEBOOK_LINK_TTL), false)
  assert.equal(verifyFacebookLinkIntent(intent, binding, secret, 999), false)
  assert.throws(() => createFacebookLinkIntent(binding, 'short', 1000))
})

test('link start rejects absent or foreign origins; cookie lookup is exact', () => {
  const prior = process.env.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_SITE_URL = 'https://pre.chickimmiu.com'
  try {
    assert.equal(isSameOriginRequest(new Request('http://localhost:3000/api/auth/facebook/link', { headers: { origin: 'https://pre.chickimmiu.com' } })), true)
    assert.equal(isSameOriginRequest(new Request('https://pre.chickimmiu.com/api/auth/facebook/link')), false)
    assert.equal(isSameOriginRequest(new Request('https://pre.chickimmiu.com/api/auth/facebook/link', { headers: { origin: 'https://pre.chickimmiu.com.evil.test' } })), false)
    assert.equal(readCookie(new Headers({ cookie: 'otherpayload-token=bad; payload-token=good' }), 'payload-token'), 'good')
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prior
  }
})

test('future member reference stays independent of login provider and contains no provider IDs, email or balances', () => {
  const base = { id: 42, email: 'private@example.com', points: 200, socialLogins: { googleId: 'google-private' } }
  const before = memberIdentitySummary(base)
  const after = memberIdentitySummary({ ...base, socialLogins: { ...base.socialLogins, facebookId: 'fb-private', facebookAppId: 'app-private' } })
  assert.equal(before.subject, 'ckmu:customer:42')
  assert.equal(after.subject, before.subject)
  assert.equal(after.loginMethods.facebook, true)
  assert.equal(memberIdentitySummary({ id: 42, socialLogins: { facebookId: 'legacy-unscoped' } }).loginMethods.facebook, false)
  assert.doesNotMatch(JSON.stringify(after), /private|points|email/)
})
