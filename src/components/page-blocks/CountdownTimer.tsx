'use client'

import { useEffect, useState } from 'react'

/**
 * CountdownTimer — Page Builder「倒數計時」block 的即時倒數（client）。
 *
 * 為何獨立成 client component：PageBlocks.tsx 是 RSC（無 'use client'），
 * 原本的倒數區塊是純靜態 HTML，四個數字永遠顯示 00。這裡用 setInterval 真實倒數。
 *
 * SSR / hydration：初始 state = null → server 與 client 首次 render 都輸出 "00"
 * （與舊版相同），不會 hydration mismatch；mount 後 effect 才開始每秒更新。
 */

interface Parts {
  d: number
  h: number
  m: number
  s: number
  expired: boolean
}

function calc(endDate: string): Parts {
  const end = new Date(endDate).getTime()
  if (Number.isNaN(end)) return { d: 0, h: 0, m: 0, s: 0, expired: true }
  const now = Date.now()
  const expired = end - now <= 0
  let diff = Math.max(0, end - now)
  const d = Math.floor(diff / 86_400_000)
  diff -= d * 86_400_000
  const h = Math.floor(diff / 3_600_000)
  diff -= h * 3_600_000
  const m = Math.floor(diff / 60_000)
  diff -= m * 60_000
  const s = Math.floor(diff / 1_000)
  return { d, h, m, s, expired }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function CountdownTimer({ endDate, onBg }: { endDate: string; onBg?: boolean }) {
  const [t, setT] = useState<Parts | null>(null)

  useEffect(() => {
    if (!endDate) return
    const tick = () => setT(calc(endDate))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endDate])

  const boxes = [
    { unit: '天', value: t ? pad(t.d) : '00' },
    { unit: '時', value: t ? pad(t.h) : '00' },
    { unit: '分', value: t ? pad(t.m) : '00' },
    { unit: '秒', value: t ? pad(t.s) : '00' },
  ]

  return (
    <div className="flex justify-center gap-3 md:gap-4 mb-8">
      {boxes.map((b) => (
        <div
          key={b.unit}
          className={`rounded-xl p-4 w-16 md:w-20 shadow-sm ${
            onBg ? 'bg-white/95 text-foreground backdrop-blur-sm' : 'bg-white'
          }`}
        >
          <p className="text-2xl md:text-3xl font-medium tabular-nums">{b.value}</p>
          <p className="text-[10px] text-muted-foreground tracking-wider">{b.unit}</p>
        </div>
      ))}
    </div>
  )
}
