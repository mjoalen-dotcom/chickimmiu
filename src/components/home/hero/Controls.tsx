'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ControlsProps {
  current: number
  total: number
  setCurrent: (i: number) => void
  prev: () => void
  next: () => void
  /** light = 用在深色 hero（白色 dot），dark = 用在淺色 hero（深色 dot） */
  tone?: 'light' | 'dark'
}

export function HeroControls({ current, total, setCurrent, prev, next, tone = 'dark' }: ControlsProps) {
  if (total <= 1) return null
  const dotInactive = tone === 'light' ? 'bg-white/40' : 'bg-foreground/20'
  const dotActive = tone === 'light' ? 'bg-white' : 'bg-brand-primary'
  const btnClass =
    tone === 'light'
      ? 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md'
      : 'bg-white/80 hover:bg-white text-foreground backdrop-blur-sm'

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
      <button
        onClick={prev}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${btnClass}`}
        aria-label="上一張"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="flex gap-2 items-center">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all ${i === current ? `w-6 ${dotActive}` : `w-2 ${dotInactive}`}`}
            aria-label={`第 ${i + 1} 張`}
          />
        ))}
      </div>
      <button
        onClick={next}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${btnClass}`}
        aria-label="下一張"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
