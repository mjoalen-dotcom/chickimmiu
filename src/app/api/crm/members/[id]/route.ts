import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * CRM Single Member 360 View API
 * GET /api/crm/members/:id — 單一會員 360 度全貌
 *
 * Returns: credit score, RFM, LTV prediction, churn score,
 *          preferences, tags, auto-tag suggestions, recent orders,
 *          credit history, return history
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

// ── Demo / fallback for a single member ──
function getDemoMemberData(id: string) {
  return {
    id,
    name: '王小明',
    email: 'demo@chickimmiu.com',
    phone: '0912-345-678',
    tierFrontName: '金曦女王',
    points: 3200,
    shoppingCredit: 500,
    totalSpent: 68500,
    birthday: '1992-05-15',
    createdAt: '2024-08-20T10:00:00.000Z',
    creditScore: {
      current: 88,
      status: '優質',
      trend: 'stable' as const,
      history: [
        { date: '2026-04-01', score: 88, change: 0, reason: '月度評估' },
        { date: '2026-03-01', score: 88, change: 2, reason: '準時付款' },
        { date: '2026-02-01', score: 86, change: -1, reason: '退貨一次' },
        { date: '2026-01-01', score: 87, change: 3, reason: '高頻回購' },
        { date: '2025-12-01', score: 84, change: 0, reason: '月度評估' },
      ],
    },
    rfm: {
      recency: 8,
      frequency: 12,
      monetary: 68500,
      segment: '忠實客群',
      recencyLabel: '8 天前',
      frequencyLabel: '12 次 / 年',
      monetaryLabel: 'NT$68,500',
    },
    ltv: {
      predicted12m: 42000,
      predicted24m: 78000,
      confidence: 0.82,
      trend: 'increasing' as const,
    },
    churn: {
      score: 15,
      risk: '低風險' as const,
      factors: [
        { factor: '回購頻率高', impact: -12, direction: '降低風險' as const },
        { factor: '最近有活動', impact: -8, direction: '降低風險' as const },
        { factor: '偶爾退貨', impact: 5, direction: '增加風險' as const },
      ],
    },
    preferences: {
      favoriteCategories: ['洋裝', '上衣', '外套'],
      preferredSizes: ['M', 'S'],
      preferredColors: ['黑色', '米白', '粉色'],
      avgOrderValue: 5700,
      preferredPayment: '信用卡',
      shoppingFrequency: '每月 1-2 次',
    },
    tags: ['韓系愛好者', '高回購客', '職場穿搭', '偏好 M 碼'],
    autoTagSuggestions: [
      { tag: '換季購買者', confidence: 0.91, reason: '每季初都有下單紀錄' },
      { tag: '品牌忠實客', confidence: 0.87, reason: '持續購買超過 18 個月' },
      { tag: '洋裝愛好者', confidence: 0.84, reason: '60% 訂單含洋裝品項' },
    ],
    recentOrders: [
      {
        id: 'ORD-20260405',
        date: '2026-04-05',
        total: 4800,
        items: 3,
        status: '已出貨',
      },
      {
        id: 'ORD-20260320',
        date: '2026-03-20',
        total: 6200,
        items: 2,
        status: '已完成',
      },
      {
        id: 'ORD-20260228',
        date: '2026-02-28',
        total: 3500,
        items: 1,
        status: '已完成',
      },
      {
        id: 'ORD-20260210',
        date: '2026-02-10',
        total: 7800,
        items: 4,
        status: '已完成',
      },
      {
        id: 'ORD-20260115',
        date: '2026-01-15',
        total: 5200,
        items: 2,
        status: '已完成',
      },
    ],
    returnHistory: [
      {
        orderId: 'ORD-20260228',
        date: '2026-03-05',
        reason: '尺寸不合',
        amount: 1800,
        status: '已退款',
      },
    ],
    creditHistory: [
      {
        date: '2026-04-01',
        type: '購物回饋',
        amount: 48,
        balance: 500,
        description: '訂單 ORD-20260405 回饋',
      },
      {
        date: '2026-03-20',
        type: '購物回饋',
        amount: 62,
        balance: 452,
        description: '訂單 ORD-20260320 回饋',
      },
      {
        date: '2026-03-05',
        type: '退貨扣除',
        amount: -18,
        balance: 390,
        description: '退貨 ORD-20260228',
      },
    ],
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config })

    // ── 1. Find user ──
    let user: Record<string, unknown> | null = null
    try {
      const found = await payload.findByID({
        collection: 'users',
        id,
        depth: 1,
      })
      user = found as unknown as Record<string, unknown>
    } catch {
      // User not found — return demo data
      return NextResponse.json({
        success: true,
        data: getDemoMemberData(id),
        meta: { source: 'demo' },
      })
    }

    if (!user) {
      return NextResponse.json({
        success: true,
        data: getDemoMemberData(id),
        meta: { source: 'demo' },
      })
    }

    // ── 2. Credit score history ──
    const creditHistory = await payload.find({
      collection: 'credit-score-history',
      where: { user: { equals: id } } as never,
      sort: '-createdAt',
      limit: 10,
    })

    const latestCredit = creditHistory.docs[0]
    const currentCreditScore = latestCredit
      ? ((latestCredit.newScore as number) ?? 80)
      : 80

    let creditStatus: string
    if (currentCreditScore >= 90) creditStatus = '優質'
    else if (currentCreditScore >= 60) creditStatus = '一般'
    else if (currentCreditScore >= 40) creditStatus = '觀察'
    else if (currentCreditScore >= 30) creditStatus = '警示'
    else if (currentCreditScore >= 1) creditStatus = '黑名單'
    else creditStatus = '停權'

    // Credit trend
    const scores = creditHistory.docs.map((d) => (d.newScore as number) ?? 80)
    let creditTrend: 'improving' | 'stable' | 'declining' = 'stable'
    if (scores.length >= 2) {
      const diff = scores[0] - scores[scores.length - 1]
      if (diff > 3) creditTrend = 'improving'
      else if (diff < -3) creditTrend = 'declining'
    }

    const creditScoreData = {
      current: currentCreditScore,
      status: creditStatus,
      trend: creditTrend,
      history: creditHistory.docs.map((d) => ({
        date: d.createdAt,
        score: (d.newScore as number) ?? 80,
        change: (d.change as number) ?? 0,
        reason: (d.reason as string) || '系統評估',
      })),
    }

    // ── 3. Orders ──
    const orders = await payload.find({
      collection: 'orders',
      where: { orderedBy: { equals: id } } as never,
      sort: '-createdAt',
      limit: 10,
      depth: 0,
    })

    const orderTotals = orders.docs.map(
      (o) => ((o as unknown as Record<string, unknown>).total as number) || 0,
    )
    const totalSpent = (user.totalSpent as number) || orderTotals.reduce((a, b) => a + b, 0)
    const avgOrderValue =
      orderTotals.length > 0
        ? Math.round(orderTotals.reduce((a, b) => a + b, 0) / orderTotals.length)
        : 0

    const recentOrders = orders.docs.map((o) => {
      const order = o as unknown as Record<string, unknown>
      return {
        id: order.orderNumber || order.id,
        date: order.createdAt,
        total: (order.total as number) || 0,
        items: Array.isArray(order.items) ? order.items.length : 0,
        status: (order.status as string) || '處理中',
      }
    })

    // ── 4. Returns ──
    const returns = await payload.find({
      collection: 'returns',
      where: { user: { equals: id } } as never,
      sort: '-createdAt',
      limit: 10,
    })

    const returnHistory = returns.docs.map((r) => {
      const ret = r as unknown as Record<string, unknown>
      return {
        orderId: ret.order || ret.orderId || '',
        date: ret.createdAt,
        reason: (ret.reason as string) || '未說明',
        amount: (ret.amount as number) || 0,
        status: (ret.status as string) || '處理中',
      }
    })

    // ── 5. RFM calculation ──
    const lastOrderDate = orders.docs[0]
      ? new Date((orders.docs[0] as unknown as Record<string, unknown>).createdAt as string)
      : null
    const recencyDays = lastOrderDate
      ? Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999
    const frequency = orders.totalDocs

    let rfmSegment = '沉睡客'
    if (recencyDays < 30 && frequency >= 8 && totalSpent > 50000) rfmSegment = '冠軍客群'
    else if (frequency >= 5 && totalSpent > 30000) rfmSegment = '忠實客群'
    else if (recencyDays < 60 && frequency >= 3) rfmSegment = '潛力忠誠客'
    else if (recencyDays < 30 && frequency <= 2) rfmSegment = '優質新客'
    else if (totalSpent < 10000 && frequency >= 2) rfmSegment = '價格敏感客'
    else if (recencyDays > 120) rfmSegment = '流失高風險客'

    const rfm = {
      recency: recencyDays,
      frequency,
      monetary: totalSpent,
      segment: rfmSegment,
      recencyLabel: `${recencyDays} 天前`,
      frequencyLabel: `${frequency} 次`,
      monetaryLabel: `NT$${totalSpent.toLocaleString()}`,
    }

    // ── 6. LTV prediction (heuristic) ──
    const monthsSinceJoin = Math.max(
      1,
      Math.floor(
        (Date.now() - new Date(user.createdAt as string).getTime()) / (1000 * 60 * 60 * 24 * 30),
      ),
    )
    const monthlySpend = totalSpent / monthsSinceJoin
    const ltv = {
      predicted12m: Math.round(monthlySpend * 12),
      predicted24m: Math.round(monthlySpend * 24 * 0.85), // slight decay
      confidence: Math.min(0.95, 0.5 + frequency * 0.05),
      trend: monthlySpend > avgOrderValue * 0.8 ? ('increasing' as const) : ('stable' as const),
    }

    // ── 7. Churn score (heuristic) ──
    let churnScore = 50
    const churnFactors: Array<{
      factor: string
      impact: number
      direction: '降低風險' | '增加風險'
    }> = []

    if (recencyDays < 30) {
      churnScore -= 15
      churnFactors.push({ factor: '最近有活動', impact: -15, direction: '降低風險' })
    } else if (recencyDays > 90) {
      churnScore += 20
      churnFactors.push({ factor: '超過 90 天未購買', impact: 20, direction: '增加風險' })
    }

    if (frequency >= 5) {
      churnScore -= 20
      churnFactors.push({ factor: '回購頻率高', impact: -20, direction: '降低風險' })
    }

    if (returns.totalDocs > 3) {
      churnScore += 15
      churnFactors.push({ factor: '退貨次數偏多', impact: 15, direction: '增加風險' })
    }

    if (currentCreditScore >= 85) {
      churnScore -= 10
      churnFactors.push({ factor: '信用分數優良', impact: -10, direction: '降低風險' })
    }

    churnScore = Math.max(0, Math.min(100, churnScore))

    let churnRisk: string
    if (churnScore < 25) churnRisk = '低風險'
    else if (churnScore < 50) churnRisk = '中風險'
    else if (churnScore < 75) churnRisk = '高風險'
    else churnRisk = '極高風險'

    // ── 8. Tags & auto-tag suggestions ──
    const existingTags: string[] = Array.isArray(user.tags)
      ? (user.tags as Array<string | Record<string, unknown>>).map((t) =>
          typeof t === 'string' ? t : ((t as unknown as Record<string, unknown>).tag as string) || '',
        )
      : []

    const autoTagSuggestions: Array<{
      tag: string
      confidence: number
      reason: string
    }> = []

    if (frequency >= 5 && !existingTags.includes('高回購客')) {
      autoTagSuggestions.push({
        tag: '高回購客',
        confidence: 0.92,
        reason: `累計 ${frequency} 次購買`,
      })
    }
    if (totalSpent > 50000 && !existingTags.includes('高消費客')) {
      autoTagSuggestions.push({
        tag: '高消費客',
        confidence: 0.88,
        reason: `累計消費 NT$${totalSpent.toLocaleString()}`,
      })
    }
    if (returns.totalDocs >= 3 && !existingTags.includes('高退貨風險')) {
      autoTagSuggestions.push({
        tag: '高退貨風險',
        confidence: 0.85,
        reason: `${returns.totalDocs} 次退貨紀錄`,
      })
    }
    if (recencyDays > 120 && !existingTags.includes('沉睡客')) {
      autoTagSuggestions.push({
        tag: '沉睡客',
        confidence: 0.9,
        reason: `已超過 ${recencyDays} 天未購買`,
      })
    }

    // ── 9. Points / credit transactions ──
    let pointsTransactions: Array<Record<string, unknown>> = []
    try {
      const pts = await payload.find({
        collection: 'points-transactions',
        where: { user: { equals: id } } as never,
        sort: '-createdAt',
        limit: 10,
      })
      pointsTransactions = pts.docs.map((p) => ({
        date: p.createdAt,
        type: (p as unknown as Record<string, unknown>).type || '點數異動',
        amount: (p as unknown as Record<string, unknown>).amount || 0,
        balance: (p as unknown as Record<string, unknown>).balance || 0,
        description: (p as unknown as Record<string, unknown>).description || '',
      }))
    } catch {
      // collection may not exist yet
    }

    // ── Build response ──
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name || '未知會員',
        email: user.email || '',
        phone: (user.phone as string) || null,
        tierFrontName: resolveTierFrontName(user.memberTier),
        points: (user.points as number) ?? 0,
        shoppingCredit: (user.shoppingCredit as number) ?? 0,
        totalSpent,
        birthday: (user.birthday as string) || null,
        createdAt: user.createdAt,
        creditScore: creditScoreData,
        rfm,
        ltv,
        churn: {
          score: churnScore,
          risk: churnRisk,
          factors: churnFactors,
        },
        preferences: {
          favoriteCategories: [], // would come from order item analysis
          preferredSizes: [],
          preferredColors: [],
          avgOrderValue,
          preferredPayment: '',
          shoppingFrequency:
            monthsSinceJoin > 0
              ? `每月約 ${Math.round((frequency / monthsSinceJoin) * 10) / 10} 次`
              : '資料不足',
        },
        tags: existingTags,
        autoTagSuggestions,
        recentOrders,
        returnHistory,
        creditHistory: pointsTransactions,
      },
      meta: { source: 'live' },
    })
  } catch (error) {
    console.error('CRM Member Detail GET error:', error)
    const id =
      (error as unknown as Record<string, unknown>)?.id?.toString() || 'unknown'
    return NextResponse.json({
      success: true,
      data: getDemoMemberData(id),
      meta: { source: 'demo-fallback', error: '伺服器錯誤，顯示示範數據' },
    })
  }
}
