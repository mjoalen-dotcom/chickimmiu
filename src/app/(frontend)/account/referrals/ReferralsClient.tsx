'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Users, Gift, TrendingUp, Share2, Crown, Star, Shield } from 'lucide-react'

/* ── Types from server ── */
export type ReferralSummary = {
  code: string
  linkPrefix: string
  tierSlug: string
  tierDisplayName: string
  multiplier: number
  totalReferred: number
  totalReward: number
  monthlyRemaining: number
  monthlyLimit: number
}
export type ReferralHistoryItem = {
  id: string
  name: string
  date: string
  status: 'completed' | 'pending'
  event: string
  reward: number
}
export type TierBonusRow = {
  slug: string
  displayName: string
  multiplier: number
  isCurrent: boolean
}
export type RewardRules = {
  referrerSignup: number
  referrerPurchase: number
  refereeSignup: number
  refereePurchase: number
  subscriberBonus: number
  minPurchaseAmount: number
  enabled: boolean
}

/* ── Tier color lookup (Tailwind, not in DB) ── */
const TIER_TEXT_COLORS: Record<string, string> = {
  bronze: 'text-orange-600',
  silver: 'text-gray-500',
  gold: 'text-gold-600',
  platinum: 'text-blue-500',
  diamond: 'text-purple-500',
}

export default function ReferralsClient({
  summary,
  history,
  tierBonuses,
  rewards,
}: {
  summary: ReferralSummary
  history: ReferralHistoryItem[]
  tierBonuses: TierBonusRow[]
  rewards: RewardRules
}) {
  const [copied, setCopied] = useState(false)
  const [absoluteLink, setAbsoluteLink] = useState<string>('')

  // Construct absolute URL on client to avoid server-side host detection complexity
  useEffect(() => {
    if (!summary.code || typeof window === 'undefined') return
    const prefix = summary.linkPrefix.startsWith('/') ? summary.linkPrefix : `/${summary.linkPrefix}`
    setAbsoluteLink(`${window.location.origin}${prefix}${summary.code}`)
  }, [summary.code, summary.linkPrefix])

  const copyCode = () => {
    if (!absoluteLink) return
    navigator.clipboard.writeText(absoluteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasCode = Boolean(summary.code)
  const fallbackLink = summary.code ? `${summary.linkPrefix}${summary.code}` : ''

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
              等級加成：{summary.tierDisplayName}（{summary.multiplier}x）
            </p>
          </div>
        </div>

        {hasCode ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-white rounded-xl px-4 py-3 font-mono text-lg tracking-widest text-center border border-cream-200">
                {summary.code}
              </div>
              <button
                onClick={copyCode}
                disabled={!absoluteLink}
                className="flex items-center gap-2 px-5 py-3 bg-gold-500 text-white rounded-xl text-sm hover:bg-gold-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? '已複製' : '複製連結'}
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              推薦連結：{absoluteLink || fallbackLink}
            </p>
          </>
        ) : (
          <div className="bg-white rounded-xl p-4 text-center text-sm text-muted-foreground">
            尚未產生推薦碼。請聯絡客服或至會員中心生成專屬推薦碼。
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '推薦人數', value: summary.totalReferred, icon: Users },
          { label: '累計獎勵', value: `NT$ ${summary.totalReward.toLocaleString()}`, icon: Gift },
          { label: '等級加成', value: `${summary.multiplier}x`, icon: TrendingUp },
          { label: '本月剩餘', value: `${summary.monthlyRemaining} 次`, icon: Shield },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 text-center border border-cream-200">
            <stat.icon size={20} className="mx-auto mb-2 text-gold-500" />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-medium text-gold-600">{String(stat.value)}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      {rewards.enabled && (
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <h3 className="font-medium mb-4">推薦獎勵規則</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gold-600">推薦人獎勵</h4>
              <div className="space-y-2 text-sm text-foreground/80">
                <p>🎁 好友註冊成功 → 獲得 <strong>{rewards.referrerSignup} 購物金</strong></p>
                <p>💰 好友首消滿 NT${rewards.minPurchaseAmount.toLocaleString()} → 再獲 <strong>{rewards.referrerPurchase} 購物金</strong></p>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gold-600">被推薦人獎勵</h4>
              <div className="space-y-2 text-sm text-foreground/80">
                <p>🎁 註冊成功 → 獲得 <strong>{rewards.refereeSignup} 購物金</strong></p>
                <p>💰 首消滿 NT${rewards.minPurchaseAmount.toLocaleString()} → 再獲 <strong>{rewards.refereePurchase} 購物金</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier bonuses */}
      {tierBonuses.length > 0 && (
        <div className="bg-white rounded-2xl border border-cream-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={18} className="text-gold-500" />
            <h3 className="font-medium">等級加成表</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {tierBonuses.map((t) => {
              const color = TIER_TEXT_COLORS[t.slug] ?? 'text-gray-500'
              return (
                <div
                  key={t.slug}
                  className={`flex-shrink-0 text-center p-4 rounded-xl border ${
                    t.isCurrent
                      ? 'border-gold-500 bg-gold-500/5'
                      : 'border-cream-200'
                  }`}
                >
                  <Star size={16} className={`mx-auto mb-1 ${color}`} />
                  <p className="text-xs text-muted-foreground">{t.displayName}</p>
                  <p className={`text-sm font-medium ${color}`}>{t.multiplier}x</p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ✨ 訂閱會員每次推薦額外 +{rewards.subscriberBonus} 購物金
          </p>
        </div>
      )}

      {/* Referral history */}
      <div className="bg-white rounded-2xl border border-cream-200 p-6">
        <h3 className="font-medium mb-4">推薦紀錄</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">尚未有推薦紀錄。</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
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
                    <span className="text-sm font-medium text-gold-600">+NT$ {item.reward.toLocaleString()}</span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-cream-100 rounded-full text-muted-foreground">
                      待完成
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
