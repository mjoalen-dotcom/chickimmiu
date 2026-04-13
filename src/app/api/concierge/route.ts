import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import {
  submitConciergeRequest,
  validateConciergeEligibility,
} from '@/lib/concierge/conciergeEngine'

/**
 * T5 璀璨天后管家服務 API
 * ──────────────────────────────────────
 * GET  /api/concierge — 查詢管家服務請求列表
 * POST /api/concierge — 提交新管家服務請求
 */

// ── GET: 查詢管家服務請求 ──

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // 驗證登入
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 },
      )
    }

    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const status = searchParams.get('status')

    // 建構查詢條件
    const where: Where = {}

    // 非管理員僅能查看自己的請求
    if (user.role !== 'admin') {
      // 驗證 T5 資格
      const eligibility = await validateConciergeEligibility(String(user.id))
      if (!eligibility.eligible) {
        return NextResponse.json(
          { success: false, error: eligibility.reason || '您目前無法使用管家服務' },
          { status: 403 },
        )
      }
      where.requester = { equals: user.id }
    }

    // 狀態篩選
    if (status) {
      where.status = { equals: status }
    }

    const result = await payload.find({
      collection: 'concierge-service-requests',
      where,
      page,
      limit,
      sort: '-createdAt',
      depth: 1,
    })

    const requests = result.docs.map((doc) => {
      const d = doc as unknown as Record<string, unknown>
      const concierge = d.assignedConcierge as unknown as Record<string, unknown> | string | null
      const conciergeName = concierge && typeof concierge === 'object'
        ? (concierge.name as string) || '專屬管家'
        : null

      return {
        id: doc.id,
        requestNumber: d.requestNumber,
        serviceType: d.serviceType,
        priority: d.priority,
        status: d.status,
        assignedConciergeName: conciergeName,
        requestDetail: d.requestDetail,
        aiResponse: user.role === 'admin' ? d.aiResponse : {
          aiSuggestion: (d.aiResponse as unknown as Record<string, unknown> | undefined)?.aiSuggestion,
        },
        resolution: d.resolution,
        isBirthdayMonthRequest: d.isBirthdayMonthRequest,
        conciergeNotes: user.role === 'admin'
          ? d.conciergeNotes
          : ((d.conciergeNotes as unknown as Array<Record<string, unknown>> | undefined) || [])
              .filter((n) => n.noteType === 'customer_facing'),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: requests,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('Concierge GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

// ── POST: 提交新管家服務請求 ──

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // 驗證登入
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 },
      )
    }

    const body = await req.json()

    // 驗證必填欄位
    const { serviceType, description } = body
    if (!serviceType || !description) {
      return NextResponse.json(
        { success: false, error: '請提供服務類型與需求描述' },
        { status: 400 },
      )
    }

    // 有效服務類型
    const validServiceTypes = [
      'fashion_styling', 'size_consultation', 'custom_order',
      'restaurant_booking', 'michelin_booking', 'event_tickets',
      'flower_cake_gift', 'hotel_travel', 'private_event',
      'beauty_wellness', 'driver_service', 'other',
    ]

    if (!validServiceTypes.includes(serviceType)) {
      return NextResponse.json(
        { success: false, error: '無效的服務類型' },
        { status: 400 },
      )
    }

    // 檢查是否為生日月
    let isBirthdayMonth = false
    const birthday = (user as unknown as Record<string, unknown>).birthday as string | undefined
    if (birthday) {
      const birthMonth = new Date(birthday).getMonth()
      const currentMonth = new Date().getMonth()
      isBirthdayMonth = birthMonth === currentMonth
    }

    // 提交請求
    const response = await submitConciergeRequest({
      userId: user.id as unknown as string,
      serviceType,
      description,
      preferredDate: body.preferredDate,
      preferredTime: body.preferredTime,
      location: body.location,
      budget: body.budget,
      numberOfPeople: body.numberOfPeople,
      specialRequirements: body.specialRequirements,
      isUrgent: body.isUrgent ?? false,
      isBirthdayMonth,
    })

    return NextResponse.json({
      success: true,
      message: '親愛的璀璨天后，您的管家服務請求已成功提交',
      data: {
        requestId: response.requestId,
        requestNumber: response.requestNumber,
        priority: response.priority,
        estimatedResponseTime: response.estimatedResponseTime,
        assignedConcierge: response.assignedConcierge ? '已為您安排專屬管家' : '正在為您安排最合適的管家',
        aiSuggestion: response.aiSuggestion,
        isBirthdayMonth,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '伺服器錯誤'

    // 資格不符回 403
    if (message.includes('資格') || message.includes('等級')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 403 },
      )
    }

    console.error('Concierge POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
