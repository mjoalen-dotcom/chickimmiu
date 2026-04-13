import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * 行銷活動 API
 * GET  /api/marketing/campaigns — 列表/搜尋行銷活動
 * POST /api/marketing/campaigns — 建立新行銷活動
 */

const TIER_FRONT_NAMES: Record<string, string> = {
  ordinary: '優雅初遇者',
  bronze: '曦漾仙子',
  silver: '優漾女神',
  gold: '金曦女王',
  platinum: '星耀皇后',
  diamond: '璀璨天后',
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || '-createdAt'

    const payload = await getPayload({ config })

    const conditions: Where[] = []

    if (status) {
      conditions.push({ status: { equals: status } })
    }

    if (type) {
      conditions.push({ campaignType: { equals: type } })
    }

    if (startDate) {
      conditions.push({ 'schedule.startDate': { greater_than_equal: startDate } })
    }

    if (endDate) {
      conditions.push({ 'schedule.endDate': { less_than_equal: endDate } })
    }

    if (search) {
      conditions.push({
        or: [
          { campaignName: { contains: search } },
          { description: { contains: search } },
        ],
      })
    }

    const where: Where = conditions.length > 0
      ? { and: conditions }
      : {}

    const result = await payload.find({
      collection: 'marketing-campaigns',
      where,
      page,
      limit,
      sort: sortBy,
      depth: 1,
    })

    const campaigns = result.docs.map((doc) => {
      const campaign = doc as unknown as Record<string, unknown>
      const tierFilter = campaign.tierFilter as string[] | undefined
      const tierFrontNames = tierFilter
        ? tierFilter.map((code) => TIER_FRONT_NAMES[code] || code).filter(Boolean)
        : []

      return {
        id: doc.id,
        campaignName: campaign.campaignName,
        campaignType: campaign.campaignType,
        status: campaign.status,
        description: campaign.description,
        targetSegments: campaign.targetSegments,
        tierFilter: tierFrontNames,
        channels: campaign.channels,
        schedule: campaign.schedule,
        performance: campaign.performance,
        abTestEnabled: campaign.abTestEnabled,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: campaigns,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('Marketing Campaigns GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      campaignName,
      campaignSlug,
      campaignType,
      description,
      targetSegments,
      tierFilter,
      creditScoreFilter,
      channels,
      schedule,
      messageTemplates,
      abTestEnabled,
      abTestConfig,
      budget,
      personalizedContent,
      linkedFestival,
      adminNote,
    } = body

    if (!campaignName || !campaignSlug) {
      return NextResponse.json(
        { success: false, error: '活動名稱與活動代碼為必填欄位' },
        { status: 400 },
      )
    }

    if (!schedule?.startDate || !schedule?.endDate) {
      return NextResponse.json(
        { success: false, error: '開始日期與結束日期為必填欄位' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 檢查 slug 是否已存在
    const existing = await payload.find({
      collection: 'marketing-campaigns',
      where: { campaignSlug: { equals: campaignSlug } } satisfies Where,
      limit: 1,
    })

    if (existing.docs.length > 0) {
      return NextResponse.json(
        { success: false, error: '活動代碼已存在，請使用其他代碼' },
        { status: 409 },
      )
    }

    const created = await (payload.create as Function)({
      collection: 'marketing-campaigns',
      data: {
        campaignName,
        campaignSlug,
        campaignType: campaignType || 'custom',
        status: 'draft',
        description,
        targetSegments,
        tierFilter,
        creditScoreFilter,
        channels,
        schedule,
        messageTemplates,
        abTestEnabled: abTestEnabled || false,
        abTestConfig,
        budget,
        personalizedContent,
        linkedFestival,
        adminNote,
      },
    })

    return NextResponse.json({
      success: true,
      message: '行銷活動已建立',
      data: {
        id: created.id,
        campaignName: (created as unknown as Record<string, unknown>).campaignName,
        status: (created as unknown as Record<string, unknown>).status,
        createdAt: created.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Marketing Campaigns POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
