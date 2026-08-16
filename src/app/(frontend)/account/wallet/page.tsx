import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { WalletClient } from './WalletClient'

/**
 * /account/wallet — 購物金 / 儲值金 錢包
 * 餘額 + 帳本流水 + 儲值金退現申請。auth gate 由 account/layout 處理；
 * 本頁再 auth 一次取 user 做查詢（與 /account/points 同模式）。
 */

export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) return null

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
    wallet: String(d.wallet || ''),
    type: String(d.type || ''),
    amount: Number(d.amount) || 0,
    balance: d.balance == null ? null : Number(d.balance),
    source: String(d.source || ''),
    description: String(d.description || ''),
    createdAt: String(d.createdAt || ''),
  }))

  const withdrawals = (wdRes.docs as unknown as Array<Record<string, unknown>>).map((d) => {
    const bank = (d.bankInfo as Record<string, unknown>) || {}
    const acct = String(bank.accountNumber || '')
    return {
      id: String(d.id),
      amount: Number(d.amount) || 0,
      status: String(d.status || ''),
      bankName: String(bank.bankName || ''),
      accountTail: acct ? acct.slice(-4) : '',
      createdAt: String(d.createdAt || ''),
      processedAt: d.processedAt ? String(d.processedAt) : null,
    }
  })

  return (
    <WalletClient
      initialBalances={balances}
      initialTransactions={transactions}
      initialWithdrawals={withdrawals}
    />
  )
}
