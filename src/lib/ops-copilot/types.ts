/**
 * Ops Copilot — 共用型別
 * ─────────────────────────────────────
 * CHIC KIM & MIU 營運 AI 助理
 *
 * 設計原則（重要，改動前先讀）：
 *
 * 1. **數字由程式算，不由 LLM 算。**
 *    signals.ts 是純 TypeScript 掃描器，直接查 Payload；LLM 只負責「排序 + 講人話」。
 *    任何顯示給 Alan 的數字都必須能追回某個 Signal 的 metrics，不能是模型生成的。
 *    這是我們跟「叫 LLM 直接查資料庫」那種做法最大的差別 —— 它會幻覺，我們不會。
 *
 * 2. **L2 授權模型：AI 提案，人核准。**
 *    LLM 永遠只能產生 ProposedAction（寫進 ops-actions collection，status='pending'）。
 *    真正的寫入只發生在 admin 對 /api/ops-copilot/actions/[id]/execute 發 POST 之後。
 *    LLM 拿不到任何 execute 路徑，chat 的工具全部是唯讀。
 *
 * 3. **護城河在 schema，不在模型。**
 *    Shoplazza Athena 只能碰它自己 schema 有的欄位。我們的訊號掃描器可以碰
 *    StyleVotes（穿搭投票）、CreditScoreHistory（信用分數）、CompetitorPriceRecords（競品比價）、
 *    WalletTransactions（可提領錢包）—— 這些欄位在任何開店 SaaS 上都不存在。
 *    新增掃描器時優先挑「別人沒有的表」。
 */

/** 訊號嚴重度 — 決定日報排序與顏色 */
export type SignalSeverity = 'critical' | 'warning' | 'info'

/** 訊號分類 — 對應日報的分區 */
export type SignalCategory =
  | 'inventory' // 庫存 / 補貨
  | 'pricing' // 定價 / 競品
  | 'orders' // 訂單 / 履約 / 發票
  | 'members' // 會員 / 回購 / 流失
  | 'engagement' // 互動玩法（穿搭投票 / 卡牌 / 遊戲）— 我們獨有
  | 'risk' // 風險（信用分數 / 惡意退貨 / 提領）
  | 'marketing' // 行銷成效

/**
 * 一則營運訊號。
 * metrics 內的每個數字都來自實際查詢，會原樣塞進 LLM prompt 當事實依據。
 */
export interface OpsSignal {
  /** 穩定 id，格式 `<category>.<rule>`，同一規則跨日相同（給去重與趨勢用） */
  id: string
  category: SignalCategory
  severity: SignalSeverity
  /** 一行標題（人看的） */
  title: string
  /** 支撐這個訊號的實際數字 —— 唯一可信的數值來源 */
  metrics: Record<string, string | number>
  /** 相關實體，讓前端可以直接連到後台 */
  entities?: Array<{ collection: string; id: string | number; label: string }>
  /** 這則訊號建議的行動（尚未寫入 DB，由 briefing 決定要不要落地成 ProposedAction） */
  suggestedActions?: ActionDraft[]
}

/** 行動風險等級 — L2 全部需要人工核准，但高風險額外標紅並要求二次確認 */
export type ActionRisk = 'low' | 'high'

/** LLM / 掃描器產出的行動草稿（尚未寫入 ops-actions） */
export interface ActionDraft {
  type: ActionTypeId
  /** 給人看的一句話：「把針織背心從 $1,280 調到 $1,180」 */
  summary: string
  /** 執行參數，會被對應 ActionType 的 validate() 檢查 */
  input: Record<string, unknown>
}

/** 已註冊的行動類型 id */
export type ActionTypeId =
  | 'create_purchase_order' // 建立進貨單（草稿）
  | 'adjust_product_price' // 調整商品售價
  | 'create_coupon' // 建立折扣碼
  | 'send_member_dm' // 對指定會員寄個人化 DM
  | 'flag_credit_review' // 標記會員信用分數需人工複查

/**
 * 行動類型定義。
 * preview() 必須是**零副作用**的：它只讀資料、算出「執行後會變成什麼」給人看。
 * execute() 才真的寫。兩者分離是 L2 的核心保證。
 */
export interface ActionType {
  id: ActionTypeId
  label: string
  risk: ActionRisk
  /** 參數檢查；回傳錯誤訊息陣列，空陣列 = 通過 */
  validate: (input: Record<string, unknown>) => string[]
  /** 零副作用預覽：回傳 before/after 對照 */
  preview: (
    payload: PayloadLike,
    input: Record<string, unknown>,
  ) => Promise<ActionPreview>
  /** 真正執行；只會被 execute API 在 admin 認證後呼叫 */
  execute: (
    payload: PayloadLike,
    input: Record<string, unknown>,
    actorId: string | number,
  ) => Promise<ActionResult>
}

export interface ActionPreview {
  /** 標題行 */
  headline: string
  /** 逐項 before → after */
  changes: Array<{ field: string; before: string; after: string }>
  /** 阻擋執行的原因（非空 = 不可執行） */
  blockers?: string[]
}

export interface ActionResult {
  ok: boolean
  message: string
  /** 執行後受影響的實體，寫進 audit log */
  affected?: Array<{ collection: string; id: string | number }>
}

/** 日報 */
export interface OpsBriefing {
  generatedAt: string
  /** LLM 產出的三句話摘要（結論先行）；LLM 不可用時退回程式產生的版本 */
  headline: string
  signals: OpsSignal[]
  /** 已落地成 ops-actions 的提案 id（前端可直接一鍵核准） */
  proposedActionIds: Array<string | number>
  /** 這份日報是不是靠 fallback 產的（LLM 掛了）— 前端要標示 */
  degraded: boolean
}

/**
 * Payload local API 的最小介面。
 * 用結構型別而非 import Payload 型別，避免 lib 層被 payload 的 generated types 綁死
 * （generated types 每次 generate:types 都會變，lib 不該跟著漂）。
 */
export interface PayloadLike {
  find: (args: Record<string, unknown>) => Promise<{
    docs: Record<string, unknown>[]
    totalDocs: number
  }>
  findByID: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
}
