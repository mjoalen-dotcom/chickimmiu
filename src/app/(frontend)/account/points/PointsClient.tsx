'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Coins, Crown, Gift, Truck, Ticket, Sparkles, Star, TrendingUp,
  Timer, Flame, Heart, Dice6, Package, AlertTriangle,
  HandHeart, Palette, Zap, ChevronRight, X, CheckCircle2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Types from server ── */
export type TierLite = {
  id: string
  slug: string
  level: number
  displayName: string
  minSpent: number
  discountPercent: number
  pointsMultiplier: number
  freeShippingThreshold: number
}
export type ShopItemLite = {
  id: string
  name: string
  type: string
  pointsCost: number
  stock: number
  redeemed: number
  description: string
  badge: string | null
}
export type HistoryItem = {
  date: string
  desc: string
  points: number
  type: 'earn' | 'spend'
}
export type UserLite = {
  points: number
  shoppingCredit: number
  currentTierSlug: string
  currentTierDisplayName: string
  currentTierMultiplier: number
  expiringPoints: number
  expiringDays: number
}
export type TestimonialItem = {
  name: string
  text: string
  avatar: string
  tier: string
}

/* ── Tier color lookup (Tailwind, not in DB) ── */
const TIER_HEX_COLORS: Record<string, string> = {
  ordinary: '#9CA3AF',
  normal: '#9CA3AF',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
}

/* ── UGC 兌換見證 fallback（後台 ugcTestimonials.items 留空時自動顯示，
     admin 填入真實見證後自動替換） ── */
const FALLBACK_TESTIMONIALS: TestimonialItem[] = [
  { name: '小**', text: '用 500 點換到電影票，超划算！', avatar: '🎬', tier: '金牌' },
  { name: '王**', text: '轉盤第一次就中購物金！', avatar: '🎰', tier: '銀牌' },
  { name: '林**', text: '神秘禮物收到限量絲巾，太驚喜', avatar: '🎁', tier: '白金' },
  { name: '陳**', text: '免運券超實用，每次都兌', avatar: '📦', tier: '銅牌' },
]

type Tab = 'shop' | 'history' | 'tiers'

export default function PointsClient({
  tiers,
  shopItems,
  history,
  user,
  testimonials,
}: {
  tiers: TierLite[]
  shopItems: ShopItemLite[]
  history: HistoryItem[]
  user: UserLite
  testimonials: TestimonialItem[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('shop')
  const points = user.points
  const credit = user.shoppingCredit
  const expiringPoints = user.expiringPoints
  const expiringDays = user.expiringDays
  const currentTierColor = TIER_HEX_COLORS[user.currentTierSlug] ?? TIER_HEX_COLORS.ordinary

  // 兌換流程：點按鈕 → 開 confirm modal → 送 API → 顯示 toast → router.refresh()
  // 兌換規則跟使用者說明：扣點不可退、隨下一張訂單寄出、不能單獨退貨
  const SHIPPABLE_TYPES = new Set(['physical', 'movie_ticket', 'gift_physical'])
  const [confirmItem, setConfirmItem] = useState<ShopItemLite | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [toast, setToast] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null)

  async function handleConfirmRedeem() {
    if (!confirmItem) return
    setRedeeming(true)
    try {
      const res = await fetch('/api/v1/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ redemptionId: confirmItem.id }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        message?: string
      }
      if (res.ok && json.success) {
        setToast({
          kind: 'success',
          text: json.message ?? '兌換成功！獎品將隨您的下一張訂單寄出',
        })
        setConfirmItem(null)
        router.refresh()
      } else {
        setToast({ kind: 'error', text: json.error ?? '兌換失敗，請稍後再試' })
      }
    } catch {
      setToast({ kind: 'error', text: '網路錯誤，請稍後再試' })
    } finally {
      setRedeeming(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const badgeIcon = (badge: string | null) => {
    switch (badge) {
      case '限量': return <Package size={10} />
      case '即將售完': return <AlertTriangle size={10} />
      case '熱門': return <Flame size={10} />
      case '超划算': return <Zap size={10} />
      case '試手氣': return <Dice6 size={10} />
      case '驚喜': return <Sparkles size={10} />
      case 'VIP': case '專屬': return <Crown size={10} />
      case '愛心': return <HandHeart size={10} />
      default: return null
    }
  }

  const badgeColor = (badge: string | null) => {
    switch (badge) {
      case '限量': case '即將售完': return 'bg-red-500 text-white'
      case '熱門': return 'bg-orange-500 text-white'
      case '超划算': return 'bg-green-500 text-white'
      case '試手氣': return 'bg-purple-500 text-white'
      case '驚喜': return 'bg-pink-500 text-white'
      case 'VIP': case '專屬': return 'bg-gold-500 text-white'
      case '愛心': return 'bg-blue-500 text-white'
      default: return ''
    }
  }

  const nearbyItems = shopItems
    .filter((i) => i.pointsCost > points && i.pointsCost <= points + 300)
    .slice(0, 2)

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-serif">點數中心</h2>

      {/* ── 餘額卡片 ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-gold-500/10 to-cream-100 rounded-2xl p-4 border border-gold-500/20">
          <div className="flex items-center justify-between mb-2">
            <Coins size={18} className="text-gold-500" />
            <span
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: currentTierColor + '20', color: currentTierColor }}
            >
              <Crown size={10} />
              {user.currentTierDisplayName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">會員點數</p>
          <p className="text-2xl font-medium">{points.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{user.currentTierMultiplier}x 點數加倍</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/10 to-cream-100 rounded-2xl p-4 border border-green-500/20">
          <Gift size={18} className="text-green-600 mb-2" />
          <p className="text-xs text-muted-foreground">購物金</p>
          <p className="text-2xl font-medium">NT$ {credit.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">永不過期</p>
        </div>
      </div>

      {/* ── 即將到期提醒（損失規避） ── */}
      {expiringPoints > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl"
        >
          <Timer size={18} className="text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700">
              {expiringPoints} 點將在 {expiringDays} 天後到期
            </p>
            <p className="text-[10px] text-red-500">趕快使用，別讓點數白白消失！</p>
          </div>
          <button className="text-xs text-red-600 font-medium flex items-center gap-0.5 shrink-0">
            立即兌換 <ChevronRight size={12} />
          </button>
        </motion.div>
      )}

      {/* ── 接近可兌換提示（進度感） ── */}
      {nearbyItems.length > 0 && (
        <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-4">
          <p className="text-xs text-gold-700 font-medium mb-2">
            <Sparkles size={12} className="inline mr-1" />
            快達標了！
          </p>
          <div className="space-y-2">
            {nearbyItems.map((item) => {
              const progress = (points / item.pointsCost) * 100
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-xs flex-1 truncate">{item.name}</span>
                  <div className="w-20 h-1.5 rounded-full bg-cream-200 overflow-hidden">
                    <div className="h-full bg-gold-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    差 {item.pointsCost - points} 點
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Tab 切換 ── */}
      <div className="flex gap-1 bg-cream-100 rounded-xl p-1">
        {([
          { key: 'shop' as Tab, label: '點數商城', icon: Gift },
          { key: 'history' as Tab, label: '紀錄', icon: TrendingUp },
          { key: 'tiers' as Tab, label: '等級權益', icon: Crown },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs transition-colors ${
              tab === t.key ? 'bg-white text-foreground shadow-sm font-medium' : 'text-muted-foreground'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════════ 點數商城 ═══════════════ */}
        {tab === 'shop' && (
          <motion.div
            key="shop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {shopItems.length === 0 ? (
              <div className="text-center py-8 px-6 bg-white rounded-2xl border border-cream-200">
                <p className="text-sm text-muted-foreground">點數商城暫無商品。</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {shopItems.map((item) => {
                  const canAfford = points >= item.pointsCost
                  const remaining = item.stock > 0 ? item.stock - item.redeemed : null
                  const isAlmostGone = remaining !== null && remaining <= 5
                  const progress = Math.min(100, (points / item.pointsCost) * 100)

                  return (
                    <div
                      key={item.id}
                      className={`relative bg-white rounded-2xl border p-4 transition-all hover:shadow-md ${
                        canAfford ? 'border-gold-500/30 hover:border-gold-500' : 'border-cream-200'
                      }`}
                    >
                      {/* Badge */}
                      {item.badge && (
                        <span className={`absolute -top-2 -right-2 flex items-center gap-0.5 text-[9px] font-medium px-2 py-0.5 rounded-full ${badgeColor(item.badge)}`}>
                          {badgeIcon(item.badge)}
                          {item.badge}
                        </span>
                      )}

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-cream-50 flex items-center justify-center mb-3">
                        {item.type === 'movie_ticket' && <Ticket size={20} className="text-purple-500" />}
                        {item.type === 'free_shipping' && <Truck size={20} className="text-blue-500" />}
                        {item.type === 'store_credit' && <Coins size={20} className="text-green-500" />}
                        {item.type === 'lottery' && <Dice6 size={20} className="text-purple-500" />}
                        {item.type === 'coupon' && <Ticket size={20} className="text-orange-500" />}
                        {item.type === 'mystery' && <Gift size={20} className="text-pink-500" />}
                        {item.type === 'experience' && <Star size={20} className="text-gold-500" />}
                        {item.type === 'styling' && <Palette size={20} className="text-gold-500" />}
                        {item.type === 'charity' && <HandHeart size={20} className="text-blue-500" />}
                        {item.type === 'physical' && <Package size={20} className="text-gray-500" />}
                        {item.type === 'discount_code' && <Ticket size={20} className="text-red-500" />}
                        {item.type === 'addon_deal' && <Gift size={20} className="text-orange-500" />}
                      </div>

                      <h4 className="text-sm font-medium leading-tight mb-1">{item.name}</h4>
                      <p className="text-[10px] text-muted-foreground mb-3">{item.description}</p>

                      {/* 進度條 */}
                      {!canAfford && (
                        <div className="mb-2">
                          <div className="w-full h-1 rounded-full bg-cream-200 overflow-hidden">
                            <div className="h-full bg-gold-500 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5">差 {item.pointsCost - points} 點</p>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gold-600">{item.pointsCost} 點</span>
                        {remaining !== null && (
                          <span className={`text-[9px] ${isAlmostGone ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                            {isAlmostGone ? `僅剩 ${remaining}` : `剩 ${remaining}`}
                          </span>
                        )}
                      </div>

                      {/* 社會認同 */}
                      {item.redeemed > 50 && (
                        <p className="text-[9px] text-muted-foreground mt-1">
                          <Flame size={9} className="inline text-orange-400" /> 已有 {item.redeemed.toLocaleString()} 人兌換
                        </p>
                      )}

                      {/* CTA */}
                      <button
                        disabled={!canAfford || !SHIPPABLE_TYPES.has(item.type)}
                        onClick={() => {
                          if (!SHIPPABLE_TYPES.has(item.type)) {
                            setToast({
                              kind: 'error',
                              text: '此類型獎品需於指定活動或洽客服兌換',
                            })
                            setTimeout(() => setToast(null), 4000)
                            return
                          }
                          setConfirmItem(item)
                        }}
                        className={`w-full mt-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          canAfford && SHIPPABLE_TYPES.has(item.type)
                            ? 'bg-gold-500 text-white hover:bg-gold-600'
                            : 'bg-cream-100 text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {!SHIPPABLE_TYPES.has(item.type)
                          ? '活動兌換'
                          : canAfford
                          ? '立即兌換'
                          : '點數不足'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* UGC 兌換見證 */}
            <div className="bg-cream-50 rounded-2xl p-4">
              <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5">
                <Heart size={12} className="text-pink-500" />
                會員兌換心得
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(testimonials.length > 0 ? testimonials : FALLBACK_TESTIMONIALS).map((t, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 text-xs">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">{t.avatar}</span>
                      <span className="font-medium">{t.name}</span>
                      <span className="text-[9px] text-gold-500">{t.tier}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{t.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ 點數紀錄 ═══════════════ */}
        {tab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-2xl border border-cream-200 p-5">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">尚無點數紀錄。</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                      <div>
                        <p className="text-sm">{h.desc}</p>
                        <p className="text-[10px] text-muted-foreground">{h.date}</p>
                      </div>
                      <span className={`text-sm font-medium ${h.type === 'earn' ? 'text-green-600' : 'text-red-500'}`}>
                        {h.type === 'earn' ? '+' : ''}{h.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════════════ 等級權益 ═══════════════ */}
        {tab === 'tiers' && (
          <motion.div
            key="tiers"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-2xl border border-cream-200 p-5">
              {tiers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">尚未設定會員等級。</p>
              ) : (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-xs min-w-[540px]">
                    <thead>
                      <tr className="border-b border-cream-200">
                        <th className="py-3 text-left font-medium">等級</th>
                        <th className="py-3 text-center font-medium">門檻</th>
                        <th className="py-3 text-center font-medium">折扣</th>
                        <th className="py-3 text-center font-medium">點數倍率</th>
                        <th className="py-3 text-center font-medium">免運</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier) => {
                        const hex = TIER_HEX_COLORS[tier.slug] ?? TIER_HEX_COLORS.ordinary
                        const isCurrent = tier.slug === user.currentTierSlug
                        return (
                          <tr
                            key={tier.slug}
                            className={`border-b border-cream-100 ${isCurrent ? 'bg-gold-500/5' : ''}`}
                          >
                            <td className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                <Crown size={12} style={{ color: hex }} />
                                <span className={isCurrent ? 'font-medium' : ''}>
                                  {tier.displayName}
                                </span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.5 bg-gold-500 text-white text-[8px] rounded-full">目前</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 text-center">
                              {tier.minSpent === 0 ? '免費' : `NT$ ${tier.minSpent.toLocaleString()}`}
                            </td>
                            <td className="py-2.5 text-center">{tier.discountPercent}%</td>
                            <td className="py-2.5 text-center">{tier.pointsMultiplier}x</td>
                            <td className="py-2.5 text-center">
                              {tier.freeShippingThreshold === 0 ? '免運' : `滿 ${tier.freeShippingThreshold}`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast：操作結果 ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="redeem-toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm ${
              toast.kind === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.kind === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 兌換確認 Modal ── */}
      <AnimatePresence>
        {confirmItem && (
          <motion.div
            key="redeem-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
            onClick={() => !redeeming && setConfirmItem(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-base font-medium">確認兌換</h3>
                <button
                  type="button"
                  disabled={redeeming}
                  onClick={() => setConfirmItem(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="關閉"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-cream-50 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium mb-1">{confirmItem.name}</p>
                {confirmItem.description && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {confirmItem.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">兌換需要</span>
                  <span className="text-lg font-medium text-gold-600">
                    {confirmItem.pointsCost.toLocaleString()} 點
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">兌換後餘額</span>
                  <span className="text-sm">
                    {(points - confirmItem.pointsCost).toLocaleString()} 點
                  </span>
                </div>
              </div>

              <ul className="space-y-2 mb-5 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <Package size={14} className="text-gold-500 shrink-0 mt-0.5" />
                  <span>
                    獎品將進入您的「<strong className="text-foreground">寶物箱</strong>
                    」，於下一張<strong className="text-foreground">付款訂單</strong>
                    產生時自動隨單寄出。
                  </span>
                </li>
                <li className="flex gap-2">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <span>
                    兌換後點數立即扣除，
                    <strong className="text-foreground">無法取消或退回</strong>
                    ；隨單寄出之獎品
                    <strong className="text-foreground">不接受單獨退貨</strong>。
                  </span>
                </li>
              </ul>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={redeeming}
                  onClick={() => setConfirmItem(null)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium border border-cream-200 hover:bg-cream-50 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={redeeming}
                  onClick={handleConfirmRedeem}
                  className="flex-1 py-2.5 rounded-lg text-xs font-medium bg-gold-500 text-white hover:bg-gold-600 disabled:bg-gold-400 disabled:cursor-wait"
                >
                  {redeeming ? '兌換中…' : '確認兌換'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
