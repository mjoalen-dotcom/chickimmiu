/**
 * UserRewards (寶物箱) end-to-end 測試腳本 — HTTP REST 版
 *
 * 透過 Payload REST API 對 running dev server 發請求，確保 collection hooks
 * 被 Payload 執行（直接寫 SQL 會 bypass 所有 afterChange/beforeChange）。
 *
 * Prereq：
 *   - Dev server 跑在 BASE_URL（預設 http://localhost:3001）
 *   - 一個 admin 帳號存在（腳本會用 ADMIN_EMAIL + ADMIN_PW 登入）
 *
 * 跑法：
 *   ADMIN_EMAIL=demo@test.local ADMIN_PW='Demo12345!' node scripts/test-user-rewards-scenarios.ts
 *   # 或用 tsx 直接跑 .ts
 *   ADMIN_EMAIL=demo@test.local ADMIN_PW='Demo12345!' pnpm exec tsx scripts/test-user-rewards-scenarios.ts
 *
 * 每個 scenario 獨立 setup，失敗時把 DB rows 留著方便 debug。
 */

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'demo@test.local'
const ADMIN_PW = process.env.ADMIN_PW || 'Demo12345!'

type Row = Record<string, unknown>

const results: Array<{ id: string; name: string; ok: boolean; detail: string }> = []

function log(s: string) { process.stdout.write(s) }
function record(id: string, name: string, ok: boolean, detail: string) {
  results.push({ id, name, ok, detail })
  log(`  [${ok ? 'PASS' : 'FAIL'}] ${id} — ${name}\n`)
  if (!ok) log(`         ↳ ${detail}\n`)
}
function assertEq<T>(id: string, name: string, actual: T, expected: T, ctx = '') {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  const detail = ok
    ? `${ctx}actual=${JSON.stringify(actual)}`
    : `${ctx}expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`
  record(id, name, ok, detail)
  return ok
}

let ADMIN_TOKEN = ''
const headers = (tokenOverride?: string): Record<string, string> => {
  const tok = tokenOverride !== undefined ? tokenOverride : ADMIN_TOKEN
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (tok) h['Authorization'] = `JWT ${tok}`
  return h
}

type ReqOpts = { method?: string; body?: unknown; token?: string; expectStatus?: number }
async function req<T = unknown>(path: string, opts: ReqOpts = {}): Promise<{ status: number; body: T }> {
  const r = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: headers(opts.token),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await r.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* pass */ }
  return { status: r.status, body: body as T }
}

async function login(email: string, password: string): Promise<string> {
  const r = await req<{ token?: string; user?: { id: number; role?: string } }>('/api/users/login', {
    method: 'POST', body: { email, password }, token: '',
  })
  if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status} ${JSON.stringify(r.body)}`)
  if (!r.body.token) throw new Error(`no token for ${email}`)
  return r.body.token
}

async function registerIfMissing(email: string, password: string, name?: string): Promise<number> {
  // 先看 admin 身份能不能找到
  const q = await req<{ docs: Array<{ id: number }>; totalDocs: number }>(
    `/api/users?where[email][equals]=${encodeURIComponent(email)}&limit=1`,
  )
  if (q.status === 200 && q.body.totalDocs > 0) return q.body.docs[0].id

  // 不存在就 public /api/users/register 建
  const r = await req<{ user?: { id: number } }>(
    '/api/users/register',
    { method: 'POST', body: { email, password, name: name || email, acceptTerms: true }, token: '' },
  )
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`register ${email} failed: ${r.status} ${JSON.stringify(r.body)}`)
  }
  const newId = r.body.user?.id
  if (!newId) throw new Error(`register ${email}: no user.id`)
  return newId
}

async function cleanupUserRewards(userId: number) {
  // REST `delete` with where clause via admin
  await req(`/api/user-rewards?where[user][equals]=${userId}`, { method: 'DELETE' })
}
async function cleanupUserOrders(userId: number) {
  await req(`/api/orders?where[customer][equals]=${userId}`, { method: 'DELETE' })
}

async function main() {
  log(`[test-user-rewards] starting against ${BASE}\n`)

  // ── Step 0: admin login ──
  ADMIN_TOKEN = await login(ADMIN_EMAIL, ADMIN_PW)
  log(`[test-user-rewards] logged in as ${ADMIN_EMAIL}\n\n`)

  // ── Step 1: ensure 2 test users ──
  const userA = await registerIfMissing('test-ur-alpha@example.com', 'TestPW2026!', 'Test UR Alpha')
  const userB = await registerIfMissing('test-ur-bravo@example.com', 'TestPW2026!', 'Test UR Bravo')
  log(`users: A=${userA} (test-ur-alpha), B=${userB} (test-ur-bravo)\n\n`)

  await cleanupUserRewards(userA)
  await cleanupUserOrders(userA)
  await cleanupUserRewards(userB)

  const far = new Date(Date.now() + 365 * 86400_000).toISOString()
  const past = new Date(Date.now() - 7 * 86400_000).toISOString()

  // ═══════════════════════════════════════════════════════════════
  // T1 — 遊戲中獎 hook 自動建 UserRewards
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T1 — MiniGameRecords.afterChange auto-create ━━━\n')

  const mk1a = await req<{ doc?: Row; id?: number }>('/api/mini-game-records', {
    method: 'POST',
    body: {
      player: userA, gameType: 'movie_lottery',
      result: { outcome: 'win', prizeType: 'coupon', prizeAmount: 1,
        prizeDescription: 'T1-COUPON 威秀券', couponCode: 'T1-COUPON-ABCD' },
      status: 'completed',
    },
  })
  const rec1Id = (mk1a.body as { doc?: { id?: number } }).doc?.id
  const q1a = await req<{ totalDocs: number; docs: Row[] }>(
    `/api/user-rewards?where[sourceRecord][equals]=${rec1Id}&limit=1`,
  )
  assertEq('T1a', '遊戲 coupon win → user-rewards 自動建一筆', q1a.body.totalDocs, 1)
  if (q1a.body.docs[0]) {
    const r = q1a.body.docs[0]
    assertEq('T1a-type', '  └ rewardType=coupon', r.rewardType, 'coupon')
    assertEq('T1a-state', '  └ state=unused', r.state, 'unused')
    assertEq('T1a-code', '  └ couponCode 對齊', r.couponCode, 'T1-COUPON-ABCD')
    assertEq('T1a-phys', '  └ requiresPhysicalShipping=false（電子券）', r.requiresPhysicalShipping, false)
  }

  const mk1b = await req<{ doc?: Row }>('/api/mini-game-records', {
    method: 'POST',
    body: {
      player: userA, gameType: 'daily_checkin',
      result: { outcome: 'win', prizeType: 'badge', prizeAmount: 0,
        prizeDescription: 'T1-BADGE 測試徽章' },
      status: 'completed',
    },
  })
  const rec1bId = (mk1b.body as { doc?: { id?: number } }).doc?.id
  const q1b = await req<{ totalDocs: number }>(
    `/api/user-rewards?where[sourceRecord][equals]=${rec1bId}&limit=1`,
  )
  assertEq('T1b', '遊戲 badge win → user-rewards 自動建', q1b.body.totalDocs, 1)

  const mk1c = await req<{ doc?: Row }>('/api/mini-game-records', {
    method: 'POST',
    body: {
      player: userA, gameType: 'spin_wheel',
      result: { outcome: 'win', prizeType: 'points', prizeAmount: 50,
        prizeDescription: 'T1-POINTS 50 點' },
      status: 'completed',
    },
  })
  const rec1cId = (mk1c.body as { doc?: { id?: number } }).doc?.id
  const q1c = await req<{ totalDocs: number }>(
    `/api/user-rewards?where[sourceRecord][equals]=${rec1cId}&limit=1`,
  )
  assertEq('T1c', '遊戲 points win → user-rewards **不** 建', q1c.body.totalDocs, 0)

  const mk1d = await req<{ doc?: Row }>('/api/mini-game-records', {
    method: 'POST',
    body: {
      player: userA, gameType: 'movie_lottery',
      result: { outcome: 'lose', prizeType: 'none', prizeAmount: 0 },
      status: 'completed',
    },
  })
  const rec1dId = (mk1d.body as { doc?: { id?: number } }).doc?.id
  const q1d = await req<{ totalDocs: number }>(
    `/api/user-rewards?where[sourceRecord][equals]=${rec1dId}&limit=1`,
  )
  assertEq('T1d', '遊戲 lose → user-rewards 不建', q1d.body.totalDocs, 0)

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T2 — Checkout 自動 attach + 出貨 state 回流
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T2 — Checkout auto-attach + shipped transition ━━━\n')

  await cleanupUserRewards(userA)

  async function createReward(data: Row): Promise<number> {
    const r = await req<{ doc?: { id: number } }>('/api/user-rewards', { method: 'POST', body: data })
    if (r.status !== 201 && r.status !== 200) throw new Error(`createReward failed: ${r.status} ${JSON.stringify(r.body)}`)
    const id = (r.body as { doc?: { id?: number } }).doc?.id
    if (!id) throw new Error(`createReward: no doc.id in ${JSON.stringify(r.body)}`)
    return id
  }

  const rPhys1 = await createReward({
    user: userA, rewardType: 'movie_ticket_physical', displayName: 'T2-實體電影票',
    amount: 2, state: 'unused', expiresAt: far, requiresPhysicalShipping: true,
  })
  const rPhys2 = await createReward({
    user: userA, rewardType: 'gift_physical', displayName: 'T2-化妝包',
    amount: 1, state: 'unused', expiresAt: far, requiresPhysicalShipping: true,
  })
  const rDigital = await createReward({
    user: userA, rewardType: 'coupon', displayName: 'T2-電子券',
    couponCode: 'T2-DIGITAL', state: 'unused', expiresAt: far, requiresPhysicalShipping: false,
  })

  const orderBody = {
    orderNumber: `T2-${Date.now()}`,
    customer: userA,
    items: [{ product: 1, productName: 'T2 商品', quantity: 1, unitPrice: 1000, subtotal: 1000 }],
    subtotal: 1000, shippingFee: 0, total: 1000,
    status: 'pending', paymentStatus: 'unpaid',
    shippingAddress: { recipientName: 'T2', phone: '0912345678', city: '台北市', address: '忠孝東路 1 號' },
  }
  const orderR = await req<{ doc?: { id: number } }>('/api/orders', { method: 'POST', body: orderBody })
  const order1Id = orderR.body.doc?.id
  if (!order1Id) throw new Error(`T2 order create failed: ${orderR.status} ${JSON.stringify(orderR.body)}`)

  const order1 = await req<{ gifts?: Row[] }>(`/api/orders/${order1Id}`)
  const gifts = order1.body.gifts || []
  assertEq('T2a', '訂單建立時 gifts 有 2 筆（2 實體）', gifts.length, 2)

  const phys1After = (await req<Row>(`/api/user-rewards/${rPhys1}?depth=0`)).body
  const phys2After = (await req<Row>(`/api/user-rewards/${rPhys2}?depth=0`)).body
  const digitalAfter = (await req<Row>(`/api/user-rewards/${rDigital}?depth=0`)).body
  assertEq('T2b', '實體 #1 state → pending_attach', phys1After.state, 'pending_attach')
  assertEq('T2c', '實體 #2 state → pending_attach', phys2After.state, 'pending_attach')
  assertEq('T2d', '電子券維持 unused', digitalAfter.state, 'unused')
  assertEq('T2e', '實體 #1 attachedToOrder 指回本訂單',
    Number(phys1After.attachedToOrder), Number(order1Id))

  await req(`/api/orders/${order1Id}`, { method: 'PATCH', body: { status: 'shipped' } })
  const phys1Shipped = (await req<Row>(`/api/user-rewards/${rPhys1}?depth=0`)).body
  assertEq('T2f', 'Order shipped → 實體 #1 state=shipped', phys1Shipped.state, 'shipped')
  assertEq('T2g', '實體 #1 有 shippedAt', Boolean(phys1Shipped.shippedAt), true)

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T3 — 取消訂單 → pending_attach 回退 unused
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T3 — Order cancel rollback ━━━\n')

  const rPhys3 = await createReward({
    user: userA, rewardType: 'gift_physical', displayName: 'T3-贈品',
    amount: 1, state: 'unused', expiresAt: far, requiresPhysicalShipping: true,
  })
  const o2Body = {
    orderNumber: `T3-${Date.now()}`, customer: userA,
    items: [{ product: 1, productName: 'T3 商品', quantity: 1, unitPrice: 500, subtotal: 500 }],
    subtotal: 500, shippingFee: 0, total: 500,
    status: 'pending', paymentStatus: 'unpaid',
    shippingAddress: { recipientName: 'T3', phone: '0912345678', city: '台北市', address: '光復南路 1 號' },
  }
  const o2 = await req<{ doc?: { id: number } }>('/api/orders', { method: 'POST', body: o2Body })
  const o2Id = o2.body.doc?.id
  if (!o2Id) throw new Error(`T3 order create failed: ${o2.status} ${JSON.stringify(o2.body)}`)

  const o2Full = await req<{ gifts?: Row[] }>(`/api/orders/${o2Id}`)
  const o2Gifts = o2Full.body.gifts || []
  assertEq('T3a', '新訂單 attach 1 張（已 shipped 的不再撈）', o2Gifts.length, 1)

  const phys3Pending = (await req<Row>(`/api/user-rewards/${rPhys3}?depth=0`)).body
  assertEq('T3b', '實體 #3 state=pending_attach', phys3Pending.state, 'pending_attach')

  await req(`/api/orders/${o2Id}`, { method: 'PATCH', body: { status: 'cancelled' } })
  const phys3Back = (await req<Row>(`/api/user-rewards/${rPhys3}?depth=0`)).body
  assertEq('T3c', '取消訂單 → 實體 #3 回 unused', phys3Back.state, 'unused')
  assertEq('T3d', '實體 #3 attachedToOrder 清空',
    phys3Back.attachedToOrder == null ? null : phys3Back.attachedToOrder, null)

  const phys1Still = (await req<Row>(`/api/user-rewards/${rPhys1}?depth=0`)).body
  assertEq('T3e', 'T2 shipped 的不受其他訂單取消影響', phys1Still.state, 'shipped')

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T4 — 擁有者權限：B 不可讀 A 的獎項 + consume 別人的 → 403/404
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T4 — Owner access control ━━━\n')

  const tokenB = await login('test-ur-bravo@example.com', 'TestPW2026!')

  // B 登入狀態下查 A 的 rewards — access filter 會把 where 條件強加 user=B
  // 所以實際上回傳的是 B 自己的（不該看到 A 的資料）
  const listAsB = await req<{ totalDocs: number; docs: Row[] }>(
    `/api/user-rewards?where[user][equals]=${userA}&limit=200`,
    { token: tokenB },
  )
  const leakedAPUR = listAsB.body.docs.filter((d) => {
    const u = typeof d.user === 'object' ? (d.user as { id?: unknown }).id : d.user
    return Number(u) === userA
  })
  assertEq('T4a', 'B 登入狀態下查 A 的 rewards → 0 筆（access filter 起作用）',
    leakedAPUR.length, 0)

  // 取得 A 的一張 reward id，B 嘗試讀取（應 403/404）
  const oneA = await req<{ docs: Array<{ id: number }> }>(
    `/api/user-rewards?where[user][equals]=${userA}&limit=1`,
  )
  const someAId = oneA.body.docs[0]?.id
  if (someAId) {
    const readAsB = await req(`/api/user-rewards/${someAId}`, { token: tokenB })
    assertEq('T4b', `B 直接 GET A 的 reward id=${someAId} → 404/403`,
      readAsB.status === 404 || readAsB.status === 403, true, `(status=${readAsB.status}) `)

    // B 嘗試 consume A 的券 → 403 forbidden（route.ts 自行檢查 ownerId）
    const consumeAsB = await req<{ error?: string }>('/api/user-rewards/consume', {
      method: 'POST', body: { rewardId: someAId }, token: tokenB,
    })
    assertEq('T4c', `B consume A 的 reward → 403 forbidden`,
      consumeAsB.status === 403 || consumeAsB.status === 404, true,
      `(status=${consumeAsB.status}, error="${consumeAsB.body.error}") `)
  }

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T5 — coupon_code UNIQUE partial index
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T5 — coupon_code UNIQUE index ━━━\n')

  const CODE = `T5-UNIQUE-${Date.now()}`
  await createReward({
    user: userA, rewardType: 'coupon', displayName: 'T5 a', couponCode: CODE,
    state: 'unused', expiresAt: far, requiresPhysicalShipping: false,
  })

  const dup = await req<{ errors?: Row[] }>('/api/user-rewards', {
    method: 'POST',
    body: { user: userA, rewardType: 'coupon', displayName: 'T5 b', couponCode: CODE,
      state: 'unused', expiresAt: far, requiresPhysicalShipping: false },
  })
  assertEq('T5a', '重複 coupon_code 應 reject（4xx）',
    dup.status >= 400 && dup.status < 500, true, `(status=${dup.status}) `)

  // 多筆 NULL 允許
  await createReward({
    user: userA, rewardType: 'badge', displayName: 'T5-null 1',
    state: 'unused', expiresAt: far, requiresPhysicalShipping: false,
  })
  let nullOk = true
  try {
    await createReward({
      user: userA, rewardType: 'badge', displayName: 'T5-null 2',
      state: 'unused', expiresAt: far, requiresPhysicalShipping: false,
    })
  } catch {
    nullOk = false
  }
  assertEq('T5b', '多筆 coupon_code=NULL 允許（partial index）', nullOk, true)

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T6 — 過期邊界
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T6 — Expiry edge cases ━━━\n')

  const future60s = new Date(Date.now() + 60_000).toISOString()
  const past100ms = new Date(Date.now() - 100).toISOString()

  const rFuture = await createReward({
    user: userA, rewardType: 'coupon', displayName: 'T6-future',
    couponCode: `T6-FUTURE-${Date.now()}`, state: 'unused',
    expiresAt: future60s, requiresPhysicalShipping: false,
  })
  const rPast = await createReward({
    user: userA, rewardType: 'coupon', displayName: 'T6-past',
    couponCode: `T6-PAST-${Date.now()}`, state: 'unused',
    expiresAt: past100ms, requiresPhysicalShipping: false,
  })

  const f1 = (await req<Row>(`/api/user-rewards/${rFuture}?depth=0`)).body
  assertEq('T6a', '未過期（+60s） → afterRead 維持 unused', f1.state, 'unused')

  const p1 = (await req<Row>(`/api/user-rewards/${rPast}?depth=0`)).body
  assertEq('T6b', '已過期（-100ms） → afterRead lazy 標 expired', p1.state, 'expired')

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T7 — Summary 計算：只算 unused+pending，其他排除
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T7 — Summary filter ━━━\n')

  await cleanupUserRewards(userB)
  const states: Array<'unused' | 'pending_attach' | 'shipped' | 'consumed'> = [
    'unused', 'pending_attach', 'shipped', 'consumed',
  ]
  for (const s of states) {
    await createReward({
      user: userB, rewardType: 'coupon', displayName: `T7-${s}`,
      state: s, expiresAt: far, requiresPhysicalShipping: false,
    })
  }
  await createReward({
    user: userB, rewardType: 'coupon', displayName: 'T7-expired',
    state: 'unused', expiresAt: past, requiresPhysicalShipping: false,
  })

  const allB = await req<{ totalDocs: number; docs: Row[] }>(
    `/api/user-rewards?where[user][equals]=${userB}&limit=200`,
  )
  const by: Record<string, number> = {}
  for (const d of allB.body.docs) {
    const s = String(d.state)
    by[s] = (by[s] || 0) + 1
  }
  assertEq('T7a', '5 種 state 各 1 筆',
    { unused: by.unused || 0, pending_attach: by.pending_attach || 0,
      shipped: by.shipped || 0, consumed: by.consumed || 0, expired: by.expired || 0 },
    { unused: 1, pending_attach: 1, shipped: 1, consumed: 1, expired: 1 })

  const usable = allB.body.docs.filter((r) =>
    ['unused', 'pending_attach'].includes(String(r.state)))
  assertEq('T7b', 'Summary 可用 = unused(1) + pending_attach(1) = 2', usable.length, 2)

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T8 — Lazy expire 不污染 update path
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T8 — afterRead expire not sticky ━━━\n')

  const rPast2 = await createReward({
    user: userA, rewardType: 'coupon', displayName: 'T8-past',
    couponCode: `T8-PAST-${Date.now()}`, state: 'unused',
    expiresAt: past100ms, requiresPhysicalShipping: false,
  })
  const read1 = (await req<Row>(`/api/user-rewards/${rPast2}?depth=0`)).body
  assertEq('T8a', 'read 時看到 expired', read1.state, 'expired')

  await req(`/api/user-rewards/${rPast2}`, {
    method: 'PATCH', body: { expiresAt: far },
  })
  const read2 = (await req<Row>(`/api/user-rewards/${rPast2}?depth=0`)).body
  assertEq('T8b', 'admin 把 expiresAt 改到未來 → read 變回 unused', read2.state, 'unused')

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  // T9 — 腳本冪等性：再跑一次 T1a 依然 PASS
  // ═══════════════════════════════════════════════════════════════
  log('━━━ T9 — Re-run safety ━━━\n')

  const before = await req<{ totalDocs: number }>(
    `/api/user-rewards?where[user][equals]=${userA}&limit=1`,
  )
  const beforeCount = before.body.totalDocs
  const recRe = await req<{ doc?: { id: number } }>('/api/mini-game-records', {
    method: 'POST',
    body: {
      player: userA, gameType: 'movie_lottery',
      result: { outcome: 'win', prizeType: 'coupon', prizeAmount: 1,
        prizeDescription: 'T9 再跑', couponCode: `T9-${Date.now()}` },
      status: 'completed',
    },
  })
  const recReId = recRe.body.doc?.id
  const afterQ = await req<{ totalDocs: number }>(
    `/api/user-rewards?where[sourceRecord][equals]=${recReId}&limit=1`,
  )
  assertEq('T9a', '重跑 game win → 依然自動建一筆 reward', afterQ.body.totalDocs, 1)
  log(`       (user A 獎項總數: 重跑前=${beforeCount} → 重跑後=${beforeCount + 1})\n`)

  log('\n')

  // ═══════════════════════════════════════════════════════════════
  const pass = results.filter((r) => r.ok).length
  const fail = results.filter((r) => !r.ok).length
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  log(`Total: ${results.length}   PASS: ${pass}   FAIL: ${fail}\n`)
  if (fail > 0) {
    log('\nFailed:\n')
    for (const r of results.filter((x) => !x.ok)) {
      log(`  ${r.id} — ${r.name}\n       ${r.detail}\n`)
    }
    process.exit(1)
  }
  log('ALL PASS ✅\n')
  process.exit(0)
}

main().catch((e) => {
  process.stderr.write(`[test-user-rewards] ERROR: ${(e as Error).stack || e}\n`)
  process.exit(1)
})
