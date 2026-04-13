'use client'

import Link from 'next/link'
import { Crown, Coins, Wallet, TrendingUp, Gamepad2, ArrowRight } from 'lucide-react'
import { CreditScoreCard } from '@/components/account/CreditScoreCard'

export default function AccountPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 會員等級卡 */}
      <div className="bg-gradient-to-br from-cream-100 to-blush-50 rounded-2xl p-6 md:p-8 border border-cream-200">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs tracking-widest text-gold-500 mb-1">MEMBERSHIP</p>
            <h2 className="text-xl font-serif">優雅初遇者</h2>
            <p className="text-sm text-muted-foreground mt-1">
              再消費 NT$ 3,000 即可升級為「曦漾仙子」
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center">
            <Crown size={24} className="text-gold-500" />
          </div>
        </div>
        {/* 升級進度條 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>累計消費 NT$ 0</span>
            <span>曦漾仙子 NT$ 3,000</span>
          </div>
          <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
            <div className="h-full w-0 rounded-full bg-gold-500 transition-all" />
          </div>
        </div>
      </div>

      {/* 數據卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Coins, label: '會員點數', value: '0', color: 'text-gold-500' },
          { icon: Wallet, label: '購物金', value: 'NT$ 0', color: 'text-green-600' },
          { icon: TrendingUp, label: '累計消費', value: 'NT$ 0', color: 'text-blue-600' },
          { icon: Crown, label: '會員折扣', value: '0%', color: 'text-purple-600' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4 border border-cream-200"
          >
            <card.icon size={20} className={`${card.color} mb-3`} />
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-lg font-medium mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* 信用分數 */}
      <CreditScoreCard />

      {/* 好運遊戲快捷入口 */}
      <div className="bg-gradient-to-br from-gold-500/5 to-blush-50 rounded-2xl p-6 border border-gold-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gamepad2 size={20} className="text-gold-500" />
            <h3 className="font-medium">好運遊戲</h3>
          </div>
          <Link href="/games" className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 transition-colors">
            查看全部 <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { emoji: '📅', label: '每日簽到', href: '/games/daily-checkin' },
            { emoji: '🎡', label: '幸運轉盤', href: '/games/spin-wheel' },
            { emoji: '🎫', label: '刮刮樂', href: '/games/scratch-card' },
            { emoji: '🃏', label: '抽卡對戰', href: '/games/card-battle' },
          ].map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="text-center p-3 rounded-xl bg-white/60 hover:bg-white border border-cream-200/50 hover:border-gold-400/30 transition-all group"
            >
              <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">{g.emoji}</span>
              <p className="text-[10px] text-muted-foreground">{g.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* 最近訂單 */}
      <div className="bg-white rounded-2xl p-6 border border-cream-200">
        <h3 className="font-medium mb-4">最近訂單</h3>
        <div className="text-center py-12 text-sm text-muted-foreground">
          <p>目前還沒有訂單</p>
          <a href="/products" className="text-gold-600 hover:underline mt-2 inline-block">
            去逛逛 &rarr;
          </a>
        </div>
      </div>
    </div>
  )
}
