'use client'

import { useState, type FormEvent } from 'react'
import { Wallet, Gift, Banknote, ArrowDownToLine, X } from 'lucide-react'

interface Txn {
  id: string
  wallet: string
  type: string
  amount: number
  balance: number | null
  source: string
  description: string
  createdAt: string
}
interface Withdrawal {
  id: string
  amount: number
  status: string
  bankName: string
  accountTail: string
  createdAt: string
  processedAt: string | null
}
interface Balances {
  shoppingCredit: number
  storedValue: number
}

const WALLET_LABEL: Record<string, string> = { shoppingCredit: '購物金', storedValue: '儲值金' }
const TYPE_LABEL: Record<string, string> = {
  earn: '入帳',
  spend: '消費',
  redeem: '兌換存入',
  refund: '退款入帳',
  withdraw: '退現扣除',
  withdraw_refund: '退現退回',
  expire: '過期',
  admin_adjust: '管理員調整',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '待處理',
  approved: '已核准',
  paid: '已匯款',
  rejected: '已拒絕',
  cancelled: '已取消',
}
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  paid: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
  cancelled: 'bg-cream-100 text-muted-foreground',
}

const nt = (n: number) => `NT$ ${n.toLocaleString()}`
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString('zh-TW') : '')

export function WalletClient({
  initialBalances,
  initialTransactions,
  initialWithdrawals,
}: {
  initialBalances: Balances
  initialTransactions: Txn[]
  initialWithdrawals: Withdrawal[]
}) {
  const [balances, setBalances] = useState(initialBalances)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals)

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({
    amount: '',
    bankName: '',
    bankCode: '',
    accountName: '',
    accountNumber: '',
    note: '',
  })

  const refresh = async () => {
    try {
      const res = await fetch('/api/account/wallet', { credentials: 'include' })
      if (!res.ok) return
      const body = await res.json()
      if (body?.success) {
        setBalances(body.balances)
        setTransactions(body.transactions)
        setWithdrawals(body.withdrawals)
      }
    } catch {
      /* ignore */
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setMsg(null)
    const amount = Math.floor(Number(form.amount))
    if (!Number.isFinite(amount) || amount < 100) {
      setMsg({ kind: 'err', text: '最低退現金額為 NT$ 100' })
      return
    }
    if (amount > balances.storedValue) {
      setMsg({ kind: 'err', text: '儲值金餘額不足' })
      return
    }
    if (!form.bankName.trim() || !form.accountName.trim() || !form.accountNumber.trim()) {
      setMsg({ kind: 'err', text: '請填寫完整收款帳戶' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/account/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, amount }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.success) {
        setMsg({ kind: 'ok', text: '退現申請已送出，儲值金已先行扣住，待客服處理。' })
        setForm({ amount: '', bankName: '', bankCode: '', accountName: '', accountNumber: '', note: '' })
        setShowForm(false)
        await refresh()
      } else {
        setMsg({ kind: 'err', text: body?.error || '申請失敗' })
      }
    } catch {
      setMsg({ kind: 'err', text: '網路異常，請稍後再試' })
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      const res = await fetch(`/api/account/wallet/withdraw?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.success) {
        setMsg({ kind: 'ok', text: '已取消，儲值金已退回。' })
        await refresh()
      } else {
        setMsg({ kind: 'err', text: body?.error || '取消失敗' })
      }
    } catch {
      setMsg({ kind: 'err', text: '網路異常' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif">我的錢包</h2>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-cream-200 p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Gift size={15} /> 購物金（贈送，不可退現）
          </div>
          <p className="text-2xl font-serif text-gold-600">{nt(balances.shoppingCredit)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-cream-200 p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <Banknote size={15} /> 儲值金（可退現）
          </div>
          <p className="text-2xl font-serif text-foreground">{nt(balances.storedValue)}</p>
          <button
            onClick={() => {
              setShowForm((v) => !v)
              setMsg(null)
            }}
            disabled={balances.storedValue < 100}
            className="mt-3 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-foreground text-cream-50 hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            <ArrowDownToLine size={13} />
            申請退現
          </button>
        </div>
      </div>

      {msg && (
        <p
          role="status"
          className={`text-sm ${msg.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}
        >
          {msg.text}
        </p>
      )}

      {/* Withdrawal form */}
      {showForm && (
        <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-cream-200 p-5 space-y-3">
          <p className="text-sm font-medium">儲值金退現申請</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="number" min={100} step={1} required placeholder="退現金額（NT$，最低 100）"
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
            <input
              type="text" required placeholder="銀行名稱"
              value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
            <input
              type="text" placeholder="銀行代碼（選填）"
              value={form.bankCode} onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
            <input
              type="text" required placeholder="戶名"
              value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40"
            />
            <input
              type="text" required placeholder="帳號"
              value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40 sm:col-span-2"
            />
          </div>
          <input
            type="text" placeholder="備註（選填）"
            value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-cream-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <div className="flex gap-2">
            <button
              type="submit" disabled={submitting}
              className="px-6 py-2.5 rounded-full bg-foreground text-cream-50 text-sm hover:bg-foreground/90 transition-colors disabled:opacity-60"
            >
              {submitting ? '送出中…' : '送出申請'}
            </button>
            <button
              type="button" onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-full border border-cream-200 text-sm hover:bg-cream-100 transition-colors"
            >
              取消
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            送出後將先扣住對應儲值金；若申請被取消或未通過，金額會自動退回。
          </p>
        </form>
      )}

      {/* Withdrawal requests */}
      {withdrawals.length > 0 && (
        <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
          <p className="text-sm font-medium px-5 pt-4 pb-2">退現申請</p>
          <div className="divide-y divide-cream-100">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium">{nt(w.amount)}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {w.bankName} {w.accountTail && `••••${w.accountTail}`} · {fmtDate(w.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-1 rounded-full ${STATUS_STYLE[w.status] || ''}`}>
                    {STATUS_LABEL[w.status] || w.status}
                  </span>
                  {w.status === 'pending' && (
                    <button
                      onClick={() => cancel(w.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                      aria-label="取消申請"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction ledger */}
      <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
        <p className="text-sm font-medium px-5 pt-4 pb-2 flex items-center gap-2">
          <Wallet size={15} /> 帳本流水
        </p>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 pb-5">尚無異動紀錄</p>
        ) : (
          <div className="divide-y divide-cream-100">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="min-w-0">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-cream-100 text-muted-foreground mr-2">
                    {WALLET_LABEL[t.wallet] || t.wallet}
                  </span>
                  <span>{t.description || TYPE_LABEL[t.type] || t.type}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{fmtDate(t.createdAt)}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className={t.amount >= 0 ? 'text-green-600' : 'text-red-500'}>
                    {t.amount >= 0 ? '+' : ''}
                    {nt(t.amount).replace('NT$ ', 'NT$ ')}
                  </span>
                  {t.balance != null && (
                    <span className="block text-xs text-muted-foreground">餘 {nt(t.balance)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
