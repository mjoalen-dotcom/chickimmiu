'use client'

import React, { useMemo, useState } from 'react'
import { useAllFormFields } from '@payloadcms/ui'
import { reduceFieldsToValues } from 'payload/shared'

import { evaluateProduct, type TabStatus } from '@/lib/admin/productCompleteness'

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 60,
  right: 16,
  zIndex: 50,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  maxWidth: 360,
}

const badgeStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  borderRadius: 999,
  background: 'var(--theme-elevation-0, #ffffff)',
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--theme-elevation-800, #18181b)',
  cursor: 'default',
  position: 'relative',
  whiteSpace: 'nowrap',
}

function iconByState(state: TabStatus['state']): string {
  if (state === 'ok') return '✅'
  if (state === 'warn') return '⚠️'
  return '🟡'
}

function tooltipLines(status: TabStatus): string[] {
  const lines: string[] = []
  if (status.missing.length > 0) {
    lines.push(`必填缺少：${status.missing.join('、')}`)
  }
  if (status.suggested.length > 0) {
    lines.push(`建議補齊：${status.suggested.join('、')}`)
  }
  if (lines.length === 0) {
    lines.push('此分頁已完成')
  }
  return lines
}

const ProductTabBadges: React.FC = () => {
  const [fields] = useAllFormFields()
  const [hovered, setHovered] = useState<string | null>(null)

  const status = useMemo(() => {
    const data = reduceFieldsToValues(fields, true)
    return evaluateProduct(data)
  }, [fields])

  const items: Array<{ key: keyof typeof status; label: string; value: TabStatus }> = [
    { key: 'tab1', label: '①', value: status.tab1 },
    { key: 'tab2', label: '②', value: status.tab2 },
    { key: 'tab3', label: '③', value: status.tab3 },
    { key: 'tab4', label: '④', value: status.tab4 },
  ]

  return (
    <div style={containerStyle}>
      {items.map((item) => {
        const lines = tooltipLines(item.value)
        return (
          <div
            key={item.key}
            style={badgeStyle}
            onMouseEnter={() => setHovered(item.key)}
            onMouseLeave={() => setHovered((prev) => (prev === item.key ? null : prev))}
          >
            {item.label} {iconByState(item.value.state)}
            {hovered === item.key && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  width: 260,
                  borderRadius: 8,
                  border: '1px solid var(--theme-elevation-250, #c7c7d2)',
                  background: 'var(--theme-elevation-0, #ffffff)',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
                  padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: 'var(--theme-elevation-800, #18181b)',
                  zIndex: 80,
                }}
              >
                {lines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ProductTabBadges
