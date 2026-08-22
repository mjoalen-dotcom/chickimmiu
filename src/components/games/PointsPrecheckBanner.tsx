'use client'

import Link from 'next/link'
import { AlertTriangle, Coins, LogIn, Sparkles } from 'lucide-react'

/**
 * PointsPrecheckBanner — 遊戲/測驗開始前的點數預檢（2026-08-22 需求）
 * ──────────────────────────────────────────────────────────────────
 * server 端（games/[slug]/page.tsx）算好餘額/消耗/免費次數傳進來，
 * 玩家在按「開始」前就知道這一局要不要扣點、扣得起扣不起。
 * 扣點的最終防線仍在 API（點數不足 server 會擋），這裡只是事前透明化。
 * 色弱相容：狀態不靠色相區分 — 皆有 icon + 文字 + 邊框明度對比。
 */

export type GamePrecheck =
  | { loggedIn: false }
  | {
      loggedIn: true
      points: number
      pointsCost: number
      freePlaysLeft: number | null
      dailyRemaining: number | null
    }

export function PointsPrecheckBanner({ precheck }: { precheck: GamePrecheck }) {
  if (!precheck.loggedIn) {
    return (
      <div className="container pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border border-cream-200 bg-white px-5 py-4">
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <Coins size={16} className="shrink-0" />
            登入後這裡會先顯示你的點數餘額與本次消耗，玩之前心裡有數
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase border border-neutral-800 px-4 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
          >
            <LogIn size={13} /> 登入
          </Link>
        </div>
      </div>
    )
  }

  const { points, pointsCost, freePlaysLeft, dailyRemaining } = precheck

  // 今日次數用完 — 其他資訊都不重要了
  if (dailyRemaining === 0) {
    return (
      <div className="container pt-6">
        <div className="flex items-center gap-2.5 border border-cream-200 bg-white px-5 py-4 text-sm text-neutral-600">
          <Sparkles size={16} className="shrink-0" />
          今日遊玩次數已用完，明天再來！你目前有 {points.toLocaleString()} 點。
        </div>
      </div>
    )
  }

  // 免費次數還有 — 先講好消息
  if (freePlaysLeft !== null && freePlaysLeft > 0) {
    return (
      <div className="container pt-6">
        <div className="flex items-center gap-2.5 border border-cream-200 bg-white px-5 py-4 text-sm text-neutral-700">
          <Sparkles size={16} className="text-gold-600 shrink-0" />
          <span>
            今日免費次數還有 <strong className="font-medium">{freePlaysLeft}</strong> 次
            {pointsCost > 0 && <>，用完後每次消耗 {pointsCost} 點</>}
            ｜目前點數 {points.toLocaleString()} 點
          </span>
        </div>
      </div>
    )
  }

  // 免遊玩成本的遊戲不用打擾
  if (pointsCost <= 0) return null

  // 要扣點但點數不足 — 醒目警示 + 賺點出口
  if (points < pointsCost) {
    return (
      <div className="container pt-6">
        <div className="border-2 border-neutral-900 bg-white px-5 py-4">
          <p className="flex items-center gap-2.5 text-sm font-medium text-neutral-900">
            <AlertTriangle size={17} className="shrink-0" />
            點數不足：本次需要 {pointsCost} 點，你目前只有 {points.toLocaleString()} 點
          </p>
          <div className="flex flex-wrap gap-3 mt-3 pl-[27px]">
            <Link
              href="/games/daily-checkin"
              className="inline-flex items-center gap-1.5 text-xs tracking-[0.15em] border border-neutral-800 px-4 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
            >
              每日簽到賺點
            </Link>
            <Link
              href="/guide#points"
              className="inline-flex items-center gap-1.5 text-xs tracking-[0.15em] text-neutral-600 underline underline-offset-4 hover:text-foreground transition-colors py-2"
            >
              更多賺點方法
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 扣得起 — 平實告知
  return (
    <div className="container pt-6">
      <div className="flex items-center gap-2.5 border border-cream-200 bg-white px-5 py-4 text-sm text-neutral-700">
        <Coins size={16} className="text-gold-600 shrink-0" />
        本次遊玩將扣 <strong className="font-medium">{pointsCost}</strong> 點｜目前點數 {points.toLocaleString()} 點
      </div>
    </div>
  )
}
