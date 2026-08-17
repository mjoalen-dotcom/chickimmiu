/**
 * Ops Copilot — 訊號掃描器
 * ─────────────────────────────────────
 * **這裡是護城河。**
 *
 * 每個掃描器都是純 TypeScript：查 Payload、算數字、回傳 OpsSignal。
 * LLM 完全不參與計算，只在 briefing.ts 拿這些現成數字去排序與敘述。
 * 所以日報上的每個數字都可以追回一筆實際查詢，不會有幻覺。
 *
 * 掃描器的挑選原則：優先挑「開店 SaaS 沒有的表」。
 *   · scanStyleVoteFlops   → style-submissions / style-votes（穿搭投票）
 *   · scanCreditRisk       → credit-score-history（會員信用分數）
 *   · scanPendingWithdrawals → wallet-withdrawals（可提領購物金）
 *   · scanCompetitorUndercut → competitor-price-records（競品比價）
 * 這四個在 Shopline / Cyberbiz / 91APP 的 schema 裡根本不存在 —— 它們的 AI 助理
 * 永遠問不出「這批穿搭投票輸掉的款要不要降價」。
 *
 * 新增掃描器時：
 *   1. 寫成 `async function scanXxx(payload): Promise<OpsSignal[]>`
 *   2. metrics 只放實際查到的數字，不要放推估值
 *   3. 註冊到 SCANNERS
 *   4. 單一掃描器 throw 不會拖垮整份日報（collectSignals 逐個 catch）
 */

import type { OpsSignal, PayloadLike } from './types'

// ── 參數（改這裡就能調靈敏度） ──────────────────────────
const VELOCITY_WINDOW_DAYS = 30
const ORDER_SCAN_LIMIT = 800
const SAFETY_STOCK_DAYS = 14
const STUCK_ORDER_DAYS = 3
const DORMANT_MEMBER_DAYS = 45
const WITHDRAWAL_SLA_DAYS = 3
const MAX_ITEMS_PER_SIGNAL = 8

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** relationship 欄位可能是 id 也可能是 populated 物件，統一取 id */
function relId(v: unknown): string | number | null {
  if (typeof v === 'number' || typeof v === 'string') return v
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

// ── 共用：近 N 日各商品銷量 ─────────────────────────────

/**
 * 掃近 VELOCITY_WINDOW_DAYS 天的有效訂單，加總每個 product 的出貨件數。
 * 有上限（ORDER_SCAN_LIMIT）—— 訂單量長大後要換成 InventoryTransactions 聚合，
 * 但在目前量級直接掃訂單最準（退貨/取消的單已被 status 過濾掉）。
 */
async function getProductVelocity(
  payload: PayloadLike,
): Promise<{ sold: Map<string, number>; orderCount: number; truncated: boolean }> {
  const res = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { createdAt: { greater_than: daysAgo(VELOCITY_WINDOW_DAYS) } },
        { status: { not_in: ['cancelled', 'refunded'] } },
      ],
    },
    limit: ORDER_SCAN_LIMIT,
    depth: 0,
    pagination: true,
  })

  const sold = new Map<string, number>()
  for (const order of res.docs) {
    const items = Array.isArray(order.items) ? order.items : []
    for (const raw of items) {
      const item = raw as Record<string, unknown>
      const pid = relId(item.product)
      if (pid === null) continue
      const key = String(pid)
      sold.set(key, (sold.get(key) ?? 0) + num(item.quantity))
    }
  }

  return {
    sold,
    orderCount: res.docs.length,
    truncated: res.totalDocs > res.docs.length,
  }
}

// ── 掃描器 1：庫存低於安全水位 ──────────────────────────

async function scanLowStock(payload: PayloadLike): Promise<OpsSignal[]> {
  const { sold, orderCount, truncated } = await getProductVelocity(payload)

  const res = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    limit: 500,
    depth: 0,
  })

  type Row = {
    id: string | number
    name: string
    stock: number
    daily: number
    daysLeft: number
    suggestQty: number
  }
  const rows: Row[] = []

  for (const doc of res.docs) {
    const id = doc.id as string | number
    const stock = num(doc.stock)
    const soldQty = sold.get(String(id)) ?? 0
    if (soldQty === 0) continue // 沒動過的款不叫缺貨，叫滯銷（另一個掃描器的事）

    const daily = soldQty / VELOCITY_WINDOW_DAYS
    const daysLeft = daily > 0 ? stock / daily : Infinity
    if (daysLeft >= SAFETY_STOCK_DAYS) continue

    const target = Math.ceil(daily * SAFETY_STOCK_DAYS * 2) // 補到 28 天水位
    rows.push({
      id,
      name: str(doc.name) || `#${id}`,
      stock,
      daily: Math.round(daily * 100) / 100,
      daysLeft: Math.round(daysLeft * 10) / 10,
      suggestQty: Math.max(1, target - stock),
    })
  }

  if (rows.length === 0) return []

  rows.sort((a, b) => a.daysLeft - b.daysLeft)
  const top = rows.slice(0, MAX_ITEMS_PER_SIGNAL)

  return [
    {
      id: 'inventory.low_stock',
      category: 'inventory',
      severity: rows.some((r) => r.daysLeft < 5) ? 'critical' : 'warning',
      title: `${rows.length} 款庫存撐不到 ${SAFETY_STOCK_DAYS} 天`,
      metrics: {
        低水位款數: rows.length,
        最急款: top[0].name,
        最急剩餘天數: top[0].daysLeft,
        取樣訂單數: orderCount,
        取樣天數: VELOCITY_WINDOW_DAYS,
        ...(truncated ? { 取樣已截斷: `僅取最近 ${ORDER_SCAN_LIMIT} 筆訂單` } : {}),
      },
      entities: top.map((r) => ({
        collection: 'products',
        id: r.id,
        label: `${r.name}｜現貨 ${r.stock}｜日均 ${r.daily}｜剩 ${r.daysLeft} 天`,
      })),
      suggestedActions: top.slice(0, 3).map((r) => ({
        type: 'create_purchase_order' as const,
        summary: `建立進貨單草稿：${r.name} × ${r.suggestQty} 件（補到 ${SAFETY_STOCK_DAYS * 2} 天水位）`,
        input: { productId: r.id, quantity: r.suggestQty },
      })),
    },
  ]
}

// ── 掃描器 2：競品已低於我們（SaaS 沒有這張表） ──────────

async function scanCompetitorUndercut(payload: PayloadLike): Promise<OpsSignal[]> {
  const res = await payload.find({
    collection: 'competitor-price-records',
    where: {
      and: [
        { relatedProduct: { exists: true } },
        { priceTWD: { greater_than: 0 } },
        { observedAt: { greater_than: daysAgo(30) } },
      ],
    },
    limit: 200,
    depth: 1,
  })

  type Row = {
    id: string | number
    name: string
    ours: number
    theirs: number
    gapPct: number
    suggested: number
    cost: number
  }
  const rows: Row[] = []

  for (const doc of res.docs) {
    const product = doc.relatedProduct as Record<string, unknown> | null
    if (!product || typeof product !== 'object') continue

    const ours = num(product.salePrice) || num(product.price)
    const theirs = num(doc.priceTWD)
    if (ours <= 0 || theirs <= 0 || theirs >= ours) continue

    const cost = num(product.cost)
    // 建議價：對到競品之上一點點，但不低於成本 × 1.6（守住 37.5% 毛利底線）
    const floor = cost > 0 ? Math.ceil(cost * 1.6) : Math.ceil(theirs * 1.05)
    const suggested = Math.max(floor, Math.ceil((theirs * 1.05) / 10) * 10)
    if (suggested >= ours) continue

    rows.push({
      id: product.id as string | number,
      name: str(product.name) || str(doc.productName),
      ours,
      theirs,
      gapPct: Math.round(((ours - theirs) / ours) * 1000) / 10,
      suggested,
      cost,
    })
  }

  if (rows.length === 0) return []
  rows.sort((a, b) => b.gapPct - a.gapPct)
  const top = rows.slice(0, MAX_ITEMS_PER_SIGNAL)

  return [
    {
      id: 'pricing.competitor_undercut',
      category: 'pricing',
      severity: rows.some((r) => r.gapPct >= 20) ? 'critical' : 'warning',
      title: `${rows.length} 款競品售價已低於我們`,
      metrics: {
        受影響款數: rows.length,
        最大價差百分比: top[0].gapPct,
        最大價差商品: top[0].name,
        比價資料來源: '競品價格紀錄（近 30 日）',
      },
      entities: top.map((r) => ({
        collection: 'products',
        id: r.id,
        label: `${r.name}｜我們 $${r.ours}｜競品 $${r.theirs}（低 ${r.gapPct}%）`,
      })),
      suggestedActions: top.slice(0, 3).map((r) => ({
        type: 'adjust_product_price' as const,
        summary: `${r.name} 調價 $${r.ours} → $${r.suggested}（守住成本 ×1.6 底線）`,
        input: { productId: r.id, salePrice: r.suggested },
      })),
    },
  ]
}

// ── 掃描器 3：卡住的訂單與發票 ──────────────────────────

async function scanStuckFulfillment(payload: PayloadLike): Promise<OpsSignal[]> {
  const signals: OpsSignal[] = []

  const stuck = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { paymentStatus: { equals: 'paid' } },
        { status: { in: ['pending', 'processing'] } },
        { createdAt: { less_than: daysAgo(STUCK_ORDER_DAYS) } },
      ],
    },
    limit: 100,
    depth: 0,
  })

  if (stuck.docs.length > 0) {
    signals.push({
      id: 'orders.stuck_fulfillment',
      category: 'orders',
      severity: stuck.docs.length >= 5 ? 'critical' : 'warning',
      title: `${stuck.docs.length} 筆已付款訂單超過 ${STUCK_ORDER_DAYS} 天未出貨`,
      metrics: {
        卡住訂單數: stuck.docs.length,
        門檻天數: STUCK_ORDER_DAYS,
        金額合計: stuck.docs.reduce((s, d) => s + num(d.total), 0),
      },
      entities: stuck.docs.slice(0, MAX_ITEMS_PER_SIGNAL).map((d) => ({
        collection: 'orders',
        id: d.id as string | number,
        label: `${str(d.orderNumber)}｜$${num(d.total)}｜${str(d.status)}`,
      })),
    })
  }

  const failedInvoices = await payload.find({
    collection: 'invoices',
    where: { status: { equals: 'failed' } },
    limit: 50,
    depth: 0,
  })

  if (failedInvoices.docs.length > 0) {
    signals.push({
      id: 'orders.failed_invoices',
      category: 'orders',
      severity: 'critical',
      title: `${failedInvoices.docs.length} 張發票開立失敗`,
      metrics: {
        失敗張數: failedInvoices.docs.length,
        最近錯誤: str(failedInvoices.docs[0]?.lastError).slice(0, 120) || '（無記錄）',
      },
      entities: failedInvoices.docs.slice(0, MAX_ITEMS_PER_SIGNAL).map((d) => ({
        collection: 'invoices',
        id: d.id as string | number,
        label: `${str(d.invoiceNumber) || `#${d.id}`}｜重試 ${num(d.retryCount)} 次`,
      })),
    })
  }

  return signals
}

// ── 掃描器 4：高價值會員沉睡 ────────────────────────────

async function scanDormantVips(payload: PayloadLike): Promise<OpsSignal[]> {
  const res = await payload.find({
    collection: 'users',
    where: {
      and: [
        { role: { equals: 'customer' } },
        { orderCount: { greater_than: 1 } },
        { lastOrderDate: { less_than: daysAgo(DORMANT_MEMBER_DAYS) } },
        { isBlacklisted: { not_equals: true } },
      ],
    },
    sort: '-lifetimeSpend',
    limit: 100,
    depth: 1,
  })

  if (res.docs.length === 0) return []

  const top = res.docs.slice(0, MAX_ITEMS_PER_SIGNAL)
  const totalSpend = res.docs.reduce((s, d) => s + num(d.lifetimeSpend), 0)

  return [
    {
      id: 'members.dormant_vip',
      category: 'members',
      severity: 'warning',
      title: `${res.docs.length} 位回頭客超過 ${DORMANT_MEMBER_DAYS} 天未回購`,
      metrics: {
        沉睡人數: res.docs.length,
        累計消費合計: Math.round(totalSpend),
        門檻天數: DORMANT_MEMBER_DAYS,
        最高價值會員累計消費: Math.round(num(top[0].lifetimeSpend)),
      },
      entities: top.map((d) => {
        const tier = d.memberTier as Record<string, unknown> | null
        return {
          collection: 'users',
          id: d.id as string | number,
          label: `${str(d.name) || str(d.email)}｜${str(tier?.frontName as string) || '一般會員'}｜累計 $${Math.round(num(d.lifetimeSpend))}`,
        }
      }),
      suggestedActions: top.slice(0, 3).map((d) => ({
        type: 'send_member_dm' as const,
        summary: `對 ${str(d.name) || str(d.email)} 寄個人化回購 DM`,
        input: { userId: d.id, intent: 'winback' },
      })),
    },
  ]
}

// ── 掃描器 5：穿搭投票墊底款（SaaS 沒有這張表） ──────────

async function scanStyleVoteFlops(payload: PayloadLike): Promise<OpsSignal[]> {
  const res = await payload.find({
    collection: 'style-submissions',
    where: {
      and: [
        // winner 也要算進來 —— 少了高分那端，平均會被拉低，墊底款反而漏抓。
        { status: { in: ['approved', 'winner'] } },
        { createdAt: { greater_than: daysAgo(30) } },
      ],
    },
    limit: 300,
    depth: 0,
  })

  const scored = res.docs
    .map((d) => ({ id: d.id as string | number, votes: num(d.voteCount) }))
    .filter((d) => d.votes >= 0)

  if (scored.length < 8) return [] // 樣本太少，投票分數沒有統計意義

  const avg = scored.reduce((s, d) => s + d.votes, 0) / scored.length
  const flops = scored
    .filter((d) => d.votes < avg * 0.4)
    .sort((a, b) => a.votes - b.votes)

  if (flops.length === 0) return []

  return [
    {
      id: 'engagement.style_vote_flops',
      category: 'engagement',
      severity: 'info',
      title: `${flops.length} 件穿搭投票分數低於平均四成`,
      metrics: {
        墊底件數: flops.length,
        全站平均票數: Math.round(avg * 10) / 10,
        樣本件數: scored.length,
        最低票數: flops[0].votes,
        判定門檻: '低於平均 × 0.4',
      },
      entities: flops.slice(0, MAX_ITEMS_PER_SIGNAL).map((d) => ({
        collection: 'style-submissions',
        id: d.id,
        label: `投稿 #${d.id}｜${d.votes} 票`,
      })),
    },
  ]
}

// ── 掃描器 6：信用分數異常（SaaS 沒有這張表） ────────────

async function scanCreditRisk(payload: PayloadLike): Promise<OpsSignal[]> {
  const res = await payload.find({
    collection: 'credit-score-history',
    where: {
      and: [
        { change: { less_than: 0 } },
        { createdAt: { greater_than: daysAgo(14) } },
      ],
    },
    limit: 200,
    depth: 1,
  })

  if (res.docs.length === 0) return []

  // 同一會員 14 天內多次扣分才值得人工看
  const byUser = new Map<string, { label: string; drops: number; total: number; id: string | number }>()
  for (const doc of res.docs) {
    const user = doc.user as Record<string, unknown> | null
    const uid = relId(doc.user)
    if (uid === null) continue
    const key = String(uid)
    const prev = byUser.get(key) ?? {
      label: str(user?.name as string) || str(user?.email as string) || `#${key}`,
      drops: 0,
      total: 0,
      id: uid,
    }
    prev.drops += 1
    prev.total += Math.abs(num(doc.change))
    byUser.set(key, prev)
  }

  const repeat = [...byUser.values()].filter((u) => u.drops >= 2).sort((a, b) => b.total - a.total)
  if (repeat.length === 0) return []

  return [
    {
      id: 'risk.repeat_credit_drops',
      category: 'risk',
      severity: 'warning',
      title: `${repeat.length} 位會員近 14 天重複扣信用分`,
      metrics: {
        會員數: repeat.length,
        扣分事件總數: res.docs.length,
        最高累計扣分: repeat[0].total,
        觀察天數: 14,
      },
      entities: repeat.slice(0, MAX_ITEMS_PER_SIGNAL).map((u) => ({
        collection: 'users',
        id: u.id,
        label: `${u.label}｜${u.drops} 次扣分｜累計 -${u.total}`,
      })),
      suggestedActions: repeat.slice(0, 3).map((u) => ({
        type: 'flag_credit_review' as const,
        summary: `標記 ${u.label} 需人工複查信用（14 天內扣分 ${u.drops} 次）`,
        input: { userId: u.id, reason: `14 天內重複扣分 ${u.drops} 次，累計 -${u.total}` },
      })),
    },
  ]
}

// ── 掃描器 7：提領申請逾時（SaaS 沒有這張表） ────────────

async function scanPendingWithdrawals(payload: PayloadLike): Promise<OpsSignal[]> {
  const res = await payload.find({
    collection: 'wallet-withdrawals',
    where: {
      and: [
        { status: { equals: 'pending' } },
        { createdAt: { less_than: daysAgo(WITHDRAWAL_SLA_DAYS) } },
      ],
    },
    limit: 100,
    depth: 1,
  })

  if (res.docs.length === 0) return []

  return [
    {
      id: 'risk.pending_withdrawals',
      category: 'risk',
      severity: 'critical',
      title: `${res.docs.length} 筆購物金提領超過 ${WITHDRAWAL_SLA_DAYS} 天未處理`,
      metrics: {
        待處理筆數: res.docs.length,
        金額合計: res.docs.reduce((s, d) => s + num(d.amount), 0),
        SLA天數: WITHDRAWAL_SLA_DAYS,
      },
      entities: res.docs.slice(0, MAX_ITEMS_PER_SIGNAL).map((d) => {
        const user = d.user as Record<string, unknown> | null
        return {
          collection: 'wallet-withdrawals',
          id: d.id as string | number,
          label: `${str(user?.name as string) || `#${d.id}`}｜$${num(d.amount)}`,
        }
      }),
    },
  ]
}

// ── 註冊表 ──────────────────────────────────────────────

const SCANNERS: Array<{
  name: string
  run: (payload: PayloadLike) => Promise<OpsSignal[]>
}> = [
  { name: 'lowStock', run: scanLowStock },
  { name: 'competitorUndercut', run: scanCompetitorUndercut },
  { name: 'stuckFulfillment', run: scanStuckFulfillment },
  { name: 'dormantVips', run: scanDormantVips },
  { name: 'styleVoteFlops', run: scanStyleVoteFlops },
  { name: 'creditRisk', run: scanCreditRisk },
  { name: 'pendingWithdrawals', run: scanPendingWithdrawals },
]

const SEVERITY_ORDER: Record<OpsSignal['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

/**
 * 跑完所有掃描器，回傳依嚴重度排序的訊號。
 * 單一掃描器 throw 不會讓整份日報失敗 —— 記 log 後跳過，其他訊號照常出。
 */
export async function collectSignals(
  payload: PayloadLike,
): Promise<{ signals: OpsSignal[]; failed: string[] }> {
  const results = await Promise.allSettled(SCANNERS.map((s) => s.run(payload)))

  const signals: OpsSignal[] = []
  const failed: string[] = []

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      signals.push(...r.value)
    } else {
      failed.push(SCANNERS[i].name)
      console.error(`[ops-copilot] scanner "${SCANNERS[i].name}" failed:`, r.reason)
    }
  })

  signals.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return { signals, failed }
}
