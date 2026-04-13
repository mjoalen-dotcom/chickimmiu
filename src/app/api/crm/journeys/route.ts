import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * CRM Automation Journeys API
 * GET  /api/crm/journeys — 列出所有自動化旅程及其狀態
 * POST /api/crm/journeys — 手動為會員觸發旅程
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'automation-journeys',
      page,
      limit,
      sort: 'priority',
    })

    // 為每個旅程附加最近的執行統計
    const journeysWithStats = await Promise.all(
      result.docs.map(async (journey) => {
        // 統計此旅程的執行紀錄
        const logsResult = await payload.find({
          collection: 'automation-logs',
          where: {
            journey: { equals: journey.id },
          } as never,
          limit: 0, // 只要 totalDocs
        })

        const completedResult = await payload.find({
          collection: 'automation-logs',
          where: {
            journey: { equals: journey.id },
            status: { equals: 'completed' },
          } as never,
          limit: 0,
        })

        const totalExecutions = logsResult.totalDocs
        const completedExecutions = completedResult.totalDocs

        return {
          id: journey.id,
          name: journey.name,
          slug: journey.slug,
          description: journey.description,
          isActive: journey.isActive,
          triggerType: journey.triggerType,
          triggerEvent: journey.triggerEvent,
          priority: journey.priority,
          stepsCount: Array.isArray(journey.steps) ? journey.steps.length : 0,
          stats: {
            totalExecutions,
            completedExecutions,
            completionRate:
              totalExecutions > 0
                ? Math.round((completedExecutions / totalExecutions) * 100)
                : 0,
          },
        }
      }),
    )

    return NextResponse.json({
      success: true,
      data: journeysWithStats,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
      },
    })
  } catch (error) {
    console.error('CRM Journeys GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { journeySlug, userId, data } = body

    if (!journeySlug || !userId) {
      return NextResponse.json(
        { success: false, error: '缺少必要欄位：journeySlug, userId' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 查找旅程
    const journeyResult = await payload.find({
      collection: 'automation-journeys',
      where: {
        slug: { equals: journeySlug },
      } as never,
      limit: 1,
    })

    const journey = journeyResult.docs[0]
    if (!journey) {
      return NextResponse.json(
        { success: false, error: `找不到旅程：${journeySlug}` },
        { status: 404 },
      )
    }

    if (!journey.isActive) {
      return NextResponse.json(
        { success: false, error: '此旅程目前已停用' },
        { status: 400 },
      )
    }

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

    // 檢查冷卻時間
    if (journey.cooldownHours) {
      const cooldownDate = new Date()
      cooldownDate.setHours(cooldownDate.getHours() - (journey.cooldownHours as number))

      const recentLogs = await payload.find({
        collection: 'automation-logs',
        where: {
          journey: { equals: journey.id },
          user: { equals: userId },
          createdAt: { greater_than: cooldownDate.toISOString() },
        } as never,
        limit: 1,
      })

      if (recentLogs.docs.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `此旅程尚在冷卻期間，請 ${journey.cooldownHours} 小時後再試`,
          },
          { status: 429 },
        )
      }
    }

    // 建立執行紀錄
    const log = await (payload.create as Function)({
      collection: 'automation-logs',
      data: {
        journey: journey.id,
        user: userId,
        status: 'triggered',
        currentStep: 0,
        triggerData: {
          source: 'manual',
          triggeredAt: new Date().toISOString(),
          ...(data || {}),
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `旅程「${journey.name}」已為會員觸發`,
      data: {
        logId: log.id,
        journeyName: journey.name,
        journeySlug: journey.slug,
        userId,
        status: 'triggered',
      },
    })
  } catch (error) {
    console.error('CRM Journeys POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
