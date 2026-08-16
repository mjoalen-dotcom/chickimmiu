import { createHmac, timingSafeEqual } from 'node:crypto'

import { normalizeWidgetHost } from './domain-policy'

export const SOCIAL_WALL_EMBED_AUDIENCE = 'social-wall-embed' as const
export const SOCIAL_WALL_DEVELOPMENT_SECRET = 'wallgather-local-preview-secret-2026-only'

export interface EmbedTokenPayload {
  aud: typeof SOCIAL_WALL_EMBED_AUDIENCE
  widgetId: string
  host: string
  iat: number
  exp: number
}

export interface SignEmbedTokenInput {
  widgetId: string
  host: string
  secret: string
  now: number
  ttlSeconds?: number
}

export interface VerifyEmbedTokenInput {
  token: string
  secret: string
  expectedAudience?: string
  expectedWidgetId: string
  expectedHost: string
  now: number
}

const DEFAULT_TTL_SECONDS = 300
const MAX_TTL_SECONDS = 600

function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Embed signing secret must contain at least 32 bytes')
  }
}

function encodePart(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function createSignature(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('base64url')
}

function signaturesMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

/** Issues an HS256 token for one widget and one normalized host. */
export function signEmbedToken(_input: SignEmbedTokenInput): string {
  assertSecret(_input.secret)
  const widgetId = _input.widgetId.trim()
  if (!widgetId) throw new Error('Widget id is required')
  if (!Number.isSafeInteger(_input.now) || _input.now < 0) throw new Error('Invalid issued-at time')

  const ttlSeconds = _input.ttlSeconds ?? DEFAULT_TTL_SECONDS
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error('Embed token TTL must be a positive integer no longer than 600 seconds')
  }

  const header = encodePart({ alg: 'HS256', typ: 'JWT' })
  const payload: EmbedTokenPayload = {
    aud: SOCIAL_WALL_EMBED_AUDIENCE,
    widgetId,
    host: normalizeWidgetHost(_input.host),
    iat: _input.now,
    exp: _input.now + ttlSeconds,
  }
  const body = `${header}.${encodePart(payload)}`
  return `${body}.${createSignature(body, _input.secret)}`
}

/** Verifies signature, audience, widget, host, and expiry before returning claims. */
export function verifyEmbedToken(_input: VerifyEmbedTokenInput): EmbedTokenPayload {
  assertSecret(_input.secret)
  if (!Number.isSafeInteger(_input.now) || _input.now < 0) throw new Error('Invalid verification time')

  const parts = _input.token.split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('Invalid embed token')
  const [encodedHeader, encodedPayload, receivedSignature] = parts
  const signedBody = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = createSignature(signedBody, _input.secret)
  if (!signaturesMatch(receivedSignature, expectedSignature)) {
    throw new Error('Invalid embed token signature')
  }

  let header: { alg?: unknown; typ?: unknown }
  let payload: Partial<EmbedTokenPayload>
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'))
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid embed token payload')
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('Invalid embed token algorithm')
  if (payload.aud !== (_input.expectedAudience ?? SOCIAL_WALL_EMBED_AUDIENCE)) {
    throw new Error('Embed token audience mismatch')
  }
  if (payload.widgetId !== _input.expectedWidgetId) throw new Error('Embed token widget mismatch')

  const expectedHost = normalizeWidgetHost(_input.expectedHost)
  if (payload.host !== expectedHost) throw new Error('Embed token host mismatch')
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) {
    throw new Error('Invalid embed token timestamps')
  }
  if ((payload.iat as number) > _input.now + 30) throw new Error('Embed token issued in the future')
  if ((payload.exp as number) <= _input.now) throw new Error('Embed token expired')
  if ((payload.exp as number) - (payload.iat as number) > MAX_TTL_SECONDS) {
    throw new Error('Embed token expiry exceeds maximum TTL')
  }

  return payload as EmbedTokenPayload
}
