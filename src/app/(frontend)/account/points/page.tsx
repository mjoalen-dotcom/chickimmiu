'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Coins, Crown, Gift, Truck, Ticket, Sparkles, Star, TrendingUp,
  Timer, Flame, Lock, Heart, Dice6, Package, ArrowRight, AlertTriangle,
  HandHeart, Palette, Zap, ChevronRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── 會員等級 ── */
const TIERS = [
  { name: '普通會員', slug: 'normal', level: 1, minSpent: 0, discount: 0, multiplier: 1, freeShipping: 1000, color: '#9CA3AF' },
  { name: '銅牌會員', slug: 'bronze', level: 2, minSpent: 3000, discount: 2, multiplier: 1.2, freeShipping: 800, color: '#CD7F32' },
  { name: '銀牌會員', slug: 'silver', level: 3, minSpent: 10000, discount: 3, multiplier: 1.5, freeShipping: 600, color: '#C0C0C0' },
  { name: '金牌會員', slug: 'gold', level: 4, minSpent: 30000, discount: 5, multiplier: 2, freeShipping: 0, color: '#FFD700' },
  { name: '白金會員', slug: 'platinum', level: 5, minSpent: 60000, discount: 8, multiplier: 2.5, freeShipping: 0, color: '#E5E4E2' },
  { name: '鑽石會員', slug: 'diamond', level: 6, minSpent: 100000, discount: 10, multiplier: 3, freeShipping: 0, color: '#B9F2FF' },
]

/* ── 點數商城獎品（上線後從 API 取得） ── */
const SHOP_ITEMS = [
  { id: '1', name: '威秀電影票 (單張)', type: 'movie_ticket', cost: 500, stock: 50, redeemed: 42, image: null, badge: '限量', desc: '全台威秀門市 2D 一般廳' },
  { id: '2', name: '威秀電影票 (雙人)', type: 'movie_ticket', cost: 900, stock: 30, redeemed: 28, image: null, badge: '即將售完', desc: '好友一起看電影！' },
  { id: '3', name: '免運券', type: 'free_shipping', cost: 100, stock: 0, redeemed: 186, image: null, badge: '熱門', desc: '單筆免運（限台灣本島）' },
  { id: '4', name: 'NT$100 購物金', type: 'store_credit', cost: 200, stock: 0, redeemed: 312, image: null, badge: '超划算', desc: '直接折抵訂單金額' },
  { id: '5', name: '幸運轉盤 ×1', type: 'lottery', cost: 50, stock: 0, redeemed: 1024, image: null, badge: '試手氣', desc: '獎品含電影票、購物金' },
  { id: '6', name: '95折優惠券', type: 'coupon', cost: 150, stock: 0, redeemed: 98, image: null, badge: null, desc: '全站適用（不併用）' },
  { id: '7', name: '神秘禮物', type: 'mystery', cost: 100, stock: 0, redeemed: 456, image: null, badge: '驚喜', desc: '隨機好禮！最高價值 NT$500' },
  { id: '8', name: '新品搶先購', type: 'experience', cost: 300, stock: 20, redeemed: 15, image: null, badge: 'VIP', desc: '提前 24 小時搶先購買' },
  { id: '9', name: 'VIP 造型諮詢', type: 'styling', cost: 800, stock: 10, redeemed: 3, image: null, badge: '專屬', desc: '30 分鐘一對一線上造型建議' },
  { id: '10', name: '公益捐贈', type: 'charity', cost: 100, stock: 0, redeemed: 67, image: null, badge: '愛心', desc: '100 點 = NT$10 捐贈兒福基金會' },
]

/* ── 點數紀錄 ── */
const DEMO_HISTORY = [
  { date: '2026-04-10', desc: '訂單消費獎勵 (ORD-20260410-005)', points: 298, type: 'earn' },
  { date: '2026-04-08', desc: '附圖評價獎勵', points: 50, type: 'earn' },
  { date: '2026-04-05', desc: '兌換免運券', points: -100, type: 'spend' },
  { date: '2026-04-01', desc: '每月等級贈送', points: 100, type: 'earn' },
  { date: '2026-03-28', desc: '幸運轉盤（中獎 NT$50 購物金）', points: -50, type: 'spend' },
  { date: '2026-03-25', desc: '推薦好友完成首購', points: 100, type: 'earn' },
  { date: '2026-03-20', desc: '訂單消費獎勵 (ORD-20260320-012)', points: 156, type: 'earn' },
  { date: '2026-03-15', desc: '神秘禮物兌換', points: -100, type: 'spend' },
]

/* ── UGC 兌換見證 ── */
const UGC_TESTIMONIALS = [
  { name: '小**', text: '用 500 點換到電影票，超划算！', avatar: '🎬', tier: '金牌' },
  { name: '王**', text: '轉盤第一次就中購物金！', avatar: '🎰', tier: '銀牌' },
  { name: '林**', text: '神秘禮物收到限量絲巾，太驚喜', avatar: '🎁', tier: '白金' },
  { name: '陳**', text: '免運券超實用，每次都兌', avatar: '📦', tier: '銅牌' },
]

type Tab = 'shop' | 'history' | 'tiers'

export default function PointsPage() {
  const [tab, setTab] = useState<Tab>('shop')
  const currentTier = TIERS[3] // Demo: 金牌
  const points = 688
  const credit = 150
  const expiringPoints = 120
  const expiringDays = 18

  const badgeIcon = (badge: string | null) => {
    switch (badge) {
      case '限量': return <Package size={10} />
      case '即將售完': return <AlertTriangle size={10} />
      case '熱門': return <Flame size={10} />
      case '超划算': return <Zap size={10} />
      case '試手氣': return <Dice6 size={10} />
      case '驚喜': return <Sparkles size={10} />
      case 'VIP': return <Crown size={10} />
      case '專屬': return <Palette size={10} />
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

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-serif">點數中心</h2>

      {/* ── 餘額卡片 ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-gold-500/10 to-cream-100 rounded-2xl p-4 border border-gold-500/20">
          <div className="flex items-center justify-between mb-2">
            <Coins size={18} className="text-gold-500" />
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: currentTier.color + '20', color: currentTier.color }}>
              <Crown size={10} />
              {currentTier.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">會員點數</p>
          <p className="text-2xl font-medium">{points.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{currentTier.multiplier}x 點數加倍</p>
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
      <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-4">
        <p className="text-xs text-gold-700 font-medium mb-2">
          <Sparkles size={12} className="inline mr-1" />
          快達標了！
        </p>
        <div className="space-y-2">
          {SHOP_ITEMS.filter(i => i.cost > points && i.cost <= points + 300).slice(0, 2).map(item => {
            const progress = (points / item.cost) * 100
            return (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-xs flex-1 truncate">{item.name}</span>
                <div className="w-20 h-1.5 rounded-full bg-cream-200 overflow-hidden">
                  <div className="h-full bg-gold-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  差 {item.cost - points} 點
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tab 切換 ── */}
      <div className="flex gap-1 bg-cream-100 rounded-xl p-1">
        {([
          { key: 'shop' as Tab, label: '點數商城', icon: Gift },
          { key: 'history' as Tab, label: '紀錄', icon: TrendingUp },
          { key: 'tiers' as Tab, label: '等級權益', icon: Crown },
        ]).map(t => (
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
            {/* 商品卡片 */}
            <div className="grid grid-cols-2 gap-3">
              {SHOP_ITEMS.map(item => {
                const canAfford = points >= item.cost
                const remaining = item.stock > 0 ? item.stock - item.redeemed : null
                const isAlmostGone = remaining !== null && remaining <= 5
                const progress = Math.min(100, (points / item.cost) * 100)

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
                    </div>

                    <h4 className="text-sm font-medium leading-tight mb-1">{item.name}</h4>
                    <p className="text-[10px] text-muted-foreground mb-3">{item.desc}</p>

                    {/* 進度條 */}
                    {!canAfford && (
                      <div className="mb-2">
                        <div className="w-full h-1 rounded-full bg-cream-200 overflow-hidden">
                          <div className="h-full bg-gold-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5">差 {item.cost - points} 點</p>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gold-600">{item.cost} 點</span>
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
                      disabled={!canAfford}
                      className={`w-full mt-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        canAfford
                          ? 'bg-gold-500 text-white hover:bg-gold-600'
                          : 'bg-cream-100 text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? '立即兌換' : '點數不足'}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* UGC 兌換見證 */}
            <div className="bg-cream-50 rounded-2xl p-4">
              <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5">
                <Heart size={12} className="text-pink-500" />
                會員兌換心得
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {UGC_TESTIMONIALS.map((t, i) => (
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
              <div className="space-y-3">
                {DEMO_HISTORY.map((h, i) => (
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
                    {TIERS.map((tier) => (
                      <tr
                        key={tier.slug}
                        className={`border-b border-cream-100 ${tier.slug === currentTier.slug ? 'bg-gold-500/5' : ''}`}
                      >
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Crown size={12} style={{ color: tier.color }} />
                            <span className={tier.slug === currentTier.slug ? 'font-medium' : ''}>
                              {tier.name}
                            </span>
                            {tier.slug === currentTier.slug && (
                              <span className="px-1.5 py-0.5 bg-gold-500 text-white text-[8px] rounded-full">目前</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-center">
                          {tier.minSpent === 0 ? '免費' : `NT$ ${tier.minSpent.toLocaleString()}`}
                        </td>
                        <td className="py-2.5 text-center">{tier.discount}%</td>
                        <td className="py-2.5 text-center">{tier.multiplier}x</td>
                        <td className="py-2.5 text-center">
                          {tier.freeShipping === 0 ? '免運' : `滿 ${tier.freeShipping}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
