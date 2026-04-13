import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * CRM Members API
 * GET   /api/crm/members — 列表/搜尋會員（含 CRM 資料）
 * PATCH /api/crm/members — 更新會員 CRM 欄位（管理員）
 */

// ── tier slug → frontName 對照表（備用，若 DB 查不到時使用） ──
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const search = searchParams.get('search')
    const tier = searchParams.get('tier')
    const creditStatus = searchParams.get('creditStatus')
    const tag = searchParams.get('tag')
    const sortBy = searchParams.get('sortBy') || '-createdAt'

    const payload = await getPayload({ config })

    const where: Record<string, unknown> = {
      role: { equals: 'customer' },
    }

    if (search) {
      where.or = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    if (tier) {
      // 先查出 tier ID
      const tierResult = await payload.find({
        collection: 'membership-tiers',
        where: { slug: { equals: tier } } as never,
        limit: 1,
      })
      if (tierResult.docs[0]) {
        where.memberTier = { equals: tierResult.docs[0].id }
      }
    }

    // tag 和 creditStatus 篩選需要 CRM 欄位
    // 因為 Users collection 目前沒有 tags/creditStatus 欄位，
    // 這些在 MVP 階段先做 post-filter 或 skip
    // tag filter — 若 Users 有 tags 欄位則啟用
    if (tag) {
      where['tags'] = { contains: tag }
    }

    const result = await payload.find({
      collection: 'users',
      where: where as never,
      page,
      limit,
      sort: sortBy,
      depth: 1, // populate memberTier
    })

    // creditStatus 篩選：取得每位會員最新信用分數後過濾
    let members = await Promise.all(
      result.docs.map(async (user) => {
        // 取得最新信用分數
        const creditHistory = await payload.find({
          collection: 'credit-score-history',
          where: { user: { equals: user.id } } as never,
          sort: '-createdAt',
          limit: 1,
        })

        const latestCredit = creditHistory.docs[0]
        const creditScore = latestCredit ? (latestCredit.newScore as number) ?? 80 : 80

        let creditStatusValue: string
        if (creditScore >= 90) creditStatusValue = 'excellent'
        else if (creditScore >= 60) creditStatusValue = 'normal'
        else if (creditScore >= 40) creditStatusValue = 'watchlist'
        else if (creditScore >= 30) creditStatusValue = 'warning'
        else if (creditScore >= 1) creditStatusValue = 'blacklist'
        else creditStatusValue = 'suspended'

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: (user as unknown as Record<string, unknown>).phone || null,
          tierFrontName: resolveTierFrontName(user.memberTier),
          points: (user as unknown as Record<string, unknown>).points ?? 0,
          shoppingCredit: (user as unknown as Record<string, unknown>).shoppingCredit ?? 0,
          totalSpent: (user as unknown as Record<string, unknown>).totalSpent ?? 0,
          creditScore,
          creditStatus: creditStatusValue,
          birthday: (user as unknown as Record<string, unknown>).birthday || null,
          createdAt: user.createdAt,
        }
      }),
    )

    // 後端 creditStatus 過濾
    if (creditStatus) {
      members = members.filter((m) => m.creditStatus === creditStatus)
    }

    return NextResponse.json({
      success: true,
      data: members,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('CRM Members GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, ...updateFields } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 驗證使用者存在
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '找不到該會員' },
        { status: 404 },
      )
    }

    // 可更新的 CRM 欄位白名單
    const allowedFields = [
      'tags',
      'vipOwner',
      'serviceLevel',
      'crmNote',
      'memberTier',
      'points',
      'shoppingCredit',
    ]

    const safeData: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (updateFields[key] !== undefined) {
        safeData[key] = updateFields[key]
      }
    }

    if (Object.keys(safeData).length === 0) {
      return NextResponse.json(
        { success: false, error: '沒有可更新的欄位' },
        { status: 400 },
      )
    }

    const updated = await (payload.update as Function)({
      collection: 'users',
      id: userId,
      data: safeData,
    })

    return NextResponse.json({
      success: true,
      message: '會員資料已更新',
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        updatedFields: Object.keys(safeData),
      },
    })
  } catch (error) {
    console.error('CRM Members PATCH error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
