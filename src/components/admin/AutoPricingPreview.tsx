'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useField } from '@payloadcms/ui'
import { computeSuggestedPrice } from '@/lib/pricing/computeSuggestedPrice'
import type { ProfitMode } from '@/lib/pricing/computeSuggestedPrice'

/**
 * AutoPricingPreview
 * ──────────────────
 * 後台商品「自動計價」群組的 UI field — 即時預覽建議售價 + 一鍵套用。
 *
 * 讀取（sibling fields via useAllFormFields / useField）：
 *   - autoPricing.costAmount
 *   - autoPricing.costCurrencyCode
 *   - weight
 * 寫入（useField）：
 *   - price（套用建議售價時）
 *
 * 依賴：
 *   - GET /api/globals/pricing-formula-settings  （PricingFormulaSettings global）
 *   - GET /api/currencies?limit=20              （拿匯率）
 *
 * 缺資料的處理：成本 / 匯率 / 公式任一缺，整個面板顯示 placeholder 而非錯誤；
 * server hook 也是「成本沒填 = 跳過」，所以不影響存檔。
 *
 * MUST be 'use client' — Payload v3 admin Field 在 group 內若是 RSC 會 silent
 * 清空整個 form 的 render-fields（feedback memory `payload_v3_group_field_rsc`）。
 */

type FormulaSettings = {
  currencyCode?: string
  manualRateOverride?: number | null
  weightShippingPerGram?: number
  weightShippingFlatFee?: number
  profitMode?: ProfitMode
  profitPercent?: number
  profitFixedFloor?: number
  priceRoundTo?: number
}

type Currency = {
  code?: string
  rateAgainstTwd?: number
}

interface Props {
  path: string
}

const AutoPricingPreview: React.FC<Props> = () => {
  // 直接 useField 各 sibling，避免 useAllFormFields 的 group context 衝突
  const { value: costAmountValue } = useField<number | null>({
    path: 'autoPricing.costAmount',
  })
  const { value: costCurrencyValue } = useField<string | null>({
    path: 'autoPricing.costCurrencyCode',
  })
  const { value: weightValue } = useField<number | null>({ path: 'weight' })
  const { setValue: setPrice } = useField<number | null>({ path: 'price' })

  const [formula, setFormula] = useState<FormulaSettings | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [appliedAt, setAppliedAt] = useState<string | null>(null)

  /* ── 一次拉公式 + 匯率 ──
   * /api/currencies 是前台 custom route（src/app/(frontend)/api/currencies/route.ts）
   * 回傳 { currencies: [...] } 而非 Payload native 的 { docs: [...] }；
   * 兩種 shape 都接看哪個有資料。
   */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [fRes, cRes] = await Promise.all([
          fetch('/api/globals/pricing-formula-settings?depth=0', {
            credentials: 'include',
          }),
          fetch('/api/currencies', { credentials: 'include' }),
        ])
        if (!fRes.ok) throw new Error(`公式設定 HTTP ${fRes.status}`)
        if (!cRes.ok) throw new Error(`幣別 HTTP ${cRes.status}`)
        const f = (await fRes.json()) as FormulaSettings
        const cJson = (await cRes.json()) as {
          currencies?: Currency[]
          docs?: Currency[]
        }
        if (cancelled) return
        setFormula(f)
        const list = Array.isArray(cJson.currencies)
          ? cJson.currencies
          : Array.isArray(cJson.docs)
          ? cJson.docs
          : []
        setCurrencies(list)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'load failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /* ── normalize sibling 值 ── */
  const costAmount = toNumberOrNull(costAmountValue)
  const costCurrencyCode = typeof costCurrencyValue === 'string' ? costCurrencyValue : null
  const weight = toNumberOrNull(weightValue) ?? 0

  /* ── 算 rate（manualRateOverride 優先；否則找 currencies 中該幣別的 rateAgainstTwd） ── */
  const rate = useMemo<number | null>(() => {
    if (!formula) return null
    if (
      formula.manualRateOverride != null &&
      Number(formula.manualRateOverride) > 0
    ) {
      return Number(formula.manualRateOverride)
    }
    const code = costCurrencyCode || formula.currencyCode || 'KRW'
    const found = currencies.find((c) => (c.code || '').toUpperCase() === code.toUpperCase())
    if (found && Number(found.rateAgainstTwd) > 0) return Number(found.rateAgainstTwd)
    // 沒匯率時的 fallback（極少見：currencies collection 沒這幣別）
    return null
  }, [formula, currencies, costCurrencyCode])

  /* ── 即時計算 ── */
  const result = useMemo(() => {
    if (!formula || !rate) return null
    return computeSuggestedPrice({
      costInLocalCurrency: costAmount ?? undefined,
      weight: weight ?? 0,
      rate,
      weightShippingPerGram: formula.weightShippingPerGram,
      weightShippingFlatFee: formula.weightShippingFlatFee,
      profitMode: formula.profitMode,
      profitPercent: formula.profitPercent,
      profitFixedFloor: formula.profitFixedFloor,
      priceRoundTo: formula.priceRoundTo,
    })
  }, [formula, rate, costAmount, weight])

  /* ── 套用按鈕 ── */
  const applyToPrice = () => {
    if (!result) return
    setPrice(result.suggestedPrice)
    const ts = new Date()
    setAppliedAt(`${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`)
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 13, color: '#71717a' }}>載入計價公式中…</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 13, color: '#dc2626' }}>
          載入失敗：{loadError}（請先到「② 商品管理 → 商品計價公式」初始化設定）
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--theme-elevation-800, #18181b)',
              marginBottom: 4,
            }}
          >
            🧮 即時試算建議售價
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-elevation-500, #71717a)' }}>
            匯率：1 TWD ={' '}
            {rate != null
              ? `${rate} ${costCurrencyCode || formula?.currencyCode || ''}`
              : '（缺幣別 / 匯率）'}
            {formula?.manualRateOverride ? '（已鎖定）' : '（即時跟隨幣別表）'}
            {' · '}模式：{profitModeLabel(formula?.profitMode)}
          </div>
        </div>
        <button
          type="button"
          onClick={applyToPrice}
          disabled={!result}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            border: result ? '1px solid #16a34a' : '1px solid #d4d4d8',
            borderRadius: 6,
            background: result ? '#f0fdf4' : '#fafafa',
            color: result ? '#15803d' : '#a1a1aa',
            cursor: result ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          📥 套用到「原價」
        </button>
      </div>

      {result ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10,
          }}
        >
          <Stat label="換算成本 TWD" value={fmt(result.costTWD)} />
          <Stat label="重量運費 TWD" value={fmt(result.shippingTWD)} />
          <Stat label="保底淨利 TWD" value={fmt(result.profitTWD)} />
          <Stat
            label="建議售價 TWD"
            value={fmt(result.suggestedPrice)}
            highlight
          />
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#71717a', padding: '8px 0' }}>
          {!costAmount
            ? '尚未填採購金額（自動計價跳過）'
            : !rate
            ? '找不到該幣別的匯率（請先到「① 訂單與物流 → 幣別與匯率」確認 KRW/USD/JPY/CNY 已啟用）'
            : '請完成上方欄位'}
        </div>
      )}

      {appliedAt && (
        <div
          style={{
            fontSize: 11,
            color: '#15803d',
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          ✓ {appliedAt} 已套用建議售價，記得按右上「Save」存檔
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: 'var(--theme-elevation-500, #71717a)',
          lineHeight: 1.5,
        }}
      >
        <strong>勾「使用自動計價」</strong>
        後存檔時會自動覆寫「原價」；不勾則「原價」必須手填，公式僅供試算參考。
      </div>
    </div>
  )
}

export default AutoPricingPreview

/* ──────────────────────────── helpers ──────────────────────────── */

const containerStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-200, #e4e4e7)',
  borderRadius: 8,
  padding: '12px 14px',
  background: 'var(--theme-elevation-50, #fafafa)',
  marginBottom: 16,
}

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div
    style={{
      padding: '8px 10px',
      borderRadius: 6,
      background: highlight ? '#f0fdf4' : 'var(--theme-input-bg, #fff)',
      border: highlight ? '1px solid #86efac' : '1px solid var(--theme-elevation-200, #e4e4e7)',
    }}
  >
    <div
      style={{
        fontSize: 10,
        color: 'var(--theme-elevation-500, #71717a)',
        marginBottom: 2,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: highlight ? 18 : 14,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? '#15803d' : 'var(--theme-elevation-800, #18181b)',
      }}
    >
      {value}
    </div>
  </div>
)

function profitModeLabel(mode?: ProfitMode): string {
  if (mode === 'fixed_only') return '固定金額'
  if (mode === 'whichever_higher') return '取其大者'
  return '百分比'
}

function fmt(n: number): string {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
