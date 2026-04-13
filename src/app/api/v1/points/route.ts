import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Points Redemptions API
 * GET /api/v1/points — 取得可兌換商品列表
 * POST /api/v1/points — 兌換商品
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
    const type = searchParams.get('type')

    const payload = await getPayload({ config })

    const now = new Date().toISOString()
    const where: Record<string, unknown> = {
      isActive: { equals: true },
      or: [
        { 'limits.endDate': { exists: false } },
        { 'limits.endDate': { greater_than_equal: now } },
      ],
    }

    if (type) {
      where.type = { equals: type }
    }

    const result = await payload.find({
      collection: 'points-redemptions',
      where: where as never,
      page,
      limit,
      sort: 'sortOrder',
    })

    return NextResponse.json({
      success: true,
      data: result.docs.map((item) => ({
        ...item,
        remaining: ((item.stock as number) || 0) - ((item.redeemed as number) || 0),
      })),
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
      },
    })
  } catch (error) {
    console.error('Points API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, redemptionId } = body

    if (!userId || !redemptionId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or redemptionId' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 取得兌換項目
    const redemption = await payload.findByID({
      collection: 'points-redemptions',
      id: redemptionId,
    })

    if (!redemption || !redemption.isActive) {
      return NextResponse.json(
        { success: false, error: 'Redemption item not found or inactive' },
        { status: 404 },
      )
    }

    // 檢查庫存
    const remaining = ((redemption.stock as number) || 0) - ((redemption.redeemed as number) || 0)
    if (remaining <= 0) {
      return NextResponse.json(
        { success: false, error: 'Out of stock' },
        { status: 400 },
      )
    }

    // 取得使用者
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      )
    }

    const userPoints = (user.points as number) || 0
    const cost = (redemption.pointsCost as number) || 0

    if (userPoints < cost) {
      return NextResponse.json(
        { success: false, error: 'Insufficient points', required: cost, current: userPoints },
        { status: 400 },
      )
    }

    // 扣點 + 更新兌換數
    await (payload.update as Function)({
      collection: 'users',
      id: userId,
      data: { points: userPoints - cost },
    })

    await (payload.update as Function)({
      collection: 'points-redemptions',
      id: redemptionId,
      data: { redeemed: ((redemption.redeemed as number) || 0) + 1 },
    })

    // 抽獎邏輯（如果是 lottery 類型）
    let prize = null
    if (redemption.type === 'lottery') {
      const lotteryConfig = redemption.lotteryConfig as unknown as Record<string, unknown> | undefined
      const prizes = (lotteryConfig?.prizes as unknown as Array<Record<string, unknown>>) || []
      if (prizes.length > 0) {
        // 加權隨機
        const totalWeight = prizes.reduce((sum, p) => sum + ((p.probability as number) || 0), 0)
        let random = Math.random() * totalWeight
        for (const p of prizes) {
          random -= (p.probability as number) || 0
          if (random <= 0) {
            prize = { name: p.name, value: p.value }
            break
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '兌換成功',
      data: {
        pointsDeducted: cost,
        remainingPoints: userPoints - cost,
        ...(prize ? { prize } : {}),
      },
    })
  } catch (error) {
    console.error('Points redemption error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
