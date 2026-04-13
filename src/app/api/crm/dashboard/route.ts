import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * CRM Dashboard API
 * GET /api/crm/dashboard — CRM 儀表板 KPI 數據
 *
 * Returns: overview, tierDistribution, creditDistribution,
 *          creditKPIs, journeyStats, recentAlerts
 */

// ── tier slug → frontName 對照表 ──
const TIER_FRONT_NAMES: Record<string, string> = {
  ordinary: '優雅初遇者',
  bronze: '曦漾仙子',
  silver: '優漾女神',
  gold: '金曦女王',
  platinum: '星耀皇后',
  diamond: '璀璨天后',
}

export async function GET(_req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // ── 1. Overview：基本會員統計 ──
    const allMembers = await payload.find({
      collection: 'users',
      where: { role: { equals: 'customer' } } as never,
      limit: 0,
    })
    const totalMembers = allMembers.totalDocs

    // 30 天內活躍會員（有下單）
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const activeOrders = await payload.find({
      collection: 'orders',
      where: {
        createdAt: { greater_than: thirtyDaysAgo.toISOString() },
      } as never,
      limit: 0,
    })
    const activeMembers30d = activeOrders.totalDocs // MVP 近似值

    // 7 天內新會員
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const newMembers = await payload.find({
      collection: 'users',
      where: {
        role: { equals: 'customer' },
        createdAt: { greater_than: sevenDaysAgo.toISOString() },
      } as never,
      limit: 0,
    })
    const newMembers7d = newMembers.totalDocs

    // 平均累計消費 — 取一批樣本計算
    const sampleMembers = await payload.find({
      collection: 'users',
      where: { role: { equals: 'customer' } } as never,
      limit: 200,
      sort: '-createdAt',
    })
    const totalSpentValues = sampleMembers.docs.map(
      (u) => ((u as unknown as Record<string, unknown>).totalSpent as number) || 0,
    )
    const avgLifetimeSpend =
      totalSpentValues.length > 0
        ? Math.round(totalSpentValues.reduce((a, b) => a + b, 0) / totalSpentValues.length)
        : 0

    // ── 2. 信用分數統計 ──
    // 取每位會員的最新信用分數（取樣）
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
        ? Math.round(creditScores.reduce((a, b) => a + b, 0) / creditScores.length)
        : 80

    // 信用分布
    const creditDistribution = {
      excellent: creditScores.filter((s) => s >= 90).length,
      normal: creditScores.filter((s) => s >= 60 && s < 90).length,
      watchlist: creditScores.filter((s) => s >= 40 && s < 60).length,
      warning: creditScores.filter((s) => s >= 30 && s < 40).length,
      blacklist: creditScores.filter((s) => s >= 1 && s < 30).length,
      suspended: creditScores.filter((s) => s < 1).length,
    }

    // 信用 KPI
    const goodCustomerCount = creditScores.filter((s) => s >= 90).length
    const blacklistCount = creditScores.filter((s) => s < 30).length
    const goodCustomerRate =
      creditScores.length > 0
        ? Math.round((goodCustomerCount / creditScores.length) * 100 * 10) / 10
        : 0
    const blacklistRate =
      creditScores.length > 0
        ? Math.round((blacklistCount / creditScores.length) * 100 * 10) / 10
        : 0

    // 分數分布圖
    const scoreDistributionChart = [
      { range: '0-19', count: creditScores.filter((s) => s < 20).length },
      { range: '20-39', count: creditScores.filter((s) => s >= 20 && s < 40).length },
      { range: '40-59', count: creditScores.filter((s) => s >= 40 && s < 60).length },
      { range: '60-79', count: creditScores.filter((s) => s >= 60 && s < 80).length },
      { range: '80-89', count: creditScores.filter((s) => s >= 80 && s < 90).length },
      { range: '90-100', count: creditScores.filter((s) => s >= 90).length },
    ]

    // 退貨率相關性（MVP：模擬值）
    const returnRateCorrelation = -0.72

    // ── 3. 等級分布 ──
    const tierDistribution: Record<string, number> = {}
    const tiers = await payload.find({
      collection: 'membership-tiers',
      limit: 10,
      sort: 'level',
    })

    for (const tier of tiers.docs) {
      const slug = tier.slug as string
      const frontName = (tier.frontName as string) || TIER_FRONT_NAMES[slug] || slug
      const count = await payload.find({
        collection: 'users',
        where: {
          role: { equals: 'customer' },
          memberTier: { equals: tier.id },
        } as never,
        limit: 0,
      })
      tierDistribution[frontName] = count.totalDocs
    }

    // 沒有等級的會員歸入預設等級
    const assignedTotal = Object.values(tierDistribution).reduce((a, b) => a + b, 0)
    const unassigned = totalMembers - assignedTotal
    if (unassigned > 0) {
      const defaultName = TIER_FRONT_NAMES['ordinary']
      tierDistribution[defaultName] = (tierDistribution[defaultName] || 0) + unassigned
    }

    // ── 4. 自動化旅程統計 ──
    const activeJourneys = await payload.find({
      collection: 'automation-journeys',
      where: { isActive: { equals: true } } as never,
      limit: 0,
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const triggeredToday = await payload.find({
      collection: 'automation-logs',
      where: {
        createdAt: { greater_than: today.toISOString() },
      } as never,
      limit: 0,
    })

    const allLogs = await payload.find({
      collection: 'automation-logs',
      limit: 0,
    })
    const completedLogs = await payload.find({
      collection: 'automation-logs',
      where: { status: { equals: 'completed' } } as never,
      limit: 0,
    })
    const completionRate =
      allLogs.totalDocs > 0
        ? Math.round((completedLogs.totalDocs / allLogs.totalDocs) * 100)
        : 0

    // ── 5. 最近警示 ──
    // 取最近的信用分數重大變動作為警示
    const recentCritical = await payload.find({
      collection: 'credit-score-history',
      where: {
        or: [
          { newScore: { less_than: 30 } },
          { change: { less_than: -10 } },
        ],
      } as never,
      sort: '-createdAt',
      limit: 10,
      depth: 1,
    })

    const recentAlerts = recentCritical.docs.map((entry) => {
      const newScore = (entry.newScore as number) ?? 0
      const change = (entry.change as number) ?? 0
      const userObj = entry.user as unknown as Record<string, unknown> | string
      const userId = typeof userObj === 'string' ? userObj : userObj?.id
      const userName =
        typeof userObj === 'object' && userObj?.name ? (userObj.name as string) : '未知會員'

      let type: string
      let message: string

      if (newScore < 30) {
        type = 'credit_blacklist'
        message = `會員「${userName}」信用分數降至 ${newScore}，已進入黑名單`
      } else if (change <= -10) {
        type = 'credit_drop'
        message = `會員「${userName}」信用分數大幅下降 ${change}（目前 ${newScore}）`
      } else {
        type = 'credit_warning'
        message = `會員「${userName}」信用分數異常（${newScore}）`
      }

      return {
        type,
        message,
        userId,
        timestamp: entry.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalMembers,
          activeMembers30d,
          newMembers7d,
          avgCreditScore,
          avgLifetimeSpend,
        },
        tierDistribution,
        creditDistribution,
        creditKPIs: {
          avgScore: avgCreditScore,
          goodCustomerRate,
          blacklistRate,
          returnRateCorrelation,
          scoreDistributionChart,
        },
        journeyStats: {
          activeJourneys: activeJourneys.totalDocs,
          triggeredToday: triggeredToday.totalDocs,
          completionRate,
        },
        recentAlerts,
      },
    })
  } catch (error) {
    console.error('CRM Dashboard GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
