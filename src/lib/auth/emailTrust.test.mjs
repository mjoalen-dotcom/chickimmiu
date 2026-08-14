import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * 社群登入 email 可信度判定測試（WO-BP002 P0：未驗證 email → 帳號接管）
 * 跑法：node --test src/lib/auth/emailTrust.test.mjs
 */

const { isProviderEmailVerified, trustedEmailFrom } = await import('./emailTrust.ts')

test('google：只認 email_verified === true', () => {
  assert.equal(isProviderEmailVerified('google', { email_verified: true }), true)
  assert.equal(isProviderEmailVerified('google', { email_verified: false }), false)
  assert.equal(isProviderEmailVerified('google', { email_verified: 'true' }), false)
  assert.equal(isProviderEmailVerified('google', {}), false)
  assert.equal(isProviderEmailVerified('google', null), false)
})

test('apple：boolean 與字串 "true" 都算已驗證', () => {
  assert.equal(isProviderEmailVerified('apple', { email_verified: true }), true)
  assert.equal(isProviderEmailVerified('apple', { email_verified: 'true' }), true)
  assert.equal(isProviderEmailVerified('apple', { email_verified: 'false' }), false)
  assert.equal(isProviderEmailVerified('apple', {}), false)
})

test('line：有回 email 就是已驗證（LINE 不提供 claim）', () => {
  assert.equal(isProviderEmailVerified('line', {}), true)
  assert.equal(isProviderEmailVerified('LINE', null), true)
})

test('facebook / 未知 provider：一律不採信', () => {
  assert.equal(isProviderEmailVerified('facebook', { email_verified: true }), false)
  assert.equal(isProviderEmailVerified('facebook', {}), false)
  assert.equal(isProviderEmailVerified('threads', { email_verified: true }), false)
  assert.equal(isProviderEmailVerified('', {}), false)
  assert.equal(isProviderEmailVerified(null, {}), false)
})

test('trustedEmailFrom：未驗證 → null（不得用來匹配既有會員）', () => {
  assert.equal(
    trustedEmailFrom('google', { email_verified: true }, 'victim@example.com'),
    'victim@example.com',
  )
  // 攻擊情境：在 provider 端掛受害者 email 但沒驗證 → 不可用於匹配
  assert.equal(trustedEmailFrom('google', { email_verified: false }, 'victim@example.com'), null)
  assert.equal(trustedEmailFrom('facebook', {}, 'victim@example.com'), null)
  // 沒 email（LINE 常見）→ null，走 socialId + placeholder email
  assert.equal(trustedEmailFrom('line', {}, null), null)
  assert.equal(trustedEmailFrom('line', {}, 'someone@example.com'), 'someone@example.com')
})
