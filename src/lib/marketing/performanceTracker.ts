/**
 * 行銷活動成效追蹤引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷自動化成效分析
 *
 * 追蹤訊息事件、計算活動指標、產生 Dashboard 數據。
 * 支援依客群、信用分數區間、通道等多維度分析。
 *
 * 信用分數區間標籤（前台顯示用）：
 *   90-100 → 優質好客人
 *   70-89  → 一般會員
 *   50-69  → 觀察中
 *   30-49  → 警示
 *   0-29   → 高風險
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

export interface CampaignMetrics {
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  revenue: number
  cost: number
  roi: number
  openRate: number
  clickRate: number
  conversionRate: number
  unsubscribeRate: number
  avgRevenuePerConversion: number
}

export interface SegmentMetrics {
  sent: number
  opened: number
  clicked: number
  converted: number
  revenue: number
  openRate: number
  clickRate: number
  conversionRate: number
}

export interface ChannelMetrics extends SegmentMetrics {
  channel: string
  deliveryRate: number
  bounceRate: number
}

export interface MarketingDashboardData {
  activeCampaigns: number
  totalSent30d: number
  totalRevenue30d: number
  avgOpenRate: number
  avgClickRate: number
  avgConversionRate: number
  overallROI: number
  topCampaigns: Array<{ id: string; name: string; revenue: number; roi: number }>
  channelPerformance: Record<string, ChannelMetrics>
  segmentPerformance: Record<string, SegmentMetrics>
  recentCampaigns: Array<{ id: string; name: string; status: string; metrics: CampaignMetrics }>
  creditScoreImpact: Array<{ range: string; avgConversion: number; avgRevenue: number }>
}

// ══════════════════════════════════════════════════════════
// 信用分數區間定義
// ══════════════════════════════════════════════════════════

const CREDIT_SCORE_RANGES = [
  { min: 90, max: 100, label: '優質好客人' },
  { min: 70, max: 89, label: '一般會員' },
  { min: 50, max: 69, label: '觀察中' },
  { min: 30, max: 49, label: '警示' },
  { min: 0, max: 29, label: '高風險' },
] as const

// ══════════════════════════════════════════════════════════
// Core Functions
// ══════════════════════════════════════════════════════════

/**
 * 追蹤行銷訊息事件
 *
 * 更新 automation-logs 的狀態與時間戳，
 * 同步更新關聯活動的 performance 計數器。
 *
 * @param logId - automation-logs 的文件 ID
 * @param eventType - 事件類型
 * @param metadata - 附加資料（訂單 ID、營收等）
 */
export async function trackMessageEvent(
  logId: string,
  eventType: 'delivered' | 'opened' | 'clicked' | 'converted' | 'bounced' | 'unsubscribed',
  metadata?: { orderId?: string; revenue?: number },
): Promise<void> {
  const payload = await getPayload({ config })

  // 讀取原始 log
  const log = await payload.findByID({
    collection: 'automation-logs',
    id: logId,
  })

  if (!log) {
    console.warn(`[PerformanceTracker] 找不到執行紀錄: ${logId}`)
    return
  }

  // 更新 log 狀態
  const now = new Date().toISOString()
  const existingData = (log.triggerData as unknown as Record<string, unknown>) ?? {}
  const trackingEvents = (existingData.trackingEvents as unknown as Array<Record<string, unknown>>) ?? []

  trackingEvents.push({
    eventType,
    timestamp: now,
    ...(metadata ?? {}),
  })

  await (payload.update as Function)({
    collection: 'automation-logs',
    id: logId,
    data: {
      triggerData: {
        ...existingData,
        trackingEvents,
        lastEventType: eventType,
        lastEventAt: now,
        ...(metadata?.orderId ? { convertedOrderId: metadata.orderId } : {}),
        ...(metadata?.revenue ? { convertedRevenue: metadata.revenue } : {}),
      },
    },
  })

  // 嘗試更新關聯的行銷活動 performance 計數器
  const journeyId = typeof log.journey === 'string' ? log.journey : (log.journey as unknown as { id: string })?.id
  if (journeyId) {
    await updateCampaignPerformance(journeyId, eventType, metadata?.revenue)
  }

  console.log(`[PerformanceTracker] 事件已追蹤: ${logId} → ${eventType}`)
}

/**
 * 更新行銷活動的 performance 計數器
 *
 * 透過 journeyId 查找關聯的 marketing-campaigns，
 * 再遞增對應的計數欄位。
 */
async function updateCampaignPerformance(
  journeyId: string,
  eventType: string,
  revenue?: number,
): Promise<void> {
  const payload = await getPayload({ config })

  // 查找關聯的行銷活動
  const campaignResult = await payload.find({
    collection: 'marketing-campaigns',
    where: {
      journeyRef: { equals: journeyId },
    } satisfies Where,
    limit: 1,
  })

  if (campaignResult.docs.length === 0) return

  const campaign = campaignResult.docs[0]
  const perf = (campaign.performance as Record<string, number>) ?? {}

  // 遞增對應計數器
  const fieldMap: Record<string, string> = {
    delivered: 'delivered',
    opened: 'opened',
    clicked: 'clicked',
    converted: 'converted',
    bounced: 'delivered', // bounced 不增加 delivered
    unsubscribed: 'unsubscribed',
  }

  const field = fieldMap[eventType]
  if (!field) return

  const updateData: Record<string, unknown> = {}

  if (eventType === 'bounced') {
    // 退回不更新 delivered，反而要減少
    updateData.performance = {
      ...perf,
      delivered: Math.max((perf.delivered ?? 0) - 1, 0),
    }
  } else if (eventType === 'unsubscribed') {
    updateData.performance = {
      ...perf,
      unsubscribed: (perf.unsubscribed ?? 0) + 1,
    }
  } else {
    updateData.performance = {
      ...perf,
      [field]: (perf[field] ?? 0) + 1,
      ...(eventType === 'converted' && revenue ? { revenue: (perf.revenue ?? 0) + revenue } : {}),
    }
  }

  await (payload.update as Function)({
    collection: 'marketing-campaigns',
    id: campaign.id as unknown as string,
    data: updateData,
  })
}

/**
 * 計算單一活動的成效指標
 *
 * 從 automation-logs 聚合統計，計算開信率、點擊率、
 * 轉換率、ROI 等核心指標。
 *
 * @param campaignId - marketing-campaigns 的文件 ID
 */
export async function calculateCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const payload = await getPayload({ config })

  // 取得活動資料
  const campaign = await payload.findByID({
    collection: 'marketing-campaigns',
    id: campaignId,
  })

  const perf = (campaign.performance as Record<string, number>) ?? {}
  const budget = (campaign.budget as Record<string, number>) ?? {}

  const sent = perf.sent ?? 0
  const delivered = perf.delivered ?? 0
  const opened = perf.opened ?? 0
  const clicked = perf.clicked ?? 0
  const converted = perf.converted ?? 0
  const revenue = perf.revenue ?? 0
  const unsubscribed = perf.unsubscribed ?? 0
  const cost = budget.spentAmount ?? budget.totalBudget ?? 0

  // 也從 automation-logs 補充統計
  const journeyRef = campaign.journeyRef
  const journeyId = typeof journeyRef === 'string' ? journeyRef : (journeyRef as unknown as { id: string })?.id

  let logsMetrics = { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0, unsubscribed: 0 }

  if (journeyId) {
    logsMetrics = await aggregateLogsMetrics(journeyId)
  }

  // 取最大值（campaign performance 欄位 vs logs 聚合）
  const finalSent = Math.max(sent, logsMetrics.sent)
  const finalDelivered = Math.max(delivered, logsMetrics.delivered)
  const finalOpened = Math.max(opened, logsMetrics.opened)
  const finalClicked = Math.max(clicked, logsMetrics.clicked)
  const finalConverted = Math.max(converted, logsMetrics.converted)
  const finalRevenue = Math.max(revenue, logsMetrics.revenue)
  const finalUnsubscribed = Math.max(unsubscribed, logsMetrics.unsubscribed)

  const openRate = finalDelivered > 0 ? finalOpened / finalDelivered : 0
  const clickRate = finalOpened > 0 ? finalClicked / finalOpened : 0
  const conversionRate = finalClicked > 0 ? finalConverted / finalClicked : 0
  const unsubscribeRate = finalSent > 0 ? finalUnsubscribed / finalSent : 0
  const roi = calculateROI(finalRevenue, cost)
  const avgRevenuePerConversion = finalConverted > 0 ? finalRevenue / finalConverted : 0

  return {
    sent: finalSent,
    delivered: finalDelivered,
    opened: finalOpened,
    clicked: finalClicked,
    converted: finalConverted,
    revenue: finalRevenue,
    cost,
    roi,
    openRate: roundToPercent(openRate),
    clickRate: roundToPercent(clickRate),
    conversionRate: roundToPercent(conversionRate),
    unsubscribeRate: roundToPercent(unsubscribeRate),
    avgRevenuePerConversion: Math.round(avgRevenuePerConversion),
  }
}

/**
 * 從 automation-logs 聚合事件統計
 */
async function aggregateLogsMetrics(
  journeyId: string,
): Promise<{ sent: number; delivered: number; opened: number; clicked: number; converted: number; revenue: number; unsubscribed: number }> {
  const payload = await getPayload({ config })

  const logsResult = await payload.find({
    collection: 'automation-logs',
    where: {
      journey: { equals: journeyId },
    } satisfies Where,
    limit: 10000,
  })

  let sent = 0
  let delivered = 0
  let opened = 0
  let clicked = 0
  let converted = 0
  let revenue = 0
  let unsubscribed = 0

  for (const log of logsResult.docs) {
    sent++

    const triggerData = (log.triggerData as unknown as Record<string, unknown>) ?? {}
    const events = (triggerData.trackingEvents as unknown as Array<Record<string, unknown>>) ?? []

    const eventTypes = new Set(events.map((e) => e.eventType as string))

    if (eventTypes.has('delivered')) delivered++
    if (eventTypes.has('opened')) opened++
    if (eventTypes.has('clicked')) clicked++
    if (eventTypes.has('converted')) {
      converted++
      const convertedRevenue = triggerData.convertedRevenue as number
      if (convertedRevenue) revenue += convertedRevenue
    }
    if (eventTypes.has('unsubscribed')) unsubscribed++
  }

  return { sent, delivered, opened, clicked, converted, revenue, unsubscribed }
}

/**
 * 計算活動 ROI
 *
 * ROI = (營收 - 成本) / 成本 × 100
 * 若成本為 0，則回傳 0（避免除以零）
 *
 * @param revenue - 營收
 * @param cost - 成本
 */
export function calculateROI(revenue: number, cost: number): number {
  if (cost === 0) return 0
  return Math.round(((revenue - cost) / cost) * 100 * 100) / 100
}

/**
 * 取得行銷自動化總 Dashboard 數據
 *
 * 綜合所有活動的 30 天數據，產生完整的 Dashboard 報表，
 * 包含通道成效、客群成效、信用分數影響分析。
 */
export async function getMarketingDashboard(): Promise<MarketingDashboardData> {
  const payload = await getPayload({ config })

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 取得進行中的活動
  const activeCampaignsResult = await payload.find({
    collection: 'marketing-campaigns',
    where: {
      status: { equals: 'active' },
    } satisfies Where,
    limit: 100,
  })

  // 取得 30 天內所有活動（含已完成）
  const recentCampaignsResult = await payload.find({
    collection: 'marketing-campaigns',
    where: {
      updatedAt: { greater_than: thirtyDaysAgo.toISOString() },
    } satisfies Where,
    limit: 100,
    sort: '-updatedAt',
  })

  // 計算每個活動的指標
  const campaignMetricsList: Array<{ id: string; name: string; status: string; metrics: CampaignMetrics }> = []
  let totalSent = 0
  let totalRevenue = 0
  let totalCost = 0
  let totalOpened = 0
  let totalClicked = 0
  let totalConverted = 0
  let totalDelivered = 0

  for (const campaign of recentCampaignsResult.docs) {
    const metrics = await calculateCampaignMetrics(campaign.id as unknown as string)
    const name = (campaign.campaignName as string) ?? '未命名活動'
    const status = (campaign.status as string) ?? 'draft'

    campaignMetricsList.push({
      id: campaign.id as unknown as string,
      name,
      status,
      metrics,
    })

    totalSent += metrics.sent
    totalDelivered += metrics.delivered
    totalRevenue += metrics.revenue
    totalCost += metrics.cost
    totalOpened += metrics.opened
    totalClicked += metrics.clicked
    totalConverted += metrics.converted
  }

  // Top campaigns（依營收排序）
  const topCampaigns = campaignMetricsList
    .filter((c) => c.metrics.revenue > 0)
    .sort((a, b) => b.metrics.revenue - a.metrics.revenue)
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      name: c.name,
      revenue: c.metrics.revenue,
      roi: c.metrics.roi,
    }))

  // 通道成效分析
  const channelPerformance = await aggregateChannelPerformance(recentCampaignsResult.docs as unknown as Record<string, unknown>[])

  // 客群成效分析
  const segmentPerformance = await aggregateSegmentPerformance(recentCampaignsResult.docs as unknown as Record<string, unknown>[])

  // 信用分數影響分析
  const creditScoreImpact = await aggregateCreditScoreImpact(recentCampaignsResult.docs as unknown as Record<string, unknown>[])

  // 計算平均指標
  const avgOpenRate = totalDelivered > 0 ? roundToPercent(totalOpened / totalDelivered) : 0
  const avgClickRate = totalOpened > 0 ? roundToPercent(totalClicked / totalOpened) : 0
  const avgConversionRate = totalClicked > 0 ? roundToPercent(totalConverted / totalClicked) : 0
  const overallROI = calculateROI(totalRevenue, totalCost)

  return {
    activeCampaigns: activeCampaignsResult.totalDocs,
    totalSent30d: totalSent,
    totalRevenue30d: totalRevenue,
    avgOpenRate,
    avgClickRate,
    avgConversionRate,
    overallROI,
    topCampaigns,
    channelPerformance,
    segmentPerformance,
    recentCampaigns: campaignMetricsList.slice(0, 20),
    creditScoreImpact,
  }
}

/**
 * 依客群分析活動成效
 *
 * 從活動的 automation-logs 中，按照會員的分群碼分組統計。
 *
 * @param campaignId - marketing-campaigns 的文件 ID
 */
export async function analyzeBySegment(campaignId: string): Promise<Record<string, SegmentMetrics>> {
  const payload = await getPayload({ config })

  // 取得活動關聯的 journey
  const campaign = await payload.findByID({
    collection: 'marketing-campaigns',
    id: campaignId,
  })

  const journeyRef = campaign.journeyRef
  const journeyId = typeof journeyRef === 'string' ? journeyRef : (journeyRef as unknown as { id: string })?.id

  if (!journeyId) {
    return {}
  }

  // 取得所有相關 logs
  const logsResult = await payload.find({
    collection: 'automation-logs',
    where: {
      journey: { equals: journeyId },
    } satisfies Where,
    limit: 10000,
  })

  // 按客群分組
  const segmentMap: Record<string, { sent: number; opened: number; clicked: number; converted: number; revenue: number }> = {}

  for (const log of logsResult.docs) {
    const userId = typeof log.user === 'string' ? log.user : (log.user as unknown as { id: string })?.id
    if (!userId) continue

    // 取得會員的分群碼
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    const segmentCode = ((user as unknown as Record<string, unknown>).segmentCode as string) ?? 'REG1'

    if (!segmentMap[segmentCode]) {
      segmentMap[segmentCode] = { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 }
    }

    const data = segmentMap[segmentCode]
    data.sent++

    const triggerData = (log.triggerData as unknown as Record<string, unknown>) ?? {}
    const events = (triggerData.trackingEvents as unknown as Array<Record<string, unknown>>) ?? []
    const eventTypes = new Set(events.map((e) => e.eventType as string))

    if (eventTypes.has('opened')) data.opened++
    if (eventTypes.has('clicked')) data.clicked++
    if (eventTypes.has('converted')) {
      data.converted++
      const rev = triggerData.convertedRevenue as number
      if (rev) data.revenue += rev
    }
  }

  // 轉為 SegmentMetrics
  const result: Record<string, SegmentMetrics> = {}
  for (const [code, data] of Object.entries(segmentMap)) {
    result[code] = {
      sent: data.sent,
      opened: data.opened,
      clicked: data.clicked,
      converted: data.converted,
      revenue: data.revenue,
      openRate: data.sent > 0 ? roundToPercent(data.opened / data.sent) : 0,
      clickRate: data.opened > 0 ? roundToPercent(data.clicked / data.opened) : 0,
      conversionRate: data.clicked > 0 ? roundToPercent(data.converted / data.clicked) : 0,
    }
  }

  return result
}

/**
 * 依信用分數區間分析成效
 *
 * 分為 5 個區間：
 * - 90-100：優質好客人
 * - 70-89：一般會員
 * - 50-69：觀察中
 * - 30-49：警示
 * - 0-29：高風險
 *
 * @param campaignId - marketing-campaigns 的文件 ID
 */
export async function analyzeByCreditScore(
  campaignId: string,
): Promise<Array<{ range: string; metrics: SegmentMetrics }>> {
  const payload = await getPayload({ config })

  const campaign = await payload.findByID({
    collection: 'marketing-campaigns',
    id: campaignId,
  })

  const journeyRef = campaign.journeyRef
  const journeyId = typeof journeyRef === 'string' ? journeyRef : (journeyRef as unknown as { id: string })?.id

  if (!journeyId) {
    return CREDIT_SCORE_RANGES.map((r) => ({
      range: r.label,
      metrics: emptySegmentMetrics(),
    }))
  }

  const logsResult = await payload.find({
    collection: 'automation-logs',
    where: {
      journey: { equals: journeyId },
    } satisfies Where,
    limit: 10000,
  })

  // 按信用分數區間分組
  const rangeMap: Record<string, { sent: number; opened: number; clicked: number; converted: number; revenue: number }> = {}
  for (const r of CREDIT_SCORE_RANGES) {
    rangeMap[r.label] = { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 }
  }

  for (const log of logsResult.docs) {
    const userId = typeof log.user === 'string' ? log.user : (log.user as unknown as { id: string })?.id
    if (!userId) continue

    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    const creditScore = (user.creditScore as number) ?? 50
    const rangeLabel = getCreditScoreRangeLabel(creditScore)
    const data = rangeMap[rangeLabel]
    if (!data) continue

    data.sent++

    const triggerData = (log.triggerData as unknown as Record<string, unknown>) ?? {}
    const events = (triggerData.trackingEvents as unknown as Array<Record<string, unknown>>) ?? []
    const eventTypes = new Set(events.map((e) => e.eventType as string))

    if (eventTypes.has('opened')) data.opened++
    if (eventTypes.has('clicked')) data.clicked++
    if (eventTypes.has('converted')) {
      data.converted++
      const rev = triggerData.convertedRevenue as number
      if (rev) data.revenue += rev
    }
  }

  return CREDIT_SCORE_RANGES.map((r) => {
    const data = rangeMap[r.label]
    return {
      range: r.label,
      metrics: {
        sent: data.sent,
        opened: data.opened,
        clicked: data.clicked,
        converted: data.converted,
        revenue: data.revenue,
        openRate: data.sent > 0 ? roundToPercent(data.opened / data.sent) : 0,
        clickRate: data.opened > 0 ? roundToPercent(data.clicked / data.opened) : 0,
        conversionRate: data.clicked > 0 ? roundToPercent(data.converted / data.clicked) : 0,
      },
    }
  })
}

/**
 * 依通道分析成效
 *
 * 從 automation-logs 的 executedSteps 中，按通道（LINE、Email、SMS、Push）分組。
 *
 * @param campaignId - marketing-campaigns 的文件 ID
 */
export async function analyzeByChannel(campaignId: string): Promise<Record<string, ChannelMetrics>> {
  const payload = await getPayload({ config })

  const campaign = await payload.findByID({
    collection: 'marketing-campaigns',
    id: campaignId,
  })

  const journeyRef = campaign.journeyRef
  const journeyId = typeof journeyRef === 'string' ? journeyRef : (journeyRef as unknown as { id: string })?.id

  if (!journeyId) {
    return {}
  }

  const logsResult = await payload.find({
    collection: 'automation-logs',
    where: {
      journey: { equals: journeyId },
    } satisfies Where,
    limit: 10000,
  })

  // 通道統計
  const channelMap: Record<string, {
    sent: number; delivered: number; opened: number; clicked: number
    converted: number; revenue: number; bounced: number
  }> = {}

  for (const log of logsResult.docs) {
    const steps = (log.executedSteps as unknown as Array<Record<string, unknown>>) ?? []
    const triggerData = (log.triggerData as unknown as Record<string, unknown>) ?? {}
    const events = (triggerData.trackingEvents as unknown as Array<Record<string, unknown>>) ?? []
    const eventTypes = new Set(events.map((e) => e.eventType as string))

    for (const step of steps) {
      const action = step.action as string
      let channel = ''

      if (action === 'send_line') channel = 'line'
      else if (action === 'send_email') channel = 'email'
      else if (action === 'send_sms') channel = 'sms'
      else continue // 非訊息發送步驟跳過

      if (!channelMap[channel]) {
        channelMap[channel] = { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0, bounced: 0 }
      }

      const data = channelMap[channel]
      data.sent++

      if (step.success) {
        data.delivered++
      } else {
        data.bounced++
      }

      // 事件歸屬到所有使用的通道（簡化處理）
      if (eventTypes.has('opened')) data.opened++
      if (eventTypes.has('clicked')) data.clicked++
      if (eventTypes.has('converted')) {
        data.converted++
        const rev = triggerData.convertedRevenue as number
        if (rev) data.revenue += rev
      }
    }
  }

  const result: Record<string, ChannelMetrics> = {}
  for (const [channel, data] of Object.entries(channelMap)) {
    result[channel] = {
      channel,
      sent: data.sent,
      opened: data.opened,
      clicked: data.clicked,
      converted: data.converted,
      revenue: data.revenue,
      openRate: data.delivered > 0 ? roundToPercent(data.opened / data.delivered) : 0,
      clickRate: data.opened > 0 ? roundToPercent(data.clicked / data.opened) : 0,
      conversionRate: data.clicked > 0 ? roundToPercent(data.converted / data.clicked) : 0,
      deliveryRate: data.sent > 0 ? roundToPercent(data.delivered / data.sent) : 0,
      bounceRate: data.sent > 0 ? roundToPercent(data.bounced / data.sent) : 0,
    }
  }

  return result
}

// ══════════════════════════════════════════════════════════
// Dashboard 聚合 Helpers
// ══════════════════════════════════════════════════════════

/**
 * 聚合所有活動的通道成效（用於 Dashboard）
 */
async function aggregateChannelPerformance(
  campaigns: Array<Record<string, unknown>>,
): Promise<Record<string, ChannelMetrics>> {
  const aggregated: Record<string, {
    sent: number; delivered: number; opened: number; clicked: number
    converted: number; revenue: number; bounced: number
  }> = {}

  for (const campaign of campaigns) {
    const campaignId = campaign.id as unknown as string
    try {
      const channelMetrics = await analyzeByChannel(campaignId)
      for (const [channel, metrics] of Object.entries(channelMetrics)) {
        if (!aggregated[channel]) {
          aggregated[channel] = { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0, bounced: 0 }
        }
        const data = aggregated[channel]
        data.sent += metrics.sent
        data.opened += metrics.opened
        data.clicked += metrics.clicked
        data.converted += metrics.converted
        data.revenue += metrics.revenue
      }
    } catch {
      // 跳過無法分析的活動
    }
  }

  const result: Record<string, ChannelMetrics> = {}
  for (const [channel, data] of Object.entries(aggregated)) {
    result[channel] = {
      channel,
      sent: data.sent,
      opened: data.opened,
      clicked: data.clicked,
      converted: data.converted,
      revenue: data.revenue,
      openRate: data.delivered > 0 ? roundToPercent(data.opened / data.delivered) : 0,
      clickRate: data.opened > 0 ? roundToPercent(data.clicked / data.opened) : 0,
      conversionRate: data.clicked > 0 ? roundToPercent(data.converted / data.clicked) : 0,
      deliveryRate: data.sent > 0 ? roundToPercent(data.delivered / data.sent) : 0,
      bounceRate: data.sent > 0 ? roundToPercent(data.bounced / data.sent) : 0,
    }
  }

  return result
}

/**
 * 聚合所有活動的客群成效（用於 Dashboard）
 */
async function aggregateSegmentPerformance(
  campaigns: Array<Record<string, unknown>>,
): Promise<Record<string, SegmentMetrics>> {
  const aggregated: Record<string, { sent: number; opened: number; clicked: number; converted: number; revenue: number }> = {}

  for (const campaign of campaigns) {
    const campaignId = campaign.id as unknown as string
    try {
      const segMetrics = await analyzeBySegment(campaignId)
      for (const [segment, metrics] of Object.entries(segMetrics)) {
        if (!aggregated[segment]) {
          aggregated[segment] = { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 }
        }
        const data = aggregated[segment]
        data.sent += metrics.sent
        data.opened += metrics.opened
        data.clicked += metrics.clicked
        data.converted += metrics.converted
        data.revenue += metrics.revenue
      }
    } catch {
      // 跳過無法分析的活動
    }
  }

  const result: Record<string, SegmentMetrics> = {}
  for (const [segment, data] of Object.entries(aggregated)) {
    result[segment] = {
      sent: data.sent,
      opened: data.opened,
      clicked: data.clicked,
      converted: data.converted,
      revenue: data.revenue,
      openRate: data.sent > 0 ? roundToPercent(data.opened / data.sent) : 0,
      clickRate: data.opened > 0 ? roundToPercent(data.clicked / data.opened) : 0,
      conversionRate: data.clicked > 0 ? roundToPercent(data.converted / data.clicked) : 0,
    }
  }

  return result
}

/**
 * 聚合所有活動的信用分數影響分析（用於 Dashboard）
 */
async function aggregateCreditScoreImpact(
  campaigns: Array<Record<string, unknown>>,
): Promise<Array<{ range: string; avgConversion: number; avgRevenue: number }>> {
  const aggregated: Record<string, { totalConversion: number; totalRevenue: number; count: number }> = {}

  for (const r of CREDIT_SCORE_RANGES) {
    aggregated[r.label] = { totalConversion: 0, totalRevenue: 0, count: 0 }
  }

  for (const campaign of campaigns) {
    const campaignId = campaign.id as unknown as string
    try {
      const creditMetrics = await analyzeByCreditScore(campaignId)
      for (const { range, metrics } of creditMetrics) {
        const data = aggregated[range]
        if (!data) continue
        data.totalConversion += metrics.conversionRate
        data.totalRevenue += metrics.revenue
        data.count++
      }
    } catch {
      // 跳過無法分析的活動
    }
  }

  return CREDIT_SCORE_RANGES.map((r) => {
    const data = aggregated[r.label]
    return {
      range: r.label,
      avgConversion: data.count > 0 ? roundToPercent(data.totalConversion / data.count / 100) : 0,
      avgRevenue: data.count > 0 ? Math.round(data.totalRevenue / data.count) : 0,
    }
  })
}

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

/** 信用分數 → 區間標籤 */
function getCreditScoreRangeLabel(score: number): string {
  for (const r of CREDIT_SCORE_RANGES) {
    if (score >= r.min && score <= r.max) return r.label
  }
  return '高風險'
}

/** 四捨五入至百分比（兩位小數） */
function roundToPercent(ratio: number): number {
  return Math.round(ratio * 100 * 100) / 100
}

/** 空的 SegmentMetrics */
function emptySegmentMetrics(): SegmentMetrics {
  return {
    sent: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
    revenue: 0,
    openRate: 0,
    clickRate: 0,
    conversionRate: 0,
  }
}
