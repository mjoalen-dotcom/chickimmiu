'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'

/**
 * WelcomeTour — 首訪任務式導覽（2026-08-22 需求 ①）
 * ──────────────────────────────────────────────────
 * Alan 指示：「像是上癮的遊戲，會指導那邊拿點數、那邊用、測驗個性、
 * 如何升等、優惠與兌換」→ 做成 5 站遊戲迴圈引導，每站都有直達 CTA：
 * 拿點數 → 測驗個性 → 升等 → 兌換優惠。
 * 首訪（localStorage 無旗標）在 /home 彈出；點 CTA / 略過 / 完成
 * 都寫旗標，之後不再打擾。完整版說明在 /guide（永久入口）。
 */

const STORAGE_KEY = 'ckmu_tour_v1'

type Step = {
  emoji: string
  tag: string
  title: string
  desc: string
  ctaLabel: string
  ctaHref: string
}

const STEPS: Step[] = [
  {
    emoji: '👋',
    tag: 'WELCOME',
    title: '歡迎來到 CHIC KIM & MIU',
    desc: '這裡不只買衣服 — 簽到、看文、玩遊戲都能賺點數，點數換優惠，越玩越划算。花 30 秒帶你走一圈。',
    ctaLabel: '開始',
    ctaHref: '',
  },
  {
    emoji: '🪙',
    tag: 'STEP 1 · 拿點數',
    title: '先把點數拿起來',
    desc: '每日簽到天天送、連 7 天有加碼；看穿搭誌文章也給點。這是整個迴圈的起點。',
    ctaLabel: '去簽到領點',
    ctaHref: '/games/daily-checkin',
  },
  {
    emoji: '🔮',
    tag: 'STEP 2 · 測驗個性',
    title: '測出妳的穿搭人格',
    desc: '用點數玩 MBTI 穿搭測驗，解鎖專屬人格卡與個性化穿搭推薦。測驗前頁面會先顯示餘額，扣多少一目了然。',
    ctaLabel: '去測驗',
    ctaHref: '/games/mbti-style',
  },
  {
    emoji: '👑',
    tag: 'STEP 3 · 升等',
    title: '等級越高，福利越多',
    desc: '消費自動升級：購物回饋變多、遊戲免費次數變多、生日禮升級。看看妳離下一級還差多少。',
    ctaLabel: '看等級福利',
    ctaHref: '/membership-benefits',
  },
  {
    emoji: '🎁',
    tag: 'STEP 4 · 優惠與兌換',
    title: '把點數花在刀口上',
    desc: '結帳直接折抵，或到點數中心兌換專屬好禮。賺、玩、升、換 — 迴圈跑起來。',
    ctaLabel: '去兌換好禮',
    ctaHref: '/account/points',
  },
]

export function WelcomeTour() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch {
      return
    }
    const timer = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  const markDone = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch { /* 私密模式寫不進去就算了，下次再顯示 */ }
    setOpen(false)
  }

  if (!open) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="新手導覽"
      onClick={markDone}
    >
      <div
        className="w-full max-w-md bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-cream-200 px-6 py-4">
          <p className="text-[10px] tracking-[0.3em] text-neutral-400 uppercase">{current.tag}</p>
          <button
            onClick={markDone}
            aria-label="關閉導覽"
            className="p-1.5 text-neutral-400 hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-8 text-center">
          <p className="text-4xl mb-4">{current.emoji}</p>
          <h2 className="text-xl font-serif mb-3">{current.title}</h2>
          <p className="text-sm text-neutral-500 leading-6">{current.desc}</p>
        </div>

        {/* progress dots — 形狀+明度雙重編碼（非只靠顏色） */}
        <div className="flex items-center justify-center gap-2 pb-6" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i === step
                  ? 'h-1.5 w-6 bg-neutral-900 transition-all'
                  : 'h-1.5 w-1.5 bg-neutral-300 transition-all'
              }
            />
          ))}
        </div>

        {/* actions */}
        <div className="border-t border-cream-200 px-6 py-4 space-y-3">
          {current.ctaHref ? (
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={current.ctaHref}
                onClick={markDone}
                className="inline-flex items-center justify-center gap-1.5 bg-neutral-900 text-white px-4 py-3 text-xs tracking-[0.2em] uppercase hover:bg-neutral-700 transition-colors"
              >
                {current.ctaLabel} <ArrowRight size={12} />
              </Link>
              {isLast ? (
                <button
                  onClick={markDone}
                  className="inline-flex items-center justify-center border border-neutral-300 px-4 py-3 text-xs tracking-[0.2em] uppercase text-neutral-600 hover:border-neutral-800 hover:text-foreground transition-colors"
                >
                  完成導覽
                </button>
              ) : (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="inline-flex items-center justify-center border border-neutral-300 px-4 py-3 text-xs tracking-[0.2em] uppercase text-neutral-600 hover:border-neutral-800 hover:text-foreground transition-colors"
                >
                  下一站
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setStep(1)}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-neutral-900 text-white px-4 py-3 text-xs tracking-[0.2em] uppercase hover:bg-neutral-700 transition-colors"
            >
              開始導覽 <ArrowRight size={12} />
            </button>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={markDone}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 underline underline-offset-4 transition-colors"
            >
              略過
            </button>
            <Link
              href="/guide"
              onClick={markDone}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 underline underline-offset-4 transition-colors"
            >
              看完整新手教學
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
