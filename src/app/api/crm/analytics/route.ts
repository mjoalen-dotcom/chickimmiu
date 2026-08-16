import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * CRM Behavior Analytics API
 * GET /api/crm/analytics — 會員行為分析儀表板聚合數據
 *
 * Query params:
 *   timeRange: 7d | 30d | 90d | 365d (default 30d)
 *   tierFilter: tier frontName (optional)
 *   segmentFilter: segment name (optional)
 *
 * Returns: overview KPIs, segment distribution, churn distribution,
 *          LTV distribution, credit score distribution, monthly trends, top tags
 */

// ── tier slug -> frontName (NEVER expose codes) ──
const TIER_FRONT_NAMES: Record<string, string> = {
  ordinary: '優雅初遇者',
  bronze: '曦漾仙子',
  silver: '優漾女神',
  gold: '金曦女王',
  platinum: '星耀皇后',
  diamond: '璀璨天后',
}

function resolveTierFrontName(tier: unknown): string {
  if (!tier || typeof tier !== 'object') {
    if (typeof tier === 'string' && TIER_FRONT_NAMES[tier]) {
      return TIER_FRONT_NAMES[tier]
    }
    return TIER_FRONT_NAMES['ordinary']
  }
  const tierObj = tier as unknown as Record<string, unknown>
  if (tierObj.frontName && typeof tierObj.frontName === 'string') {
    return tierObj.frontName
  }
  const slug = (tierObj.slug as string) || ''
  return TIER_FRONT_NAMES[slug] || TIER_FRONT_NAMES['ordinary']
}

function getTimeRangeDays(timeRange: string): number {
  switch (timeRange) {
    case '7d':
      return 7
    case '90d':
      return 90
    case '365d':
      return 365
    default:
      return 30
  }
}

// ── Empty baseline（不再使用 demo 假資料；無資料時回傳 0 / 空陣列）──
const EMPTY_DATA = {
  overview: {
    totalMembers: 0,
    avgLTV: 0,
    avgChurnScore: 0,
    avgCreditScore: 0,
    overallReturnRate: 0,
  },
  segmentDistribution: [] as Array<{ segment: string; count: number; percentage: number }>,
  churnDistribution: [] as Array<{ risk: string; count: number }>,
  ltvDistribution: [] as Array<{ range: string; count: number }>,
  creditScoreDistribution: [] as Array<{ range: string; count: number }>,
  topTags: [] as Array<{ tag: string; count: number }>,
  monthlyTrends: [] as Array<{
    month: string
    newMembers: number
    churnedMembers: number
    avgSpend: number
  }>,
  tierDistribution: {} as Record<string, number>,
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const timeRange = searchParams.get('timeRange') || '30d'
    const tierFilter = searchParams.get('tierFilter') || null
    const segmentFilter = searchParams.get('segmentFilter') || null

    const days = getTimeRangeDays(timeRange)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const payload = await getPayload({ config })

    // ── 1. Total members ──
    const allMembers = await payload.find({
      collection: 'customers',
      limit: 0,
    })
    const totalMembers = allMembers.totalDocs

    // 無會員資料時回傳空 baseline（不假資料）。
    if (totalMembers === 0) {
      return NextResponse.json({
        success: true,
        data: EMPTY_DATA,
        meta: { source: 'empty', timeRange, tierFilter, segmentFilter },
      })
    }

    // ── 2. Sample members for aggregation ──
    const sampleMembers = await payload.find({
      collection: 'customers',
      limit: 300,
      sort: '-createdAt',
      depth: 1,
    })

    // ── 3. Credit scores ──
    const creditScores: number[] = []
    for (const member of sampleMembers.docs) {
      const history = await payload.find({
        collection: 'credit-score-history',
        where: { user: { equals: member.id } } as never,
        sort: '-createdAt',
        limit: 1,
      })
      const score = history.docs[0] ? ((history.docs[0].newScore as number) ?? 80) : 80
      creditScores.push(score)
    }

    const avgCreditScore =
      creditScores.length > 0
        ? Math.round((creditScores.reduce((a, b) => a + b, 0) / creditScores.length) * 10) / 10
        : 80

    // ── 4. LTV / spend ──
    const totalSpentValues = sampleMembers.docs.map(
      (u) => ((u as unknown as Record<string, unknown>).totalSpent as number) || 0,
    )
    const avgLTV =
      totalSpentValues.length > 0
        ? Math.round(totalSpentValues.reduce((a, b) => a + b, 0) / totalSpentValues.length)
        : 0

    // ── 5. Returns / churn approximation ──
    const ordersInRange = await payload.find({
      collection: 'orders',
      where: {
        createdAt: { greater_than: cutoffDate.toISOString() },
      } as never,
      limit: 0,
    })
    const returnsInRange = await payload.find({
      collection: 'returns',
      where: {
        createdAt: { greater_than: cutoffDate.toISOString() },
      } as never,
      limit: 0,
    })
    const overallReturnRate =
      ordersInRange.totalDocs > 0
        ? Math.round((returnsInRange.totalDocs / ordersInRange.totalDocs) * 100 * 10) / 10
        : 0

    // Churn score approximation based on credit score distribution
    const avgChurnScore =
      creditScores.length > 0
        ? Math.round(100 - creditScores.reduce((a, b) => a + b, 0) / creditScores.length)
        : 32

    // ── 6. Segment distribution (RFM-based) ──
    // 由實際 spend/recency 樣本推導；無樣本則自然得到空/零，不再 fallback 假資料。
    const segmentDistribution = deriveSegmentDistribution(
      sampleMembers.docs as unknown as Record<string, unknown>[],
      totalMembers,
    )

    // ── 7. Churn distribution ──
    const churnDistribution = deriveChurnDistribution(creditScores, totalMembers)

    // ── 8. LTV distribution ──
    const ltvDistribution = deriveLtvDistribution(totalSpentValues)

    // ── 9. Credit score distribution ──
    const creditScoreDistribution = [
      { range: '90-100 優質', count: creditScores.filter((s) => s >= 90).length },
      { range: '60-89 一般', count: creditScores.filter((s) => s >= 60 && s < 90).length },
      { range: '40-59 觀察', count: creditScores.filter((s) => s >= 40 && s < 60).length },
      { range: '30-39 警示', count: creditScores.filter((s) => s >= 30 && s < 40).length },
      { range: '1-29 黑名單', count: creditScores.filter((s) => s >= 1 && s < 30).length },
      { range: '0 停權', count: creditScores.filter((s) => s < 1).length },
    ]

    // ── 10. Tier distribution ──
    const tierDistribution: Record<string, number> = {}
    const tiers = await payload.find({
      collection: 'membership-tiers',
      limit: 10,
      sort: 'level',
    })
    for (const tier of tiers.docs) {
      const frontName = resolveTierFrontName(tier)
      const count = await payload.find({
        collection: 'customers',
        where: {
          memberTier: { equals: tier.id },
        } as never,
        limit: 0,
      })
      tierDistribution[frontName] = count.totalDocs
    }
    const assignedTotal = Object.values(tierDistribution).reduce((a, b) => a + b, 0)
    const unassigned = totalMembers - assignedTotal
    if (unassigned > 0) {
      const defaultName = TIER_FRONT_NAMES['ordinary']
      tierDistribution[defaultName] = (tierDistribution[defaultName] || 0) + unassigned
    }

    // ── 11. Monthly trends (last 6 months) ──
    const monthlyTrends = await deriveMonthlyTrends(payload)

    // ── 12. Top tags ──
    const topTags = deriveTopTags(sampleMembers.docs as unknown as Record<string, unknown>[])

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalMembers,
          avgLTV,
          avgChurnScore,
          avgCreditScore,
          overallReturnRate,
        },
        segmentDistribution,
        churnDistribution,
        ltvDistribution,
        creditScoreDistribution,
        topTags,
        monthlyTrends,
        tierDistribution,
      },
      meta: { source: 'live', timeRange, tierFilter, segmentFilter },
    })
  } catch (error) {
    console.error('CRM Analytics GET error:', error)
    // 出錯回傳空 baseline（不假資料）。
    return NextResponse.json({
      success: true,
      data: EMPTY_DATA,
      meta: { source: 'error', error: '伺服器錯誤，暫無法取得分析數據' },
    })
  }
}

// ── Helper: RFM segment distribution ──
function deriveSegmentDistribution(
  docs: Array<Record<string, unknown>>,
  totalMembers: number,
) {
  const totalSpents = docs.map((d) => ((d as unknown as Record<string, unknown>).totalSpent as number) || 0)
  const median =
    totalSpents.length > 0
      ? totalSpents.sort((a, b) => a - b)[Math.floor(totalSpents.length / 2)]
      : 0

  // Simple heuristic segmentation based on spend
  let champions = 0,
    loyal = 0,
    potential = 0,
    newQuality = 0,
    priceSensitive = 0,
    atRisk = 0,
    returnRisk = 0,
    hibernating = 0

  for (const doc of docs) {
    const spent = ((doc as unknown as Record<string, unknown>).totalSpent as number) || 0
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date((doc as unknown as Record<string, unknown>).createdAt as string).getTime()) /
        (1000 * 60 * 60 * 24),
    )

    if (spent > median * 3 && daysSinceCreation > 90) champions++
    else if (spent > median * 2) loyal++
    else if (spent > median * 1.2 && daysSinceCreation < 120) potential++
    else if (daysSinceCreation < 30 && spent > 0) newQuality++
    else if (spent > 0 && spent < median * 0.3) priceSensitive++
    else if (daysSinceCreation > 180 && spent < median * 0.5) hibernating++
    else if (spent === 0 && daysSinceCreation > 60) atRisk++
    else returnRisk++
  }

  const total = docs.length || 1
  const scale = totalMembers / total

  const segments = [
    { segment: '冠軍客群', count: Math.round(champions * scale) },
    { segment: '忠實客群', count: Math.round(loyal * scale) },
    { segment: '潛力忠誠客', count: Math.round(potential * scale) },
    { segment: '優質新客', count: Math.round(newQuality * scale) },
    { segment: '價格敏感客', count: Math.round(priceSensitive * scale) },
    { segment: '流失高風險客', count: Math.round(atRisk * scale) },
    { segment: '退貨高風險客', count: Math.round(returnRisk * scale) },
    { segment: '沉睡客', count: Math.round(hibernating * scale) },
  ]

  const segTotal = segments.reduce((a, b) => a + b.count, 0) || 1
  return segments.map((s) => ({
    ...s,
    percentage: Math.round((s.count / segTotal) * 100 * 10) / 10,
  }))
}

// ── Helper: Churn distribution ──
function deriveChurnDistribution(creditScores: number[], totalMembers: number) {
  const scale = creditScores.length > 0 ? totalMembers / creditScores.length : 1
  return [
    { risk: '低風險', count: Math.round(creditScores.filter((s) => s >= 80).length * scale) },
    {
      risk: '中風險',
      count: Math.round(creditScores.filter((s) => s >= 50 && s < 80).length * scale),
    },
    {
      risk: '高風險',
      count: Math.round(creditScores.filter((s) => s >= 30 && s < 50).length * scale),
    },
    { risk: '極高風險', count: Math.round(creditScores.filter((s) => s < 30).length * scale) },
  ]
}

// ── Helper: LTV distribution ──
function deriveLtvDistribution(totalSpents: number[]) {
  return [
    { range: 'NT$0-10K', count: totalSpents.filter((s) => s < 10000).length },
    { range: 'NT$10K-30K', count: totalSpents.filter((s) => s >= 10000 && s < 30000).length },
    { range: 'NT$30K-60K', count: totalSpents.filter((s) => s >= 30000 && s < 60000).length },
    { range: 'NT$60K-100K', count: totalSpents.filter((s) => s >= 60000 && s < 100000).length },
    { range: 'NT$100K+', count: totalSpents.filter((s) => s >= 100000).length },
  ]
}

// ── Helper: Monthly trends (last 6 months) ──
async function deriveMonthlyTrends(payload: Awaited<ReturnType<typeof getPayload>>) {
  const trends: Array<{
    month: string
    newMembers: number
    churnedMembers: number
    avgSpend: number
  }> = []

  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const monthStr = `${year}-${month}`

    const startOfMonth = new Date(year, date.getMonth(), 1)
    const endOfMonth = new Date(year, date.getMonth() + 1, 0, 23, 59, 59)

    const newMembers = await payload.find({
      collection: 'customers',
      where: {
        createdAt: {
          greater_than: startOfMonth.toISOString(),
          less_than: endOfMonth.toISOString(),
        },
      } as never,
      limit: 0,
    })

    const monthOrders = await payload.find({
      collection: 'orders',
      where: {
        createdAt: {
          greater_than: startOfMonth.toISOString(),
          less_than: endOfMonth.toISOString(),
        },
      } as never,
      limit: 50,
    })

    const orderTotals = monthOrders.docs.map(
      (o) => ((o as unknown as Record<string, unknown>).total as number) || 0,
    )
    const avgSpend =
      orderTotals.length > 0
        ? Math.round(orderTotals.reduce((a, b) => a + b, 0) / orderTotals.length)
        : 0

    trends.push({
      month: monthStr,
      newMembers: newMembers.totalDocs,
      churnedMembers: 0, // would require churn tracking collection
      avgSpend,
    })
  }

  return trends
}

// ── Helper: Top tags ──
function deriveTopTags(docs: Array<Record<string, unknown>>) {
  const tagCounts: Record<string, number> = {}

  for (const doc of docs) {
    const tags = (doc as unknown as Record<string, unknown>).tags
    if (Array.isArray(tags)) {
      for (const t of tags) {
        const tagStr = typeof t === 'string' ? t : (t as unknown as Record<string, unknown>)?.tag
        if (typeof tagStr === 'string' && tagStr.trim()) {
          tagCounts[tagStr.trim()] = (tagCounts[tagStr.trim()] || 0) + 1
        }
      }
    }
  }

  return Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }))
}
