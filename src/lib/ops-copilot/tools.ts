/**
 * Ops Copilot — 對話工具（全部唯讀）
 * ─────────────────────────────────────
 * 給 runToolLoop() 用的工具集。**這裡不存在任何有副作用的工具**：
 * LLM 想改東西只能走 propose_action，而 propose_action 也只是寫一筆
 * pending 提案到 ops-actions，等人核准。
 *
 * 安全邊界：
 *   · READABLE_COLLECTIONS 白名單 —— 沒列在裡面的表 LLM 查不到
 *   · users 一律走 redactUser()：不回傳 email 全文、手機、地址、銀行資訊
 *   · limit 硬上限 50、depth 硬上限 1（避免一次把整個 DB 拉進 context）
 *
 * 為什麼是「白名單」而不是「黑名單」：新 collection 是每週都在加的，
 * 黑名單會漏。要讓 AI 看新表，來這裡明確加一行。
 */

import { ACTION_CATALOG, getActionType } from './actions'
import { collectSignals } from './signals'
import type { LlmToolDef } from './llm'
import type { PayloadLike } from './types'

/** LLM 可讀的 collection 白名單 */
const READABLE_COLLECTIONS = [
  'products',
  'orders',
  'invoices',
  'returns',
  'exchanges',
  'refunds',
  'users',
  'coupons',
  'purchase-orders',
  'inventory-transactions',
  'competitor-price-records',
  'style-submissions',
  'style-votes',
  'credit-score-history',
  'wallet-withdrawals',
  'points-transactions',
  'user-subscriptions',
  'product-reviews',
  'behavior-events',
  'customer-service-tickets',
] as const

const MAX_LIMIT = 50
const MAX_DEPTH = 1

/** users 的敏感欄位遮蔽 —— PII 不進 LLM context */
const USER_SAFE_FIELDS = [
  'id',
  'name',
  'role',
  'points',
  'shoppingCredit',
  'creditScore',
  'creditStatus',
  'orderCount',
  'lifetimeSpend',
  'annualSpend',
  'lastOrderDate',
  'lastLoginDate',
  'memberTier',
  'isBlacklisted',
  'emailSubscribed',
  'preferredCategory',
  'preferredSize',
  'createdAt',
]

function redactUser(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of USER_SAFE_FIELDS) {
    if (k in doc) out[k] = doc[k]
  }
  const email = typeof doc.email === 'string' ? doc.email : ''
  // 只留足以辨識是誰、但不足以直接寄信的形式
  out.emailMasked = email ? `${email.slice(0, 2)}***@${email.split('@')[1] ?? ''}` : ''
  return out
}

function redact(collection: string, docs: Record<string, unknown>[]): unknown[] {
  if (collection === 'users') return docs.map(redactUser)
  return docs
}

function clampLimit(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return 10
  return Math.min(Math.floor(n), MAX_LIMIT)
}

/**
 * 建立本次對話可用的工具集。
 * @param payload  Payload local API
 * @param actorId  目前登入的 admin，寫進提案的稽核欄位
 */
export function buildTools(payload: PayloadLike, actorId: string | number): LlmToolDef[] {
  return [
    {
      name: 'list_signals',
      description:
        '取得目前所有營運訊號（庫存低水位、競品低價、卡單、沉睡會員、穿搭投票墊底、信用風險、提領逾時）。' +
        '這些數字是程式掃描實際資料算出來的，可以直接引用。' +
        '回答任何「現在營運狀況如何」「有什麼要注意的」類問題時先呼叫這個。',
      input_schema: { type: 'object', properties: {}, required: [] },
      run: async () => {
        const { signals, failed } = await collectSignals(payload)
        return { signals, failedScanners: failed }
      },
    },

    {
      name: 'query_collection',
      description:
        `查詢一個資料表並回傳文件。可查的表：${READABLE_COLLECTIONS.join(', ')}。` +
        'where 使用 Payload 查詢語法，例如 {"status":{"equals":"published"}} 或 ' +
        '{"and":[{"stock":{"less_than":10}},{"status":{"equals":"published"}}]}。' +
        `單次最多 ${MAX_LIMIT} 筆。users 表的 email/電話/地址/銀行資訊一律被遮蔽。` +
        '需要精確數量時用 count_collection，不要靠這個工具數。',
      input_schema: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: [...READABLE_COLLECTIONS] },
          where: { type: 'object', description: 'Payload where 條件；省略代表全部' },
          sort: { type: 'string', description: '例：-createdAt、stock' },
          limit: { type: 'integer', description: `1–${MAX_LIMIT}，預設 10` },
          depth: { type: 'integer', description: `0–${MAX_DEPTH}，預設 0` },
        },
        required: ['collection'],
      },
      run: async (input) => {
        const collection = String(input.collection)
        if (!(READABLE_COLLECTIONS as readonly string[]).includes(collection)) {
          throw new Error(`collection "${collection}" 不在唯讀白名單內`)
        }
        const res = await payload.find({
          collection,
          where: (input.where as Record<string, unknown>) ?? undefined,
          sort: typeof input.sort === 'string' ? input.sort : undefined,
          limit: clampLimit(input.limit),
          depth: Math.min(Number(input.depth) || 0, MAX_DEPTH),
        })
        return {
          totalDocs: res.totalDocs,
          returned: res.docs.length,
          docs: redact(collection, res.docs),
        }
      },
    },

    {
      name: 'count_collection',
      description:
        '只回傳符合條件的文件總數，不回傳內容。要講「有幾筆」時用這個，比 query_collection 省 token 也更準。',
      input_schema: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: [...READABLE_COLLECTIONS] },
          where: { type: 'object' },
        },
        required: ['collection'],
      },
      run: async (input) => {
        const collection = String(input.collection)
        if (!(READABLE_COLLECTIONS as readonly string[]).includes(collection)) {
          throw new Error(`collection "${collection}" 不在唯讀白名單內`)
        }
        const res = await payload.find({
          collection,
          where: (input.where as Record<string, unknown>) ?? undefined,
          limit: 1,
          depth: 0,
        })
        return { totalDocs: res.totalDocs }
      },
    },

    {
      name: 'sales_summary',
      description:
        '統計指定天數內的營收、訂單數、客單價與熱銷商品排行。取消與退款的訂單已排除。',
      input_schema: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: '往回統計幾天，1–180，預設 30' },
          topN: { type: 'integer', description: '熱銷排行取幾名，預設 10' },
        },
        required: [],
      },
      run: async (input) => {
        const days = Math.min(Math.max(Number(input.days) || 30, 1), 180)
        const topN = Math.min(Math.max(Number(input.topN) || 10, 1), 30)
        const since = new Date(Date.now() - days * 86_400_000).toISOString()

        const res = await payload.find({
          collection: 'orders',
          where: {
            and: [
              { createdAt: { greater_than: since } },
              { status: { not_in: ['cancelled', 'refunded'] } },
            ],
          },
          limit: 1000,
          depth: 0,
        })

        let revenue = 0
        const byProduct = new Map<string, { name: string; qty: number; revenue: number }>()

        for (const order of res.docs) {
          revenue += typeof order.total === 'number' ? order.total : 0
          const items = Array.isArray(order.items) ? order.items : []
          for (const raw of items) {
            const item = raw as Record<string, unknown>
            const name = typeof item.productName === 'string' ? item.productName : '(未命名)'
            const qty = typeof item.quantity === 'number' ? item.quantity : 0
            const sub = typeof item.subtotal === 'number' ? item.subtotal : 0
            const prev = byProduct.get(name) ?? { name, qty: 0, revenue: 0 }
            prev.qty += qty
            prev.revenue += sub
            byProduct.set(name, prev)
          }
        }

        const orderCount = res.docs.length
        return {
          windowDays: days,
          orderCount,
          revenue: Math.round(revenue),
          averageOrderValue: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
          truncated: res.totalDocs > res.docs.length,
          topProducts: [...byProduct.values()]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, topN),
        }
      },
    },

    {
      name: 'propose_action',
      description:
        `提出一個待人工核准的行動。可用類型：${ACTION_CATALOG.map((a) => `${a.type}(${a.label}, 風險:${a.risk})`).join('、')}。` +
        '⚠️ 這個工具**不會執行任何事**，只會把提案排進待辦，等 Alan 在後台按下執行才生效。' +
        '所以請放心提案，但每個提案的 summary 一定要寫清楚「按下去會發生什麼」，' +
        'input 的數字必須來自你實際查到的資料，不可以自己編。',
      input_schema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ACTION_CATALOG.map((a) => a.type) },
          summary: { type: 'string', description: '一句話說明按下去會發生什麼（繁體中文）' },
          input: { type: 'object', description: '該行動類型需要的參數' },
          sourceSignalId: { type: 'string', description: '來源訊號 id，例如 inventory.low_stock' },
        },
        required: ['type', 'summary', 'input'],
      },
      run: async (raw) => {
        const actionType = getActionType(String(raw.type))
        if (!actionType) throw new Error(`未知的行動類型：${raw.type}`)

        const input = (raw.input as Record<string, unknown>) ?? {}
        const errors = actionType.validate(input)
        if (errors.length > 0) {
          return { ok: false, errors, hint: '修正參數後再提一次' }
        }

        const preview = await actionType.preview(payload, input)

        const doc = await payload.create({
          collection: 'ops-actions',
          data: {
            summary: String(raw.summary || actionType.label),
            actionType: actionType.id,
            risk: actionType.risk,
            status: 'pending',
            input,
            sourceSignalId: typeof raw.sourceSignalId === 'string' ? raw.sourceSignalId : undefined,
            previewSnapshot: preview,
            adminNote: `由對話提出（操作者 #${actorId}）`,
          },
        })

        return {
          ok: true,
          proposalId: doc.id,
          preview,
          note: '提案已排入待辦，尚未執行。',
        }
      },
    },
  ]
}

export { READABLE_COLLECTIONS }
