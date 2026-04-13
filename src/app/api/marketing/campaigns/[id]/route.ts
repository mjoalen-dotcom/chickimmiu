import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { calculateCampaignMetrics } from '@/lib/marketing/performanceTracker'

/**
 * 單一行銷活動 API
 * GET    /api/marketing/campaigns/:id — 取得活動詳情 + 成效指標
 * PATCH  /api/marketing/campaigns/:id — 更新活動設定/狀態
 * DELETE /api/marketing/campaigns/:id — 取消/刪除活動
 */

const TIER_FRONT_NAMES: Record<string, string> = {
  ordinary: '優雅初遇者',
  bronze: '曦漾仙子',
  silver: '優漾女神',
  gold: '金曦女王',
  platinum: '星耀皇后',
  diamond: '璀璨天后',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config })

    const campaign = await payload.findByID({
      collection: 'marketing-campaigns',
      id,
      depth: 2,
    })

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: '找不到該行銷活動' },
        { status: 404 },
      )
    }

    const data = campaign as unknown as Record<string, unknown>

    // 取得關聯 A/B 測試
    const abTests = await payload.find({
      collection: 'ab-tests',
      where: { campaign: { equals: id } } satisfies Where,
      limit: 10,
      depth: 1,
    })

    // 取得即時成效數據
    let livePerformance = data.performance
    try {
      livePerformance = await calculateCampaignMetrics(id)
    } catch {
      // 使用儲存的成效數據
    }

    // 轉換 tierFilter 為前台名稱
    const tierFilter = data.tierFilter as string[] | undefined
    const tierFrontNames = tierFilter
      ? tierFilter.map((code) => TIER_FRONT_NAMES[code] || code)
      : []

    // 計算轉換指標
    const perf = livePerformance as Record<string, number> | undefined
    const sent = perf?.sent || 0
    const opened = perf?.opened || 0
    const clicked = perf?.clicked || 0
    const converted = perf?.converted || 0

    const metrics = {
      openRate: sent > 0 ? Math.round((opened / sent) * 10000) / 100 : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 10000) / 100 : 0,
      conversionRate: clicked > 0 ? Math.round((converted / clicked) * 10000) / 100 : 0,
      roi: perf?.revenue && (data.budget as unknown as Record<string, unknown>)?.totalBudget
        ? Math.round(
            ((perf.revenue - ((data.budget as unknown as Record<string, unknown>).totalBudget as number)) /
              ((data.budget as unknown as Record<string, unknown>).totalBudget as number)) *
              10000,
          ) / 100
        : null,
    }

    return NextResponse.json({
      success: true,
      data: {
        id: campaign.id,
        campaignName: data.campaignName,
        campaignSlug: data.campaignSlug,
        campaignType: data.campaignType,
        status: data.status,
        description: data.description,
        targetSegments: data.targetSegments,
        tierFilter: tierFrontNames,
        creditScoreFilter: data.creditScoreFilter,
        channels: data.channels,
        schedule: data.schedule,
        messageTemplates: data.messageTemplates,
        abTestEnabled: data.abTestEnabled,
        abTestConfig: data.abTestConfig,
        budget: data.budget,
        performance: livePerformance,
        metrics,
        personalizedContent: data.personalizedContent,
        abTests: abTests.docs.map((test) => ({
          id: test.id,
          testName: (test as unknown as Record<string, unknown>).testName,
          status: (test as unknown as Record<string, unknown>).status,
          winnerVariant: (test as unknown as Record<string, unknown>).winnerVariant,
          confidenceLevel: (test as unknown as Record<string, unknown>).confidenceLevel,
        })),
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      },
    })
  } catch (error) {
    console.error('Marketing Campaign GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const payload = await getPayload({ config })

    // 驗證活動存在
    const existing = await payload.findByID({
      collection: 'marketing-campaigns',
      id,
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '找不到該行銷活動' },
        { status: 404 },
      )
    }

    // 可更新欄位白名單
    const allowedFields = [
      'campaignName',
      'status',
      'description',
      'targetSegments',
      'tierFilter',
      'creditScoreFilter',
      'channels',
      'schedule',
      'messageTemplates',
      'abTestEnabled',
      'abTestConfig',
      'budget',
      'personalizedContent',
      'adminNote',
    ]

    const safeData: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        safeData[key] = body[key]
      }
    }

    if (Object.keys(safeData).length === 0) {
      return NextResponse.json(
        { success: false, error: '沒有可更新的欄位' },
        { status: 400 },
      )
    }

    // 狀態變更驗證
    if (safeData.status) {
      const currentStatus = (existing as unknown as Record<string, unknown>).status as string
      const newStatus = safeData.status as string
      const validTransitions: Record<string, string[]> = {
        draft: ['scheduled', 'cancelled'],
        scheduled: ['active', 'cancelled'],
        active: ['paused', 'completed', 'cancelled'],
        paused: ['active', 'cancelled'],
        completed: [],
        cancelled: [],
      }

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return NextResponse.json(
          { success: false, error: `無法從「${currentStatus}」變更為「${newStatus}」` },
          { status: 400 },
        )
      }
    }

    const updated = await (payload.update as Function)({
      collection: 'marketing-campaigns',
      id,
      data: safeData,
    })

    return NextResponse.json({
      success: true,
      message: '行銷活動已更新',
      data: {
        id: updated.id,
        campaignName: (updated as unknown as Record<string, unknown>).campaignName,
        status: (updated as unknown as Record<string, unknown>).status,
        updatedAt: updated.updatedAt,
        updatedFields: Object.keys(safeData),
      },
    })
  } catch (error) {
    console.error('Marketing Campaign PATCH error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const payload = await getPayload({ config })

    const existing = await payload.findByID({
      collection: 'marketing-campaigns',
      id,
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '找不到該行銷活動' },
        { status: 404 },
      )
    }

    const status = (existing as unknown as Record<string, unknown>).status as string

    // 進行中的活動先標記取消，不直接刪除
    if (status === 'active') {
      await (payload.update as Function)({
        collection: 'marketing-campaigns',
        id,
        data: { status: 'cancelled' },
      })

      return NextResponse.json({
        success: true,
        message: '進行中的活動已取消',
        data: { id, action: 'cancelled' },
      })
    }

    // 草稿或已取消的活動可直接刪除
    if (status === 'draft' || status === 'cancelled') {
      await payload.delete({
        collection: 'marketing-campaigns',
        id,
      })

      return NextResponse.json({
        success: true,
        message: '行銷活動已刪除',
        data: { id, action: 'deleted' },
      })
    }

    // 其他狀態標記取消
    await (payload.update as Function)({
      collection: 'marketing-campaigns',
      id,
      data: { status: 'cancelled' },
    })

    return NextResponse.json({
      success: true,
      message: '行銷活動已取消',
      data: { id, action: 'cancelled' },
    })
  } catch (error) {
    console.error('Marketing Campaign DELETE error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
