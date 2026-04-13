import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Public Products API
 * GET /api/v1/products — 商品列表（分頁、篩選、排序）
 *
 * Query params:
 *   page, limit, category, tag, sort, search, minPrice, maxPrice
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const category = searchParams.get('category')
    const tag = searchParams.get('tag')
    const sort = searchParams.get('sort') || '-createdAt'
    const search = searchParams.get('search')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')

    const payload = await getPayload({ config })

    const where: Record<string, unknown> = {
      status: { equals: 'active' },
    }

    if (category) {
      where.category = { equals: category }
    }
    if (tag === 'new') {
      where.isNew = { equals: true }
    } else if (tag === 'hot') {
      where.isHot = { equals: true }
    }
    if (search) {
      where.name = { contains: search }
    }
    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) (where.price as unknown as Record<string, unknown>).greater_than_equal = parseFloat(minPrice)
      if (maxPrice) (where.price as unknown as Record<string, unknown>).less_than_equal = parseFloat(maxPrice)
    }

    const result = await payload.find({
      collection: 'products',
      where: where as never,
      page,
      limit,
      sort,
    })

    return NextResponse.json({
      success: true,
      data: result.docs,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
