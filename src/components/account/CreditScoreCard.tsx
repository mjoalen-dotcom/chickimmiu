'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, TrendingUp, TrendingDown, Info, ChevronDown, Star, AlertTriangle } from 'lucide-react'

interface CreditHistory {
  change: number
  reason: string
  description: string
  createdAt: string
}

interface CreditScoreData {
  score: number
  status: string
  statusLabel: string
  history: CreditHistory[]
}

const STATUS_COLORS: Record<string, { bg: string; bar: string; text: string; icon: string }> = {
  excellent:  { bg: 'bg-emerald-50',  bar: 'bg-emerald-500',  text: 'text-emerald-700',  icon: '✨' },
  normal:     { bg: 'bg-blue-50',     bar: 'bg-blue-500',     text: 'text-blue-700',     icon: '👍' },
  watchlist:  { bg: 'bg-amber-50',    bar: 'bg-amber-500',    text: 'text-amber-700',    icon: '⚠️' },
  warning:    { bg: 'bg-orange-50',   bar: 'bg-orange-500',   text: 'text-orange-700',   icon: '🔶' },
  blacklist:  { bg: 'bg-red-50',      bar: 'bg-red-500',      text: 'text-red-700',      icon: '⛔' },
  suspended:  { bg: 'bg-gray-50',     bar: 'bg-gray-500',     text: 'text-gray-700',     icon: '🚫' },
}

const REASON_LABELS: Record<string, string> = {
  purchase: '購買加分',
  on_time_delivery: '準時收貨',
  good_review: '好評加分',
  photo_review: '好評附圖',
  referral_success: '推薦成功',
  first_register: '首次註冊',
  first_purchase: '首購加分',
  birthday_bonus: '生日月加分',
  subscriber_bonus: '訂閱會員加分',
  return_general: '一般退貨',
  return_no_reason: '無理由退貨',
  return_malicious: '退貨扣分',
  return_rate_penalty: '高退貨率',
  abandoned_cart: '棄單',
  malicious_cancel: '惡意取消',
  admin_adjustment: '管理員調整',
  good_customer_reward: '好客人表揚',
}

export function CreditScoreCard({ userId }: { userId?: string }) {
  const [data, setData] = useState<CreditScoreData | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      // Demo data
      setData({
        score: 92,
        status: 'excellent',
        statusLabel: '優質好客人',
        history: [
          { change: 8, reason: 'purchase', description: '購買訂單 #CKM-20260410-A1B2', createdAt: '2026-04-10T14:30:00Z' },
          { change: 12, reason: 'photo_review', description: '商品評價附圖', createdAt: '2026-04-08T10:15:00Z' },
          { change: 5, reason: 'on_time_delivery', description: '準時收貨確認', createdAt: '2026-04-05T09:00:00Z' },
          { change: -8, reason: 'return_general', description: '一般退貨 #RTN-001', createdAt: '2026-03-28T16:20:00Z' },
          { change: 18, reason: 'referral_success', description: '推薦好友成功', createdAt: '2026-03-20T11:00:00Z' },
        ],
      })
      setLoading(false)
      return
    }
    fetch(`/api/crm/credit-score?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (d.score !== undefined) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-cream-200 p-6 animate-pulse">
        <div className="h-4 bg-cream-200 rounded w-32 mb-4" />
        <div className="h-8 bg-cream-200 rounded w-20 mb-4" />
        <div className="h-2 bg-cream-200 rounded w-full" />
      </div>
    )
  }

  if (!data) return null

  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.normal
  const scorePercent = Math.min(100, Math.max(0, data.score))

  return (
    <div className={`rounded-2xl border border-cream-200 overflow-hidden ${colors.bg}`}>
      {/* Main card */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-gold-500" />
            <h3 className="text-sm font-medium">您的信用分數</h3>
          </div>
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            <span>{colors.icon}</span>
            {data.statusLabel}
          </div>
        </div>

        {/* Score display */}
        <div className="flex items-baseline gap-2 mb-4">
          <motion.span
            className="text-4xl font-bold text-foreground"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {data.score}
          </motion.span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-cream-200/80 rounded-full overflow-hidden mb-2">
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full ${colors.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${scorePercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          {/* Threshold markers */}
          {[30, 50, 70, 90].map((threshold) => (
            <div
              key={threshold}
              className="absolute top-0 bottom-0 w-px bg-white/60"
              style={{ left: `${threshold}%` }}
            />
          ))}
        </div>

        {/* Labels */}
        <div className="flex justify-between text-[9px] text-muted-foreground/60 mb-4">
          <span>停權</span>
          <span>黑名單</span>
          <span>觀察</span>
          <span>一般</span>
          <span>優質</span>
        </div>

        {/* Tips based on status */}
        {data.status === 'excellent' && (
          <div className="flex items-start gap-2 p-3 bg-white/60 rounded-xl">
            <Star size={14} className="text-gold-500 mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/70">
              您是我們最珍貴的好客人 ✨ 感謝您一直以來的支持！繼續保持，享受最高等級優惠。
            </p>
          </div>
        )}
        {(data.status === 'watchlist' || data.status === 'warning') && (
          <div className="flex items-start gap-2 p-3 bg-white/60 rounded-xl">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/70">
              您是我們重視的好客人 💝 透過購物、好評可以提升信用分數，恢復完整會員權益喔！
            </p>
          </div>
        )}

        {/* Toggle history */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1 mt-4 text-xs text-muted-foreground hover:text-gold-600 transition-colors"
        >
          <Info size={12} />
          信用分數紀錄
          <ChevronDown
            size={12}
            className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* History */}
      {showHistory && data.history.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-cream-200/50"
        >
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {data.history.map((entry, i) => {
              const isPositive = entry.change > 0
              return (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 bg-white/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isPositive ? (
                      <TrendingUp size={14} className="text-emerald-500 shrink-0" />
                    ) : (
                      <TrendingDown size={14} className="text-red-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {REASON_LABELS[entry.reason] || entry.reason}
                      </p>
                      {entry.description && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {isPositive ? '+' : ''}{entry.change}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
