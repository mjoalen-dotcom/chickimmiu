/**
 * computeSuggestedPrice
 * ─────────────────────
 * 採購韓幣（或其他幣別）→ 建議 TWD 售價的純函式，無 side effect。
 *
 * 公式：
 *   costTWD     = costInLocalCurrency / rate              （rate = 1 TWD 換多少採購幣別）
 *   shippingTWD = weight × perGram + flatFee
 *   profitTWD   = 依 profitMode 取百分比 / 固定 / max
 *   raw         = costTWD + shippingTWD + profitTWD
 *   suggested   = round(raw / roundTo) × roundTo
 *
 * 給商品 admin Field（即時預覽）+ Products.beforeChange hook（存檔自動套用）共用。
 * Server side 必須重新算一次（client 算的不可信）。
 */

export type ProfitMode = 'percent_only' | 'fixed_only' | 'whichever_higher'

export interface PricingFormulaInputs {
  /** 採購金額（採購幣別，例如 KRW 50000） */
  costInLocalCurrency: number
  /** 商品重量（公克） */
  weight: number
  /** 採購匯率：1 TWD = 多少採購幣別。例：KRW 36, JPY 4.8, USD 0.031 */
  rate: number
  /** 每公克運費（TWD/g） */
  weightShippingPerGram: number
  /** 固定處理費（TWD） */
  weightShippingFlatFee: number
  /** 保底淨利模式 */
  profitMode: ProfitMode
  /** 加成百分比，例 35 = 35% */
  profitPercent: number
  /** 保底固定金額（TWD） */
  profitFixedFloor: number
  /** 售價自動取整單位（TWD），例 10 = 個位數歸零 */
  priceRoundTo: number
}

export interface PricingFormulaResult {
  costTWD: number
  shippingTWD: number
  profitTWD: number
  /** = costTWD + shippingTWD + profitTWD（未取整） */
  rawTotal: number
  /** round 後的最終建議售價 */
  suggestedPrice: number
}

const DEFAULTS = {
  weightShippingPerGram: 0.3,
  weightShippingFlatFee: 80,
  profitMode: 'percent_only' as ProfitMode,
  profitPercent: 35,
  profitFixedFloor: 200,
  priceRoundTo: 10,
}

export function computeSuggestedPrice(
  inputs: Partial<PricingFormulaInputs>,
): PricingFormulaResult | null {
  const cost = Number(inputs.costInLocalCurrency)
  const weight = Number(inputs.weight ?? 0)
  const rate = Number(inputs.rate)

  // 必要條件：成本 > 0、匯率 > 0；weight 可以是 0（純電子商品 / 預設運費由 flat 處理）
  if (!Number.isFinite(cost) || cost <= 0) return null
  if (!Number.isFinite(rate) || rate <= 0) return null

  const perGram = numOr(inputs.weightShippingPerGram, DEFAULTS.weightShippingPerGram)
  const flatFee = numOr(inputs.weightShippingFlatFee, DEFAULTS.weightShippingFlatFee)
  const mode = (inputs.profitMode ?? DEFAULTS.profitMode) as ProfitMode
  const percent = numOr(inputs.profitPercent, DEFAULTS.profitPercent)
  const fixed = numOr(inputs.profitFixedFloor, DEFAULTS.profitFixedFloor)
  const roundTo = numOr(inputs.priceRoundTo, DEFAULTS.priceRoundTo)

  const costTWD = cost / rate
  const shippingTWD = Math.max(0, weight) * perGram + flatFee
  const baseAmount = costTWD + shippingTWD

  let profitTWD: number
  if (mode === 'fixed_only') {
    profitTWD = fixed
  } else if (mode === 'whichever_higher') {
    profitTWD = Math.max(baseAmount * (percent / 100), fixed)
  } else {
    profitTWD = baseAmount * (percent / 100)
  }

  const rawTotal = baseAmount + profitTWD
  const safeRoundTo = roundTo > 0 ? roundTo : 1
  const suggestedPrice = Math.round(rawTotal / safeRoundTo) * safeRoundTo

  return {
    costTWD: round2(costTWD),
    shippingTWD: round2(shippingTWD),
    profitTWD: round2(profitTWD),
    rawTotal: round2(rawTotal),
    suggestedPrice,
  }
}

function numOr(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
