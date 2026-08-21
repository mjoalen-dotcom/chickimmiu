/**
 * Ops Copilot — 行動註冊表
 * ─────────────────────────────────────
 * L2 授權模型的執行層。鐵律：
 *
 *   preview() 零副作用 —— 只讀資料、算出「按下去會變成什麼」。
 *   execute() 才寫入 —— 而且只會被 /api/ops-copilot/actions/[id]/execute
 *                       在 admin 認證通過後呼叫。
 *
 * LLM 拿不到這個檔案裡的任何東西。它只能產生 ActionDraft（type + input），
 * 由 briefing.ts 寫進 ops-actions collection 排隊等人核准。
 * 「AI 自己把價格改掉了」在架構上不可能發生。
 *
 * 新增行動時：
 *   1. validate() 要擋掉所有畸形輸入（LLM 產的 input 一律視為不可信）
 *   2. preview() 不准呼叫任何 create/update
 *   3. 動到錢、庫存、對外發送的一律 risk:'high'（前端會要求二次確認）
 */

import type {
  ActionResult,
  ActionType,
  ActionTypeId,
  PayloadLike,
} from './types'

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** id 可能是 number（SQLite autoincrement）或 string。原型別要保留 —— String(id) 在 relationship 寫入時會被判 invalid。 */
function asId(v: unknown): string | number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    return Number.isInteger(n) ? n : v
  }
  return null
}

// ── 1. 建立進貨單草稿 ───────────────────────────────────

const createPurchaseOrder: ActionType = {
  id: 'create_purchase_order',
  label: '建立進貨單草稿',
  // draft 狀態不會動到庫存（庫存只在 status→received 時才套用），所以是低風險。
  risk: 'low',
  validate: (input) => {
    const errs: string[] = []
    if (asId(input.productId) === null) errs.push('缺少 productId')
    const qty = num(input.quantity)
    if (qty <= 0) errs.push('quantity 必須大於 0')
    if (qty > 5000) errs.push('quantity 超過 5000，請人工建單')
    return errs
  },
  preview: async (payload, input) => {
    const product = await payload.findByID({
      collection: 'products',
      id: asId(input.productId)!,
      depth: 0,
    })
    if (!product) {
      return { headline: '找不到商品', changes: [], blockers: ['商品已不存在'] }
    }
    const qty = num(input.quantity)
    const unitCost = num(product.cost)
    return {
      headline: `建立進貨單草稿：${str(product.name)} × ${qty}`,
      changes: [
        { field: '進貨單', before: '（不存在）', after: `草稿 1 張，${qty} 件` },
        { field: '現有庫存', before: String(num(product.stock)), after: `${num(product.stock)}（草稿不動庫存，收貨時才加）` },
        {
          field: '預估採購成本',
          before: '—',
          after: unitCost > 0 ? `$${unitCost * qty}（單價 $${unitCost}）` : '未設定成本，需人工填',
        },
      ],
    }
  },
  execute: async (payload, input): Promise<ActionResult> => {
    const productId = asId(input.productId)!
    const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
    if (!product) return { ok: false, message: '商品已不存在' }

    const qty = num(input.quantity)
    const unitCost = num(product.cost)
    // supplierName 在 Products 的 `sourcing` group 底下（後台 sidebar 的「採購來源資訊」），
    // 不是 top-level 欄位 —— 直接讀 product.supplierName 會永遠拿到 undefined。
    const sourcing = product.sourcing as Record<string, unknown> | undefined
    const doc = await payload.create({
      collection: 'purchase-orders',
      data: {
        poNumber: `PO-AI-${Date.now()}`,
        status: 'draft',
        supplierName: str(sourcing?.supplierName) || '（待填）',
        note: '由營運 AI 助理建立，請確認供應商與到貨日後再改為「已下單」。',
        items: [
          {
            product: productId,
            sku: str(product.productSku) || `P${productId}`,
            quantity: qty,
            unitCost,
            totalCost: unitCost * qty,
          },
        ],
      },
    })
    return {
      ok: true,
      message: `已建立進貨單草稿 ${str(doc.poNumber)}（${qty} 件）`,
      affected: [{ collection: 'purchase-orders', id: doc.id as string | number }],
    }
  },
}

// ── 2. 調整商品售價 ─────────────────────────────────────

const MIN_MARGIN_MULTIPLIER = 1.3

const adjustProductPrice: ActionType = {
  id: 'adjust_product_price',
  label: '調整商品售價',
  risk: 'high',
  validate: (input) => {
    const errs: string[] = []
    if (asId(input.productId) === null) errs.push('缺少 productId')
    if (num(input.salePrice) <= 0) errs.push('salePrice 必須大於 0')
    return errs
  },
  preview: async (payload, input) => {
    const product = await payload.findByID({
      collection: 'products',
      id: asId(input.productId)!,
      depth: 0,
    })
    if (!product) {
      return { headline: '找不到商品', changes: [], blockers: ['商品已不存在'] }
    }

    const current = num(product.salePrice) || num(product.price)
    const next = num(input.salePrice)
    const cost = num(product.cost)
    const blockers: string[] = []

    // 熔斷 1：單次調價超過 20% 一律擋下，改人工。避免 LLM 少寫一位數直接把價格砍掉九成。
    if (current > 0 && Math.abs(next - current) / current > 0.2) {
      blockers.push(
        `單次調價幅度 ${Math.round((Math.abs(next - current) / current) * 100)}% 超過 20% 上限，請人工改`,
      )
    }
    // 熔斷 2：不得低於成本 × 1.3
    if (cost > 0 && next < cost * MIN_MARGIN_MULTIPLIER) {
      blockers.push(`售價 $${next} 低於成本 $${cost} × ${MIN_MARGIN_MULTIPLIER} 底線`)
    }

    const marginPct = cost > 0 ? Math.round(((next - cost) / next) * 1000) / 10 : null

    return {
      headline: `${str(product.name)} 調價 $${current} → $${next}`,
      changes: [
        { field: '特價（salePrice）', before: current > 0 ? `$${current}` : '（未設定）', after: `$${next}` },
        { field: '原價（price）', before: `$${num(product.price)}`, after: `$${num(product.price)}（不變）` },
        {
          field: '毛利率',
          before: cost > 0 && current > 0 ? `${Math.round(((current - cost) / current) * 1000) / 10}%` : '—',
          after: marginPct === null ? '未設定成本，無法計算' : `${marginPct}%`,
        },
      ],
      blockers: blockers.length ? blockers : undefined,
    }
  },
  execute: async (payload, input): Promise<ActionResult> => {
    const productId = asId(input.productId)!
    const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
    if (!product) return { ok: false, message: '商品已不存在' }

    const current = num(product.salePrice) || num(product.price)
    const next = num(input.salePrice)
    const cost = num(product.cost)

    // 熔斷在 execute 再檢一次 —— preview 到核准之間可能隔了幾小時，成本或原價已被改過。
    if (current > 0 && Math.abs(next - current) / current > 0.2) {
      return { ok: false, message: `調價幅度超過 20% 上限，已攔截（現價 $${current} → $${next}）` }
    }
    if (cost > 0 && next < cost * MIN_MARGIN_MULTIPLIER) {
      return { ok: false, message: `售價低於成本 × ${MIN_MARGIN_MULTIPLIER} 底線，已攔截` }
    }

    await payload.update({
      collection: 'products',
      id: productId,
      data: { salePrice: next },
    })
    return {
      ok: true,
      message: `${str(product.name)} 售價已由 $${current} 調為 $${next}`,
      affected: [{ collection: 'products', id: productId }],
    }
  },
}

// ── 3. 建立折扣碼 ───────────────────────────────────────

const createCoupon: ActionType = {
  id: 'create_coupon',
  label: '建立折扣碼',
  risk: 'high',
  validate: (input) => {
    const errs: string[] = []
    const code = str(input.code)
    if (!/^[A-Z0-9_-]{4,24}$/.test(code)) errs.push('code 需為 4–24 碼大寫英數字')
    const type = str(input.discountType)
    if (!['percentage', 'fixed'].includes(type)) errs.push('discountType 需為 percentage 或 fixed')
    const value = num(input.discountValue)
    if (value <= 0) errs.push('discountValue 必須大於 0')
    if (type === 'percentage' && value > 50) errs.push('折扣百分比超過 50%，請人工建立')
    return errs
  },
  preview: async (payload, input) => {
    const dupe = await payload.find({
      collection: 'coupons',
      where: { code: { equals: str(input.code) } },
      limit: 1,
      depth: 0,
    })
    const type = str(input.discountType)
    const value = num(input.discountValue)
    return {
      headline: `建立折扣碼 ${str(input.code)}`,
      changes: [
        { field: '折扣', before: '（不存在）', after: type === 'percentage' ? `${value}% off` : `折抵 $${value}` },
        { field: '低消門檻', before: '—', after: num(input.minOrderAmount) > 0 ? `$${num(input.minOrderAmount)}` : '無' },
        { field: '總使用次數上限', before: '—', after: num(input.usageLimit) > 0 ? String(num(input.usageLimit)) : '不限' },
        { field: '啟用狀態', before: '—', after: '建立後為「未啟用」，需人工開啟' },
      ],
      blockers: dupe.docs.length > 0 ? [`折扣碼 ${str(input.code)} 已存在`] : undefined,
    }
  },
  execute: async (payload, input): Promise<ActionResult> => {
    const dupe = await payload.find({
      collection: 'coupons',
      where: { code: { equals: str(input.code) } },
      limit: 1,
      depth: 0,
    })
    if (dupe.docs.length > 0) return { ok: false, message: '折扣碼已存在' }

    const doc = await payload.create({
      collection: 'coupons',
      data: {
        code: str(input.code),
        name: str(input.name) || str(input.code),
        description: '由營運 AI 助理建立，確認條件後請手動啟用。',
        discountType: str(input.discountType),
        discountValue: num(input.discountValue),
        minOrderAmount: num(input.minOrderAmount) || undefined,
        usageLimit: num(input.usageLimit) || undefined,
        // 一律以未啟用建立：核准「建立」不等於核准「立刻對外生效」。
        isActive: false,
      },
    })
    return {
      ok: true,
      message: `折扣碼 ${str(input.code)} 已建立（未啟用，請至折扣碼頁開啟）`,
      affected: [{ collection: 'coupons', id: doc.id as string | number }],
    }
  },
}

// ── 4. 寄送個人化 DM ────────────────────────────────────

const sendMemberDm: ActionType = {
  id: 'send_member_dm',
  label: '寄送個人化 DM',
  // 對外發送，Alan 硬規則 4：核准這個 action 就是那一次的明確授權。
  risk: 'high',
  validate: (input) => {
    const errs: string[] = []
    if (asId(input.userId) === null) errs.push('缺少 userId')
    if (!str(input.subject).trim()) errs.push('缺少 subject')
    if (!str(input.body).trim()) errs.push('缺少 body')
    if (str(input.body).length > 4000) errs.push('body 超過 4000 字')
    return errs
  },
  preview: async (payload, input) => {
    const user = await payload.findByID({
      collection: 'customers',
      id: asId(input.userId)!,
      depth: 0,
    })
    if (!user) return { headline: '找不到會員', changes: [], blockers: ['會員已不存在'] }

    const blockers: string[] = []
    if (user.emailSubscribed === false) blockers.push('該會員已退訂行銷信，不得寄送')
    if (user.isBlacklisted === true) blockers.push('該會員在黑名單中')
    if (!str(user.email)) blockers.push('該會員沒有 email')

    return {
      headline: `寄 DM 給 ${str(user.name) || str(user.email)}`,
      changes: [
        { field: '收件者', before: '—', after: str(user.email) },
        { field: '主旨', before: '—', after: str(input.subject) },
        { field: '內文', before: '—', after: str(input.body) },
      ],
      blockers: blockers.length ? blockers : undefined,
    }
  },
  execute: async (payload, input): Promise<ActionResult> => {
    const userId = asId(input.userId)!
    const user = await payload.findByID({ collection: 'customers', id: userId, depth: 0 })
    if (!user) return { ok: false, message: '會員已不存在' }
    if (user.emailSubscribed === false) return { ok: false, message: '會員已退訂行銷信，已攔截' }
    if (user.isBlacklisted === true) return { ok: false, message: '會員在黑名單中，已攔截' }

    // 動態 import：channelDispatcher 會拉進整個行銷模組，不該在 lib 載入時就付這個成本。
    const { sendMessage } = await import('../marketing/channelDispatcher')
    const result = await sendMessage(String(userId), 'email', {
      subject: str(input.subject),
      body: str(input.body),
    })

    return {
      ok: result.success,
      message: result.success
        ? `已寄給 ${str(user.email)}`
        : `寄送失敗：${result.error ?? '未知錯誤'}`,
      affected: [{ collection: 'customers', id: userId }],
    }
  },
}

// ── 5. 標記信用複查 ─────────────────────────────────────

const flagCreditReview: ActionType = {
  id: 'flag_credit_review',
  label: '標記會員需信用複查',
  // 只加註記與標籤，不動 creditScore / creditStatus（那會影響結帳與退貨判定邏輯）。
  risk: 'low',
  validate: (input) => {
    const errs: string[] = []
    if (asId(input.userId) === null) errs.push('缺少 userId')
    if (!str(input.reason).trim()) errs.push('缺少 reason')
    return errs
  },
  preview: async (payload, input) => {
    const user = await payload.findByID({
      collection: 'customers',
      id: asId(input.userId)!,
      depth: 0,
    })
    if (!user) return { headline: '找不到會員', changes: [], blockers: ['會員已不存在'] }
    const existing = str(user.crmNote)
    return {
      headline: `標記 ${str(user.name) || str(user.email)} 需信用複查`,
      changes: [
        { field: 'CRM 備註', before: existing || '（空）', after: `${existing ? existing + '\n' : ''}[AI 標記] ${str(input.reason)}` },
        { field: '信用分數', before: String(num(user.creditScore)), after: `${num(user.creditScore)}（不變 — 只加註記，不改分數）` },
      ],
    }
  },
  execute: async (payload, input): Promise<ActionResult> => {
    const userId = asId(input.userId)!
    const user = await payload.findByID({ collection: 'customers', id: userId, depth: 0 })
    if (!user) return { ok: false, message: '會員已不存在' }

    const stamp = new Date().toISOString().slice(0, 10)
    const existing = str(user.crmNote)
    const line = `[AI 標記 ${stamp}] ${str(input.reason)}`

    const tags = Array.isArray(user.tags) ? (user.tags as Record<string, unknown>[]) : []
    const hasTag = tags.some((t) => str(t.tag) === '信用複查')

    await payload.update({
      collection: 'customers',
      id: userId,
      data: {
        crmNote: existing ? `${existing}\n${line}` : line,
        tags: hasTag ? tags : [...tags, { tag: '信用複查' }],
      },
    })
    return {
      ok: true,
      message: `已標記 ${str(user.name) || str(user.email)}`,
      affected: [{ collection: 'customers', id: userId }],
    }
  },
}

// ── 註冊表 ──────────────────────────────────────────────

export const ACTION_TYPES: Record<ActionTypeId, ActionType> = {
  create_purchase_order: createPurchaseOrder,
  adjust_product_price: adjustProductPrice,
  create_coupon: createCoupon,
  send_member_dm: sendMemberDm,
  flag_credit_review: flagCreditReview,
}

export function getActionType(id: string): ActionType | null {
  return (ACTION_TYPES as Record<string, ActionType>)[id] ?? null
}

/** 給 LLM 看的行動清單 —— 只暴露 id / label / risk / 參數說明，不暴露實作。 */
export const ACTION_CATALOG = Object.values(ACTION_TYPES).map((a) => ({
  type: a.id,
  label: a.label,
  risk: a.risk,
}))
