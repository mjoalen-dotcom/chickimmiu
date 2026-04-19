'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Gift,
  Ticket,
  Award,
  Truck,
  Package,
  CheckCircle,
  Clock,
  Copy,
  Check,
} from 'lucide-react'

/**
 * PR-B /account/treasure UI 升級。
 * ─────────────────────────────────
 * 由 server component 抓 UserRewards 傳入，本 client 端負責：
 *   - 每筆 state badge（含顏色）
 *   - 未使用 + 有 couponCode → 複製按鈕 + 標記已使用按鈕
 *   - 未使用 + requiresPhysicalShipping → 「隨下次訂購寄出」文字
 *   - 過期 / 已寄出 / 已使用 → 灰階顯示
 */

export type RewardRow = {
  id: number
  rewardType:
    | 'free_shipping_coupon'
    | 'movie_ticket_physical'
    | 'movie_ticket_digital'
    | 'coupon'
    | 'gift_physical'
    | 'badge'
  displayName: string
  amount: number | null
  couponCode: string | null
  redemptionInstructions: string | null
  state: 'unused' | 'pending_attach' | 'shipped' | 'consumed' | 'expired'
  expiresAt: string
  requiresPhysicalShipping: boolean
  createdAt: string
}

const REWARD_META: Record<
  RewardRow['rewardType'],
  { label: string; icon: typeof Gift; tone: string; bg: string }
> = {
  free_shipping_coupon: { label: '免運券', icon: Truck, tone: 'text-sky-600', bg: 'bg-sky-50' },
  movie_ticket_physical: { label: '電影券（實體）', icon: Ticket, tone: 'text-rose-600', bg: 'bg-rose-50' },
  movie_ticket_digital: { label: '電影券（電子）', icon: Ticket, tone: 'text-rose-600', bg: 'bg-rose-50' },
  coupon: { label: '優惠券', icon: Ticket, tone: 'text-amber-600', bg: 'bg-amber-50' },
  gift_physical: { label: '贈品', icon: Package, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
  badge: { label: '徽章', icon: Award, tone: 'text-purple-600', bg: 'bg-purple-50' },
}

const STATE_META: Record<
  RewardRow['state'],
  { label: string; badge: string; faded: boolean }
> = {
  unused: { label: '未使用', badge: 'bg-emerald-100 text-emerald-700', faded: false },
  pending_attach: { label: '即將隨單寄出', badge: 'bg-blue-100 text-blue-700', faded: false },
  shipped: { label: '已寄出', badge: 'bg-slate-100 text-slate-600', faded: true },
  consumed: { label: '已使用', badge: 'bg-slate-100 text-slate-600', faded: true },
  expired: { label: '已過期', badge: 'bg-neutral-100 text-neutral-500', faded: true },
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(iso: string): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

type Summary = Record<string, { count: number; total: number }>

export default function TreasureClient({
  rewards,
  summary,
}: {
  rewards: RewardRow[]
  summary: Summary
}) {
  return (
    <main className="space-y-8">
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">MY TREASURE BOX</p>
        <div className="flex items-center gap-2">
          <Sparkles size={22} className="text-gold-500" />
          <h1 className="text-2xl font-serif">我的寶物箱</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          這裡是您於「好運遊戲」抽中的所有獎項。未使用的電子券可直接複製兌換碼；實體獎項將於下次訂購時自動隨單寄出。
        </p>
      </div>

      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(summary).map(([type, s]) => {
            const meta =
              REWARD_META[type as RewardRow['rewardType']] || {
                label: type,
                icon: Gift,
                tone: 'text-foreground',
                bg: 'bg-cream-100',
              }
            const Icon = meta.icon
            return (
              <div key={type} className={`${meta.bg} rounded-2xl p-4 border border-cream-200`}>
                <div className={`flex items-center gap-2 ${meta.tone} mb-2`}>
                  <Icon size={16} />
                  <span className="text-xs font-medium">{meta.label}</span>
                </div>
                <p className="text-xl font-serif">{s.count}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {type === 'badge' ? '張' : s.total > 0 ? `共 ${s.total.toLocaleString()}` : '可使用'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="bg-cream-50 rounded-2xl border border-cream-200 p-12 text-center">
          <Gift size={36} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            您還沒有任何獎項紀錄，快去遊樂場玩看看吧！
          </p>
          <a
            href="/games"
            className="inline-block px-5 py-2.5 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors"
          >
            前往好運遊戲
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map((r) => (
            <TreasureCard key={r.id} reward={r} />
          ))}
        </div>
      )}

      <div className="bg-cream-50 rounded-2xl border border-cream-200 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground flex items-center gap-2">
          <Ticket size={14} />
          兌換說明
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>點數 / 購物金已自動入帳，可於「點數 / 購物金」頁查詢餘額</li>
          <li>實體獎項（電影券、贈品等）將於下次訂購時隨單寄出，無需另外申請</li>
          <li>電子券可直接複製兌換碼；使用後按「標記為已使用」以利核對</li>
          <li>若有兌換問題請至「客服中心」聯繫我們</li>
        </ul>
      </div>
    </main>
  )
}

function TreasureCard({ reward }: { reward: RewardRow }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [consumeError, setConsumeError] = useState<string | null>(null)

  const rMeta = REWARD_META[reward.rewardType] || {
    label: reward.rewardType,
    icon: Gift,
    tone: 'text-foreground',
    bg: 'bg-cream-100',
  }
  const sMeta = STATE_META[reward.state]
  const Icon = rMeta.icon

  const daysLeft = daysUntil(reward.expiresAt)
  const isUsable = reward.state === 'unused'
  const canMarkUsed = isUsable && Boolean(reward.couponCode)
  const showPhysicalNote = isUsable && reward.requiresPhysicalShipping

  const faded = sMeta.faded

  async function handleCopy() {
    if (!reward.couponCode) return
    try {
      await navigator.clipboard.writeText(reward.couponCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function handleMarkUsed() {
    setConsumeError(null)
    const res = await fetch('/api/user-rewards/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewardId: reward.id }),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null
      setConsumeError(j?.error || '標記失敗，請稍後再試')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-cream-200 p-4 flex flex-col gap-3 ${
        faded ? 'opacity-60 grayscale' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`${rMeta.bg} ${rMeta.tone} w-12 h-12 rounded-xl flex items-center justify-center shrink-0`}
        >
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${rMeta.bg} ${rMeta.tone} font-medium`}>
              {rMeta.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${sMeta.badge} font-medium`}>
              {sMeta.label}
            </span>
          </div>
          <p className="text-sm font-medium truncate">{reward.displayName}</p>
          {reward.couponCode && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-gold-600 font-mono truncate">
                代碼：{reward.couponCode}
              </p>
              {isUsable && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gold-700 bg-gold-50 hover:bg-gold-100 px-2 py-0.5 rounded-full transition-colors"
                  aria-label="複製兌換碼"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '已複製' : '複製'}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          {reward.amount != null && reward.rewardType !== 'badge' && (
            <p className="text-base font-medium text-gold-600">
              {reward.amount.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-1">
            <Clock size={11} />
            {reward.state === 'expired'
              ? `已於 ${formatDate(reward.expiresAt)} 過期`
              : `至 ${formatDate(reward.expiresAt)}`}
          </p>
          {isUsable && daysLeft != null && daysLeft <= 30 && daysLeft > 0 && (
            <p className="text-[10px] text-rose-600 mt-0.5">僅剩 {daysLeft} 天</p>
          )}
        </div>
      </div>

      {(showPhysicalNote || canMarkUsed || reward.redemptionInstructions) && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-t border-cream-100 pt-3">
          <div className="text-xs text-muted-foreground flex-1 min-w-0 space-y-0.5">
            {showPhysicalNote && (
              <p className="flex items-center gap-1">
                <Truck size={11} /> 下次訂購時自動隨單寄出
              </p>
            )}
            {reward.redemptionInstructions && (
              <p className="line-clamp-2">{reward.redemptionInstructions}</p>
            )}
            {consumeError && <p className="text-rose-600">{consumeError}</p>}
          </div>
          {canMarkUsed && (
            <button
              type="button"
              onClick={handleMarkUsed}
              disabled={isPending}
              className="shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-cream-200 text-foreground rounded-lg hover:bg-cream-50 disabled:opacity-50 transition-colors"
            >
              <CheckCircle size={12} />
              {isPending ? '處理中…' : '標記為已使用'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
