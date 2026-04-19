import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Sparkles, Gift, Ticket, Award, Coins, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: '我的寶物箱',
  description: '查詢遊樂場所抽到的所有獎項：免運券、電影券、優惠券、徽章等。',
  robots: { index: false, follow: false },
}

/**
 * 4a — 我的寶物箱（查詢頁）
 * ────────────────────────────
 * 讀 MiniGameRecords 中該會員所有 outcome=win 且有獎品的紀錄，
 * 顯示為卡片清單。本階段純查詢，不做兌換 / 不接 checkout 自動隨單出貨。
 *
 * 完整兌換流程（4c）：見 docs/session-prompts/15-treasure-redemption-spec.md
 */

const GAME_LABELS: Record<string, string> = {
  spin_wheel: '轉盤抽獎',
  scratch_card: '刮刮樂',
  daily_checkin: '每日簽到',
  movie_lottery: '電影抽獎',
  fashion_challenge: '穿搭挑戰',
  card_battle: '抽卡片比大小',
}

const PRIZE_TYPE_META: Record<
  string,
  { label: string; icon: typeof Gift; color: string; bg: string }
> = {
  points: { label: '點數', icon: Coins, color: 'text-amber-600', bg: 'bg-amber-50' },
  credit: { label: '購物金', icon: Coins, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  coupon: { label: '優惠券', icon: Ticket, color: 'text-rose-600', bg: 'bg-rose-50' },
  badge: { label: '徽章', icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' },
}

type PrizeRecord = {
  id: string
  gameType: string
  outcome: string
  prizeType: string | null
  prizeAmount: number | null
  prizeDescription: string | null
  couponCode: string | null
  createdAt: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function TreasurePage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/account/treasure')

  const records = await payload.find({
    collection: 'mini-game-records',
    where: {
      and: [
        { player: { equals: user.id } },
        { 'result.outcome': { equals: 'win' } },
      ],
    },
    sort: '-createdAt',
    limit: 100,
    depth: 0,
  })

  const prizes: PrizeRecord[] = records.docs
    .map((r) => {
      const result = (r as unknown as Record<string, unknown>).result as
        | Record<string, unknown>
        | undefined
      const prizeType = (result?.prizeType as string | null | undefined) ?? null
      const prizeAmount = (result?.prizeAmount as number | null | undefined) ?? null
      const prizeDescription = (result?.prizeDescription as string | null | undefined) ?? null
      const couponCode = (result?.couponCode as string | null | undefined) ?? null
      return {
        id: String(r.id),
        gameType: String((r as unknown as Record<string, unknown>).gameType || ''),
        outcome: String(result?.outcome || ''),
        prizeType,
        prizeAmount,
        prizeDescription,
        couponCode,
        createdAt: String((r as unknown as Record<string, unknown>).createdAt || ''),
      }
    })
    .filter((p) => p.prizeType && p.prizeType !== 'none')

  const summary = prizes.reduce<Record<string, { count: number; total: number }>>((acc, p) => {
    const key = p.prizeType || 'other'
    if (!acc[key]) acc[key] = { count: 0, total: 0 }
    acc[key].count += 1
    acc[key].total += p.prizeAmount ?? 0
    return acc
  }, {})

  return (
    <main className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">MY TREASURE BOX</p>
        <div className="flex items-center gap-2">
          <Sparkles size={22} className="text-gold-500" />
          <h1 className="text-2xl font-serif">我的寶物箱</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          這裡是您於「好運遊戲」抽中的所有獎項紀錄。
        </p>
      </div>

      {/* Summary cards */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(summary).map(([type, s]) => {
            const meta = PRIZE_TYPE_META[type] || {
              label: type,
              icon: Gift,
              color: 'text-foreground',
              bg: 'bg-cream-100',
            }
            const Icon = meta.icon
            return (
              <div
                key={type}
                className={`${meta.bg} rounded-2xl p-4 border border-cream-200`}
              >
                <div className={`flex items-center gap-2 ${meta.color} mb-2`}>
                  <Icon size={16} />
                  <span className="text-xs font-medium">{meta.label}</span>
                </div>
                <p className="text-xl font-serif">{s.count}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {type === 'badge' ? '張' : `共 ${s.total.toLocaleString()}`}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Prize list */}
      {prizes.length === 0 ? (
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
          {prizes.map((p) => {
            const meta = PRIZE_TYPE_META[p.prizeType || ''] || {
              label: p.prizeType || '其他',
              icon: Gift,
              color: 'text-foreground',
              bg: 'bg-cream-100',
            }
            const Icon = meta.icon
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-cream-200 p-4 flex items-center gap-4"
              >
                <div
                  className={`${meta.bg} ${meta.color} w-12 h-12 rounded-xl flex items-center justify-center shrink-0`}
                >
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} font-medium`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {GAME_LABELS[p.gameType] || p.gameType}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">
                    {p.prizeDescription || `${meta.label} ${p.prizeAmount ?? ''}`.trim()}
                  </p>
                  {p.couponCode && (
                    <p className="text-xs text-gold-600 font-mono mt-1">代碼：{p.couponCode}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {p.prizeAmount != null && p.prizeType !== 'badge' && (
                    <p className="text-base font-medium text-gold-600">
                      {p.prizeAmount.toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-1">
                    <Calendar size={11} />
                    {formatDate(p.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Notice */}
      <div className="bg-cream-50 rounded-2xl border border-cream-200 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground flex items-center gap-2">
          <Ticket size={14} />
          兌換說明
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>點數 / 購物金已自動入帳，可於「點數 / 購物金」頁查詢餘額</li>
          <li>實體獎項（電影券、贈品等）將於下次訂購時隨單寄出，無需另外申請</li>
          <li>優惠券代碼可於結帳頁輸入使用</li>
          <li>若有兌換問題請至「客服中心」聯繫我們</li>
        </ul>
      </div>
    </main>
  )
}
