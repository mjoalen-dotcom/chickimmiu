import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const CODE_TTL_SECONDS = 90

export interface AuthorizationGrant {
  v: 1
  iss: string
  aud: string
  sub: string
  redirectUri: string
  codeChallenge: string
  jti: string
  iat: number
  exp: number
}

interface SsoClient {
  id: string
  secret: string
  redirectUris: string[]
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

function requiredSecret(name: string): string {
  const value = process.env[name]?.trim()
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters`)
  }
  return value
}

export function getSsoClient(clientId: string): SsoClient | null {
  const configuredId =
    process.env.SSO_KIM_CLIENT_ID?.trim() || 'kimlafayette-web'
  if (clientId !== configuredId) return null

  const redirects = (
    process.env.SSO_KIM_REDIRECT_URIS ||
    'https://www.kimlafayette.com/auth/callback.php,https://blog.kimlafayette.com/auth/callback.php'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (process.env.NODE_ENV !== 'production') {
    redirects.push(
      'http://127.0.0.1:8000/auth/callback.php',
      'http://localhost:8000/auth/callback.php',
      'http://127.0.0.1:3011/auth/callback.php',
      'http://localhost:3011/auth/callback.php',
    )
  }

  return {
    id: configuredId,
    secret: requiredSecret('SSO_KIM_CLIENT_SECRET'),
    redirectUris: [...new Set(redirects)],
  }
}

export function isAllowedRedirect(client: SsoClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri)
}

export function createAuthorizationCode(input: {
  issuer: string
  clientId: string
  userId: string
  redirectUri: string
  codeChallenge: string
  now?: number
}): string {
  const now = input.now ?? Math.floor(Date.now() / 1000)
  const grant: AuthorizationGrant = {
    v: 1,
    iss: input.issuer,
    aud: input.clientId,
    sub: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    jti: randomBytes(18).toString('base64url'),
    iat: now,
    exp: now + CODE_TTL_SECONDS,
  }
  const encoded = base64UrlEncode(JSON.stringify(grant))
  return `${encoded}.${sign(encoded, requiredSecret('SSO_AUTH_CODE_SECRET'))}`
}

export function verifyAuthorizationCode(
  code: string,
  input: {
    issuer: string
    clientId: string
    redirectUri: string
    now?: number
  },
): AuthorizationGrant | null {
  const [encoded, suppliedSignature, extra] = code.split('.')
  if (!encoded || !suppliedSignature || extra) return null

  const expectedSignature = sign(
    encoded,
    requiredSecret('SSO_AUTH_CODE_SECRET'),
  )
  if (!secureEqual(suppliedSignature, expectedSignature)) return null

  let grant: AuthorizationGrant
  try {
    grant = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  const now = input.now ?? Math.floor(Date.now() / 1000)
  if (
    grant.v !== 1 ||
    grant.iss !== input.issuer ||
    grant.aud !== input.clientId ||
    grant.redirectUri !== input.redirectUri ||
    !grant.sub ||
    !grant.jti ||
    !grant.codeChallenge ||
    grant.iat > now + 10 ||
    grant.exp <= now ||
    grant.exp - grant.iat > CODE_TTL_SECONDS
  ) {
    return null
  }
  return grant
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) return false
  return secureEqual(
    createHash('sha256').update(codeVerifier).digest('base64url'),
    codeChallenge,
  )
}

export function verifyClientSecret(
  suppliedSecret: string,
  client: SsoClient,
): boolean {
  return secureEqual(suppliedSecret, client.secret)
}

export function allowedPostLogoutRedirect(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'www.kimlafayette.com' ||
        url.hostname === 'blog.kimlafayette.com')
    )
  } catch {
    return false
  }
}
