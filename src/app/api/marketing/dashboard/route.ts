import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { getMarketingDashboard } from '@/lib/marketing/performanceTracker'

/**
 * 行銷儀表板 API
 * GET /api/marketing/dashboard — 完整行銷儀表板數據
 *
 * Returns: activeCampaigns, 30-day metrics, channel performance,
 *          segment performance, top campaigns, credit impact, recent list
 */

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

    // ── 1. 活動統計 ──
    const activeCampaigns = await payload.find({
      collection: 'marketing-campaigns',
      where: { status: { equals: 'active' } } satisfies Where,
      limit: 0,
    })

    const scheduledCampaigns = await payload.find({
      collection: 'marketing-campaigns',
      where: { status: { equals: 'scheduled' } } satisfies Where,
      limit: 0,
    })

    const draftCampaigns = await payload.find({
      collection: 'marketing-campaigns',
      where: { status: { equals: 'draft' } } satisfies Where,
      limit: 0,
    })

    const allCampaigns = await payload.find({
      collection: 'marketing-campaigns',
      limit: 0,
    })

    // ── 2. 30 天內成效指標 ──
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentCampaigns = await payload.find({
      collection: 'marketing-campaigns',
      where: {
        or: [
          { status: { equals: 'active' } },
          { status: { equals: 'completed' } },
        ],
        'schedule.startDate': { greater_than_equal: thirtyDaysAgo.toISOString() },
      } satisfies Where,
      limit: 100,
      depth: 0,
    })

    let totalSent = 0
    let totalDelivered = 0
    let totalOpened = 0
    let totalClicked = 0
    let totalConverted = 0
    let totalRevenue = 0
    let totalUnsubscribed = 0

    for (const c of recentCampaigns.docs) {
      const perf = (c as unknown as Record<string, unknown>).performance as Record<string, number> | undefined
      if (perf) {
        totalSent += perf.sent || 0
        totalDelivered += perf.delivered || 0
        totalOpened += perf.opened || 0
        totalClicked += perf.clicked || 0
        totalConverted += perf.converted || 0
        totalRevenue += perf.revenue || 0
        totalUnsubscribed += perf.unsubscribed || 0
      }
    }

    // 嘗試從 performanceTracker 取得更即時的數據
    try {
      const liveSummary = await getMarketingDashboard()
      if (liveSummary) {
        totalSent = liveSummary.totalSent30d ?? totalSent
        totalOpened = Math.round(liveSummary.totalSent30d * (liveSummary.avgOpenRate / 100)) || totalOpened
        totalClicked = Math.round(totalOpened * (liveSummary.avgClickRate / 100)) || totalClicked
        totalConverted = Math.round(totalClicked * (liveSummary.avgConversionRate / 100)) || totalConverted
        totalRevenue = liveSummary.totalRevenue30d ?? totalRevenue
      }
    } catch {
      // 使用已計算的數據
    }

    const thirtyDayMetrics = {
      sent: totalSent,
      delivered: totalDelivered,
      opened: totalOpened,
      clicked: totalClicked,
      converted: totalConverted,
      revenue: totalRevenue,
      unsubscribed: totalUnsubscribed,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 10000) / 100 : 0,
      clickRate: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 10000) / 100 : 0,
      conversionRate: totalClicked > 0 ? Math.round((totalConverted / totalClicked) * 10000) / 100 : 0,
    }

    // ── 3. 管道成效分析 ──
    const channelMap: Record<string, { sent: number; opened: number; clicked: number; converted: number; revenue: number }> = {}
    const channelLabels: Record<string, string> = {
      line: 'LINE',
      email: 'Email',
      sms: '簡訊',
      push: '推播通知',
      in_app_popup: '站內彈窗',
      edm: 'EDM',
    }

    for (const c of recentCampaigns.docs) {
      const data = c as unknown as Record<string, unknown>
      const channels = data.channels as string[] | undefined
      const perf = data.performance as Record<string, number> | undefined
      if (channels && perf) {
        for (const ch of channels) {
          if (!channelMap[ch]) {
            channelMap[ch] = { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 }
          }
          // 平均分配到每個管道（MVP 近似值）
          const factor = 1 / channels.length
          channelMap[ch].sent += Math.round((perf.sent || 0) * factor)
          channelMap[ch].opened += Math.round((perf.opened || 0) * factor)
          channelMap[ch].clicked += Math.round((perf.clicked || 0) * factor)
          channelMap[ch].converted += Math.round((perf.converted || 0) * factor)
          channelMap[ch].revenue += Math.round((perf.revenue || 0) * factor)
        }
      }
    }

    const channelPerformance = Object.entries(channelMap).map(([ch, stats]) => ({
      channel: channelLabels[ch] || ch,
      ...stats,
      openRate: stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 10000) / 100 : 0,
      clickRate: stats.opened > 0 ? Math.round((stats.clicked / stats.opened) * 10000) / 100 : 0,
      conversionRate: stats.clicked > 0 ? Math.round((stats.converted / stats.clicked) * 10000) / 100 : 0,
    }))

    // ── 4. 客群成效分析 ──
    const segmentMap: Record<string, { campaigns: number; sent: number; converted: number; revenue: number }> = {}

    for (const c of recentCampaigns.docs) {
      const data = c as unknown as Record<string, unknown>
      const segments = data.targetSegments as string[] | undefined
      const perf = data.performance as Record<string, number> | undefined
      if (segments && perf) {
        for (const seg of segments) {
          if (!segmentMap[seg]) {
            segmentMap[seg] = { campaigns: 0, sent: 0, converted: 0, revenue: 0 }
          }
          segmentMap[seg].campaigns += 1
          const factor = 1 / segments.length
          segmentMap[seg].sent += Math.round((perf.sent || 0) * factor)
          segmentMap[seg].converted += Math.round((perf.converted || 0) * factor)
          segmentMap[seg].revenue += Math.round((perf.revenue || 0) * factor)
        }
      }
    }

    const segmentPerformance = Object.entries(segmentMap).map(([seg, stats]) => ({
      segment: seg,
      ...stats,
      conversionRate: stats.sent > 0 ? Math.round((stats.converted / stats.sent) * 10000) / 100 : 0,
    }))

    // ── 5. 表現最佳活動 TOP 5 ──
    const allActiveCampaignsWithPerf = await payload.find({
      collection: 'marketing-campaigns',
      where: {
        or: [
          { status: { equals: 'active' } },
          { status: { equals: 'completed' } },
        ],
      } satisfies Where,
      limit: 50,
      sort: '-createdAt',
      depth: 0,
    })

    const topCampaigns = allActiveCampaignsWithPerf.docs
      .map((c) => {
        const data = c as unknown as Record<string, unknown>
        const perf = data.performance as Record<string, number> | undefined
        const tierFilter = data.tierFilter as string[] | undefined

        return {
          id: c.id,
          campaignName: data.campaignName,
          campaignType: data.campaignType,
          status: data.status,
          tierFilter: tierFilter
            ? tierFilter.map((code) => TIER_FRONT_NAMES[code] || code)
            : [],
          sent: perf?.sent || 0,
          converted: perf?.converted || 0,
          revenue: perf?.revenue || 0,
          conversionRate:
            (perf?.sent || 0) > 0
              ? Math.round(((perf?.converted || 0) / (perf?.sent || 1)) * 10000) / 100
              : 0,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // ── 6. 信用分數影響分析 ──
    // 比較有活動的會員 vs 無活動會員的信用分數變化
    const creditImpact = {
      description: '行銷活動對會員信用分數的影響分析',
      avgScoreWithCampaign: 0,
      avgScoreWithoutCampaign: 0,
      recommendation: '',
    }

    // 取得有訂單的會員（受行銷影響）的平均信用分數
    const recentOrders = await payload.find({
      collection: 'orders',
      where: {
        createdAt: { greater_than: thirtyDaysAgo.toISOString() },
      } satisfies Where,
      limit: 100,
      depth: 0,
    })

    const activeUserIds = new Set<string>()
    for (const order of recentOrders.docs) {
      const orderedBy = (order as unknown as Record<string, unknown>).orderedBy
      if (typeof orderedBy === 'string') activeUserIds.add(orderedBy)
      else if (typeof orderedBy === 'object' && orderedBy && 'id' in (orderedBy as unknown as Record<string, unknown>)) {
        activeUserIds.add((orderedBy as unknown as Record<string, unknown>).id as unknown as string)
      }
    }

    if (activeUserIds.size > 0) {
      const activeScores: number[] = []
      const sampleIds = Array.from(activeUserIds).slice(0, 30)
      for (const uid of sampleIds) {
        const history = await payload.find({
          collection: 'credit-score-history',
          where: { user: { equals: uid } } satisfies Where,
          sort: '-createdAt',
          limit: 1,
        })
        if (history.docs[0]) {
          activeScores.push(((history.docs[0] as unknown as Record<string, unknown>).newScore as number) ?? 80)
        }
      }
      creditImpact.avgScoreWithCampaign =
        activeScores.length > 0
          ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length)
          : 80
    }

    // 隨機取非活躍會員信用分數
    const inactiveUsers = await payload.find({
      collection: 'users',
      where: { role: { equals: 'customer' } } satisfies Where,
      limit: 30,
      sort: 'createdAt',
    })

    const inactiveScores: number[] = []
    for (const u of inactiveUsers.docs) {
      if (!activeUserIds.has(u.id as unknown as string)) {
        const history = await payload.find({
          collection: 'credit-score-history',
          where: { user: { equals: u.id } } satisfies Where,
          sort: '-createdAt',
          limit: 1,
        })
        if (history.docs[0]) {
          inactiveScores.push(((history.docs[0] as unknown as Record<string, unknown>).newScore as number) ?? 80)
        }
      }
    }
    creditImpact.avgScoreWithoutCampaign =
      inactiveScores.length > 0
        ? Math.round(inactiveScores.reduce((a, b) => a + b, 0) / inactiveScores.length)
        : 80

    const scoreDiff = creditImpact.avgScoreWithCampaign - creditImpact.avgScoreWithoutCampaign
    if (scoreDiff > 5) {
      creditImpact.recommendation = '行銷活動受眾的信用分數明顯較高，建議持續針對高信用客群投放'
    } else if (scoreDiff < -5) {
      creditImpact.recommendation = '行銷活動受眾的信用分數偏低，建議調整目標客群篩選條件'
    } else {
      creditImpact.recommendation = '行銷活動對信用分數影響中性，建議嘗試依信用分數差異化內容'
    }

    // ── 7. 最近活動列表 ──
    const recentList = await payload.find({
      collection: 'marketing-campaigns',
      limit: 10,
      sort: '-updatedAt',
      depth: 0,
    })

    const recentCampaignList = recentList.docs.map((c) => {
      const data = c as unknown as Record<string, unknown>
      const perf = data.performance as Record<string, number> | undefined
      const tierFilter = data.tierFilter as string[] | undefined

      return {
        id: c.id,
        campaignName: data.campaignName,
        campaignType: data.campaignType,
        status: data.status,
        tierFilter: tierFilter
          ? tierFilter.map((code) => TIER_FRONT_NAMES[code] || code)
          : [],
        channels: data.channels,
        schedule: data.schedule,
        sent: perf?.sent || 0,
        revenue: perf?.revenue || 0,
        updatedAt: c.updatedAt,
      }
    })

    // ── A/B 測試統計 ──
    const runningTests = await payload.find({
      collection: 'ab-tests',
      where: { status: { equals: 'running' } } satisfies Where,
      limit: 0,
    })

    const completedTests = await payload.find({
      collection: 'ab-tests',
      where: { status: { equals: 'completed' } } satisfies Where,
      limit: 0,
    })

    // ── 模板統計 ──
    const activeTemplates = await payload.find({
      collection: 'message-templates',
      where: { isActive: { equals: true } } satisfies Where,
      limit: 0,
    })

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          activeCampaigns: activeCampaigns.totalDocs,
          scheduledCampaigns: scheduledCampaigns.totalDocs,
          draftCampaigns: draftCampaigns.totalDocs,
          totalCampaigns: allCampaigns.totalDocs,
          runningABTests: runningTests.totalDocs,
          completedABTests: completedTests.totalDocs,
          activeTemplates: activeTemplates.totalDocs,
        },
        thirtyDayMetrics,
        channelPerformance,
        segmentPerformance,
        topCampaigns,
        creditScoreImpact: creditImpact,
        recentCampaigns: recentCampaignList,
      },
    })
  } catch (error) {
    console.error('Marketing Dashboard GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
