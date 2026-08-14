import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * 訪客結帳輸入驗證測試（WO-BP002 C）
 * 跑法：node --test src/lib/commerce/guestCheckout.test.mjs
 */

const { validateGuestCheckoutInput, syntheticGuestEmail, isSyntheticGuestEmail } = await import(
  './guestCheckout.ts'
)

const base = {
  email: 'buyer@example.com',
  items: [{ productId: 12, quantity: 2 }],
  couponCodes: ['WELCOME'],
  shippingMethodId: 3,
  paymentMethod: 'cash_cod',
  shippingAddress: {
    recipientName: '王小明',
    phone: '0912345678',
    address: '中山北路一段 1 號',
    city: '台北市',
    district: '中山區',
    zipCode: '104',
  },
  customerNote: '請小心包裝',
}

test('完整輸入通過並正規化', () => {
  const r = validateGuestCheckoutInput({ ...base, email: '  Buyer@Example.com ' })
  assert.equal(r.ok, true)
  assert.equal(r.value.email, 'buyer@example.com')
  assert.equal(r.value.items.length, 1)
  assert.equal(r.value.items[0].quantity, 2)
  assert.deepEqual(r.value.couponCodes, ['WELCOME'])
  assert.equal(r.value.shippingMethodId, 3)
})

test('email 缺漏 / 格式錯 / 合成訪客信箱 → 擋', () => {
  assert.deepEqual(validateGuestCheckoutInput({ ...base, email: '' }).errors, ['email_required'])
  assert.deepEqual(validateGuestCheckoutInput({ ...base, email: 'not-an-email' }).errors, [
    'email_invalid',
  ])
  assert.deepEqual(validateGuestCheckoutInput({ ...base, email: 'a@b' }).errors, ['email_invalid'])
  // 不允許直接冒充系統合成的訪客信箱
  assert.deepEqual(
    validateGuestCheckoutInput({ ...base, email: 'guest_x@guest.invalid' }).errors,
    ['email_invalid'],
  )
})

test('金額欄位一律忽略（價格由 server 重算）', () => {
  const r = validateGuestCheckoutInput({
    ...base,
    total: 0,
    subtotal: 0,
    shippingFee: 0,
    paymentStatus: 'paid',
    status: 'delivered',
    customer: 999,
  })
  assert.equal(r.ok, true)
  assert.equal('total' in r.value, false)
  assert.equal('paymentStatus' in r.value, false)
  assert.equal('customer' in r.value, false)
})

test('數量非正 / 無 productId 的行被丟掉；全丟光 → items_required', () => {
  const r = validateGuestCheckoutInput({
    ...base,
    items: [
      { productId: 1, quantity: 3 },
      { productId: 2, quantity: 0 },
      { productId: 3, quantity: -5 },
      { quantity: 2 },
      { productId: 4, quantity: 1.9 },
    ],
  })
  assert.equal(r.ok, true)
  assert.deepEqual(
    r.value.items.map((i) => [i.productId, i.quantity]),
    [
      [1, 3],
      [4, 1],
    ],
  )
  assert.deepEqual(validateGuestCheckoutInput({ ...base, items: [] }).errors, ['items_required'])
})

test('收件資訊缺漏會逐項回報', () => {
  const r = validateGuestCheckoutInput({
    ...base,
    shippingAddress: { recipientName: '', phone: '', address: '', city: '' },
  })
  assert.equal(r.ok, false)
  assert.deepEqual(r.errors, [
    'recipient_name_required',
    'phone_required',
    'address_required',
    'city_required',
  ])
})

test('付款方式必填；shippingMethodId 空字串 → null（走預估運費分支）', () => {
  assert.deepEqual(validateGuestCheckoutInput({ ...base, paymentMethod: '' }).errors, [
    'payment_method_required',
  ])
  assert.equal(validateGuestCheckoutInput({ ...base, shippingMethodId: '' }).value.shippingMethodId, null)
})

test('合成訪客信箱唯一且可辨識', () => {
  const a = syntheticGuestEmail('abc-123')
  assert.match(a, /^guest_abc-123@guest\.invalid$/)
  assert.equal(isSyntheticGuestEmail(a), true)
  assert.equal(isSyntheticGuestEmail('buyer@example.com'), false)
  assert.equal(isSyntheticGuestEmail(null), false)
})
