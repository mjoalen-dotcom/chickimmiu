import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * safeInternalRedirect 測試（WO-BP002：/api/auth/bridge?next= 開放轉址）
 * 重點是「經過 new URL(next, base) 之後仍留在自家網域」——只檢查字串開頭不夠，
 * WHATWG URL parser 會把反斜線當斜線。
 * 跑法：node --test src/lib/auth/safeRedirect.test.mjs
 */

const { safeInternalRedirect } = await import('./safeRedirect.ts')

const BASE = 'https://pre.chickimmiu.com'
const resolve = (v) => new URL(safeInternalRedirect(v), BASE).origin

test('正常站內路徑原樣放行', () => {
  assert.equal(safeInternalRedirect('/account'), '/account')
  assert.equal(safeInternalRedirect('/account/orders?page=2'), '/account/orders?page=2')
})

test('空值 / 非站內路徑 → fallback', () => {
  assert.equal(safeInternalRedirect(null), '/account')
  assert.equal(safeInternalRedirect(''), '/account')
  assert.equal(safeInternalRedirect('https://evil.com'), '/account')
  assert.equal(safeInternalRedirect('//evil.com'), '/account')
  assert.equal(safeInternalRedirect('/next', '/checkout'), '/next')
  assert.equal(safeInternalRedirect('https://evil.com', '/checkout'), '/checkout')
})

test('反斜線變體：解析後不得跑到外部網域', () => {
  // `/\evil.com` 在 URL parser 眼中等同 `//evil.com` → 若放行就是開放轉址
  assert.equal(resolve('/\\evil.com'), BASE)
  assert.equal(resolve('/\\\\evil.com'), BASE)
  assert.equal(resolve('\\\\evil.com'), BASE)
})

test('CRLF 注入 → fallback', () => {
  assert.equal(safeInternalRedirect('/account\r\nSet-Cookie: a=b'), '/account')
  assert.equal(safeInternalRedirect('/account\nfoo'), '/account')
})

test('所有輸入解析後都留在自家 origin', () => {
  for (const v of [
    '/account',
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    '\\/evil.com',
    '/%2F%2Fevil.com',
    null,
  ]) {
    assert.equal(resolve(v), BASE, `外洩：${JSON.stringify(v)}`)
  }
})
