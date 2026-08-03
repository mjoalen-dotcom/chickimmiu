import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, createSign, generateKeyPairSync } from 'node:crypto'

/**
 * verifyIdToken 的簽章/claim 驗證測試。
 * 用本地生成的 RSA key 假冒 provider JWKS（stub global.fetch），確認：
 *   - 正常 token 過
 *   - 竄改 payload、換 kid、錯 iss、錯 aud、過期、nonce 不符 一律擋
 */

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const KID = 'test-key-1'
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }

let jwksHits = 0
global.fetch = async () => {
  jwksHits += 1
  return { ok: true, json: async () => ({ keys: [jwk] }) }
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

function makeToken(claims, { kid = KID, alg = 'RS256' } = {}) {
  const header = b64({ alg, kid, typ: 'JWT' })
  const payload = b64(claims)
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  signer.end()
  return `${header}.${payload}.${signer.sign(privateKey).toString('base64url')}`
}

const { verifyIdToken, IdTokenError } = await import('./verifyIdToken.ts')

const now = () => Math.floor(Date.now() / 1000)
const GOOGLE_AUD = '1234.apps.googleusercontent.com'

const baseClaims = () => ({
  iss: 'https://accounts.google.com',
  aud: GOOGLE_AUD,
  sub: '109876543210',
  email: 'Someone@Example.com',
  email_verified: true,
  name: '王小明',
  iat: now(),
  exp: now() + 3600,
})

async function expectReject(promise, hint) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof IdTokenError, `${hint}: 應丟 IdTokenError，實得 ${err?.name}`)
    return true
  }, hint)
}

test('valid Google id_token verifies and normalizes email', async () => {
  const identity = await verifyIdToken({
    provider: 'google',
    idToken: makeToken(baseClaims()),
    allowedAudiences: [GOOGLE_AUD],
  })
  assert.equal(identity.sub, '109876543210')
  assert.equal(identity.email, 'someone@example.com') // 一律 lowercase
  assert.equal(identity.emailVerified, true)
  assert.equal(identity.name, '王小明')
})

test('tampered payload is rejected', async () => {
  const token = makeToken(baseClaims())
  const [h, , s] = token.split('.')
  const forged = `${h}.${b64({ ...baseClaims(), sub: 'attacker' })}.${s}`
  await expectReject(
    verifyIdToken({ provider: 'google', idToken: forged, allowedAudiences: [GOOGLE_AUD] }),
    '竄改 payload',
  )
})

test('unknown kid is rejected (after JWKS refetch)', async () => {
  const before = jwksHits
  await expectReject(
    verifyIdToken({
      provider: 'google',
      idToken: makeToken(baseClaims(), { kid: 'rotated-key' }),
      allowedAudiences: [GOOGLE_AUD],
    }),
    '未知 kid',
  )
  assert.ok(jwksHits > before, 'kid 找不到時應強制重抓 JWKS')
})

test('wrong issuer is rejected', async () => {
  await expectReject(
    verifyIdToken({
      provider: 'google',
      idToken: makeToken({ ...baseClaims(), iss: 'https://evil.example.com' }),
      allowedAudiences: [GOOGLE_AUD],
    }),
    '錯誤 issuer',
  )
})

test('audience not in allow-list is rejected', async () => {
  await expectReject(
    verifyIdToken({
      provider: 'google',
      idToken: makeToken({ ...baseClaims(), aud: 'someone-elses-app.apps.googleusercontent.com' }),
      allowedAudiences: [GOOGLE_AUD],
    }),
    '錯誤 audience',
  )
})

test('empty allow-list rejects everything (憑證未設定時不放行)', async () => {
  await expectReject(
    verifyIdToken({ provider: 'google', idToken: makeToken(baseClaims()), allowedAudiences: [] }),
    '空 audience 清單',
  )
})

test('expired token is rejected', async () => {
  await expectReject(
    verifyIdToken({
      provider: 'google',
      idToken: makeToken({ ...baseClaims(), iat: now() - 7200, exp: now() - 3600 }),
      allowedAudiences: [GOOGLE_AUD],
    }),
    '過期 token',
  )
})

test('Apple: hashed nonce matches, wrong nonce rejected, unverified email flagged', async () => {
  const nonce = 'app-generated-nonce-value'
  const appleClaims = {
    iss: 'https://appleid.apple.com',
    aud: 'com.chickimmiu.app',
    sub: '001234.abcdef.1234',
    email: 'relay@privaterelay.appleid.com',
    email_verified: 'true', // Apple 回字串
    nonce: createHash('sha256').update(nonce).digest('hex'),
    iat: now(),
    exp: now() + 3600,
  }
  const identity = await verifyIdToken({
    provider: 'apple',
    idToken: makeToken(appleClaims),
    allowedAudiences: ['com.chickimmiu.web', 'com.chickimmiu.app'],
    nonce,
  })
  assert.equal(identity.sub, '001234.abcdef.1234')
  assert.equal(identity.emailVerified, true, 'Apple 的字串 "true" 要視為已驗證')
  assert.equal(identity.name, null, 'Apple id_token 不含名字')

  await expectReject(
    verifyIdToken({
      provider: 'apple',
      idToken: makeToken(appleClaims),
      allowedAudiences: ['com.chickimmiu.app'],
      nonce: 'different-nonce',
    }),
    'nonce 不符',
  )
})

test('non-RS256 alg is rejected (alg=none 攻擊)', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', kid: KID })).toString('base64url')
  const payload = b64(baseClaims())
  await expectReject(
    verifyIdToken({
      provider: 'google',
      idToken: `${header}.${payload}.`,
      allowedAudiences: [GOOGLE_AUD],
    }),
    'alg=none',
  )
})
