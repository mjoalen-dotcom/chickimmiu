import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * UGC Posts API
 * GET /api/v1/ugc — 取得社群 UGC 內容
 *
 * Query params:
 *   page, limit, platform, location, layout
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50)
    const platform = searchParams.get('platform')
    const location = searchParams.get('location')

    const payload = await getPayload({ config })

    const where: Record<string, unknown> = {
      status: { equals: 'approved' },
    }

    if (platform) {
      where.platform = { equals: platform }
    }
    if (location) {
      where.displayLocations = { contains: location }
    }

    const result = await payload.find({
      collection: 'ugc-posts',
      where: where as never,
      page,
      limit,
      sort: '-publishedAt',
    })

    return NextResponse.json({
      success: true,
      data: result.docs,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
      },
    })
  } catch (error) {
    console.error('UGC API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
