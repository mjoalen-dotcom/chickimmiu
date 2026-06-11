'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Play, Pause, X, Volume2 } from 'lucide-react'

import { normalizeMediaUrl } from '@/lib/media-url'

/**
 * BrandHeroPlayer — blog 文章頂部影音 hero
 *
 * 渲染：
 *   - heroVideo: poster + 大 play 按鈕 → 點擊全屏 lightbox 播
 *   - heroAudio: inline 音檔播放器（簡易控制：播放/暫停 + 時間 + 進度）
 *   - lyrics:    monospace serif 排版的歌詞區（保留作者換行）
 *   - mediaCredit: 底部 credit line（作詞作曲 / 監製等）
 *
 * 任一欄位空 → 對應區塊不渲染，組件最低 1 欄即可顯示。
 */

type MediaRef =
  | {
      url?: string
      alt?: string
      filename?: string
      width?: number
      height?: number
    }
  | null
  | undefined

interface Props {
  heroVideo?: MediaRef
  heroAudio?: MediaRef
  poster?: MediaRef
  lyrics?: string | null
  mediaCredit?: string | null
  title?: string
}

export function BrandHeroPlayer({
  heroVideo,
  heroAudio,
  poster,
  lyrics,
  mediaCredit,
  title,
}: Props) {
  const hasVideo = Boolean(heroVideo?.url)
  const hasAudio = Boolean(heroAudio?.url)
  const hasLyrics = Boolean(lyrics && lyrics.trim().length > 0)

  if (!hasVideo && !hasAudio && !hasLyrics && !mediaCredit) return null

  return (
    <div className="mb-10 space-y-6">
      {hasVideo && (
        <VideoBlock
          src={normalizeMediaUrl(heroVideo!.url) || heroVideo!.url!}
          poster={
            (poster?.url && (normalizeMediaUrl(poster.url) || poster.url)) || undefined
          }
          alt={heroVideo!.alt || title || 'Brand video'}
          width={heroVideo!.width}
          height={heroVideo!.height}
        />
      )}

      {hasAudio && (
        <AudioBlock
          src={normalizeMediaUrl(heroAudio!.url) || heroAudio!.url!}
          label={hasVideo ? '純音樂版' : 'Listen'}
        />
      )}

      {Boolean(mediaCredit) && (
        <p className="text-center text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          {mediaCredit}
        </p>
      )}

      {hasLyrics && (
        <details
          className="bg-cream-50 border border-cream-200 rounded-2xl overflow-hidden group"
          open
        >
          <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between text-sm font-medium hover:bg-cream-100 transition-colors">
            <span className="tracking-wider uppercase text-[11px] text-muted-foreground">
              Lyrics · 歌詞
            </span>
            <span className="text-gold-500 text-lg transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="px-6 pb-6 pt-2">
            <pre className="font-serif text-sm md:text-base leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
              {lyrics}
            </pre>
          </div>
        </details>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   VideoBlock — poster + lightbox 全屏播
   ════════════════════════════════════════════════════════════════════ */

function VideoBlock({
  src,
  poster,
  alt,
  width,
  height,
}: {
  src: string
  poster?: string
  alt: string
  width?: number
  height?: number
}) {
  const [open, setOpen] = useState(false)
  const aspectRatio = width && height ? `${width} / ${height}` : '1 / 1'

  // ESC 關閉
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block w-full mx-auto rounded-2xl overflow-hidden bg-foreground border border-cream-200 shadow-lg group focus:outline-none focus:ring-2 focus:ring-gold-500"
        style={{ aspectRatio, maxWidth: '720px' }}
        aria-label={`播放：${alt}`}
      >
        {poster ? (
          <Image
            src={poster}
            alt={alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 720px"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-cream-50 text-sm">
            {alt}
          </div>
        )}

        {/* 中央 play 按鈕 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-20 h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
            <Play size={28} className="text-foreground ml-1" fill="currentColor" />
          </span>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 md:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="影片播放"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
            aria-label="關閉"
          >
            <X size={20} />
          </button>
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            style={{ aspectRatio }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════
   AudioBlock — inline 簡易音檔播放器
   ════════════════════════════════════════════════════════════════════ */

function AudioBlock({ src, label }: { src: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setTime(audio.currentTime)
    const onDur = () => setDuration(audio.duration || 0)
    const onEnd = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const progress = duration > 0 ? (time / duration) * 100 : 0

  return (
    <div className="bg-white border border-cream-200 rounded-2xl px-5 py-4 flex items-center gap-4 max-w-3xl mx-auto shadow-sm">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className="shrink-0 w-12 h-12 rounded-full bg-gold-500 hover:bg-gold-600 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-gold-300"
        aria-label={playing ? '暫停' : '播放'}
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5">
          <span className="flex items-center gap-1.5">
            <Volume2 size={12} />
            {label || 'Audio'}
          </span>
          <span className="font-mono tabular-nums">
            {fmt(time)} / {fmt(duration)}
          </span>
        </div>
        <div className="relative h-1 bg-cream-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gold-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
