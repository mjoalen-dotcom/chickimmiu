/**
 * 台灣營業稅計算
 * ────────────────
 * 輸入 cart 明細 + 運費 + TaxSettings → 輸出稅額分解。
 * Payload beforeChange hook (Orders.ts) 會在訂單 create/update 時呼叫本函式。
 *
 * 台灣慣例：商品定價 * 為含稅 *（defaultTaxIncluded=true）。
 *   稅額 = 總價 × rate / (100 + rate)
 *   未稅銷售額 = 總價 - 稅額
 *
 * 外加稅（defaultTaxIncluded=false）：
 *   稅額 = 總價 × rate / 100
 *   未稅銷售額 = 總價（直接）
 */

export type RoundingMode = 'round_half_up' | 'round_down' | 'round_up'

export interface TaxCategoryDef {
  value: string
  label?: string
  rate: number // %
  exempt?: boolean
}

export interface TaxSettingsLike {
  defaultTaxIncluded: boolean
  defaultTaxRate: number // %
  taxCategories: TaxCategoryDef[]
  shippingTaxable: boolean
  invoiceBreakdown?: {
    roundingMode?: RoundingMode
  }
}

export interface TaxableLineItem {
  /** 該 line item 的合計金額（unitPrice × quantity，可已打折） */
  amount: number
  /** 商品 taxCategory value；undefined 視為 standard */
  taxCategory?: string
}

export interface TaxBreakdown {
  /** 應稅銷售額（未稅） */
  standardTaxable: number
  /** 應稅稅額 */
  standardTax: number
  /** 零稅率銷售額 */
  zeroRatedSales: number
  /** 免稅銷售額 */
  exemptSales: number
}

export interface TaxCalcResult {
  /** 全部稅額（商品稅 + 運費稅） */
  taxAmount: number
  /** 商品未稅小計（subtotal - 商品稅） */
  subtotalExcludingTax: number
  /** 運費稅額 */
  shippingTaxAmount: number
  /** 用於計算的有效稅率（main 稅率，顯示用） */
  taxRate: number
  /** 發票用 breakdown */
  taxBreakdown: TaxBreakdown
}

function roundAmount(value: number, mode: RoundingMode): number {
  if (mode === 'round_down') return Math.floor(value)
  if (mode === 'round_up') return Math.ceil(value)
  // round_half_up (JS Math.round 對 .5 一律進位，符合台灣慣例)
  return Math.round(value)
}

function resolveCategory(
  settings: TaxSettingsLike,
  category?: string,
): TaxCategoryDef {
  const cats = Array.isArray(settings.taxCategories) ? settings.taxCategories : []
  const found = cats.find((c) => c.value === (category ?? 'standard'))
  if (found) return found
  return {
    value: 'standard',
    rate: settings.defaultTaxRate ?? 5,
    exempt: false,
  }
}

/**
 * 給定單筆金額 + 稅率 + 是否內含稅 → 算出稅額 + 未稅額
 */
function splitTax(
  grossOrNet: number,
  rate: number,
  taxIncluded: boolean,
  mode: RoundingMode,
): { taxable: number; tax: number } {
  if (rate <= 0 || grossOrNet <= 0) {
    return { taxable: grossOrNet, tax: 0 }
  }
  if (taxIncluded) {
    const tax = roundAmount((grossOrNet * rate) / (100 + rate), mode)
    return { taxable: grossOrNet - tax, tax }
  }
  const tax = roundAmount((grossOrNet * rate) / 100, mode)
  return { taxable: grossOrNet, tax }
}

export function calculateOrderTax(
  items: TaxableLineItem[],
  shippingFee: number,
  settings: TaxSettingsLike,
): TaxCalcResult {
  const mode: RoundingMode = settings.invoiceBreakdown?.roundingMode ?? 'round_half_up'
  const taxIncluded = Boolean(settings.defaultTaxIncluded)

  const breakdown: TaxBreakdown = {
    standardTaxable: 0,
    standardTax: 0,
    zeroRatedSales: 0,
    exemptSales: 0,
  }

  let itemTax = 0
  let itemTaxable = 0

  for (const li of items) {
    const amt = Number(li.amount) || 0
    if (amt <= 0) continue
    const cat = resolveCategory(settings, li.taxCategory)

    if (cat.exempt) {
      breakdown.exemptSales += amt
      itemTaxable += amt
      continue
    }

    const rate = Number(cat.rate) || 0
    const { taxable, tax } = splitTax(amt, rate, taxIncluded, mode)
    itemTaxable += taxable
    itemTax += tax

    if (rate > 0) {
      breakdown.standardTaxable += taxable
      breakdown.standardTax += tax
    } else {
      // rate === 0 非免稅 ⇒ 零稅率（外銷等）
      breakdown.zeroRatedSales += taxable
    }
  }

  // 運費稅
  let shippingTax = 0
  if (settings.shippingTaxable && shippingFee > 0) {
    const rate = Number(settings.defaultTaxRate) || 0
    const { tax } = splitTax(shippingFee, rate, taxIncluded, mode)
    shippingTax = tax
    if (rate > 0) {
      breakdown.standardTaxable += shippingFee - tax
      breakdown.standardTax += tax
    }
  }

  return {
    taxAmount: itemTax + shippingTax,
    subtotalExcludingTax: itemTaxable,
    shippingTaxAmount: shippingTax,
    taxRate: Number(settings.defaultTaxRate) || 0,
    taxBreakdown: breakdown,
  }
}
