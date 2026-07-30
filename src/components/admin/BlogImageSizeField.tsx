'use client'

import { useField } from '@payloadcms/ui'
import React from 'react'

interface BlogImageSizeFieldProps {
  path: string
  field?: {
    admin?: {
      description?: string
      step?: number
    }
    defaultValue?: number
    label?: string | Record<string, string>
    max?: number
    min?: number
  }
}

function localizedLabel(label: string | Record<string, string> | undefined) {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') {
    return label['zh-TW'] || label.en || '顯示寬度'
  }
  return '顯示寬度'
}

export default function BlogImageSizeField({
  path,
  field,
}: BlogImageSizeFieldProps) {
  const { setValue, value } = useField<number | null>({ path })
  const min = Number.isFinite(field?.min) ? Number(field?.min) : 24
  const max = Number.isFinite(field?.max) ? Number(field?.max) : 1200
  const step = Number.isFinite(field?.admin?.step)
    ? Number(field?.admin?.step)
    : 4
  const fallback = Number.isFinite(field?.defaultValue)
    ? Number(field?.defaultValue)
    : 96
  const width = Math.min(max, Math.max(min, Number(value) || fallback))
  const presets = [48, 72, 96, 144, 240, 320, 480, 720].filter(
    (preset) => preset >= min && preset <= max,
  )

  function update(next: number) {
    if (!Number.isFinite(next)) return
    setValue(Math.min(max, Math.max(min, Math.round(next))))
  }

  return (
    <div className="field-type" style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <label
          htmlFor={`${path}-range`}
          style={{ color: 'var(--theme-text)', fontSize: 13, fontWeight: 600 }}
        >
          {localizedLabel(field?.label)}
        </label>
        <span
          style={{
            color: 'var(--theme-elevation-600)',
            fontSize: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {width}px
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(140px, 1fr) 88px',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <input
          id={`${path}-range`}
          type="range"
          aria-label="圖片顯示寬度"
          min={min}
          max={max}
          step={step}
          value={width}
          onChange={(event) => update(event.currentTarget.valueAsNumber)}
          style={{ width: '100%', accentColor: '#a25e5e' }}
        />
        <div>
          <input
            type="number"
            aria-label="圖片寬度像素"
            min={min}
            max={max}
            step={step}
            value={width}
            onChange={(event) => update(event.currentTarget.valueAsNumber)}
            style={{
              width: '100%',
              minHeight: 38,
              padding: '7px 10px',
              border: '1px solid var(--theme-elevation-250)',
              borderRadius: 6,
              background: 'var(--theme-input-bg)',
              color: 'var(--theme-text)',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      <div
        aria-label="常用圖片尺寸"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}
      >
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => update(preset)}
            aria-pressed={width === preset}
            style={{
              minWidth: 42,
              minHeight: 28,
              padding: '4px 8px',
              border: `1px solid ${
                width === preset ? '#a25e5e' : 'var(--theme-elevation-250)'
              }`,
              borderRadius: 5,
              background:
                width === preset
                  ? 'color-mix(in srgb, #a25e5e 12%, var(--theme-bg))'
                  : 'var(--theme-bg)',
              color: width === preset ? '#a25e5e' : 'var(--theme-text)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: width === preset ? 700 : 500,
            }}
          >
            {preset}
          </button>
        ))}
      </div>

      {field?.admin?.description ? (
        <p
          style={{
            margin: '8px 0 0',
            color: 'var(--theme-elevation-550)',
            fontSize: 11,
            lineHeight: 1.55,
          }}
        >
          {field.admin.description}
        </p>
      ) : null}
    </div>
  )
}
