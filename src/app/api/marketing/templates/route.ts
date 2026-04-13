import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * 訊息模板 API
 * GET  /api/marketing/templates — 列表/搜尋訊息模板
 * POST /api/marketing/templates — 建立新訊息模板
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const channel = searchParams.get('channel')
    const category = searchParams.get('category')
    const active = searchParams.get('active')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || '-createdAt'

    const payload = await getPayload({ config })

    const conditions: Where[] = []

    if (channel) {
      conditions.push({ channel: { equals: channel } })
    }

    if (category) {
      conditions.push({ category: { equals: category } })
    }

    if (active !== null && active !== undefined) {
      conditions.push({ isActive: { equals: active === 'true' } })
    }

    if (search) {
      conditions.push({
        or: [
          { templateName: { contains: search } },
          { templateSlug: { contains: search } },
        ],
      })
    }

    const where: Where = conditions.length > 0
      ? { and: conditions }
      : {}

    const result = await payload.find({
      collection: 'message-templates',
      where,
      page,
      limit,
      sort: sortBy,
      depth: 0,
    })

    const templates = result.docs.map((doc) => {
      const tmpl = doc as unknown as Record<string, unknown>
      return {
        id: doc.id,
        templateName: tmpl.templateName,
        templateSlug: tmpl.templateSlug,
        channel: tmpl.channel,
        category: tmpl.category,
        subject: tmpl.subject,
        isActive: tmpl.isActive,
        variableCount: Array.isArray(tmpl.variables) ? tmpl.variables.length : 0,
        segmentVariantCount: Array.isArray(tmpl.segmentVariants) ? tmpl.segmentVariants.length : 0,
        tags: Array.isArray(tmpl.tags)
          ? (tmpl.tags as unknown as Array<Record<string, unknown>>).map((t) => t.tag).filter(Boolean)
          : [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: templates,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('Marketing Templates GET error:', error)
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
      templateName,
      templateSlug,
      channel,
      category,
      subject,
      content,
      textContent,
      htmlContent,
      lineFlexMessage,
      variables,
      segmentVariants,
      creditScoreVariants,
      tierVariants,
      isActive,
      tags,
    } = body

    if (!templateName || !templateSlug || !channel) {
      return NextResponse.json(
        { success: false, error: '模板名稱、模板代碼與管道為必填欄位' },
        { status: 400 },
      )
    }

    const validChannels = ['line', 'email', 'sms', 'push', 'in_app_popup', 'edm']
    if (!validChannels.includes(channel)) {
      return NextResponse.json(
        { success: false, error: `無效的管道，可選值：${validChannels.join('、')}` },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 檢查 slug 唯一性
    const existing = await payload.find({
      collection: 'message-templates',
      where: { templateSlug: { equals: templateSlug } } satisfies Where,
      limit: 1,
    })

    if (existing.docs.length > 0) {
      return NextResponse.json(
        { success: false, error: '模板代碼已存在，請使用其他代碼' },
        { status: 409 },
      )
    }

    const created = await (payload.create as Function)({
      collection: 'message-templates',
      data: {
        templateName,
        templateSlug,
        channel,
        category: category || 'custom',
        subject,
        content,
        textContent,
        htmlContent,
        lineFlexMessage,
        variables,
        segmentVariants,
        creditScoreVariants,
        tierVariants,
        isActive: isActive !== false,
        tags,
      },
    })

    return NextResponse.json({
      success: true,
      message: '訊息模板已建立',
      data: {
        id: created.id,
        templateName: (created as unknown as Record<string, unknown>).templateName,
        channel: (created as unknown as Record<string, unknown>).channel,
        isActive: (created as unknown as Record<string, unknown>).isActive,
        createdAt: created.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Marketing Templates POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
