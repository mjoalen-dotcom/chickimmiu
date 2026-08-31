import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const FACEBOOK_LINK_COOKIE = 'ckmu-facebook-link'
export const FACEBOOK_LINK_TTL = 600

type LinkBinding = { customerId: string; appId: string; sessionToken: string }
type LinkClaim = { purpose: string; customerId: string; appId: string; session: string; issued: number; expires: number; nonce: string }

function sessionHash(token: string) {
  return createHash('sha256').update(token).digest('base64url')
}

function signature(value: string, secret: string) {
  if (secret.length < 32) throw new Error('Link signing key is not configured')
  return createHmac('sha256', secret).update(`facebook-link:v1:${value}`).digest()
}

export function createFacebookLinkIntent(binding: LinkBinding, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (!binding.customerId || !binding.appId || !binding.sessionToken) throw new Error('Missing link binding')
  const claim: LinkClaim = {
    purpose: 'facebook-link:v1',
    customerId: binding.customerId,
    appId: binding.appId,
    session: sessionHash(binding.sessionToken),
    issued: now,
    expires: now + FACEBOOK_LINK_TTL,
    nonce: randomBytes(16).toString('hex'),
  }
  const data = Buffer.from(JSON.stringify(claim)).toString('base64url')
  return `${data}.${signature(data, secret).toString('base64url')}`
}

export function verifyFacebookLinkIntent(value: string, binding: LinkBinding, secret: string, now = Math.floor(Date.now() / 1000)): boolean {
  try {
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false
    if (!binding.customerId || !binding.appId || !binding.sessionToken) return false
    const [data, mac] = value.split('.')
    const supplied = Buffer.from(mac, 'base64url')
    const expected = signature(data, secret)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false
    const claim = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as LinkClaim
    return claim.purpose === 'facebook-link:v1' &&
      claim.customerId === binding.customerId && claim.appId === binding.appId &&
      claim.session === sessionHash(binding.sessionToken) &&
      Number.isInteger(claim.issued) && Number.isInteger(claim.expires) &&
      claim.issued <= now && claim.expires > now &&
      claim.expires - claim.issued === FACEBOOK_LINK_TTL && /^[a-f0-9]{32}$/.test(claim.nonce)
  } catch {
    return false
  }
}

export function readCookie(headers: Headers, name: string): string {
  for (const part of (headers.get('cookie') || '').split(';')) {
    const item = part.trim()
    if (item.startsWith(`${name}=`)) return item.slice(name.length + 1)
  }
  return ''
}

export function isSameOriginRequest(request: Request): boolean {
  const expected = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  try { return request.headers.get('origin') === new URL(expected).origin } catch { return false }
}
