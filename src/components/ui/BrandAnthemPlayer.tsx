'use client'

import { useEffect, useRef, useState } from 'react'
import { Music2, Volume2 } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { useBGMStore } from '@/stores/bgmStore'

/**
 * BrandAnthemPlayer — 全網站品牌主題曲浮動播放按鈕
 * ────────────────────────────────────────────────
 * UX 設計（資深電商規範）：
 *   - 預設關閉（瀏覽器擋 autoplay with sound，且用戶體驗優先）
 *   - 左下角浮動 48×48px 按鈕（避開右下角客服 widget）
 *   - 第一次點擊顯示 tooltip「CKMU 品牌主題曲」
 *   - 結帳頁強制暫停（不打擾下單情緒）
 *   - 偵測到頁面 <video> 在播 → 自動暫停 BGM（避免聲音打架）
 *   - 暫停 != stop（保留播放位置，user 可接著聽）
 *   - audio preload="none" 不浪費頻寬
 */

const AUDIO_SRC = '/media/confidence-is-the-silhouette.mp3'

/** 在這些路徑強制暫停 BGM（不干擾下單流程） */
const FORCE_PAUSE_PATHS = ['/checkout', '/login', '/register']

export function BrandAnthemPlayer() {
  const isPlaying = useBGMStore((s) => s.isPlaying)
  const hasInteracted = useBGMStore((s) => s.hasInteracted)
  const volume = useBGMStore((s) => s.volume)
  const togglePlaying = useBGMStore((s) => s.togglePlaying)
  const pause = useBGMStore((s) => s.pause)
  const setHasInteracted = useBGMStore((s) => s.setHasInteracted)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pathname = usePathname()
  const [showTutorial, setShowTutorial] = useState(false)

  /* ── 1. 路徑變更：結帳/登入等強制暫停 ─────────────── */
  useEffect(() => {
    if (FORCE_PAUSE_PATHS.some((p) => pathname.startsWith(p)) && isPlaying) {
      pause()
    }
  }, [pathname, isPlaying, pause])

  /* ── 2. store state ↔ audio element 雙向同步 ─────── */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    if (isPlaying) {
      audio.play().catch(() => {
        // autoplay 被瀏覽器擋住（很少發生因為有用戶 click），fallback 到暫停
        pause()
      })
    } else {
      audio.pause()
    }
  }, [isPlaying, volume, pause])

  /* ── 3. 偵測頁面任一 <video> 開始播 → 暫停 BGM ───── */
  useEffect(() => {
    if (!isPlaying) return
    const handleVideoPlay = (e: Event) => {
      const target = e.target as HTMLMediaElement
      // capture listener 連 BGM 自己 <audio> 的 play 事件都收得到 — 不跳過會自我暫停
      if (target === audioRef.current) return
      // 避免靜音 video 也觸發暫停（很多 hero bg video 是 muted loop）
      if (target.muted) return
      pause()
    }
    document.addEventListener('play', handleVideoPlay, true)
    return () => document.removeEventListener('play', handleVideoPlay, true)
  }, [isPlaying, pause])

  /* ── 4. 點按鈕 ──────────────────────────────── */
  const handleClick = () => {
    if (!hasInteracted) {
      setHasInteracted()
      setShowTutorial(true)
      setTimeout(() => setShowTutorial(false), 4000)
    }
    togglePlaying()
  }

  // 強制暫停路徑上完全不渲染按鈕（避免分散結帳注意力）
  if (FORCE_PAUSE_PATHS.some((p) => pathname.startsWith(p))) {
    return null
  }

  return (
    <>
      {/* preload="none" → 用戶按下才下載；loop → 不間斷 */}
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        loop
        preload="none"
        aria-hidden="true"
      />

      {/* Tutorial tooltip — 首次互動時短暫顯示 */}
      {showTutorial && (
        <div
          className="fixed bottom-24 left-4 md:left-6 z-50 max-w-[240px] bg-foreground text-cream-50 text-xs px-3.5 py-2.5 rounded-lg shadow-xl"
          role="status"
        >
          <p className="font-medium mb-0.5">CKMU 品牌主題曲</p>
          <p className="text-cream-200/80 text-[11px]">
            Confidence is the Silhouette
            <br />
            Urban Icon Collection
          </p>
          <span className="absolute -bottom-1 left-6 w-2 h-2 bg-foreground rotate-45" />
        </div>
      )}

      {/* 浮動按鈕 — 左下，避開右下客服 */}
      <button
        type="button"
        onClick={handleClick}
        aria-label={isPlaying ? '關閉品牌主題曲' : '播放品牌主題曲'}
        aria-pressed={isPlaying}
        title={isPlaying ? '關閉品牌主題曲' : '播放品牌主題曲'}
        className={`fixed bottom-6 left-4 md:left-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 ${
          isPlaying
            ? 'bg-gold-500 text-white ring-4 ring-gold-200'
            : 'bg-white text-foreground/70 border border-cream-300 hover:border-gold-400 hover:text-gold-600'
        }`}
      >
        {isPlaying ? (
          <span className="relative flex items-center justify-center">
            <Volume2 size={18} />
            {/* 跳動的小波紋 — 視覺暗示 BGM 在播 */}
            <span className="absolute -inset-1 rounded-full border-2 border-white/40 animate-ping pointer-events-none" />
          </span>
        ) : (
          <Music2 size={18} />
        )}
      </button>
    </>
  )
}
