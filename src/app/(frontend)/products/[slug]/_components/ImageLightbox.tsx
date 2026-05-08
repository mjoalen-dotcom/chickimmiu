'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

export type LightboxImage = {
  url: string
  alt?: string
  caption?: string
}

type Props = {
  open: boolean
  images: LightboxImage[]
  startIndex?: number
  onClose: () => void
}

const ZOOM_STEPS = [1, 1.75, 2.75]

export default function ImageLightbox({ open, images, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [zoomStep, setZoomStep] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(null)

  // Reset to startIndex whenever the dialog opens
  useEffect(() => {
    if (open) {
      setIndex(Math.max(0, Math.min(startIndex, images.length - 1)))
      setZoomStep(0)
      setPan({ x: 0, y: 0 })
    }
  }, [open, startIndex, images.length])

  const total = images.length
  const current = images[index]

  const next = useCallback(() => {
    if (total <= 1) return
    setIndex((i) => (i + 1) % total)
    setZoomStep(0)
    setPan({ x: 0, y: 0 })
  }, [total])

  const prev = useCallback(() => {
    if (total <= 1) return
    setIndex((i) => (i - 1 + total) % total)
    setZoomStep(0)
    setPan({ x: 0, y: 0 })
  }, [total])

  const cycleZoom = useCallback(() => {
    setZoomStep((s) => (s + 1) % ZOOM_STEPS.length)
    setPan({ x: 0, y: 0 })
  }, [])

  const zoomOut = useCallback(() => {
    setZoomStep(0)
    setPan({ x: 0, y: 0 })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === '+' || e.key === '=') cycleZoom()
      else if (e.key === '-' || e.key === '0') zoomOut()
    }
    window.addEventListener('keydown', onKey)
    // Lock body scroll while open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, next, prev, cycleZoom, zoomOut])

  if (!open || !current) return null

  const zoom = ZOOM_STEPS[zoomStep]
  const isZoomed = zoom > 1

  // Swipe gestures (only when not zoomed; when zoomed, touch = pan)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (isZoomed) {
      dragStart.current = { x: t.clientX, y: t.clientY, startPanX: pan.x, startPanY: pan.y }
    } else {
      touchStart.current = { x: t.clientX, y: t.clientY }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isZoomed || !dragStart.current) return
    const t = e.touches[0]
    setPan({
      x: dragStart.current.startPanX + (t.clientX - dragStart.current.x),
      y: dragStart.current.startPanY + (t.clientY - dragStart.current.y),
    })
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (isZoomed) {
      dragStart.current = null
      return
    }
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next()
      else prev()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="商品圖片放大檢視"
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={(e) => {
        // Click outside the image area closes
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm tracking-wider">
          {index + 1} / {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycleZoom}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="放大"
            title={`放大（目前 ${Math.round(zoom * 100)}%，連點循環）`}
          >
            <ZoomIn size={18} />
          </button>
          {isZoomed && (
            <button
              type="button"
              onClick={zoomOut}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="重置縮放"
              title="重置縮放"
            >
              <ZoomOut size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="關閉"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Image stage */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          // Single tap on image cycles zoom; tap outside (handled on root) closes
          e.stopPropagation()
          if (!isZoomed) cycleZoom()
        }}
      >
        <div
          className="relative w-full h-full max-w-[95vw] max-h-[80vh]"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: dragStart.current ? 'none' : 'transform 200ms ease-out',
            cursor: isZoomed ? 'grab' : 'zoom-in',
          }}
        >
          <Image
            src={current.url}
            alt={current.alt || `商品圖 ${index + 1}`}
            fill
            className="object-contain"
            unoptimized
            draggable={false}
            priority
          />
        </div>

        {/* Prev / Next */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
              aria-label="上一張"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
              aria-label="下一張"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Caption */}
      {current.caption && (
        <div className="px-6 py-3 text-center text-sm text-white/80">
          {current.caption}
        </div>
      )}

      {/* Bottom thumbnails (only when total small/medium) */}
      {total > 1 && total <= 12 && (
        <div className="px-4 pb-4">
          <div className="flex gap-2 justify-center overflow-x-auto scrollbar-hide">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex(i)
                  setZoomStep(0)
                  setPan({ x: 0, y: 0 })
                }}
                className={`relative w-12 h-16 shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                  i === index ? 'border-gold-500' : 'border-white/20 hover:border-white/50'
                }`}
              >
                <Image src={img.url} alt="" fill className="object-cover" unoptimized />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
