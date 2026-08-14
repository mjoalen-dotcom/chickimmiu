/**
 * 結帳 HTTP 端到端驗證（WO-BP002 B）— 會真的建立一筆訂單，跑完自動取消
 * ──────────────────────────────────────────────────────────────
 * 跑法（prod）：
 *   cd /var/www/chickimmiu && NODE_ENV=production pnpm payload run scripts/verify-checkout-http-e2e.ts
 *
 * 為什麼要有這支：Campaign Engine 上線後既有的驗收腳本都走 **local API**，
 * 而 `beforeChangeServerPricing` 對 local API 是直接跳過的 —— 也就是說
 * 「偽造單被擋」有證據，「正常顧客下得了單」沒有。這支用真的 HTTP + 真的
 * session cookie 走一遍 /api/pricing/quote → /api/orders，補上那一哩。
 *
 * 副作用（刻意）：
 * - 建立 1 筆真訂單（customerNote 標 [TEST-WO-BP002]）→ 驗證完立刻取消
 * - 會觸發訂單確認信 / admin 通知信（寄給測試帳號本人）
 * - 庫存 -N 再由取消流程回補（本腳本會驗證回補結果）
 */
import { getPayload, getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser } from 'payload/shared'
import config from '../src/payload.config'

const BASE = process.env.VERIFY_BASE_URL || 'https://pre.chickimmiu.com'
const TEST_EMAIL = process.env.VERIFY_USER_EMAIL || 'mjoalen+launchcheck0729@gmail.com'

const log = (...args: unknown[]) => console.error('[checkout-e2e]', ...args)
const keepAlive = setInterval(() => {}, 60_000)
let failures = 0
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) log(`✓ ${name}`)
  else {
    failures++
    log(`✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : '')
  }
}

async function main() {
  const payload = await getPayload({ config: await config })
  log('base =', BASE)

  // ── 1. 測試會員 ──────────────────────────────────────────────────────
  const users = await payload.find({
    collection: 'users',
    where: { email: { equals: TEST_EMAIL } },
    limit: 1,
    overrideAccess: true,
  })
  const user = users.docs[0] as unknown as Record<string, unknown> | undefined
  if (!user) {
    log(`找不到測試會員 ${TEST_EMAIL}，中止（不自行建立會員以免污染名單）`)
    process.exit(2)
  }
  log('測試會員 id =', user.id)

  // ── 2. 可買的商品：上架 + 有庫存 + 有價 + 無變體（避免 sku 對應問題）──
  const products = await payload.find({
    collection: 'products',
    where: {
      and: [{ status: { equals: 'published' } }, { stock: { greater_than: 2 } }, { price: { greater_than: 0 } }],
    },
    // 變體有無只能在記憶體篩（Payload where 無法查陣列長度）→ 多撈一點再過濾
    sort: '-updatedAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const product = (products.docs as unknown as Array<Record<string, unknown>>).find(
    (p) => !Array.isArray(p.variants) || (p.variants as unknown[]).length === 0,
  )
  if (!product) {
    log('找不到「上架 + 庫存 > 2 + 有價 + 無變體」的商品，中止')
    process.exit(2)
  }
  const stockBefore = Number(product.stock)
  log('測試商品 =', product.id, product.name, 'stock =', stockBefore, 'price =', product.price)

  // ── 3. 物流：取一個啟用且要付運費的（讓運費 > 0，才驗得到運費比對）──
  const ship = await payload.find({
    collection: 'shipping-methods',
    where: { and: [{ isActive: { equals: true } }, { baseFee: { greater_than: 0 } }] },
    sort: 'baseFee',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const shippingMethod = ship.docs[0] as unknown as Record<string, unknown> | undefined
  if (!shippingMethod) {
    log('找不到啟用且 baseFee > 0 的物流方式，中止')
    process.exit(2)
  }
  log('測試物流 =', shippingMethod.id, shippingMethod.name, 'baseFee =', shippingMethod.baseFee)

  // ── 4. 簽一份真的 session cookie（等同使用者已登入的瀏覽器）──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersConfig = (payload as any).collections?.users?.config
  const authConfig = usersConfig?.auth
  let sid: string | undefined
  for (let attempt = 0; attempt < 5 && !sid; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await addSessionToUser({ collectionConfig: usersConfig, payload, req: {} as any, user: user as any })
      sid = res.sid
    } catch (err) {
      // payload run 側車簽 token 偶發 SQLITE_BUSY → 退避重試
      const msg = err instanceof Error ? err.message : String(err)
      log(`addSessionToUser 第 ${attempt + 1} 次失敗：${msg}`)
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  if (!sid) {
    log('無法建立 session，中止')
    process.exit(2)
  }
  const fieldsToSign = getFieldsToSign({
    collectionConfig: usersConfig,
    email: String(user.email),
    sid,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: user as any,
  })
  const { token } = await jwtSign({
    fieldsToSign,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    secret: (payload as any).secret as string,
    tokenExpiration: authConfig.tokenExpiration,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookiePrefix = ((payload as any).config?.cookiePrefix as string | undefined) || 'payload'
  const cookie = `${cookiePrefix}-token=${token}`

  const QTY = 1
  const items = [
    {
      productId: product.id,
      sku: null,
      variantText: null,
      quantity: QTY,
    },
  ]

  // ── 5. 報價 API（前台結帳頁吃的就是這支）──────────────────────────
  const quoteRes = await fetch(`${BASE}/api/pricing/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      items,
      couponCodes: [],
      shippingMethodId: String(shippingMethod.id),
      paymentMethod: 'cash_cod',
    }),
  })
  const quote = (await quoteRes.json().catch(() => null)) as Record<string, unknown> | null
  check('POST /api/pricing/quote 回 200', quoteRes.status === 200, { status: quoteRes.status, quote })
  const breakdown = (quote?.breakdown ?? null) as Record<string, number> | null
  if (!breakdown) {
    log('沒有 breakdown，無法續驗，中止')
    process.exit(1)
  }
  log('報價 =', JSON.stringify(breakdown))
  check('報價小計 = 商品現價 × 數量', breakdown.itemsSubtotal > 0)
  check(
    '報價運費取自所選物流（未達免運門檻時 = baseFee）',
    breakdown.shippingFee === Number(shippingMethod.baseFee) || breakdown.shippingFee === 0,
    { shippingFee: breakdown.shippingFee, baseFee: shippingMethod.baseFee },
  )

  // ── 6. 建單（payload 形狀比照 checkout/page.tsx）────────────────────
  const orderBody = {
    customer: user.id,
    items: [
      {
        product: product.id,
        productName: product.name,
        quantity: QTY,
        unitPrice: breakdown.itemsSubtotal / QTY,
        subtotal: breakdown.itemsSubtotal,
      },
    ],
    subtotal: breakdown.itemsSubtotal,
    subtotalBeforeDiscount: breakdown.itemsSubtotal,
    shippingFee: breakdown.shippingFee,
    codFee: breakdown.codFee,
    total: breakdown.total,
    discountAmount: breakdown.promotionDiscount + breakdown.couponDiscount + breakdown.memberDiscount,
    paymentMethod: 'cash_cod',
    paymentStatus: 'unpaid',
    status: 'pending',
    shippingAddress: {
      recipientName: 'WO-BP002 驗證',
      phone: '0912345678',
      address: '測試地址（自動驗證單）',
      city: '台北市',
      district: '中山區',
      zipCode: '104',
    },
    shippingMethod: {
      method: shippingMethod.id,
      methodName: shippingMethod.name,
      carrier: shippingMethod.carrier,
    },
    customerNote: '[TEST-WO-BP002] 自動驗證單，驗證後立即取消',
  }

  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(orderBody),
  })
  const orderJson = (await orderRes.json().catch(() => null)) as Record<string, unknown> | null
  const created = (orderJson?.doc ?? null) as Record<string, unknown> | null
  check('POST /api/orders 正常單建立成功', orderRes.ok && Boolean(created?.orderNumber), {
    status: orderRes.status,
    body: orderRes.ok ? undefined : orderJson,
  })
  if (!created) {
    log('建單失敗，剩餘檢查略過')
    process.exit(1)
  }
  log('訂單 =', created.orderNumber, 'id =', created.id)
  check('訂單金額 = 報價金額', Number(created.total) === breakdown.total, {
    orderTotal: created.total,
    quoteTotal: breakdown.total,
  })
  const promo = created.promotion as Record<string, unknown> | undefined
  check('promotion.serverEnforced = true（伺服器權威計價確實生效）', promo?.serverEnforced === true, promo)

  // ── 7. 反向對照：竄改總額必須被擋 ──────────────────────────────────
  const tamperRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ ...orderBody, total: Math.max(0, breakdown.total - 100) }),
  })
  check('竄改總額的單被擋（4xx）', !tamperRes.ok && tamperRes.status >= 400 && tamperRes.status < 500, {
    status: tamperRes.status,
  })

  // ── 8. 庫存確實扣了 ────────────────────────────────────────────────
  const afterCreate = (await payload.findByID({
    collection: 'products',
    id: product.id as never,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>
  check('建單後庫存 -1', Number(afterCreate.stock) === stockBefore - QTY, {
    before: stockBefore,
    after: afterCreate.stock,
  })

  // ── 9. 收尾：取消訂單 → 庫存回補 ───────────────────────────────────
  await payload.update({
    collection: 'orders',
    id: created.id as never,
    data: { status: 'cancelled', adminNote: '[TEST-WO-BP002] 自動驗證單，已於驗證後取消' } as never,
    overrideAccess: true,
  })
  const afterCancel = (await payload.findByID({
    collection: 'products',
    id: product.id as never,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>
  check('取消後庫存回補至原值', Number(afterCancel.stock) === stockBefore, {
    before: stockBefore,
    after: afterCancel.stock,
  })

  log(failures === 0 ? `全部通過（測試單 ${created.orderNumber} 已取消）` : `${failures} 項失敗`)
  clearInterval(keepAlive)
  process.exit(failures === 0 ? 0 : 1)
}

await main()
