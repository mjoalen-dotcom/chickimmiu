/**
 * A/B 測試引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷 A/B 測試核心邏輯
 *
 * 負責建立 A/B 測試、分配變體、追蹤事件、
 * 分析結果並自動選出勝出版本。
 *
 * 變體分配使用一致性雜湊（hash），確保同一會員在同一活動中
 * 永遠分配到相同變體。
 *
 * 統計顯著性以 Z-test 檢定，信心水準 > 95% 時自動選出勝出者。
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

interface ABTestVariant {
  variantName: string
  variantSlug: string
  templateId: string
  percentage: number
}

interface ABTestDoc {
  id: string
  campaign: string
  variants: Array<ABTestVariant & {
    metrics?: {
      sent: number
      opened: number
      clicked: number
      converted: number
      revenue: number
    }
  }>
  winnerMetric: string
  winner?: string
  status: string
  minSampleSize?: number
  confidenceLevel?: number
}

interface AnalysisResult {
  winner: string | null
  confidenceLevel: number
  metrics: Record<string, {
    sent: number
    opened: number
    clicked: number
    converted: number
    revenue: number
    openRate: number
    clickRate: number
    conversionRate: number
  }>
  recommendation: string
}

// ══════════════════════════════════════════════════════════
// Helper — 一致性雜湊
// ══════════════════════════════════════════════════════════

/**
 * 簡易字串雜湊函式
 *
 * 使用 DJB2 演算法將字串轉為正整數，
 * 用於一致性分配 A/B 測試變體。
 *
 * @param str - 輸入字串
 * @returns 正整數雜湊值
 */
function simpleHash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// ══════════════════════════════════════════════════════════
// Helper — Z-test 統計檢定
// ══════════════════════════════════════════════════════════

/**
 * 計算兩組比例的 Z 值與信心水準
 *
 * 用於 A/B 測試的統計顯著性檢定。
 *
 * @param p1 - 組 A 的轉換率
 * @param n1 - 組 A 的樣本數
 * @param p2 - 組 B 的轉換率
 * @param n2 - 組 B 的樣本數
 * @returns Z 值與信心水準百分比
 */
function proportionZTest(
  p1: number,
  n1: number,
  p2: number,
  n2: number,
): { zScore: number; confidence: number } {
  if (n1 === 0 || n2 === 0) return { zScore: 0, confidence: 0 }

  const pPooled = (p1 * n1 + p2 * n2) / (n1 + n2)
  if (pPooled === 0 || pPooled === 1) return { zScore: 0, confidence: 0 }

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2))
  if (se === 0) return { zScore: 0, confidence: 0 }

  const zScore = Math.abs(p1 - p2) / se

  // 近似計算 p-value 後轉為信心水準
  // 使用簡化的常態分佈 CDF 近似
  const confidence = zScoreToConfidence(zScore)

  return { zScore, confidence }
}

/**
 * 將 Z 值轉為信心水準百分比（簡化近似）
 *
 * @param z - Z 值
 * @returns 信心水準百分比（0-100）
 */
function zScoreToConfidence(z: number): number {
  // 常見 Z 值對應信心水準
  if (z >= 3.29) return 99.9
  if (z >= 2.576) return 99.0
  if (z >= 2.326) return 98.0
  if (z >= 1.96) return 95.0
  if (z >= 1.645) return 90.0
  if (z >= 1.282) return 80.0
  if (z >= 1.036) return 70.0
  if (z >= 0.842) return 60.0
  if (z >= 0.674) return 50.0
  // 低於 50% 不具參考價值
  return Math.round(z * 30)
}

// ══════════════════════════════════════════════════════════
// Core — 建立 A/B 測試
// ══════════════════════════════════════════════════════════

/**
 * 建立 A/B 測試
 *
 * 在 ab-tests 集合中建立測試記錄，初始化各變體的指標。
 *
 * @param campaignId - 關聯活動 ID
 * @param variants - 變體定義（名稱、代碼、模板、百分比）
 * @param winnerMetric - 勝出指標（openRate / clickRate / conversionRate / revenue）
 * @returns 新建立的 A/B 測試 ID
 */
export async function createABTest(
  campaignId: string,
  variants: Array<{ variantName: string; variantSlug: string; templateId: string; percentage: number }>,
  winnerMetric: string,
): Promise<string> {
  const payload = await getPayload({ config })

  // 驗證百分比合計為 100
  const totalPercentage = variants.reduce((sum, v) => sum + v.percentage, 0)
  if (Math.abs(totalPercentage - 100) > 1) {
    console.warn(`[Marketing] A/B 測試變體百分比合計 ${totalPercentage}%，預期為 100%`)
  }

  const variantsWithMetrics = variants.map((v) => ({
    ...v,
    metrics: {
      sent: 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      revenue: 0,
    },
  }))

  const result = await (payload.create as Function)({
    collection: 'ab-tests',
    data: {
      campaign: campaignId,
      variants: variantsWithMetrics,
      winnerMetric,
      status: 'active',
      minSampleSize: 100,
    } as unknown as Record<string, unknown>,
  })

  const testId = typeof result.id === 'string' ? result.id : String(result.id)
  console.log(`[Marketing] A/B 測試已建立: ${testId}，變體數: ${variants.length}`)

  return testId
}

// ══════════════════════════════════════════════════════════
// Core — 分配變體
// ══════════════════════════════════════════════════════════

/**
 * 將用戶分配到變體
 *
 * 使用一致性雜湊（campaignId + userId）確保同一用戶
 * 在同一活動中永遠分配到相同變體。
 *
 * @param userId - 會員 ID
 * @param variants - 變體與百分比定義
 * @returns 分配到的變體代碼
 */
export function assignVariant(
  userId: string,
  variants: Array<{ variantSlug: string; percentage: number }>,
): string {
  if (variants.length === 0) return ''
  if (variants.length === 1) return variants[0].variantSlug

  // 一致性雜湊：同一 userId 永遠得到相同結果
  const hashValue = simpleHash(userId)
  const bucket = hashValue % 100 // 0-99

  // 依百分比累加找出對應變體
  let cumulative = 0
  for (const variant of variants) {
    cumulative += variant.percentage
    if (bucket < cumulative) {
      return variant.variantSlug
    }
  }

  // 安全回退：回傳最後一個變體
  return variants[variants.length - 1].variantSlug
}

// ══════════════════════════════════════════════════════════
// Core — 追蹤事件
// ══════════════════════════════════════════════════════════

/**
 * 記錄 A/B 測試事件（開信、點擊、轉換等）
 *
 * 更新 ab-tests 集合中對應變體的指標。
 *
 * @param abTestId - A/B 測試 ID
 * @param variantSlug - 變體代碼
 * @param eventType - 事件類型
 * @param revenue - 轉換營收（可選）
 */
export async function trackABTestEvent(
  abTestId: string,
  variantSlug: string,
  eventType: 'sent' | 'opened' | 'clicked' | 'converted',
  revenue?: number,
): Promise<void> {
  const payload = await getPayload({ config })

  try {
    const testDoc = await payload.findByID({ collection: 'ab-tests', id: abTestId })
    const test = testDoc as unknown as ABTestDoc

    if (test.status !== 'active') {
      console.log(`[Marketing] A/B 測試已非進行中狀態，跳過事件追蹤: ${abTestId}`)
      return
    }

    // 更新對應變體的指標
    const updatedVariants = test.variants.map((v) => {
      if (v.variantSlug !== variantSlug) return v

      const metrics = v.metrics ?? { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 }

      switch (eventType) {
        case 'sent':
          metrics.sent++
          break
        case 'opened':
          metrics.opened++
          break
        case 'clicked':
          metrics.clicked++
          break
        case 'converted':
          metrics.converted++
          if (typeof revenue === 'number') {
            metrics.revenue += revenue
          }
          break
      }

      return { ...v, metrics }
    })

    await (payload.update as Function)({
      collection: 'ab-tests',
      id: abTestId,
      data: { variants: updatedVariants } as unknown as Record<string, unknown>,
    })
  } catch (error) {
    console.error(`[Marketing] A/B 測試事件追蹤失敗 (${abTestId}):`, error)
  }
}

// ══════════════════════════════════════════════════════════
// Core — 分析結果
// ══════════════════════════════════════════════════════════

/**
 * 分析 A/B 測試結果並自動選出勝出版本
 *
 * 計算各變體的轉換率指標，使用 Z-test 檢定統計顯著性。
 * 信心水準 > 95% 時給予明確建議。
 *
 * @param abTestId - A/B 測試 ID
 * @returns 分析結果（勝出者、信心水準、各變體指標、建議）
 */
export async function analyzeABTest(abTestId: string): Promise<AnalysisResult> {
  const payload = await getPayload({ config })

  const testDoc = await payload.findByID({ collection: 'ab-tests', id: abTestId })
  const test = testDoc as unknown as ABTestDoc

  // 計算各變體指標
  const metrics: AnalysisResult['metrics'] = {}

  for (const variant of test.variants) {
    const m = variant.metrics ?? { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 }
    metrics[variant.variantSlug] = {
      sent: m.sent,
      opened: m.opened,
      clicked: m.clicked,
      converted: m.converted,
      revenue: m.revenue,
      openRate: m.sent > 0 ? Math.round((m.opened / m.sent) * 10000) / 100 : 0,
      clickRate: m.sent > 0 ? Math.round((m.clicked / m.sent) * 10000) / 100 : 0,
      conversionRate: m.sent > 0 ? Math.round((m.converted / m.sent) * 10000) / 100 : 0,
    }
  }

  // 找出最佳變體
  const variantSlugs = Object.keys(metrics)
  if (variantSlugs.length < 2) {
    return {
      winner: variantSlugs[0] ?? null,
      confidenceLevel: 0,
      metrics,
      recommendation: '變體數量不足，無法進行 A/B 測試比較',
    }
  }

  // 依據 winnerMetric 排序
  const metricKey = test.winnerMetric as keyof typeof metrics[string]
  const sorted = variantSlugs.sort((a, b) => {
    const aVal = metrics[a][metricKey] as number ?? 0
    const bVal = metrics[b][metricKey] as number ?? 0
    return bVal - aVal
  })

  const bestSlug = sorted[0]
  const secondSlug = sorted[1]
  const bestMetrics = metrics[bestSlug]
  const secondMetrics = metrics[secondSlug]

  // Z-test 統計檢定
  let bestRate = 0
  let secondRate = 0

  switch (test.winnerMetric) {
    case 'openRate':
      bestRate = bestMetrics.sent > 0 ? bestMetrics.opened / bestMetrics.sent : 0
      secondRate = secondMetrics.sent > 0 ? secondMetrics.opened / secondMetrics.sent : 0
      break
    case 'clickRate':
      bestRate = bestMetrics.sent > 0 ? bestMetrics.clicked / bestMetrics.sent : 0
      secondRate = secondMetrics.sent > 0 ? secondMetrics.clicked / secondMetrics.sent : 0
      break
    case 'conversionRate':
    default:
      bestRate = bestMetrics.sent > 0 ? bestMetrics.converted / bestMetrics.sent : 0
      secondRate = secondMetrics.sent > 0 ? secondMetrics.converted / secondMetrics.sent : 0
      break
  }

  const { confidence } = proportionZTest(
    bestRate,
    bestMetrics.sent,
    secondRate,
    secondMetrics.sent,
  )

  // 產生建議
  let recommendation: string
  const bestVariantDoc = test.variants.find((v) => v.variantSlug === bestSlug)
  const bestName = bestVariantDoc?.variantName ?? bestSlug

  if (confidence >= 95) {
    recommendation = `建議採用「${bestName}」版本，統計信心水準達 ${confidence}%，具顯著差異。`
  } else if (confidence >= 80) {
    recommendation = `「${bestName}」版本表現較佳，但信心水準僅 ${confidence}%，建議繼續收集更多數據。`
  } else {
    recommendation = `目前樣本量不足以做出結論（信心水準 ${confidence}%），建議持續測試。`
  }

  return {
    winner: confidence >= 95 ? bestSlug : null,
    confidenceLevel: confidence,
    metrics,
    recommendation,
  }
}

// ══════════════════════════════════════════════════════════
// Core — 自動選出勝出版本
// ══════════════════════════════════════════════════════════

/**
 * 自動切換至勝出版本
 *
 * 條件：
 * 1. 最小樣本數已達標
 * 2. 信心水準 > 95%
 *
 * 達標後更新 A/B 測試記錄，將 winner 設為勝出變體，
 * 並將狀態改為 completed。
 *
 * @param abTestId - A/B 測試 ID
 */
export async function autoSelectWinner(abTestId: string): Promise<void> {
  const payload = await getPayload({ config })

  const testDoc = await payload.findByID({ collection: 'ab-tests', id: abTestId })
  const test = testDoc as unknown as ABTestDoc

  if (test.status !== 'active') {
    console.log(`[Marketing] A/B 測試非進行中，跳過自動選出: ${abTestId}`)
    return
  }

  // 檢查最小樣本數
  const minSampleSize = test.minSampleSize ?? 100
  const totalSent = test.variants.reduce((sum, v) => sum + (v.metrics?.sent ?? 0), 0)

  if (totalSent < minSampleSize) {
    console.log(`[Marketing] 樣本數不足 (${totalSent}/${minSampleSize})，暫不選出勝出版本`)
    return
  }

  // 分析結果
  const analysis = await analyzeABTest(abTestId)

  if (analysis.winner && analysis.confidenceLevel >= 95) {
    // 更新 A/B 測試記錄
    await (payload.update as Function)({
      collection: 'ab-tests',
      id: abTestId,
      data: {
        winner: analysis.winner,
        status: 'completed',
        confidenceLevel: analysis.confidenceLevel,
        completedAt: new Date().toISOString(),
        recommendation: analysis.recommendation,
      } as unknown as Record<string, unknown>,
    })

    const winnerVariant = test.variants.find((v) => v.variantSlug === analysis.winner)
    console.log(
      `[Marketing] A/B 測試勝出版本已選出: ${winnerVariant?.variantName ?? analysis.winner}` +
      ` (信心水準: ${analysis.confidenceLevel}%)`,
    )
  } else {
    console.log(
      `[Marketing] A/B 測試尚無明確勝出者 (信心水準: ${analysis.confidenceLevel}%)`,
    )
  }
}
