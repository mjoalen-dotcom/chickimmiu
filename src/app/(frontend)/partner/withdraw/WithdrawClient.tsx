'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, Building2, AlertCircle, CheckCircle, Clock } from 'lucide-react'

interface BankInfo {
  bankName: string
  branchName: string
  accountNumber: string
  accountHolder: string
}

interface HistoryItem {
  id: string
  date: string
  amount: number
  status: string
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: '待審核', color: 'text-amber-600 bg-amber-50', icon: Clock },
  approved: { label: '已核准', color: 'text-blue-600 bg-blue-50', icon: CheckCircle },
  paid: { label: '已撥款', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  rejected: { label: '已拒絕', color: 'text-red-500 bg-red-50', icon: AlertCircle },
}

export function WithdrawClient({
  withdrawableAmount,
  bankInfo: initialBankInfo,
  history,
  affiliateId,
}: {
  withdrawableAmount: number
  bankInfo: BankInfo
  history: HistoryItem[]
  affiliateId: number
}) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [bankInfo, setBankInfo] = useState(initialBankInfo)
  const [savingBank, setSavingBank] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSaveBankInfo = async () => {
    setSavingBank(true)
    setBankSaved(false)
    try {
      const res = await fetch(`/api/affiliates/${affiliateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bankInfo }),
      })
      if (res.ok) {
        setBankSaved(true)
        setTimeout(() => setBankSaved(false), 2000)
      }
    } finally {
      setSavingBank(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('請輸入有效金額')
      return
    }
    if (numAmount > withdrawableAmount) {
      setError('申請金額超過可提領餘額')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/partner/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: numAmount }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(
          data.error === 'insufficient_balance' ? '申請金額超過可提領餘額' : '申請失敗，請稍後再試',
        )
        return
      }
      setSuccess(true)
      setAmount('')
      router.refresh()
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-serif">申請提款</h2>

      <div className="bg-gradient-to-br from-gold-500/10 to-cream-100 rounded-2xl border border-gold-500/20 p-6">
        <p className="text-xs text-muted-foreground">可提領</p>
        <p className="text-xl font-medium text-gold-600 mt-1">
          NT$ {withdrawableAmount.toLocaleString()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Wallet size={16} className="text-gold-500" />
          提款金額
        </h3>
        <input
          type="number"
          min={1}
          max={withdrawableAmount}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="請輸入提款金額"
          className="w-full px-4 py-2.5 border border-cream-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {success && <p className="text-xs text-green-600">提款申請已送出，請等候審核。</p>}
        <button
          type="submit"
          disabled={submitting || withdrawableAmount <= 0}
          className="px-6 py-2.5 bg-foreground text-cream-50 rounded-full text-sm hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '送出中...' : '送出申請'}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Building2 size={16} className="text-gold-500" />
          銀行帳戶（提款用）
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={bankInfo.bankName}
            onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
            placeholder="銀行名稱"
            className="px-3 py-2 border border-cream-200 rounded-lg text-sm"
          />
          <input
            value={bankInfo.branchName}
            onChange={(e) => setBankInfo({ ...bankInfo, branchName: e.target.value })}
            placeholder="分行名稱"
            className="px-3 py-2 border border-cream-200 rounded-lg text-sm"
          />
          <input
            value={bankInfo.accountNumber}
            onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
            placeholder="帳號"
            className="px-3 py-2 border border-cream-200 rounded-lg text-sm"
          />
          <input
            value={bankInfo.accountHolder}
            onChange={(e) => setBankInfo({ ...bankInfo, accountHolder: e.target.value })}
            placeholder="戶名"
            className="px-3 py-2 border border-cream-200 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveBankInfo}
            disabled={savingBank}
            className="px-4 py-2 border border-cream-200 rounded-full text-xs hover:bg-cream-50 disabled:opacity-40 transition-colors"
          >
            {savingBank ? '儲存中...' : '儲存帳戶資訊'}
          </button>
          {bankSaved && <span className="text-xs text-green-600">已儲存</span>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4">提款紀錄</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">尚無提款紀錄</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => {
              const meta = STATUS_LABEL[h.status] || STATUS_LABEL.pending
              const Icon = meta.icon
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between py-3 border-b border-cream-100 last:border-0"
                >
                  <div>
                    <p className="text-sm">NT$ {h.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{h.date}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.color}`}>
                    <Icon size={10} />
                    {meta.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
