'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import { HexColorPicker, HexColorInput } from 'react-colorful'

/**
 * ColorEyedropperField
 * ─────────────────────
 * Custom Field for Products.variants[].colorCode.
 *
 * 給 admin 4 條輸入色碼路徑：
 *   1. 手填 hex（HexColorInput）
 *   2. 「🎯 自動主色」一鍵：取同 row colorSwatch 圖片中央 20×20 像素平均色
 *   3. 「📍 滴管取色」popover：載入 colorSwatch 到 canvas，hover 顯示即時 RGB +
 *      放大鏡，點任一像素寫入 colorCode
 *   4. 「🎨 色票面板」popover：react-colorful 標準 hex picker（沒上傳色塊圖時用）
 *
 * Source 圖：sibling `colorSwatch` upload 欄位。沒上傳就 disable 滴管/自動按鈕。
 *
 * MUST be a client component — Payload v3 admin.components.Field inside an
 * array silently empties the entire form's render-fields if it's async/RSC.
 *
 * 圖片 sampling 走 canvas 2D getImageData；同源 URL（/api/media/...）不需 CORS
 * 設定。如果未來改用 R2 / CDN 跨域，要在 Image() 加 crossOrigin='anonymous'。
 */

interface Props {
  path: string
  field?: { label?: string | Record<string, string>; admin?: { description?: string } }
}

type Mode = 'closed' | 'eyedropper' | 'palette'

const PRESET_SWATCHES = [
  '#FFFFFF', '#F5F5F5', '#E0E0E0', '#9E9E9E', '#424242', '#000000',
  '#FDF7F0', '#F5E8D0', '#E8C8A0', '#C19A5B', '#8B6F47', '#5D4A30',
  '#FCEDEC', '#F8C9C5', '#EE9C95', '#D9645B', '#B23A30', '#7C1F18',
  '#FFF0E6', '#FFD7B5', '#FFAA66', '#FF7E1F', '#CC5500', '#8B3500',
  '#F0F8E8', '#C8E6A0', '#9CCC65', '#558B2F', '#33691E', '#1B5E20',
  '#E8F0F8', '#A0C4E8', '#5C90D5', '#1565C0', '#0D47A1', '#062F6F',
  '#F0E8F8', '#C8A2DC', '#9C27B0', '#6A1B9A', '#4A148C', '#2E0854',
]

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

const ColorEyedropperField: React.FC<Props> = ({ path, field }) => {
  const { value, setValue } = useField<string>({ path })

  /* ── Sibling colorSwatch (upload media id) ── */
  const swatchPath = path.replace(/\.colorCode$/, '.colorSwatch')
  const swatchRaw = useFormFields(([fields]) => fields[swatchPath]?.value as unknown)
  const swatchId = (() => {
    if (!swatchRaw) return null
    if (typeof swatchRaw === 'number' || typeof swatchRaw === 'string') return swatchRaw
    if (typeof swatchRaw === 'object' && 'id' in (swatchRaw as Record<string, unknown>)) {
      return (swatchRaw as { id: number | string }).id
    }
    return null
  })()

  const [swatchUrl, setSwatchUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('closed')
  const [hoverColor, setHoverColor] = useState<string | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  /* ── 拉 swatch URL：拿 mediaId 後 fetch /api/media/{id} ── */
  useEffect(() => {
    if (!swatchId) {
      setSwatchUrl(null)
      return
    }
    let cancelled = false
    fetch(`/api/media/${swatchId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const url = (d as { url?: string } | null)?.url
        setSwatchUrl(url ?? null)
      })
      .catch(() => {
        if (!cancelled) setSwatchUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [swatchId])

  /* ── 載入圖到 canvas（滴管模式開啟時） ── */
  useEffect(() => {
    if (mode !== 'eyedropper' || !swatchUrl) return
    const canvas = canvasRef.current
    if (!canvas) return
    const img = new Image()
    img.onload = () => {
      const maxW = 280
      const ratio = img.width / img.height
      const w = Math.min(maxW, img.width)
      const h = Math.round(w / ratio)
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(img, 0, 0, w, h)
      }
    }
    img.onerror = () => setError('色塊圖載入失敗，請確認 media 仍存在')
    img.src = swatchUrl
  }, [mode, swatchUrl])

  /* ── Click outside 關閉 popover ── */
  useEffect(() => {
    if (mode === 'closed') return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMode('closed')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mode])

  /* ── Helpers ── */
  const hex = typeof value === 'string' && /^#?[0-9a-fA-F]{6}$/.test(value)
    ? (value.startsWith('#') ? value.toUpperCase() : `#${value.toUpperCase()}`)
    : ''

  const sampleAtPixel = (canvas: HTMLCanvasElement, x: number, y: number): string | null => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    try {
      const data = ctx.getImageData(x, y, 1, 1).data
      return rgbToHex(data[0], data[1], data[2])
    } catch (e) {
      console.error('[ColorEyedropperField] getImageData failed:', e)
      return null
    }
  }

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return
    const c = sampleAtPixel(canvas, x, y)
    if (c) {
      setHoverColor(c)
      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)
    const c = sampleAtPixel(canvas, x, y)
    if (c) {
      setValue(c)
      setMode('closed')
    }
  }

  /* ── Auto main color：載原圖到 offscreen canvas 取中心區塊平均 ── */
  const handleAutoMain = async () => {
    if (!swatchUrl || busy) return
    setBusy(true)
    setError(null)
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          try {
            const off = document.createElement('canvas')
            off.width = img.width
            off.height = img.height
            const ctx = off.getContext('2d')
            if (!ctx) {
              reject(new Error('canvas context unavailable'))
              return
            }
            ctx.drawImage(img, 0, 0)
            const cx = Math.floor(img.width / 2)
            const cy = Math.floor(img.height / 2)
            const sampleSize = Math.min(20, img.width, img.height)
            const sx = Math.max(0, cx - Math.floor(sampleSize / 2))
            const sy = Math.max(0, cy - Math.floor(sampleSize / 2))
            const data = ctx.getImageData(sx, sy, sampleSize, sampleSize).data
            let r = 0
            let g = 0
            let b = 0
            const total = data.length / 4
            for (let i = 0; i < data.length; i += 4) {
              r += data[i]
              g += data[i + 1]
              b += data[i + 2]
            }
            setValue(rgbToHex(r / total, g / total, b / total))
            resolve()
          } catch (err) {
            reject(err as Error)
          }
        }
        img.onerror = () => reject(new Error('圖片載入失敗'))
        img.src = swatchUrl
      })
    } catch (err) {
      setError((err as Error).message || '取色失敗')
    } finally {
      setBusy(false)
    }
  }

  const label =
    typeof field?.label === 'string'
      ? field.label
      : field?.label && typeof field.label === 'object'
        ? field.label['zh-TW'] || field.label['en'] || '色碼'
        : '色碼'

  const hasSwatch = Boolean(swatchUrl)

  return (
    <div className="field-type" style={{ marginBottom: 16 }} ref={wrapRef}>
      <label
        className="field-label"
        style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}
      >
        {label}
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        {/* Swatch preview */}
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            background: hex || 'repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 50% / 12px 12px',
            flexShrink: 0,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          }}
        />

        {/* Hex input */}
        <HexColorInput
          color={hex || '#FFFFFF'}
          onChange={(c) => setValue(c.toUpperCase())}
          prefixed
          placeholder="#RRGGBB"
          style={{
            flex: 1,
            padding: '7px 10px',
            fontSize: 13,
            fontFamily: 'monospace',
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background: 'var(--theme-input-bg, #fff)',
            color: 'var(--theme-elevation-800, #18181b)',
            textTransform: 'uppercase',
            minWidth: 90,
          }}
        />

        {/* 自動主色 */}
        <button
          type="button"
          onClick={handleAutoMain}
          disabled={!hasSwatch || busy}
          title={hasSwatch ? '取色塊圖中央 20×20 像素平均色' : '請先上傳色塊圖'}
          style={{
            padding: '6px 9px',
            fontSize: 11,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background: 'var(--theme-elevation-0, #fff)',
            color: hasSwatch ? 'var(--theme-text, #333)' : '#aaa',
            cursor: hasSwatch && !busy ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          {busy ? '…' : '🎯 自動'}
        </button>

        {/* 滴管 */}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'eyedropper' ? 'closed' : 'eyedropper')
            setHoverColor(null)
          }}
          disabled={!hasSwatch}
          title={hasSwatch ? '從色塊圖滴管取色' : '請先上傳色塊圖'}
          style={{
            padding: '6px 9px',
            fontSize: 11,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background:
              mode === 'eyedropper' ? 'var(--theme-elevation-100, #f4f4f5)' : 'var(--theme-elevation-0, #fff)',
            color: hasSwatch ? 'var(--theme-text, #333)' : '#aaa',
            cursor: hasSwatch ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          📍 滴管
        </button>

        {/* 色票面板 */}
        <button
          type="button"
          onClick={() => setMode(mode === 'palette' ? 'closed' : 'palette')}
          title="開色票面板"
          style={{
            padding: '6px 9px',
            fontSize: 11,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background:
              mode === 'palette' ? 'var(--theme-elevation-100, #f4f4f5)' : 'var(--theme-elevation-0, #fff)',
            color: 'var(--theme-text, #333)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          🎨 色票
        </button>

        {/* Eyedropper popover */}
        {mode === 'eyedropper' && swatchUrl && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              zIndex: 30,
              padding: 12,
              background: 'var(--theme-bg, #fff)',
              border: '1px solid var(--theme-elevation-200, #d4d4d8)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
              minWidth: 304,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--theme-elevation-500, #71717a)',
                marginBottom: 6,
              }}
            >
              滑鼠移動 → 即時取色 / 點擊任一像素套用
            </div>
            <div style={{ position: 'relative', width: '100%' }}>
              <canvas
                ref={canvasRef}
                onMouseMove={onCanvasMove}
                onMouseLeave={() => {
                  setHoverColor(null)
                  setHoverPos(null)
                }}
                onClick={onCanvasClick}
                style={{
                  width: '100%',
                  cursor: 'crosshair',
                  borderRadius: 6,
                  display: 'block',
                  background: '#fafafa',
                }}
              />
              {hoverColor && hoverPos && (
                <div
                  style={{
                    position: 'absolute',
                    top: hoverPos.y + 14,
                    left: hoverPos.x + 14,
                    pointerEvents: 'none',
                    background: 'rgba(0,0,0,0.85)',
                    color: '#fff',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    padding: '4px 8px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: hoverColor,
                      border: '1px solid rgba(255,255,255,0.4)',
                    }}
                  />
                  {hoverColor}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Palette popover */}
        {mode === 'palette' && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              zIndex: 30,
              padding: 14,
              background: 'var(--theme-bg, #fff)',
              border: '1px solid var(--theme-elevation-200, #d4d4d8)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
              width: 240,
            }}
          >
            <HexColorPicker
              color={hex || '#C19A5B'}
              onChange={(c) => setValue(c.toUpperCase())}
              style={{ width: '100%', height: 160 }}
            />
            <div
              style={{
                marginTop: 10,
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 4,
              }}
            >
              {PRESET_SWATCHES.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => {
                    setValue(sw)
                  }}
                  aria-label={`色票 ${sw}`}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 4,
                    background: sw,
                    border:
                      hex && hex.toUpperCase() === sw.toUpperCase()
                        ? '2px solid var(--theme-success-500, #16a34a)'
                        : '1px solid rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: '#c00', marginTop: 4 }}>{error}</p>
      )}

      {field?.admin?.description && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--theme-elevation-500, #71717a)',
            marginTop: 4,
          }}
        >
          {field.admin.description}
        </p>
      )}
    </div>
  )
}

export default ColorEyedropperField
