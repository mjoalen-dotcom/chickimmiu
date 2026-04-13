'use client'

import { useState } from 'react'
import { Copy, Check, Users, Gift, TrendingUp, Share2, Crown, Star, Shield } from 'lucide-react'

const DEMO_REFERRAL = {
  code: 'KIMFAN2026',
  link: 'https://chickimmiu.com/ref/KIMFAN2026',
  tier: '金牌',
  multiplier: 1.5,
  totalReferred: 12,
  totalReward: 1850,
  monthlyRemaining: 38, // 50 - 12 this month
}

const DEMO_HISTORY = [
  { id: '1', name: '王**', date: '2026-04-08', status: 'completed', reward: 150, event: '首消達標' },
  { id: '2', name: '李**', date: '2026-04-05', status: 'completed', reward: 75, event: '註冊成功' },
  { id: '3', name: '陳**', date: '2026-03-28', status: 'pending', reward: 0, event: '待首消' },
  { id: '4', name: '林**', date: '2026-03-20', status: 'completed', reward: 150, event: '首消達標' },
  { id: '5', name: '張**', date: '2026-03-15', status: 'completed', reward: 75, event: '註冊成功' },
]

const TIER_BONUSES = [
  { tier: '銅牌', multiplier: '1.0x', color: 'text-orange-600' },
  { tier: '銀牌', multiplier: '1.2x', color: 'text-gray-500' },
  { tier: '金牌', multiplier: '1.5x', color: 'text-gold-600' },
  { tier: '白金', multiplier: '1.8x', color: 'text-blue-500' },
  { tier: '鑽石', multiplier: '2.0x', color: 'text-purple-500' },
]

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(DEMO_REFERRAL.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">REFERRAL</p>
        <h1 className="text-2xl font-serif">推薦好友</h1>
      </div>

      {/* Referral code card */}
      <div className="bg-gradient-to-r from-gold-500/10 to-blush-50 rounded-2xl border border-gold-500/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Share2 size={24} className="text-gold-500" />
          <div>
            <p className="font-medium">我的推薦碼</p>
            <p className="text-xs text-muted-foreground">
              等級加成：{DEMO_REFERRAL.tier}（{DEMO_REFERRAL.multiplier}x）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-white rounded-xl px-4 py-3 font-mono text-lg tracking-widest text-center border border-cream-200">
            {DEMO_REFERRAL.code}
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 px-5 py-3 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '已複製' : '複製連結'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          推薦連結：{DEMO_REFERRAL.link}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '推薦人數', value: DEMO_REFERRAL.totalReferred, icon: Users },
          { label: '累計獎勵', value: `NT$ ${DEMO_REFERRAL.totalReward}`, icon: Gift },
          { label: '等級加成', value: `${DEMO_REFERRAL.multiplier}x`, icon: TrendingUp },
          { label: '本月剩餘', value: `${DEMO_REFERRAL.monthlyRemaining} 次`, icon: Shield },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 text-center border border-cream-200">
            <stat.icon size={20} className="mx-auto mb-2 text-gold-500" />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-medium text-gold-600">{String(stat.value)}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4">推薦獎勵規則</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gold-600">推薦人獎勵</h4>
            <div className="space-y-2 text-sm text-foreground/80">
              <p>🎁 好友註冊成功 → 獲得 <strong>50 購物金</strong></p>
              <p>💰 好友首消滿 NT$500 → 再獲 <strong>100 購物金</strong></p>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gold-600">被推薦人獎勵</h4>
            <div className="space-y-2 text-sm text-foreground/80">
              <p>🎁 註冊成功 → 獲得 <strong>30 購物金</strong></p>
              <p>💰 首消滿 NT$500 → 再獲 <strong>50 購物金</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* Tier bonuses */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown size={18} className="text-gold-500" />
          <h3 className="font-medium">等級加成表</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {TIER_BONUSES.map((t) => (
            <div
              key={t.tier}
              className={`flex-shrink-0 text-center p-4 rounded-xl border ${
                t.tier === DEMO_REFERRAL.tier
                  ? 'border-gold-500 bg-gold-500/5'
                  : 'border-cream-200'
              }`}
            >
              <Star size={16} className={`mx-auto mb-1 ${t.color}`} />
              <p className="text-xs text-muted-foreground">{t.tier}</p>
              <p className={`text-sm font-medium ${t.color}`}>{t.multiplier}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          ✨ 訂閱會員每次推薦額外 +20 購物金
        </p>
      </div>

      {/* Referral history */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4">推薦紀錄</h3>
        <div className="space-y-3">
          {DEMO_HISTORY.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 border-b border-cream-200 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-xs">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.date}・{item.event}</p>
                </div>
              </div>
              <div className="text-right">
                {item.status === 'completed' ? (
                  <span className="text-sm font-medium text-gold-600">+NT$ {item.reward}</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-cream-100 rounded-full text-muted-foreground">
                    待完成
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
