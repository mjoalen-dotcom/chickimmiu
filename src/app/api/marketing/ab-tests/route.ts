import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { createABTest, analyzeABTest } from '@/lib/marketing/abTestEngine'

/**
 * A/B 測試 API
 * GET  /api/marketing/ab-tests — 列表 A/B 測試
 * POST /api/marketing/ab-tests — 建立新 A/B 測試
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const sortBy = searchParams.get('sortBy') || '-createdAt'

    const payload = await getPayload({ config })

    const conditions: Where[] = []

    if (status) {
      conditions.push({ status: { equals: status } })
    }

    if (campaignId) {
      conditions.push({ campaign: { equals: campaignId } })
    }

    const where: Where = conditions.length > 0
      ? { and: conditions }
      : {}

    const result = await payload.find({
      collection: 'ab-tests',
      where,
      page,
      limit,
      sort: sortBy,
      depth: 1,
    })

    const tests = result.docs.map((doc) => {
      const test = doc as unknown as Record<string, unknown>
      const campaignObj = test.campaign as unknown as Record<string, unknown> | string
      const campaignName =
        typeof campaignObj === 'object' && campaignObj?.campaignName
          ? (campaignObj.campaignName as string)
          : null

      return {
        id: doc.id,
        testName: test.testName,
        campaignId: typeof campaignObj === 'string' ? campaignObj : campaignObj?.id,
        campaignName,
        status: test.status,
        winnerMetric: test.winnerMetric,
        winnerVariant: test.winnerVariant,
        confidenceLevel: test.confidenceLevel,
        variantCount: Array.isArray(test.variants) ? test.variants.length : 0,
        autoSelectWinner: test.autoSelectWinner,
        startedAt: test.startedAt,
        completedAt: test.completedAt,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: tests,
      meta: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('AB Tests GET error:', error)
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
      testName,
      campaignId,
      variants,
      winnerMetric,
      autoSelectWinner,
      minSampleSize,
    } = body

    if (!testName || !campaignId) {
      return NextResponse.json(
        { success: false, error: '測試名稱與關聯活動為必填欄位' },
        { status: 400 },
      )
    }

    if (!Array.isArray(variants) || variants.length < 2) {
      return NextResponse.json(
        { success: false, error: 'A/B 測試至少需要 2 個變體' },
        { status: 400 },
      )
    }

    // 驗證流量分配總和 = 100
    const totalPercentage = variants.reduce(
      (sum: number, v: Record<string, unknown>) => sum + ((v.percentage as number) || 0),
      0,
    )
    if (totalPercentage !== 100) {
      return NextResponse.json(
        { success: false, error: `流量分配總和必須為 100%，目前為 ${totalPercentage}%` },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 驗證活動存在
    const campaign = await payload.findByID({
      collection: 'marketing-campaigns',
      id: campaignId,
    })

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: '找不到關聯的行銷活動' },
        { status: 404 },
      )
    }

    // 嘗試透過 engine 建立
    let createdId: string | null = null
    let createdDoc: Record<string, unknown> | null = null
    try {
      createdId = await createABTest(
        campaignId,
        (variants as unknown as Array<Record<string, unknown>>).map((v) => ({
          variantName: (v.variantName || v.name) as string,
          variantSlug: (v.variantSlug || v.slug) as string,
          templateId: (v.messageTemplate || v.templateId) as string,
          percentage: v.percentage as number,
        })),
        winnerMetric || 'conversion_rate',
      )
    } catch {
      // engine 尚未實作，直接用 Payload 建立
      const doc = await (payload.create as Function)({
        collection: 'ab-tests',
        data: {
          testName,
          campaign: campaignId,
          status: 'draft',
          variants: variants.map((v: Record<string, unknown>) => ({
            variantName: v.variantName || v.name,
            variantSlug: v.variantSlug || v.slug,
            messageTemplate: v.messageTemplate || v.templateId,
            percentage: v.percentage,
            metrics: { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 },
          })),
          winnerMetric: winnerMetric || 'conversion_rate',
          autoSelectWinner: autoSelectWinner !== false,
          minSampleSize: minSampleSize || 100,
        },
      } as unknown as Parameters<typeof payload.create>[0])
      createdId = doc.id as unknown as string
      createdDoc = doc as unknown as Record<string, unknown>
    }

    // 更新活動的 abTestEnabled
    await (payload.update as Function)({
      collection: 'marketing-campaigns',
      id: campaignId,
      data: { abTestEnabled: true },
    })

    // 嘗試取得分析結果
    let analysis = null
    try {
      if (createdId) {
        analysis = await analyzeABTest(createdId)
      }
    } catch {
      // engine 尚未實作
    }

    // 如果是透過 engine 建立，需要載入完整文件
    if (!createdDoc && createdId) {
      try {
        const fetched = await payload.findByID({ collection: 'ab-tests', id: createdId })
        createdDoc = fetched as unknown as Record<string, unknown>
      } catch {
        // 回傳基本資料
      }
    }

    return NextResponse.json({
      success: true,
      message: 'A/B 測試已建立',
      data: {
        id: createdId,
        testName: createdDoc?.testName ?? testName,
        status: createdDoc?.status ?? 'draft',
        variantCount: Array.isArray(createdDoc?.variants) ? createdDoc.variants.length : variants.length,
        analysis,
        createdAt: createdDoc?.createdAt ?? new Date().toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('AB Tests POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
