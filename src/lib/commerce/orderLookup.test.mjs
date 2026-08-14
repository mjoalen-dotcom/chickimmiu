import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * 查單識別碼（手機 / 信箱）與訪客轉會員 token 測試
 * 跑法：node --test src/lib/commerce/orderLookup.test.mjs
 */

const { normalizePhone, phoneMatches, parseLookupIdentifier } = await import('./orderLookup.ts')
const { createGuestClaimToken, verifyGuestClaimToken } = await import('./guestClaimToken.ts')

test('手機正規化：各種寫法都收斂成 09xxxxxxxx', () => {
  assert.equal(normalizePhone('0912345678'), '0912345678')
  assert.equal(normalizePhone('0912-345-678'), '0912345678')
  assert.equal(normalizePhone('0912 345 678'), '0912345678')
  assert.equal(normalizePhone('+886912345678'), '0912345678')
  assert.equal(normalizePhone('886-912-345-678'), '0912345678')
  assert.equal(normalizePhone('00886912345678'), '0912345678')
  assert.equal(normalizePhone(''), null)
  assert.equal(normalizePhone(null), null)
  assert.equal(normalizePhone('沒有數字'), null)
})

test('手機比對：同一支不同寫法都算相同', () => {
  assert.equal(phoneMatches('0912345678', '+886 912 345 678'), true)
  assert.equal(phoneMatches('0912-345-678', '0912345678'), true)
  assert.equal(phoneMatches('912345678', '0912345678'), true) // 省略前導 0
  assert.equal(phoneMatches('0912345678', '0987654321'), false)
  assert.equal(phoneMatches('0912345678', ''), false)
  assert.equal(phoneMatches(null, '0912345678'), false)
})

test('識別碼判別：有 @ 走信箱、其餘走手機', () => {
  assert.deepEqual(parseLookupIdentifier(' Buyer@Example.com '), { kind: 'email', value: 'buyer@example.com' })
  assert.deepEqual(parseLookupIdentifier('0912-345-678'), { kind: 'phone', value: '0912345678' })
  assert.deepEqual(parseLookupIdentifier('+886912345678'), { kind: 'phone', value: '0912345678' })
  assert.equal(parseLookupIdentifier('not-an-email@x'), null)
  assert.equal(parseLookupIdentifier('12345'), null) // 太短，不像電話
  assert.equal(parseLookupIdentifier(''), null)
  assert.equal(parseLookupIdentifier(null), null)
})

test('轉會員 token：簽得出來也驗得回去', () => {
  const secret = 'test-secret-abc'
  const exp = Date.now() + 60_000
  const token = createGuestClaimToken(secret, { orderId: 42, email: 'buyer@example.com', expiresAt: exp })
  const parsed = verifyGuestClaimToken(secret, token)
  assert.equal(parsed?.orderId, 42)
  assert.equal(parsed?.email, 'buyer@example.com')
})

test('轉會員 token：換 secret / 竄改 / 過期 一律無效', () => {
  const secret = 'test-secret-abc'
  const token = createGuestClaimToken(secret, {
    orderId: 42,
    email: 'buyer@example.com',
    expiresAt: Date.now() + 60_000,
  })
  assert.equal(verifyGuestClaimToken('another-secret', token), null)
  // 竄改 payload（換成別人的訂單）後簽章對不起來
  const [, sig] = token.split('.')
  const forgedBody = Buffer.from(JSON.stringify({ o: 43, e: 'attacker@example.com', x: Date.now() + 60_000 })).toString('base64url')
  assert.equal(verifyGuestClaimToken(secret, `${forgedBody}.${sig}`), null)
  // 過期
  const expired = createGuestClaimToken(secret, {
    orderId: 42,
    email: 'buyer@example.com',
    expiresAt: Date.now() - 1,
  })
  assert.equal(verifyGuestClaimToken(secret, expired), null)
  // 亂七八糟的輸入
  assert.equal(verifyGuestClaimToken(secret, ''), null)
  assert.equal(verifyGuestClaimToken(secret, 'no-dot'), null)
  assert.equal(verifyGuestClaimToken(secret, null), null)
})
