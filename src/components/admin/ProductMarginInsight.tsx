'use client'

import React, { useMemo } from 'react'
import { useFormFields } from '@payloadcms/ui'

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `NT$ ${Math.round(value).toLocaleString('zh-TW')}`
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--theme-elevation-0, #ffffff)',
  marginTop: 8,
}

const ProductMarginInsight: React.FC = () => {
  const priceRaw = useFormFields(([fields]) => fields.price?.value as unknown)
  const salePriceRaw = useFormFields(([fields]) => fields.salePrice?.value as unknown)
  const costRaw = useFormFields(([fields]) => fields['sourcing.costTWD']?.value as unknown)

  const price = toNumber(priceRaw)
  const salePrice = toNumber(salePriceRaw)
  const cost = toNumber(costRaw)

  const sellingPrice = useMemo(() => {
    if (salePrice != null && salePrice > 0) return salePrice
    return price
  }, [price, salePrice])

  const margin =
    sellingPrice != null && cost != null ? Math.round(sellingPrice - cost) : null

  const marginRate =
    sellingPrice != null && cost != null && sellingPrice > 0
      ? ((sellingPrice - cost) / sellingPrice) * 100
      : null

  const rateColor =
    marginRate == null
      ? 'var(--theme-elevation-600, #52525b)'
      : marginRate < 30
      ? '#dc2626'
      : marginRate < 50
      ? '#ca8a04'
      : '#16a34a'

  return (
    <div style={panelStyle}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: 'var(--theme-elevation-800, #18181b)',
        }}
      >
        毛利洞察
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--theme-elevation-700, #3f3f46)' }}>
          成本：<strong>{formatMoney(cost)}</strong>
        </div>
        <div style={{ fontSize: 12, color: 'var(--theme-elevation-700, #3f3f46)' }}>
          售價：<strong>{formatMoney(sellingPrice)}</strong>
        </div>
        <div style={{ fontSize: 12, color: 'var(--theme-elevation-700, #3f3f46)' }}>
          毛利 NT$：<strong>{formatMoney(margin)}</strong>
        </div>
        <div style={{ fontSize: 12, color: rateColor, fontWeight: 600 }}>
          毛利率：{marginRate == null ? '—' : `${marginRate.toFixed(1)}%`}
        </div>
      </div>

      {cost == null && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--theme-warning-700, #b45309)',
            lineHeight: 1.4,
          }}
        >
          請填採購來源 → 進貨成本
        </div>
      )}
    </div>
  )
}

export default ProductMarginInsight
