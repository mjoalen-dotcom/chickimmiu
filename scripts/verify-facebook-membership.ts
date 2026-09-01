/** Local/rehearsal-only integration checks. Never point this at the live DB. */
import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { NextRequest } from 'next/server'
import config from '../src/payload.config'
import { linkOrCreateSocialUser } from '../src/lib/auth/socialIdentity'
import { linkFacebookToCustomer, completeFacebookLink } from '../src/lib/auth/facebookLink'
import { createFacebookLinkIntent, FACEBOOK_LINK_COOKIE, readCookie } from '../src/lib/auth/facebookLinkIntent'
import { createFacebookProvider } from '../src/lib/auth/facebookProvider'
import { issuePayloadToken } from '../src/lib/auth/issuePayloadToken'
import { POST as startLink } from '../src/app/(frontend)/api/auth/facebook/link/route'
import { GET as me } from '../src/app/api/v1/me/route'

const uri = process.env.DATABASE_URI || ''
const isLocalTest = uri.startsWith('file:') && uri.endsWith('/meta-login-test.db')
const isRehearsal = /^postgres(?:ql)?:/.test(uri) && new URL(uri).pathname === '/ckmu_meta_login_test_20260831'
if (!isLocalTest && !isRehearsal) throw new Error('Refusing to run outside the isolated Facebook test database')
if (process.env.RESEND_API_KEY || process.env.SMTP_PASS) throw new Error('Remove mail credentials before testing')

const payload = await getPayload({ config })
const adapter = payload.db as unknown as {
  name: string
  rawTables: Record<string, { indexes: Record<string, { name: string; on: string[]; unique?: boolean }> }>
  drizzle: { execute: (q: ReturnType<typeof sql>) => Promise<unknown>; run: (q: ReturnType<typeof sql>) => Promise<unknown> }
}
const identityIndex = Object.values(adapter.rawTables.customers.indexes).find(i => i.on.includes('socialLogins_facebookAppId'))
assert.ok(identityIndex?.unique, 'Payload schema must describe the compound unique identity index')
console.log(`SCHEMA_INDEX ${identityIndex.name}`)
if (adapter.name !== 'postgres') {
  await adapter.drizzle.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "${identityIndex.name}" ON "customers" ("social_logins_facebook_app_id", "social_logins_facebook_id")`))
}

let checks = 0
function pass(label: string) { checks++; console.log(`PASS ${label}`) }
const appId = `88${Date.now()}`
const otherAppId = `89${Date.now()}`
const facebookId = '987654321000001'
const appSecret = 'a'.repeat(32)
const customer = async (extra: Record<string, unknown> = {}) => payload.create({
  collection: 'customers',
  data: { name: 'Facebook integration fixture', email: `fb-test-${randomUUID()}@noemail.invalid`, password: randomUUID() + randomUUID(), _verified: true, ...extra },
  disableVerificationEmail: true,
})

try {
  await payload.updateGlobal({ slug: 'global-settings', data: { socialLogin: { enableFacebook: true, facebookAppId: appId, facebookAppSecret: appSecret } } })
  const victim = await customer()
  const firstLink = await linkOrCreateSocialUser({ provider: 'facebook', providerAccountId: facebookId, providerAppId: appId, email: victim.email })
  assert.ok(firstLink)
  assert.equal(firstLink.created, true)
  const first = firstLink.user
  assert.notEqual(first.id, victim.id)
  assert.match(first.email || '', /@noemail\.invalid$/)
  assert.equal((first.socialLogins as Record<string, unknown>).facebookAppId, appId)
  pass('new Facebook member is app-scoped and never merges by an untrusted email')

  const returning = await linkOrCreateSocialUser({ provider: 'facebook', providerAccountId: facebookId, providerAppId: appId })
  assert.equal(returning?.user.id, first.id)
  assert.equal(returning?.created, false, 'repeat login must not be reported as a new registration')
  const otherApp = await linkOrCreateSocialUser({ provider: 'facebook', providerAccountId: facebookId, providerAppId: otherAppId })
  assert.notEqual(otherApp?.user.id, first.id)
  await assert.rejects(linkOrCreateSocialUser({ provider: 'facebook', providerAccountId: facebookId }))
  pass('repeat login keeps one customer; another app and missing app scope cannot take over')

  const owner = await customer({ points: 700, shoppingCredit: 120, socialLogins: { googleId: `fixture-google-${randomUUID()}` } })
  const other = await customer()
  await linkFacebookToCustomer(payload, owner.id, appId, '987654321000002')
  const preserved = await payload.findByID({ collection: 'customers', id: owner.id, depth: 0 })
  assert.equal(preserved.points, 700)
  assert.equal(preserved.shoppingCredit, 120)
  assert.equal(preserved.socialLogins?.googleId, owner.socialLogins?.googleId)
  const ownerLink = await linkOrCreateSocialUser({ provider: 'facebook', providerAppId: appId, providerAccountId: '987654321000002' })
  assert.equal(ownerLink?.user.id, owner.id)
  assert.equal(ownerLink?.created, false, 'linking an existing customer is not a new registration')
  pass('linking an existing customer preserves ID, balance and other login methods')

  await assert.rejects(linkFacebookToCustomer(payload, other.id, appId, '987654321000002'))
  await assert.rejects(linkFacebookToCustomer(payload, owner.id, appId, '987654321000003'))
  await linkFacebookToCustomer(payload, owner.id, appId, '987654321000002')
  pass('another customer cannot claim the identity; replacement is rejected and repeat callback is safe')

  const racer = await customer()
  const raced = await Promise.allSettled([
    linkFacebookToCustomer(payload, racer.id, appId, '987654321000004'),
    linkFacebookToCustomer(payload, racer.id, appId, '987654321000005'),
  ])
  assert.equal(raced.filter(r => r.status === 'fulfilled').length, 1)
  pass('concurrent callbacks cannot overwrite the same customer with two different identities')

  await payload.update({ collection: 'customers', id: owner.id, data: { socialLogins: { facebookId: '987654321000999', facebookAppId: otherAppId, googleId: 'forged' } }, overrideAccess: false, user: { ...owner, collection: 'customers' } })
  const guarded = await payload.findByID({ collection: 'customers', id: owner.id, depth: 0 })
  assert.equal(guarded.socialLogins?.facebookId, '987654321000002')
  assert.equal(guarded.socialLogins?.facebookAppId, appId)
  assert.equal(guarded.socialLogins?.googleId, owner.socialLogins?.googleId)
  pass('customer REST permissions cannot write any social authentication IDs')

  const pending = await customer()
  const { token } = await issuePayloadToken(payload, pending as unknown as { id: number; email: string } & Record<string, unknown>)
  assert.ok(token)
  const prefix = payload.config.cookiePrefix || 'payload'
  const browserCookie = `${prefix}-token=${token}`
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3157'
  assert.equal((await startLink(new Request(`${site}/api/auth/facebook/link`, { method: 'POST' }))).status, 403)
  assert.equal((await startLink(new Request(`${site}/api/auth/facebook/link`, { method: 'POST', headers: { origin: site } }))).status, 401)
  const startResponse = await startLink(new Request(`${site}/api/auth/facebook/link`, { method: 'POST', headers: { origin: site, cookie: browserCookie } }))
  assert.equal(startResponse.status, 200)
  const intentCookie = startResponse.headers.get('set-cookie') || ''
  assert.match(intentCookie, /HttpOnly/i)
  assert.match(intentCookie, /SameSite=Lax/i)
  const issuedIntent = readCookie(new Headers({ cookie: intentCookie }), FACEBOOK_LINK_COOKIE)
  assert.ok(issuedIntent)
  await completeFacebookLink(payload, new Headers({ cookie: `${browserCookie}; ${FACEBOOK_LINK_COOKIE}=${issuedIntent}` }), appId, '987654321000006')
  await assert.rejects(completeFacebookLink(payload, new Headers({ cookie: `${browserCookie}; ${FACEBOOK_LINK_COOKIE}=${issuedIntent}` }), otherAppId, '987654321000006'))
  const expired = createFacebookLinkIntent({ customerId: String(pending.id), appId, sessionToken: token }, payload.secret, 1000)
  await assert.rejects(completeFacebookLink(payload, new Headers({ cookie: `${browserCookie}; ${FACEBOOK_LINK_COOKIE}=${expired}` }), appId, '987654321000006'))
  pass('authenticated link route requires origin/session and callback requires an unexpired app-bound intent')

  const response = await me(new NextRequest(`${site}/api/v1/me`, { headers: { authorization: `Bearer ${token}` } }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.identity.subject, `ckmu:customer:${pending.id}`)
  assert.equal(body.data.identity.loginMethods.facebook, true)
  assert.doesNotMatch(JSON.stringify(body.data.identity), /987654321|noemail|access_token/)
  assert.equal((await me(new NextRequest(`${site}/api/v1/me`))).status, 401)
  pass('existing authenticated App API exposes a stable private member reference without provider IDs')

  const provider = createFacebookProvider({ clientId: appId, clientSecret: appSecret })
  const options = provider.options as Record<string, unknown>
  assert.deepEqual(options.checks, ['state'])
  const userinfo = options.userinfo as { request: (args: { tokens: { access_token: string } }) => Promise<unknown> }
  const savedFetch = globalThis.fetch
  let outbound: { url: URL; init?: RequestInit } | undefined
  globalThis.fetch = async (url, init) => {
    outbound = { url: new URL(String(url)), init }
    return Response.json({ id: '987654321000007', name: 'Fixture' })
  }
  try {
    await userinfo.request({ tokens: { access_token: 'dummy-access-token' } })
    assert.ok(outbound)
    assert.equal(outbound.url.hostname, 'graph.facebook.com')
    assert.equal(outbound.url.searchParams.get('access_token'), null)
    assert.equal(outbound.url.searchParams.get('fields'), 'id,name')
    assert.equal(outbound.url.searchParams.get('appsecret_proof'), createHmac('sha256', appSecret).update('dummy-access-token').digest('hex'))
    assert.equal(new Headers(outbound.init?.headers).get('authorization'), 'Bearer dummy-access-token')
    assert.equal(outbound.init?.redirect, 'error')
  } finally { globalThis.fetch = savedFetch }
  pass('Graph profile request uses minimal fields, fixed HTTPS host and proof without tokens in the URL')

  process.env.AUTH_TRUST_HOST = 'true'
  process.env.AUTH_URL = site
  const { handlers } = await import('../src/auth')
  const csrfResponse = await handlers.GET(new NextRequest(`${site}/api/auth/csrf`))
  assert.equal(csrfResponse.status, 200)
  const csrf = await csrfResponse.json()
  const authCookies = csrfResponse.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  const signInResponse = await handlers.POST(new NextRequest(`${site}/api/auth/signin/facebook`, {
    method: 'POST',
    headers: { cookie: authCookies, 'content-type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: `${site}/api/auth/bridge?next=%2Faccount` }),
  }))
  assert.equal(signInResponse.status, 200)
  const authorization = new URL((await signInResponse.json()).url)
  assert.equal(authorization.hostname, 'www.facebook.com')
  assert.equal(authorization.pathname, '/v25.0/dialog/oauth')
  assert.equal(authorization.searchParams.get('scope'), 'public_profile')
  assert.equal(authorization.searchParams.get('client_id'), appId)
  assert.equal(authorization.searchParams.get('redirect_uri'), `${site}/api/auth/callback/facebook`)
  assert.ok(authorization.searchParams.get('state'))
  assert.ok(signInResponse.headers.getSetCookie().some(c => /authjs\.state=/.test(c)))
  pass('real Auth.js initiation issues state protection and the exact Facebook callback without contacting Meta')

  console.log(`FACEBOOK_MEMBERSHIP_CHECKS ${checks}/${checks}`)
  process.exit(0)
} catch (error) {
  console.error('FACEBOOK_MEMBERSHIP_FAILED', error instanceof Error ? error.message : 'unknown')
  process.exit(1)
}
