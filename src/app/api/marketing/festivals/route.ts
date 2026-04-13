import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { getUpcomingFestivals, createFestivalCampaign } from '@/lib/marketing/festivalEngine'
import { launchCampaign } from '@/lib/marketing/campaignEngine'

/**
 * 節慶行銷 API
 * GET  /api/marketing/festivals — 列表節慶模板（啟用中、即將到來）
 * POST /api/marketing/festivals — 建立節慶模板 / 從節慶模板建立活動
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
    const status = searchParams.get('status') // active, upcoming, past
    const year = searchParams.get('year')
    const sortBy = searchParams.get('sortBy') || 'startDate'

    const payload = await getPayload({ config })

    // 嘗試從 festivalEngine 取得
    let engineTemplates = null
    try {
      engineTemplates = await getUpcomingFestivals(365)
    } catch {
      // engine 尚未實作
    }

    if (engineTemplates) {
      return NextResponse.json({
        success: true,
        data: engineTemplates,
        meta: { source: 'engine' },
      })
    }

    // 嘗試從 festival-templates collection 取得
    let festivals
    try {
      const now = new Date().toISOString()
      const conditions: Where[] = []

      if (status === 'active') {
        conditions.push({
          and: [
            { startDate: { less_than_equal: now } },
            { endDate: { greater_than_equal: now } },
          ],
        })
      } else if (status === 'upcoming') {
        conditions.push({ startDate: { greater_than: now } })
      } else if (status === 'past') {
        conditions.push({ endDate: { less_than: now } })
      }

      if (year) {
        const yearStart = `${year}-01-01T00:00:00.000Z`
        const yearEnd = `${year}-12-31T23:59:59.999Z`
        conditions.push({
          and: [
            { startDate: { greater_than_equal: yearStart } },
            { startDate: { less_than_equal: yearEnd } },
          ],
        })
      }

      const where: Where = conditions.length > 0
        ? { and: conditions }
        : {}

      festivals = await payload.find({
        collection: 'festival-templates' as 'marketing-campaigns',
        where,
        page,
        limit,
        sort: sortBy,
        depth: 1,
      })
    } catch {
      // Collection 可能尚未建立，回傳內建節慶模板
      const builtInFestivals = getBuiltInFestivals()

      const filtered = status
        ? builtInFestivals.filter((f) => {
            const now = new Date()
            const start = new Date(f.startDate)
            const end = new Date(f.endDate)
            if (status === 'active') return start <= now && end >= now
            if (status === 'upcoming') return start > now
            if (status === 'past') return end < now
            return true
          })
        : builtInFestivals

      return NextResponse.json({
        success: true,
        data: filtered,
        meta: {
          source: 'built-in',
          total: filtered.length,
          page: 1,
          totalPages: 1,
        },
      })
    }

    const festivalList = festivals.docs.map((doc) => {
      const data = doc as unknown as Record<string, unknown>
      const tierFilter = data.tierFilter as string[] | undefined

      return {
        id: doc.id,
        festivalName: data.festivalName || data.campaignName,
        festivalType: data.festivalType || data.campaignType,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        tierFilter: tierFilter
          ? tierFilter.map((code) => TIER_FRONT_NAMES[code] || code)
          : [],
        channels: data.channels,
        isRecurring: data.isRecurring,
        status: data.status,
        createdAt: doc.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: festivalList,
      meta: {
        page: festivals.page,
        totalPages: festivals.totalPages,
        totalDocs: festivals.totalDocs,
        hasNextPage: festivals.hasNextPage,
        hasPrevPage: festivals.hasPrevPage,
      },
    })
  } catch (error) {
    console.error('Festivals GET error:', error)
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
      action,
      festivalTemplateId,
      festivalName,
      festivalType,
      description,
      startDate,
      endDate,
      targetSegments,
      tierFilter,
      channels,
      messageTemplates,
      budget,
      personalizedContent,
      isRecurring,
      recurringPattern,
    } = body

    const payload = await getPayload({ config })

    // action = 'create_from_template' → 從節慶模板建立活動
    if (action === 'create_from_template' && festivalTemplateId) {
      // 嘗試從 festivalEngine 建立
      try {
        const campaign = await createFestivalCampaign(festivalTemplateId)
        return NextResponse.json({
          success: true,
          message: '已從節慶模板建立行銷活動',
          data: campaign,
        }, { status: 201 })
      } catch {
        // engine 尚未實作，手動建立
      }

      // 載入模板資料
      let templateData: Record<string, unknown> | null = null
      try {
        const tmpl = await payload.findByID({
          collection: 'festival-templates' as 'marketing-campaigns',
          id: festivalTemplateId,
          depth: 1,
        })
        templateData = tmpl as unknown as Record<string, unknown>
      } catch {
        // 嘗試從內建節慶模板取得
        const builtIn = getBuiltInFestivals().find((f) => f.id === festivalTemplateId)
        if (builtIn) {
          templateData = builtIn as unknown as Record<string, unknown>
        }
      }

      if (!templateData) {
        return NextResponse.json(
          { success: false, error: '找不到指定的節慶模板' },
          { status: 404 },
        )
      }

      // 從模板建立活動
      const campaignSlug = `festival-${(templateData.festivalName as string || 'event').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

      const created = await (payload.create as Function)({
        collection: 'marketing-campaigns',
        data: {
          campaignName: (templateData.festivalName as string) || festivalName || '節慶活動',
          campaignSlug,
          campaignType: 'festival',
          status: 'draft',
          description: (templateData.description as string) || description,
          targetSegments: ((templateData.targetSegments as string[]) || targetSegments || ['all']) as ('all' | 'VIP1' | 'VIP2' | 'POT1' | 'REG1' | 'REG2' | 'RISK1' | 'RISK2' | 'NEW1' | 'SLP1' | 'BLK1')[],
          tierFilter: ((templateData.tierFilter as string[]) || tierFilter) as ('all' | 'ordinary' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond')[],
          channels: ((templateData.channels as string[]) || channels || ['line', 'email']) as ('line' | 'email' | 'sms' | 'push')[],
          schedule: {
            startDate: (templateData.startDate as string) || startDate,
            endDate: (templateData.endDate as string) || endDate,
            timezone: 'Asia/Taipei',
          },
          budget: budget || (templateData.budget as unknown as Record<string, unknown>),
          personalizedContent: personalizedContent || {
            useAIRecommendation: true,
            useUGC: true,
            useCreditScorePersonalization: true,
            useSegmentPersonalization: true,
          },
          linkedFestival: festivalTemplateId,
        },
      })

      // 嘗試排程
      try {
        await launchCampaign(created.id as unknown as string)
      } catch {
        // engine 尚未實作
      }

      return NextResponse.json({
        success: true,
        message: '已從節慶模板建立行銷活動',
        data: {
          id: created.id,
          campaignName: (created as unknown as Record<string, unknown>).campaignName,
          status: (created as unknown as Record<string, unknown>).status,
          createdAt: created.createdAt,
        },
      }, { status: 201 })
    }

    // action = 'create_template' or default → 建立新節慶模板
    if (!festivalName) {
      return NextResponse.json(
        { success: false, error: '節慶名稱為必填欄位' },
        { status: 400 },
      )
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: '開始日期與結束日期為必填欄位' },
        { status: 400 },
      )
    }

    // 嘗試寫入 festival-templates collection
    let created
    try {
      created = await (payload.create as Function)({
        collection: 'festival-templates',
        data: {
          festivalName,
          festivalType: festivalType || 'custom',
          description,
          startDate,
          endDate,
          targetSegments: targetSegments || ['all'],
          tierFilter,
          channels: channels || ['line', 'email'],
          messageTemplates,
          budget,
          personalizedContent: personalizedContent || {
            useAIRecommendation: true,
            useUGC: true,
            useCreditScorePersonalization: true,
            useSegmentPersonalization: true,
          },
          isRecurring: isRecurring || false,
          recurringPattern,
        } as unknown as Record<string, unknown>,
      })
    } catch {
      // Collection 不存在，改為建立行銷活動（以 festival 類型）
      const campaignSlug = `festival-${festivalName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`

      created = await (payload.create as Function)({
        collection: 'marketing-campaigns',
        data: {
          campaignName: festivalName,
          campaignSlug,
          campaignType: 'festival',
          status: 'draft',
          description,
          targetSegments: targetSegments || ['all'],
          tierFilter,
          channels: channels || ['line', 'email'],
          schedule: {
            startDate,
            endDate,
            timezone: 'Asia/Taipei',
          },
          messageTemplates,
          budget,
          personalizedContent: personalizedContent || {
            useAIRecommendation: true,
            useUGC: true,
            useCreditScorePersonalization: true,
            useSegmentPersonalization: true,
          },
        },
      })
    }

    const result = created as unknown as Record<string, unknown>

    return NextResponse.json({
      success: true,
      message: '節慶模板已建立',
      data: {
        id: result.id,
        name: result.festivalName || result.campaignName,
        status: result.status || 'draft',
        createdAt: result.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Festivals POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

/**
 * 內建台灣節慶模板
 */
function getBuiltInFestivals() {
  const year = new Date().getFullYear()

  return [
    {
      id: 'lunar-new-year',
      festivalName: '農曆新年',
      festivalType: '傳統節慶',
      description: '農曆新年開運購物季，新春限定優惠與紅包活動',
      startDate: `${year}-01-20`,
      endDate: `${year}-02-10`,
      channels: ['line', 'email', 'push', 'in_app_popup'],
      targetSegments: ['all'],
      isRecurring: true,
      suggestedTierOffers: {
        '優雅初遇者': '新春首購 88 折',
        '曦漾仙子': '新春 85 折 + 雙倍點數',
        '優漾女神': '新春 8 折 + 三倍點數',
        '金曦女王': '新春 75 折 + 專屬紅包',
        '星耀皇后': '新春 7 折 + VIP 紅包 + 免運',
        '璀璨天后': '新春 65 折 + 頂級紅包 + 優先搶購',
      },
    },
    {
      id: 'valentines-day',
      festivalName: '情人節',
      festivalType: '西洋節慶',
      description: '情人節浪漫穿搭推薦，甜蜜加碼優惠',
      startDate: `${year}-02-07`,
      endDate: `${year}-02-14`,
      channels: ['line', 'email', 'push'],
      targetSegments: ['VIP1', 'VIP2', 'POT1', 'REG1'],
      isRecurring: true,
      suggestedTierOffers: {
        '優雅初遇者': '情人節 9 折',
        '曦漾仙子': '情人節 85 折',
        '優漾女神': '情人節 8 折 + 精美包裝',
        '金曦女王': '情人節 75 折 + 精美包裝 + 雙倍點數',
        '星耀皇后': '情人節 7 折 + 限定禮盒',
        '璀璨天后': '情人節 65 折 + 專屬禮盒 + 優先搶購',
      },
    },
    {
      id: 'mothers-day',
      festivalName: '母親節',
      festivalType: '感恩節慶',
      description: '母親節感恩回饋，溫馨穿搭推薦',
      startDate: `${year}-04-25`,
      endDate: `${year}-05-12`,
      channels: ['line', 'email', 'sms', 'push'],
      targetSegments: ['all'],
      isRecurring: true,
      suggestedTierOffers: {
        '優雅初遇者': '母親節 88 折',
        '曦漾仙子': '母親節 85 折 + 購物金',
        '優漾女神': '母親節 8 折 + 雙倍點數',
        '金曦女王': '母親節 75 折 + 三倍點數',
        '星耀皇后': '母親節 7 折 + 專屬禮遇',
        '璀璨天后': '母親節 65 折 + 頂級禮遇 + 免運',
      },
    },
    {
      id: 'mid-autumn',
      festivalName: '中秋節',
      festivalType: '傳統節慶',
      description: '中秋團圓季，秋冬新品上市特惠',
      startDate: `${year}-09-10`,
      endDate: `${year}-09-20`,
      channels: ['line', 'email', 'push'],
      targetSegments: ['all'],
      isRecurring: true,
      suggestedTierOffers: {
        '優雅初遇者': '中秋 9 折',
        '曦漾仙子': '中秋 85 折',
        '優漾女神': '中秋 8 折 + 購物金',
        '金曦女王': '中秋 75 折 + 雙倍點數',
        '星耀皇后': '中秋 7 折 + 專屬禮盒',
        '璀璨天后': '中秋 65 折 + 頂級禮遇',
      },
    },
    {
      id: 'double-eleven',
      festivalName: '雙 11 購物節',
      festivalType: '電商節慶',
      description: '年度最大購物盛事，全站超級優惠',
      startDate: `${year}-11-01`,
      endDate: `${year}-11-11`,
      channels: ['line', 'email', 'sms', 'push', 'in_app_popup', 'edm'],
      targetSegments: ['all'],
      isRecurring: true,
      suggestedTierOffers: {
        '優雅初遇者': '雙 11 全站 89 折',
        '曦漾仙子': '雙 11 全站 85 折 + 雙倍點數',
        '優漾女神': '雙 11 全站 8 折 + 三倍點數',
        '金曦女王': '雙 11 全站 75 折 + 限定優惠券',
        '星耀皇后': '雙 11 全站 7 折 + 搶先購 + 免運',
        '璀璨天后': '雙 11 全站 65 折 + 頂級搶先購 + 專屬客服',
      },
    },
    {
      id: 'christmas',
      festivalName: '聖誕節',
      festivalType: '西洋節慶',
      description: '聖誕狂歡季，冬季穿搭與交換禮物推薦',
      startDate: `${year}-12-15`,
      endDate: `${year}-12-25`,
      channels: ['line', 'email', 'push', 'in_app_popup'],
      targetSegments: ['all'],
      isRecurring: true,
      suggestedTierOffers: {
        '優雅初遇者': '聖誕 9 折',
        '曦漾仙子': '聖誕 85 折 + 聖誕購物金',
        '優漾女神': '聖誕 8 折 + 雙倍點數',
        '金曦女王': '聖誕 75 折 + 聖誕禮盒',
        '星耀皇后': '聖誕 7 折 + 限定禮盒 + 免運',
        '璀璨天后': '聖誕 65 折 + 頂級禮盒 + 專屬聖誕禮遇',
      },
    },
  ]
}
