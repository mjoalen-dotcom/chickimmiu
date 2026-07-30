import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'

process.env.SSO_KIM_CLIENT_SECRET = 'client-secret-at-least-thirty-two-characters'
process.env.SSO_AUTH_CODE_SECRET = 'code-secret-at-least-thirty-two-characters!!'
process.env.SSO_KIM_REDIRECT_URIS =
  'https://www.kimlafayette.com/auth/callback.php,https://blog.kimlafayette.com/auth/callback.php'

const {
  createAuthorizationCode,
  getSsoClient,
  verifyAuthorizationCode,
  verifyClientSecret,
  verifyPkce,
} = await import('./authorizationCode.ts')

test('authorization code is bound to client, redirect URI, expiry and PKCE', () => {
  const client = getSsoClient('kimlafayette-web')
  assert.ok(client)
  assert.ok(
    client.redirectUris.includes(
      'https://blog.kimlafayette.com/auth/callback.php',
    ),
  )
  assert.equal(
    verifyClientSecret('client-secret-at-least-thirty-two-characters', client),
    true,
  )

  const verifier = 'a'.repeat(64)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const code = createAuthorizationCode({
    issuer: 'https://pre.chickimmiu.com',
    clientId: client.id,
    userId: 'member-123',
    redirectUri: client.redirectUris[0],
    codeChallenge: challenge,
    now: 1000,
  })
  const grant = verifyAuthorizationCode(code, {
    issuer: 'https://pre.chickimmiu.com',
    clientId: client.id,
    redirectUri: client.redirectUris[0],
    now: 1040,
  })

  assert.equal(grant?.sub, 'member-123')
  assert.equal(verifyPkce(verifier, grant?.codeChallenge || ''), true)
  assert.equal(
    verifyAuthorizationCode(code, {
      issuer: 'https://pre.chickimmiu.com',
      clientId: client.id,
      redirectUri: client.redirectUris[0],
      now: 1091,
    }),
    null,
  )
})
