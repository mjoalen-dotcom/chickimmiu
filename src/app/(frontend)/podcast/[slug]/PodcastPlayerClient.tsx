'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Rewind, FastForward, Gauge } from 'lucide-react'

interface Props {
  audioUrl: string
  durationSeconds?: number
  title: string
}

const SPEEDS = [1, 1.25, 1.5, 1.75, 2]

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '00:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function PodcastPlayerClient({ audioUrl, durationSeconds, title }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationSeconds ?? 0)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setCurrentTime(a.currentTime)
    const onMeta = () => setDuration(a.duration || durationSeconds || 0)
    const onEnd = () => setIsPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
    }
  }, [durationSeconds])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.play()
      setIsPlaying(true)
    } else {
      a.pause()
      setIsPlaying(false)
    }
  }

  const skip = (delta: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta))
  }

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current
    if (!a) return
    const t = Number(e.target.value)
    a.currentTime = t
    setCurrentTime(t)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-5 md:p-6 shadow-sm">
      <audio ref={audioRef} src={audioUrl} preload="metadata" aria-label={title} />

      {/* Progress slider */}
      <div className="mb-4">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={seek}
          className="w-full h-1.5 bg-cream-200 rounded-full appearance-none cursor-pointer accent-gold-500"
          aria-label="播放進度"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5 tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        {/* fallback bar (range styles vary by browser) */}
        <div className="hidden">
          {progress.toFixed(1)}%
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => skip(-15)}
          className="w-10 h-10 rounded-full border border-cream-200 hover:border-gold-400 hover:text-gold-600 transition-colors flex items-center justify-center"
          aria-label="後退 15 秒"
        >
          <Rewind size={16} />
        </button>
        <button
          type="button"
          onClick={toggle}
          className="w-14 h-14 rounded-full bg-foreground text-cream-50 hover:bg-gold-600 transition-colors flex items-center justify-center shadow-md"
          aria-label={isPlaying ? '暫停' : '播放'}
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => skip(30)}
          className="w-10 h-10 rounded-full border border-cream-200 hover:border-gold-400 hover:text-gold-600 transition-colors flex items-center justify-center"
          aria-label="前進 30 秒"
        >
          <FastForward size={16} />
        </button>
        <button
          type="button"
          onClick={cycleSpeed}
          className="ml-2 px-3 h-10 rounded-full border border-cream-200 hover:border-gold-400 hover:text-gold-600 transition-colors flex items-center gap-1.5 text-xs tabular-nums"
          aria-label="調整播放速度"
        >
          <Gauge size={14} />
          {speed.toFixed(2).replace(/\.00$/, '')}x
        </button>
      </div>
    </div>
  )
}
