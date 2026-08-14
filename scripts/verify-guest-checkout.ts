/**
 * 訪客結帳驗證（WO-BP002 C）— 打真的 HTTP，驗 /api/checkout/guest-order
 * ──────────────────────────────────────────────────────────────────
 * 跑法（本機 prod build，先 `pnpm start -p 3006`）：
 *   RESEND_API_KEY= VERIFY_BASE_URL=http://localhost:3006 \
 *   cross-env NODE_OPTIONS=--no-deprecation payload run scripts/verify-guest-checkout.ts
 *
 * ⚠️ RESEND_API_KEY 要留空，否則會真的寄出訂單確認信。
 *
 * 驗證重點：
 * 1. 訪客送單成功 → 訂單存在、guestEmail 寫入、customer 指向 isGuest 臨時帳號
 * 2. 金額由 server 重算 —— client 送 total:0 / paymentStatus:paid / 指定他人 customer 一律無效
 * 3. 必填驗證、庫存不足、後台開關關閉（403）
 * 4. 有簽 session cookie（後續綠界付款要用）
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { computeOrderPricing } from '../src/lib/promotions/pricing'

const BASE = process.env.VERIFY_BASE_URL || 'http://localhost:3006'
/**
 * SMOKE_ONLY=1（給 prod 用）：只跑「一筆正常訪客單 + 一筆偽造欄位單 → 驗證 → 取消」。
 * 跳過限流連打（會在正式站塞一堆測試單）與後台開關切換（切換期間真顧客會撞到 403）。
 */
const SMOKE_ONLY = process.env.SMOKE_ONLY === '1'
const log = (...args: unknown[]) => console.error('[guest-checkout]', ...args)
const keepAlive = setInterval(() => {}, 60_000)
let failures = 0
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) log(`✓ ${name}`)
  else {
    failures++
    log(`✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : '')
  }
}

// 每次請求用不同的來源 IP，避免測試本身撞到 5 次 / 10 分鐘的限流
let ipSeq = 0
const post = async (body: unknown, ip?: string) => {
  const res = await fetch(`${BASE}/api/checkout/guest-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-real-ip': ip || `10.0.0.${++ipSeq}`,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  return { res, json }
}

async function main() {
  const payload = await getPayload({ config: await config })
  log('base =', BASE)

  const products = await payload.find({
    collection: 'products',
    where: {
      and: [{ status: { equals: 'published' } }, { stock: { greater_than: 2 } }, { price: { greater_than: 0 } }],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  let product = (products.docs as unknown as Array<Record<string, unknown>>).find(
    (p) => !Array.isArray(p.variants) || (p.variants as unknown[]).length === 0,
  )
  const ship = await payload.find({
    collection: 'shipping-methods',
    where: { and: [{ isActive: { equals: true } }, { baseFee: { greater_than: 0 } }] },
    sort: 'baseFee',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  let shippingMethod = ship.docs[0] as unknown as Record<string, unknown> | undefined

  // 空 DB（本機 verify 用）→ 自建最小 fixture，跑完刪掉
  const createdFixtures: Array<{
    collection: 'products' | 'shipping-methods' | 'categories'
    id: unknown
  }> = []
  if (!product) {
    // 商品的「主分類」是必填 → 先確保有一個分類可用
    const cats = await payload.find({ collection: 'categories', limit: 1, overrideAccess: true })
    let categoryId = (cats.docs[0] as unknown as Record<string, unknown> | undefined)?.id
    if (categoryId == null) {
      const cat = (await payload.create({
        collection: 'categories',
        data: { name: '[TEST-WO-BP002] 驗證用分類', slug: `test-wo-bp002-cat-${Date.now()}` } as never,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      categoryId = cat.id
      createdFixtures.push({ collection: 'categories', id: cat.id })
    }
    product = (await payload.create({
      collection: 'products',
      data: {
        name: '[TEST-WO-BP002] 驗證用商品',
        slug: `test-wo-bp002-${Date.now()}`,
        status: 'published',
        price: 550,
        stock: 5,
        category: categoryId,
      } as never,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    createdFixtures.push({ collection: 'products', id: product.id })
    log('（本機空 DB）已建立測試商品', product.id)
  }
  if (!shippingMethod) {
    shippingMethod = (await payload.create({
      collection: 'shipping-methods',
      data: {
        name: '[TEST-WO-BP002] 驗證用物流',
        carrier: 'other',
        baseFee: 60,
        freeShippingThreshold: 1200,
        isActive: true,
      } as never,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    createdFixtures.push({ collection: 'shipping-methods', id: shippingMethod.id })
    log('（本機空 DB）已建立測試物流', shippingMethod.id)
  }
  if (!product || !shippingMethod) {
    log('缺少可用商品或物流方式，中止')
    process.exit(2)
  }
  const stockBefore = Number(product.stock)
  log('商品 =', product.id, product.name, 'stock =', stockBefore, '| 物流 =', shippingMethod.name)

  const validBody = {
    email: 'guest.verify@example.com',
    items: [{ productId: product.id, quantity: 1 }],
    couponCodes: [],
    shippingMethodId: shippingMethod.id,
    paymentMethod: 'cash_cod',
    shippingAddress: {
      recipientName: '訪客驗證',
      phone: '0912345678',
      address: '測試地址',
      city: '台北市',
      district: '中山區',
      zipCode: '104',
    },
    customerNote: '[TEST-WO-BP002-GUEST]',
  }

  // 伺服器應該算出來的金額（同一支計價函式）
  const expected = await computeOrderPricing(payload, {
    items: [{ productId: product.id as number, quantity: 1 }],
    couponCodes: [],
    user: null,
    channel: 'web',
    shippingMethodId: shippingMethod.id as number,
    paymentMethod: 'cash_cod',
  })
  log('預期金額 =', JSON.stringify(expected.breakdown))

  // ── 1. 正常訪客送單 ────────────────────────────────────────────────
  const okRun = await post(validBody)
  check('訪客送單成功（200）', okRun.res.status === 200 && okRun.json?.success === true, {
    status: okRun.res.status,
    body: okRun.json,
  })
  const data = (okRun.json?.data ?? null) as Record<string, unknown> | null
  check('有簽 session cookie（後續金流要用）', /payload-token=/.test(okRun.res.headers.get('set-cookie') || ''))
  if (!data?.orderNumber) {
    log('沒拿到訂單編號，中止')
    process.exit(1)
  }
  const created = (
    await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: data.orderNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  ).docs[0] as unknown as Record<string, unknown>
  check('訂單金額 = 伺服器計價結果', Number(created.total) === expected.breakdown.total, {
    order: created.total,
    expected: expected.breakdown.total,
  })
  check('guestEmail 寫入真實聯絡信箱', created.guestEmail === validBody.email, created.guestEmail)
  check('狀態強制 pending / unpaid', created.status === 'pending' && created.paymentStatus === 'unpaid', {
    status: created.status,
    paymentStatus: created.paymentStatus,
  })
  const guestUser = (await payload.findByID({
    collection: 'users',
    id: created.customer as never,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>
  check('customer 指向 isGuest 臨時帳號', guestUser.isGuest === true, {
    id: guestUser.id,
    email: guestUser.email,
  })
  check('臨時帳號用合成信箱（不可投遞）', String(guestUser.email).endsWith('@guest.invalid'), guestUser.email)

  // ── 2. 竄改：金額 / 付款狀態 / 他人 customer 一律無效 ───────────────
  const admin = (
    await payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 1, overrideAccess: true })
  ).docs[0] as unknown as Record<string, unknown> | undefined
  const forged = await post({
    ...validBody,
    total: 0,
    subtotal: 0,
    shippingFee: 0,
    codFee: 0,
    paymentStatus: 'paid',
    status: 'delivered',
    customer: admin?.id ?? 1,
    guestEmail: 'attacker@example.com',
  })
  check('夾帶偽造欄位仍可送單（欄位被忽略而非報錯）', forged.res.status === 200, forged.json)
  const forgedOrder = (
    await payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: (forged.json?.data as Record<string, unknown>)?.orderNumber as string } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  ).docs[0] as unknown as Record<string, unknown>
  check('偽造 total=0 無效（金額仍為伺服器計價）', Number(forgedOrder.total) === expected.breakdown.total, forgedOrder.total)
  check('偽造 paymentStatus=paid 無效', forgedOrder.paymentStatus === 'unpaid', forgedOrder.paymentStatus)
  check('偽造 status=delivered 無效', forgedOrder.status === 'pending', forgedOrder.status)
  check(
    '偽造 customer（指向 admin）無效 —— 訂單掛在新建的訪客帳號',
    String(forgedOrder.customer) !== String(admin?.id ?? 1),
    { orderCustomer: forgedOrder.customer, adminId: admin?.id },
  )
  check(
    '偽造 guestEmail 欄位無效（以 email 欄位為準）',
    forgedOrder.guestEmail === validBody.email,
    forgedOrder.guestEmail,
  )

  // ── 3. 必填 / 庫存 ────────────────────────────────────────────────
  const noEmail = await post({ ...validBody, email: '' })
  check('缺 email → 400', noEmail.res.status === 400 && noEmail.json?.code === 'VALIDATION_FAILED', noEmail.json)
  const badEmail = await post({ ...validBody, email: 'nope' })
  check('email 格式錯 → 400', badEmail.res.status === 400, badEmail.json)
  // 注意：quantity 99999 會先撞到 maxItemsPerOrder，驗不到庫存防線 —— 要用
  // 「剛好超過庫存、但沒超過單筆件數上限」的數量才驗得到超賣防線。
  const tooMany = await post({ ...validBody, items: [{ productId: product.id, quantity: 99999 }] })
  check('超過單筆件數上限被擋（400）', tooMany.res.status === 400, {
    status: tooMany.res.status,
    body: tooMany.json,
  })
  const stockNow = Number(
    (
      (await payload.findByID({
        collection: 'products',
        id: product.id as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    ).stock,
  )
  const oversell = await post({
    ...validBody,
    items: [{ productId: product.id, quantity: stockNow + 1 }],
  })
  check('超賣被擋（庫存 + 1 → 400 OUT_OF_STOCK）', oversell.res.status === 400 && oversell.json?.code === 'OUT_OF_STOCK', {
    stockNow,
    status: oversell.res.status,
    body: oversell.json,
  })
  const stockAfterOversell = Number(
    (
      (await payload.findByID({
        collection: 'products',
        id: product.id as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    ).stock,
  )
  check('超賣被擋後庫存沒有被動到', stockAfterOversell === stockNow, {
    before: stockNow,
    after: stockAfterOversell,
  })

  // ── 3.5 限流：同一個 IP 連打會被擋 ────────────────────────────────
  if (!SMOKE_ONLY) {
  const burstIp = '10.9.9.9'
  let sawRateLimit = false
  for (let i = 0; i < 7; i++) {
    const r = await post({ ...validBody, email: `burst${i}@example.com` }, burstIp)
    if (r.res.status === 429) {
      sawRateLimit = true
      break
    }
  }
  check('同一來源 IP 連打會觸發限流（429）', sawRateLimit)
  const spoofed = await fetch(`${BASE}/api/checkout/guest-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-real-ip': burstIp,
      // 攻擊者自己塞的 XFF 不該讓他換一個桶
      'x-forwarded-for': `1.2.3.${Date.now() % 250}`,
    },
    body: JSON.stringify(validBody),
  })
  check('偽造 X-Forwarded-For 不能繞過限流', spoofed.status === 429, { status: spoofed.status })
  }

  // ── 4. 後台開關關閉 → 403 ─────────────────────────────────────────
  if (!SMOKE_ONLY) {
  await payload.updateGlobal({ slug: 'checkout-settings', data: { checkoutAsGuest: false } as never })
  const disabled = await post(validBody)
  check('後台關閉訪客結帳 → 403', disabled.res.status === 403 && disabled.json?.code === 'GUEST_CHECKOUT_DISABLED', {
    status: disabled.res.status,
    body: disabled.json,
  })
  await payload.updateGlobal({ slug: 'checkout-settings', data: { checkoutAsGuest: true } as never })
  const reEnabled = await post(validBody)
  check('開關打開後恢復可用（200）', reEnabled.res.status === 200, reEnabled.json)
  }

  // ── 5. 收尾：把測試單全取消（庫存回補）─────────────────────────────
  const testOrders = await payload.find({
    collection: 'orders',
    where: { customerNote: { equals: '[TEST-WO-BP002-GUEST]' } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  for (const o of testOrders.docs as unknown as Array<Record<string, unknown>>) {
    if (o.status === 'cancelled') continue
    await payload.update({
      collection: 'orders',
      id: o.id as never,
      data: { status: 'cancelled' } as never,
      overrideAccess: true,
    })
  }
  const afterCancel = (await payload.findByID({
    collection: 'products',
    id: product.id as never,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>
  check('測試單全取消後庫存回補至原值', Number(afterCancel.stock) === stockBefore, {
    before: stockBefore,
    after: afterCancel.stock,
  })

  for (const f of createdFixtures) {
    try {
      await payload.delete({ collection: f.collection, id: f.id as never, overrideAccess: true })
    } catch (err) {
      log('清除 fixture 失敗（不影響結果）', f.collection, f.id, err instanceof Error ? err.message : err)
    }
  }

  log(failures === 0 ? '全部通過' : `${failures} 項失敗`)
  clearInterval(keepAlive)
  process.exit(failures === 0 ? 0 : 1)
}

await main()
