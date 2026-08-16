import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/account/wallet
 * ───────────────────────
 * 回傳登入會員的：購物金 / 儲值金餘額 + 帳本流水 + 退現申請清單。
 * 全程以 cookie 驗證的會員為界。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const fresh = (await payload
      .findByID({ collection: 'customers', id: user.id, depth: 0 })
      .catch(() => null)) as unknown as Record<string, unknown> | null

    const balances = {
      shoppingCredit: Number(fresh?.shoppingCredit) || 0,
      storedValue: Number(fresh?.storedValueBalance) || 0,
    }

    const [txnRes, wdRes] = await Promise.all([
      payload.find({
        collection: 'wallet-transactions',
        where: { user: { equals: user.id } },
        sort: '-createdAt',
        limit: 100,
        depth: 0,
      }),
      payload.find({
        collection: 'wallet-withdrawals',
        where: { user: { equals: user.id } },
        sort: '-createdAt',
        limit: 50,
        depth: 0,
      }),
    ])

    const transactions = (txnRes.docs as unknown as Array<Record<string, unknown>>).map((d) => ({
      id: String(d.id),
      wallet: d.wallet,
      type: d.type,
      amount: Number(d.amount) || 0,
      balance: d.balance == null ? null : Number(d.balance),
      source: d.source,
      description: d.description ?? '',
      createdAt: d.createdAt,
    }))

    const withdrawals = (wdRes.docs as unknown as Array<Record<string, unknown>>).map((d) => {
      const bank = (d.bankInfo as Record<string, unknown>) || {}
      const acct = String(bank.accountNumber || '')
      return {
        id: String(d.id),
        amount: Number(d.amount) || 0,
        status: d.status,
        bankName: bank.bankName ?? '',
        accountTail: acct ? acct.slice(-4) : '',
        createdAt: d.createdAt,
        processedAt: d.processedAt ?? null,
      }
    })

    return NextResponse.json({ success: true, balances, transactions, withdrawals })
  } catch (error) {
    console.error('[account/wallet GET] error:', error)
    return NextResponse.json({ success: false, error: '讀取失敗' }, { status: 500 })
  }
}
