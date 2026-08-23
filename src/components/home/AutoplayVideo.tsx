'use client'

import { useEffect, useRef } from 'react'

/**
 * AutoplayVideo — 靜音自動循環播放的通用 video（封面雙欄影片格等用）
 * muted 用 ref 補設（React SSR 的 muted 屬性時序問題，同 HeroVideo 的處理）；
 * BrandAnthemPlayer 會跳過 muted video，BGM 不受影響。
 */
export function AutoplayVideo({
  src,
  poster,
  className,
  label,
}: {
  src: string
  poster?: string
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.play().catch(() => {
      /* autoplay 被擋就停在 poster */
    })
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label || 'CHIC KIM & MIU'}
    />
  )
}
