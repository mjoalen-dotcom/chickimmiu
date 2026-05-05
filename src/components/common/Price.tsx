'use client'

import { useLocaleStore } from '@/stores/localeStore'
import { formatPrice } from '@/lib/formatPrice'

interface PriceProps {
  /** 金額（TWD，DB 原始值） */
  twd: number
  /** 額外 className 套到 <span> */
  className?: string
  /** 直接套上 symbol 緊鄰數字（如 "NT$1,000"），預設 false → "NT$ 1,000" */
  compact?: boolean
  /** 自訂 fallback 顯示（例如「免費」），twd <= 0 時用 */
  zeroLabel?: string
}

/**
 * 幣別感知價格元件
 * ─────────────────
 *
 * 從 useLocaleStore 拉目前幣別 + 匯率，把 TWD 金額轉成顯示字串。
 *
 * SSR 行為：
 *   - 在 client rehydrate 之前，store 是 default values（currentCurrency=TWD,
 *     rateAgainstTwd=1），所以首次 render 出 "NT$ X,XXX" — 這是好事，因為
 *     server-side render 出來的 HTML 也是 TWD（DB 原始值），hydration 完美對齊。
 *   - rehydrate 後若使用者選了 USD，會自動 re-render 成 "US$ XX.XX"。
 *
 * Usage:
 *   <Price twd={1000} className="text-gold-600" />
 *   <Price twd={item.price} compact />
 *   <Price twd={shippingFee} zeroLabel="免運" />
 */
export function Price({ twd, className, compact, zeroLabel }: PriceProps) {
  const currency = useLocaleStore((s) => s.getCurrentCurrency())

  if (zeroLabel && twd <= 0) {
    return <span className={className}>{zeroLabel}</span>
  }

  return <span className={className}>{formatPrice(twd, currency, compact)}</span>
}
