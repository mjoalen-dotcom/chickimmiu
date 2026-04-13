'use client'

import { useState } from 'react'
import { Wallet, Building2, AlertCircle, CheckCircle, Clock } from 'lucide-react'

const BALANCE = {
  withdrawable: 9380,
  pending: 3200,
  totalWithdrawn: 5000,
}

const HISTORY = [
  { id: '1', date: '2024-11-25', amount: 3000, status: 'completed', account: '***1234' },
  { id: '2', date: '2024-10-20', amount: 2000, status: 'completed', account: '***1234' },
  { id: '3', date: '2024-12-01', amount: 4380, status: 'processing', account: '***1234' },
]

export default function WithdrawPage() {
  const [amount, setAmount] = useState('')
  const [bankInfo, setBankInfo] = useState({
    bankName: '中國信託',
    branchName: '忠孝分行',
    accountName: '王小美',
    accountNumber: '****-****-****-1234',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[Partner] Withdraw request:', { amount, bankInfo })
    setAmount('')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-serif">申請提款</h2>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-gold-500/10 to-cream-100 rounded-2xl border border-gold-500/20 p-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">可提領</p>
            <p className="text-xl font-medium text-gold-600 mt-1">
              NT$ {BALANCE.withdrawable.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">待確認</p>
            <p className="text-xl font-medium text-amber-500 mt-1">
              NT$ {BALANCE.pending.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">累計已提</p>
            <p className="text-xl font-medium mt-1">
              NT$ {BALANCE.totalWithdrawn.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Withdraw form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-cream-200 p-6 space-y-5">
        <h3 className="font-medium flex items-center gap-2">
          <Wallet size={16} className="text-gold-500" />
          提款申請
        </h3>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">提款金額 *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="請輸入金額"
            min={100}
            max={BALANCE.withdrawable}
            className="w-full px-4 py-3 rounded-xl border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            最低提款金額 NT$ 100，可提領餘額 NT$ {BALANCE.withdrawable.toLocaleString()}
          </p>
        </div>

        <div className="bg-cream-50 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-medium flex items-center gap-2">
            <Building2 size={14} className="text-gold-500" />
            收款帳戶
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">銀行</span>
              <p className="font-medium">{bankInfo.bankName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">分行</span>
              <p className="font-medium">{bankInfo.branchName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">戶名</span>
              <p className="font-medium">{bankInfo.accountName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">帳號</span>
              <p className="font-medium">{bankInfo.accountNumber}</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            如需更改帳戶資訊，請至後台「帳號設定」修改
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
          <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-700 leading-relaxed">
            提款申請送出後，將由管理員審核。審核通過後，款項將於 3-5 個工作天內匯入您的帳戶。
          </p>
        </div>

        <button
          type="submit"
          disabled={!amount || Number(amount) < 100 || Number(amount) > BALANCE.withdrawable}
          className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          送出提款申請
        </button>
      </form>

      {/* History */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4">提款紀錄</h3>
        <div className="space-y-3">
          {HISTORY.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-3 border-b border-cream-100 last:border-0">
              <div className="flex items-center gap-3">
                {h.status === 'completed' ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <Clock size={16} className="text-amber-500" />
                )}
                <div>
                  <p className="text-sm">NT$ {h.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{h.date} · 帳號 {h.account}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                h.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {h.status === 'completed' ? '已完成' : '處理中'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
