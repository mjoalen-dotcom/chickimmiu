import type { Payload, PayloadRequest } from 'payload'

/**
 * App 專屬活動的統一發點入口
 * ═══════════════════════════
 * 對應工單「App 專屬活動：發獎與資料遷移」共通規則 #3 / #4：
 *   #3 發獎必須由後端驗證後執行 —— 呼叫端一律自行查後台設定取金額，
 *      不接受 App 傳入的數量（本函式的 amount 只能來自 app-activity-settings）。
 *   #4 加點與寫入異動紀錄需在同一交易內完成，且確保只加一次。
 *
 * 「只加一次」的兩層保證：
 *   1. 呼叫端的冪等（複合唯一索引 / rewarded 旗標 / claimedMilestones 陣列）
 *   2. 本函式的加值與帳本寫入在同一個 DB 交易內 —— 不會出現「已記錄、但點數未加」
 *      或反之的半套狀態。
 *
 * ⚠️ 為什麼要自己加 customers.points：PointsTransactions 的 afterChange hook 只在
 * `req.payloadAPI !== 'local'`（即從 REST/GraphQL 進來）時才同步餘額；我們走的是
 * local API，hook 會跳過，所以餘額由這裡負責。這正是規則 #4 那句「若既有機制已同步
 * customers.points，發獎流程就不要再自行加值」要避免的重複加值 —— 兩邊只會有一邊生效。
 */

type LooseRecord = Record<string, unknown>

/** 本次工單新增的 source（見工單第五章；不可併進既有的 kim_blog_read / review） */
export type AppActivitySource =
  | 'travel_article_read'
  | 'step_activity'
  | 'step_activity_weekly'
  | 'product_review'
  | 'product_review_featured'

export interface AwardResult {
  awarded: number
  /** 發放後的會員點數餘額 */
  balance: number
}

/**
 * 發點 + 寫帳本（同一交易）。amount <= 0 時不寫任何東西，直接回目前餘額。
 *
 * @param existingTransactionID 呼叫端已開交易時傳入 —— 發獎與「建立領取紀錄」
 *        會被包在同一個交易裡，任一步失敗全部回滾（工單要求的原子性）。
 */
export async function awardActivityPoints(
  payload: Payload,
  args: {
    userId: string | number
    amount: number
    source: AppActivitySource
    description: string
    existingTransactionID?: string | number
  },
): Promise<AwardResult> {
  const amount = Math.max(0, Math.floor(Number(args.amount) || 0))

  const readBalance = async (req?: Partial<PayloadRequest>): Promise<number> => {
    const doc = (await payload.findByID({
      collection: 'customers',
      id: args.userId,
      depth: 0,
      overrideAccess: true,
      ...(req ? { req: req as PayloadRequest } : {}),
    })) as unknown as LooseRecord
    return Number(doc?.points ?? 0) || 0
  }

  if (amount === 0) {
    return { awarded: 0, balance: await readBalance() }
  }

  const ownTransaction = args.existingTransactionID === undefined
  const transactionID = ownTransaction
    ? await payload.db.beginTransaction()
    : args.existingTransactionID

  if (transactionID == null) {
    // 資料庫不支援/無法開交易時不硬闖 —— 寧可不發也不要留下半套帳
    throw new Error('無法建立資料庫交易，發獎中止')
  }

  const req = { transactionID } as Partial<PayloadRequest>

  try {
    const current = await readBalance(req)
    const next = current + amount

    await payload.create({
      collection: 'points-transactions',
      data: {
        user: args.userId,
        type: 'earn',
        amount,
        balance: next,
        source: args.source,
        description: args.description,
      } as never,
      overrideAccess: true,
      req: req as PayloadRequest,
    })

    await payload.update({
      collection: 'customers',
      id: args.userId,
      data: { points: next } as never,
      overrideAccess: true,
      req: req as PayloadRequest,
    })

    if (ownTransaction) await payload.db.commitTransaction(transactionID)
    return { awarded: amount, balance: next }
  } catch (err) {
    if (ownTransaction) await payload.db.rollbackTransaction(transactionID)
    throw err
  }
}
