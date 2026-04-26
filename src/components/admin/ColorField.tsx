'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useField } from '@payloadcms/ui'
import { HexColorPicker, HexColorInput } from 'react-colorful'

/**
 * ColorField
 * ──────────
 * Canva-style color picker for SiteThemes palette fields.
 * Stores a hex string (#RRGGBB) in Payload.
 *
 * MUST be a client component — Payload v3 admin.components.Field inside a
 * group silently empties the form's render-fields if the component is async/RSC.
 */

const SWATCHES = [
  '#FDFBF7', '#F9F5EC', '#F2EAD6', '#EADCB8',
  '#E2C89A', '#D4AF77', '#C19A5B', '#A8824A',
  '#FDF7F5', '#FBEDE8', '#F6D7CD', '#EFBBAA',
  '#FFE0EC', '#FFB6CE', '#FF89B5', '#E91E63',
  '#E8F5E9', '#A5D6A7', '#66BB6A', '#2E7D32',
  '#E3F2FD', '#90CAF9', '#42A5F5', '#1565C0',
  '#FFF3E0', '#FFCC80', '#FF9800', '#E65100',
  '#F3E5F5', '#CE93D8', '#AB47BC', '#6A1B9A',
  '#FFFFFF', '#F5F5F5', '#9E9E9E', '#2C2C2C',
]

interface ColorFieldProps {
  path: string
  field?: { label?: string | Record<string, string>; admin?: { description?: string } }
}

const ColorField: React.FC<ColorFieldProps> = ({ path, field }) => {
  const { value, setValue } = useField<string>({ path })
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const hex = typeof value === 'string' && /^#?[0-9a-fA-F]{6}$/.test(value)
    ? (value.startsWith('#') ? value : `#${value}`)
    : '#C19A5B'

  // Click-outside close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = typeof field?.label === 'string'
    ? field.label
    : (field?.label && typeof field.label === 'object'
        ? (field.label['zh-TW'] || field.label['en'] || path.split('.').pop())
        : path.split('.').pop())

  return (
    <div className="field-type" style={{ marginBottom: 16 }} ref={wrapRef}>
      <label
        className="field-label"
        style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 }}
      >
        {label}
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="開啟取色器"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            background: hex,
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          }}
        />

        <HexColorInput
          color={hex}
          onChange={(c) => setValue(c)}
          prefixed
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: 'monospace',
            border: '1px solid var(--theme-elevation-200, #d4d4d8)',
            borderRadius: 6,
            background: 'var(--theme-input-bg, #fff)',
            color: 'var(--theme-elevation-800, #18181b)',
            textTransform: 'uppercase',
          }}
        />

        {open && (
          <div
            ref={popoverRef}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              zIndex: 10,
              padding: 16,
              background: 'var(--theme-bg, #fff)',
              border: '1px solid var(--theme-elevation-200, #d4d4d8)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              width: 240,
            }}
          >
            <HexColorPicker
              color={hex}
              onChange={(c) => setValue(c)}
              style={{ width: '100%', height: 180 }}
            />
            <div
              style={{
                marginTop: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(9, 1fr)',
                gap: 4,
              }}
            >
              {SWATCHES.map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setValue(sw)}
                  aria-label={`色票 ${sw}`}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: sw,
                    border: hex.toUpperCase() === sw.toUpperCase()
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

      {field?.admin?.description && (
        <p style={{ fontSize: 11, color: 'var(--theme-elevation-500, #71717a)', marginTop: 4 }}>
          {field.admin.description}
        </p>
      )}
    </div>
  )
}

export default ColorField
