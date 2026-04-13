'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Swords, Sparkles, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CardBattle } from '@/components/gamification/CardBattle'

/**
 * 卡片對戰邀請頁面
 * ─────────────────
 * URL: /games/card-battle?room=CB-XXXXXXXX-XXXX&ref=REFCODE
 *
 * 當好友透過分享連結進入時，自動開啟對戰房間。
 * 若無 room 參數則顯示「建立新房間」的入口。
 */

function CardBattleContent() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('room') || undefined
  const referralCode = searchParams.get('ref') || undefined
  const [showBattle, setShowBattle] = useState(false)

  // 有 roomCode 時自動開啟對戰
  useEffect(() => {
    if (roomCode) {
      setShowBattle(true)
    }
  }, [roomCode])

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500/10 via-cream-100 to-gold-500/10 border-b border-cream-200">
        <div className="container py-12 md:py-20 text-center">
          <Link
            href="/games"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold-600 transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            返回遊樂園
          </Link>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-600 text-xs tracking-widest mb-4">
            <Swords size={14} />
            CARD BATTLE
          </div>
          <h1 className="text-3xl md:text-4xl font-serif mb-3">抽卡片比大小</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
            邀請好友一起抽卡對戰！
            <br />
            各抽一張卡片，點數大的獲勝。勝者高額獎勵、敗者安慰獎、平手雙方中獎！
          </p>

          {/* Rules */}
          <div className="max-w-lg mx-auto grid grid-cols-3 gap-4 mb-8">
            {[
              { label: '每日上限', value: '3 場' },
              { label: '勝者獎勵', value: '30~80 點' },
              { label: '敗者安慰', value: '5~15 點' },
            ].map((rule) => (
              <div key={rule.label} className="bg-white/70 rounded-xl p-3 border border-cream-200">
                <p className="text-xs text-muted-foreground">{rule.label}</p>
                <p className="text-sm font-medium text-gold-600 mt-0.5">{rule.value}</p>
              </div>
            ))}
          </div>

          {roomCode ? (
            <div className="bg-white rounded-2xl border border-purple-500/20 p-6 max-w-sm mx-auto">
              <Sparkles size={24} className="text-gold-500 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">好友邀請你對戰！</p>
              <p className="text-xs text-muted-foreground mb-4">
                房間代碼：<span className="font-mono text-gold-600">{roomCode}</span>
              </p>
              <button
                onClick={() => setShowBattle(true)}
                className="w-full py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
              >
                加入對戰
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowBattle(true)}
              className="px-8 py-3 bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
            >
              建立對戰房間
            </button>
          )}
        </div>
      </div>

      {/* How to play */}
      <div className="container py-12 md:py-16">
        <h2 className="text-xl font-serif text-center mb-8">遊戲流程</h2>
        <div className="grid md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {[
            { step: 1, title: '建立房間', desc: '發起對戰並獲得專屬房間代碼' },
            { step: 2, title: '邀請好友', desc: '分享連結或代碼邀請好友加入' },
            { step: 3, title: '雙方翻牌', desc: '各自抽取一張撲克牌' },
            { step: 4, title: '公佈結果', desc: '比大小、領獎勵、再來一局！' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-gold-500/10 flex items-center justify-center text-gold-600 font-serif text-lg mb-3">
                {item.step}
              </div>
              <p className="text-sm font-medium mb-1">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Referral integration note */}
        <div className="mt-12 bg-gradient-to-br from-gold-500/5 to-cream-100 rounded-2xl border border-gold-500/20 p-6 md:p-8 text-center max-w-lg mx-auto">
          <p className="text-xs tracking-widest text-gold-500 mb-2">推薦碼加碼</p>
          <p className="text-sm leading-relaxed">
            透過推薦碼邀請新朋友對戰，雙方額外獲得
            <span className="text-gold-600 font-medium"> 20 點獎勵</span>！
            <br />
            新朋友註冊即享首購優惠，你也能累積推薦獎勵。
          </p>
        </div>
      </div>

      {/* Battle Modal */}
      <CardBattle
        open={showBattle}
        onClose={() => setShowBattle(false)}
        roomCode={roomCode}
        referralCode={referralCode}
      />
    </>
  )
}

export default function CardBattlePage() {
  return (
    <main className="bg-cream-50 min-h-screen">
      <Suspense fallback={<div className="container py-20 text-center text-sm text-muted-foreground">載入中...</div>}>
        <CardBattleContent />
      </Suspense>
    </main>
  )
}
