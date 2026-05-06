import type { CurrencyDef } from '@/stores/localeStore'

/**
 * 將 TWD 金額轉成目前選用幣別的顯示字串
 * ────────────────────────────────────────
 *
 * 設計重點：
 *   - 來源金額一律是 TWD（DB 內所有 price/salePrice/orderTotal 都是 TWD）
 *   - 用 rateAgainstTwd 換算到目標幣別：targetAmount = twdAmount × rate
 *   - 用 Intl.NumberFormat 套上千分位 + 小數位（KRW 0 位、USD 2 位等）
 *   - 加上前綴 symbol（NT$ / US$ / ¥ / ₩）
 *
 * Examples:
 *   formatPrice(1000, twdDef)        → "NT$ 1,000"
 *   formatPrice(1000, usdDef)        → "US$ 31.00"
 *   formatPrice(1000, jpyDef)        → "¥ 4,800"
 *   formatPrice(1000, twdDef, true)  → "NT$1,000"  (無空格 / compact)
 *
 * 注意：本站交易實際以 TWD 結算（ECPay 國內金流），其他幣別只用作
 *   「顯示估算」幫境外消費者理解價格；checkout / 收據仍以 TWD 為準。
 */
export function formatPrice(
  twdAmount: number,
  currency: CurrencyDef,
  compact = false,
): string {
  if (!Number.isFinite(twdAmount)) return '—'

  const target = twdAmount * (currency.rateAgainstTwd ?? 1)
  const decimals = Math.max(0, Math.min(4, currency.decimalPlaces ?? 0))

  // Intl.NumberFormat 用 'en' locale 拿到一致的 1,234.56 格式（不依使用者地區）
  const num = new Intl.NumberFormat('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(target)

  const symbol = currency.symbol ?? currency.code ?? ''
  return compact ? `${symbol}${num}` : `${symbol} ${num}`
}

/**
 * 變體：只回數字字串（不含 symbol），給需要 inline 拼接的場合用
 *
 * Example:
 *   `${currency.symbol}${formatAmount(1000, currency)}` → "NT$1,000"
 */
export function formatAmount(twdAmount: number, currency: CurrencyDef): string {
  if (!Number.isFinite(twdAmount)) return '—'
  const target = twdAmount * (currency.rateAgainstTwd ?? 1)
  const decimals = Math.max(0, Math.min(4, currency.decimalPlaces ?? 0))
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(target)
}
