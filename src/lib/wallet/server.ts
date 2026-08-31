import type { Payload } from 'payload'

/**
 * 錢包（購物金 + 儲值金）server 端工具
 * ────────────────────────────────────
 * - recordWalletTxn：只寫帳本（不動餘額）。用在「呼叫端已自行更新餘額」的既有寫入點
 *   （註冊禮 / 兌換 / 遊戲），傳入算好的 balanceOverride 即可。
 * - adjustWallet：更新餘額 + 寫帳本（atomic-ish）。用在新流程（儲值金退現 hold / 退回）。
 *
 * 兩者都走 payload.local API（overrideAccess），WalletTransactions 的同步 hook 會因
 * req.payloadAPI === 'local' 而跳過，避免重複加扣。
 */

export type WalletKind = 'shoppingCredit' | 'storedValue'

export const WALLET_FIELD: Record<WalletKind, 'shoppingCredit' | 'storedValueBalance'> = {
  shoppingCredit: 'shoppingCredit',
  storedValue: 'storedValueBalance',
}

export interface WalletTxnInput {
  userId: string | number
  wallet: WalletKind
  amount: number // 正=入帳、負=出帳
  type: string
  source: string
  description?: string
  relatedOrder?: string | number
  relatedWithdrawal?: string | number
  /** 已知的異動後餘額；省一次查詢。recordWalletTxn 專用。 */
  balanceOverride?: number
}

/** 只寫帳本一筆（不動餘額）。呼叫端須已自行更新對應餘額。 */
export async function recordWalletTxn(payload: Payload, input: WalletTxnInput): Promise<void> {
  let balance = input.balanceOverride
  if (balance == null) {
    const user = (await payload.findByID({
      collection: 'customers',
      id: input.userId,
      depth: 0,
    })) as unknown as Record<string, unknown>
    balance = Number(user?.[WALLET_FIELD[input.wallet]]) || 0
  }
  await payload.create({
    collection: 'wallet-transactions',
    data: {
      user: input.userId,
      wallet: input.wallet,
      amount: input.amount,
      type: input.type,
      source: input.source,
      description: input.description,
      relatedOrder: input.relatedOrder,
      relatedWithdrawal: input.relatedWithdrawal,
      balance: Math.max(0, balance),
    } as never,
    overrideAccess: true,
  })
}

export interface AdjustResult {
  ok: boolean
  balance: number
  error?: string
}

/** 更新餘額 + 寫帳本。amount 正=入帳、負=出帳。預設不允許扣到負（allowNegative 放寬）。 */
export async function adjustWallet(
  payload: Payload,
  input: Omit<WalletTxnInput, 'balanceOverride'> & { allowNegative?: boolean },
): Promise<AdjustResult> {
  const field = WALLET_FIELD[input.wallet]
  const user = (await payload.findByID({
    collection: 'customers',
    id: input.userId,
    depth: 0,
  })) as unknown as Record<string, unknown>
  const current = Number(user?.[field]) || 0
  const next = current + input.amount
  if (next < 0 && !input.allowNegative) {
    return { ok: false, balance: current, error: '餘額不足' }
  }
  const newBal = Math.max(0, next)
  await payload.update({
    collection: 'customers',
    id: input.userId,
    data: { [field]: newBal } as never,
    overrideAccess: true,
  })
  await recordWalletTxn(payload, { ...input, balanceOverride: newBal })
  return { ok: true, balance: newBal }
}
