/**
 * T5 璀璨天后 — 私人生活管家服務引擎
 * ──────────────────────────────────────────────
 * AI 初步處理 + 真人管家跟進的管家服務核心邏輯
 *
 * ⚠️ 所有面向用戶的訊息一律使用「璀璨天后」，不可暴露 diamond / T5 等後台代碼
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

// ── Types ─────────────────────────────────────────────

export interface ConciergeRequest {
  userId: string
  serviceType: string
  description: string
  preferredDate?: string
  preferredTime?: string
  location?: string
  budget?: string
  numberOfPeople?: number
  specialRequirements?: string
  isUrgent?: boolean
  isBirthdayMonth?: boolean
}

export interface ConciergeResponse {
  requestId: string
  requestNumber: string
  assignedConcierge: string | null
  aiSuggestion: string
  estimatedResponseTime: string
  priority: string
}

export interface ConciergeDashboardData {
  activeRequests: number
  completedThisMonth: number
  avgSatisfaction: number
  avgResponseMinutes: number
  serviceTypeDistribution: Record<string, number>
  priorityDistribution: Record<string, number>
  topConcierges: Array<{
    id: string
    name: string
    completedCount: number
    avgSatisfaction: number
  }>
  recentRequests: Array<{
    id: string
    requestNumber: string
    serviceType: string
    status: string
    priority: string
    createdAt: string
  }>
  birthdayMonthRequests: number
}

// ── 優先級回應時間對照 ──
const PRIORITY_RESPONSE_TIMES: Record<string, string> = {
  urgent: '30 分鐘內',
  high: '1 小時內',
  normal: '2 小時內',
  low: '24 小時內',
}

// ── AI 建議模板（依服務類型） ──
const AI_SUGGESTION_TEMPLATES: Record<string, string> = {
  fashion_styling: '根據您的購買紀錄與偏好風格，為您推薦以下穿搭方案。您的專屬管家將進一步為您提供個人化建議。',
  size_consultation: '根據您的身體資料與過往購買尺寸紀錄，為您分析最適合的尺寸。專屬管家將與品牌確認詳細尺寸。',
  custom_order: '已收到您的客製化訂購需求，將為您聯繫相關品牌與設計師，提供客製化方案與報價。',
  restaurant_booking: '已為您搜尋符合條件的餐廳推薦，專屬管家將為您完成訂位。',
  michelin_booking: '已為您篩選米其林及高級餐廳推薦，專屬管家將優先為您安排訂位。',
  event_tickets: '已為您查詢相關演出 / 展覽票務資訊，專屬管家將為您搶票或安排 VIP 席位。',
  flower_cake_gift: '已為您準備精選花藝、蛋糕及禮物方案，專屬管家將依您的預算與喜好進行訂購。',
  hotel_travel: '已為您規劃初步旅行方案，專屬管家將提供詳細行程與酒店推薦。',
  private_event: '已收到您的私人活動規劃需求，專屬管家將為您統籌場地、餐飲及活動細節。',
  beauty_wellness: '已為您搜尋優質美容 / 健身服務推薦，專屬管家將為您安排預約。',
  driver_service: '已收到專車接送需求，專屬管家將為您安排車輛與司機。',
  other: '已收到您的需求，專屬管家將盡快與您聯繫，為您提供最佳服務方案。',
}

// ── Core Functions ────────────────────────────────────

/**
 * 計算優先級（根據信用分數與緊急度）
 */
export function calculatePriority(creditScore: number, isUrgent: boolean): string {
  if (creditScore >= 95) return 'urgent'
  if (creditScore >= 90) return 'high'
  if (isUrgent) return 'high'
  return 'normal'
}

/**
 * 驗證用戶是否有 T5 管家資格
 */
export async function validateConciergeEligibility(
  userId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const payload = await getPayload({ config })

  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 1,
  })

  if (!user) {
    return { eligible: false, reason: '找不到該會員' }
  }

  // 檢查黑名單
  if ((user as unknown as Record<string, unknown>).isBlacklisted) {
    return { eligible: false, reason: '此帳號目前無法使用管家服務' }
  }

  // 檢查停權
  if ((user as unknown as Record<string, unknown>).isSuspended) {
    return { eligible: false, reason: '此帳號已被停權' }
  }

  // 檢查等級是否為 diamond (T5 璀璨天后)
  const tierObj = user.memberTier as unknown as Record<string, unknown> | undefined
  const tierSlug = typeof user.memberTier === 'string'
    ? user.memberTier
    : tierObj?.slug as string | undefined

  if (tierSlug !== 'diamond') {
    return {
      eligible: false,
      reason: '管家服務為璀璨天后專屬服務，您目前的等級尚未達到資格',
    }
  }

  return { eligible: true }
}

/**
 * 取得會員的固定管家
 */
export async function getAssignedConcierge(
  userId: string,
): Promise<{ conciergeId: string; conciergeName: string } | null> {
  const payload = await getPayload({ config })

  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 1,
  })

  if (!user) return null

  const vipOwner = (user as unknown as Record<string, unknown>).vipOwner
  if (!vipOwner) return null

  if (typeof vipOwner === 'string') {
    const concierge = await payload.findByID({
      collection: 'users',
      id: vipOwner,
    })
    return concierge
      ? { conciergeId: concierge.id as unknown as string, conciergeName: concierge.name || '專屬管家' }
      : null
  }

  const conciergeObj = vipOwner as unknown as Record<string, unknown>
  return {
    conciergeId: conciergeObj.id as unknown as string,
    conciergeName: (conciergeObj.name as string) || '專屬管家',
  }
}

/**
 * 自動指派管家（若無固定管家，尋找負載最低的管家人員）
 */
export async function autoAssignConcierge(requestId: string): Promise<string> {
  const payload = await getPayload({ config })

  // 取得所有管理員（作為可指派的管家人員）
  const adminsWhere = {
    role: { equals: 'admin' },
  } satisfies Where

  const admins = await payload.find({
    collection: 'users',
    where: adminsWhere,
    limit: 50,
  })

  if (admins.docs.length === 0) {
    return ''
  }

  // 找出目前處理中請求最少的管家
  let minLoad = Infinity
  let bestConcierge = admins.docs[0]

  for (const admin of admins.docs) {
    const activeWhere = {
      assignedConcierge: { equals: admin.id },
      status: { in: ['assigned', 'in_progress', 'pending_confirmation'] },
    } satisfies Where

    const activeRequests = await payload.count({
      collection: 'concierge-service-requests',
      where: activeWhere,
    })

    if (activeRequests.totalDocs < minLoad) {
      minLoad = activeRequests.totalDocs
      bestConcierge = admin
    }
  }

  // 指派管家
  await (payload.update as Function)({
    collection: 'concierge-service-requests',
    id: requestId,
    data: {
      assignedConcierge: bestConcierge.id,
      status: 'assigned',
    },
  })

  return bestConcierge.id as unknown as string
}

/**
 * AI 初步處理請求
 */
export async function aiProcessRequest(
  requestId: string,
): Promise<{ suggestion: string; confidence: number; options: Record<string, unknown>[] }> {
  const payload = await getPayload({ config })

  const request = await payload.findByID({
    collection: 'concierge-service-requests',
    id: requestId,
    depth: 1,
  })

  if (!request) {
    throw new Error('找不到該管家服務請求')
  }

  const serviceType = request.serviceType as string
  const requestDetail = request.requestDetail as unknown as Record<string, unknown> | undefined
  const description = requestDetail?.description as string || ''

  // 更新狀態為 AI 處理中
  await (payload.update as Function)({
    collection: 'concierge-service-requests',
    id: requestId,
    data: { status: 'ai_processing' },
  })

  // 生成 AI 建議
  const baseSuggestion = AI_SUGGESTION_TEMPLATES[serviceType] || AI_SUGGESTION_TEMPLATES['other']
  let suggestion = `親愛的璀璨天后，${baseSuggestion}`
  let confidence = 70
  const options: Record<string, unknown>[] = []

  // 根據服務類型提供更具體的建議
  if (serviceType === 'fashion_styling' || serviceType === 'size_consultation' || serviceType === 'custom_order') {
    // 時尚類：查詢商品推薦
    const productsWhere = {
      status: { equals: 'active' },
    } satisfies Where

    const products = await payload.find({
      collection: 'products',
      where: productsWhere,
      limit: 5,
      sort: '-createdAt',
    })

    for (const product of products.docs) {
      options.push({
        type: 'product_recommendation',
        id: product.id,
        name: (product as unknown as Record<string, unknown>).title || (product as unknown as Record<string, unknown>).name || '商品推薦',
      })
    }
    confidence = 75
  } else if (serviceType === 'restaurant_booking' || serviceType === 'michelin_booking') {
    // 餐廳類：根據預算與地點建議
    const budget = requestDetail?.budget as string
    const location = requestDetail?.location as string
    suggestion += budget ? `\n預算範圍：${budget}` : ''
    suggestion += location ? `\n偏好地區：${location}` : ''
    confidence = 65
  } else if (serviceType === 'event_tickets') {
    confidence = 60
  }

  // 若有特殊需求，附加於建議中
  const specialReqs = requestDetail?.specialRequirements as string
  if (specialReqs) {
    suggestion += `\n\n已備註您的特殊需求：${specialReqs}`
  }

  // 更新 AI 回覆至請求記錄
  await (payload.update as Function)({
    collection: 'concierge-service-requests',
    id: requestId,
    data: {
      aiResponse: {
        aiSuggestion: suggestion,
        aiConfidence: confidence,
        aiProcessedAt: new Date().toISOString(),
        aiRecommendedOptions: options,
      },
    },
  })

  return { suggestion, confidence, options }
}

/**
 * 提交管家服務請求
 */
export async function submitConciergeRequest(
  request: ConciergeRequest,
): Promise<ConciergeResponse> {
  // 驗證資格
  const eligibility = await validateConciergeEligibility(request.userId)
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || '不符合管家服務資格')
  }

  const payload = await getPayload({ config })

  // 取得用戶信用分數
  const user = await payload.findByID({
    collection: 'users',
    id: request.userId,
  })
  const creditScore = (user as unknown as Record<string, unknown>).creditScore as number ?? 0
  const priority = calculatePriority(creditScore, request.isUrgent ?? false)

  // 建立管家服務請求
  const created = await (payload.create as Function)({
    collection: 'concierge-service-requests',
    data: {
      requester: request.userId,
      serviceType: request.serviceType,
      priority,
      status: 'submitted',
      isBirthdayMonthRequest: request.isBirthdayMonth ?? false,
      requestDetail: {
        description: request.description,
        preferredDate: request.preferredDate || undefined,
        preferredTime: request.preferredTime || undefined,
        location: request.location || undefined,
        budget: request.budget || undefined,
        numberOfPeople: request.numberOfPeople || undefined,
        specialRequirements: request.specialRequirements || undefined,
      },
    },
  })

  const requestId = created.id as unknown as string
  const requestNumber = (created as unknown as Record<string, unknown>).requestNumber as string

  // 嘗試取得固定管家
  let assignedConciergeId: string | null = null
  const concierge = await getAssignedConcierge(request.userId)
  if (concierge) {
    assignedConciergeId = concierge.conciergeId
    await (payload.update as Function)({
      collection: 'concierge-service-requests',
      id: requestId,
      data: {
        assignedConcierge: concierge.conciergeId,
        status: 'assigned',
      },
    })
  }

  // 觸發 AI 初步處理（非同步，不阻塞回應）
  aiProcessRequest(requestId).catch((err) => {
    console.error(`AI 處理請求 ${requestId} 時發生錯誤:`, err)
  })

  // 若無固定管家，自動指派
  if (!assignedConciergeId) {
    autoAssignConcierge(requestId).catch((err) => {
      console.error(`自動指派管家 ${requestId} 時發生錯誤:`, err)
    })
  }

  const aiTemplate = AI_SUGGESTION_TEMPLATES[request.serviceType] || AI_SUGGESTION_TEMPLATES['other']

  return {
    requestId,
    requestNumber,
    assignedConcierge: assignedConciergeId,
    aiSuggestion: `親愛的璀璨天后，${aiTemplate}`,
    estimatedResponseTime: PRIORITY_RESPONSE_TIMES[priority] || '2 小時內',
    priority,
  }
}

/**
 * 更新請求狀態
 */
export async function updateRequestStatus(
  requestId: string,
  status: string,
  note?: string,
): Promise<void> {
  const payload = await getPayload({ config })

  const updateData: Record<string, unknown> = { status }

  await (payload.update as Function)({
    collection: 'concierge-service-requests',
    id: requestId,
    data: updateData,
  })

  // 若有備註，追加至管家處理紀錄
  if (note) {
    const request = await payload.findByID({
      collection: 'concierge-service-requests',
      id: requestId,
    })

    const existingNotes = (request as unknown as Record<string, unknown>).conciergeNotes as unknown as Array<Record<string, unknown>> || []
    existingNotes.push({
      note,
      noteType: 'update',
      addedAt: new Date().toISOString(),
    })

    await (payload.update as Function)({
      collection: 'concierge-service-requests',
      id: requestId,
      data: { conciergeNotes: existingNotes },
    })
  }
}

/**
 * 取得管家服務 Dashboard 數據
 */
export async function getConciergeDashboard(): Promise<ConciergeDashboardData> {
  const payload = await getPayload({ config })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // 活躍中請求
  const activeWhere = {
    status: { in: ['submitted', 'ai_processing', 'assigned', 'in_progress', 'pending_confirmation'] },
  } satisfies Where

  const activeResult = await payload.count({
    collection: 'concierge-service-requests',
    where: activeWhere,
  })

  // 本月完成
  const completedWhere = {
    status: { equals: 'completed' },
    createdAt: { greater_than_equal: monthStart },
  } satisfies Where

  const completedResult = await payload.find({
    collection: 'concierge-service-requests',
    where: completedWhere,
    limit: 500,
  })

  // 計算平均滿意度
  let totalSatisfaction = 0
  let satisfactionCount = 0
  for (const doc of completedResult.docs) {
    const resolution = (doc as unknown as Record<string, unknown>).resolution as unknown as Record<string, unknown> | undefined
    const sat = resolution?.customerSatisfaction as number | undefined
    if (sat && sat > 0) {
      totalSatisfaction += sat
      satisfactionCount++
    }
  }
  const avgSatisfaction = satisfactionCount > 0 ? Math.round((totalSatisfaction / satisfactionCount) * 10) / 10 : 0

  // 所有請求（用於分佈統計）
  const allWhere = {
    createdAt: { greater_than_equal: monthStart },
  } satisfies Where

  const allResult = await payload.find({
    collection: 'concierge-service-requests',
    where: allWhere,
    limit: 1000,
  })

  // 服務類型分佈
  const serviceTypeDistribution: Record<string, number> = {}
  const priorityDistribution: Record<string, number> = {}

  for (const doc of allResult.docs) {
    const st = (doc as unknown as Record<string, unknown>).serviceType as string
    const pr = (doc as unknown as Record<string, unknown>).priority as string
    serviceTypeDistribution[st] = (serviceTypeDistribution[st] || 0) + 1
    priorityDistribution[pr] = (priorityDistribution[pr] || 0) + 1
  }

  // 生日月請求數
  const birthdayWhere = {
    isBirthdayMonthRequest: { equals: true },
    createdAt: { greater_than_equal: monthStart },
  } satisfies Where

  const birthdayResult = await payload.count({
    collection: 'concierge-service-requests',
    where: birthdayWhere,
  })

  // 最近請求
  const recentResult = await payload.find({
    collection: 'concierge-service-requests',
    sort: '-createdAt',
    limit: 10,
  })

  const recentRequests = recentResult.docs.map((doc) => ({
    id: doc.id as unknown as string,
    requestNumber: (doc as unknown as Record<string, unknown>).requestNumber as string,
    serviceType: (doc as unknown as Record<string, unknown>).serviceType as string,
    status: (doc as unknown as Record<string, unknown>).status as string,
    priority: (doc as unknown as Record<string, unknown>).priority as string,
    createdAt: doc.createdAt as string,
  }))

  // 頂尖管家（依完成數與滿意度排序）
  const conciergeStats: Record<string, { name: string; completedCount: number; totalSat: number; satCount: number }> = {}

  for (const doc of completedResult.docs) {
    const concierge = (doc as unknown as Record<string, unknown>).assignedConcierge
    if (!concierge) continue

    const conciergeId = typeof concierge === 'string' ? concierge : (concierge as unknown as Record<string, unknown>).id as unknown as string
    const conciergeName = typeof concierge === 'object' ? ((concierge as unknown as Record<string, unknown>).name as string || '管家') : '管家'

    if (!conciergeStats[conciergeId]) {
      conciergeStats[conciergeId] = { name: conciergeName, completedCount: 0, totalSat: 0, satCount: 0 }
    }
    conciergeStats[conciergeId].completedCount++

    const resolution = (doc as unknown as Record<string, unknown>).resolution as unknown as Record<string, unknown> | undefined
    const sat = resolution?.customerSatisfaction as number | undefined
    if (sat && sat > 0) {
      conciergeStats[conciergeId].totalSat += sat
      conciergeStats[conciergeId].satCount++
    }
  }

  const topConcierges = Object.entries(conciergeStats)
    .map(([id, stats]) => ({
      id,
      name: stats.name,
      completedCount: stats.completedCount,
      avgSatisfaction: stats.satCount > 0 ? Math.round((stats.totalSat / stats.satCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, 5)

  return {
    activeRequests: activeResult.totalDocs,
    completedThisMonth: completedResult.totalDocs,
    avgSatisfaction,
    avgResponseMinutes: 0, // 需要完整的時間追蹤系統來計算
    serviceTypeDistribution,
    priorityDistribution,
    topConcierges,
    recentRequests,
    birthdayMonthRequests: birthdayResult.totalDocs,
  }
}

/**
 * 生日月自動升級管家服務
 * 璀璨天后在生日月可享有：更快回應時間、更高服務預算、免費穿搭諮詢
 */
export async function applyBirthdayMonthUpgrade(userId: string): Promise<string[]> {
  const payload = await getPayload({ config })

  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 1,
  })

  if (!user) return []

  // 確認是 diamond 等級
  const tierObj = user.memberTier as unknown as Record<string, unknown> | undefined
  const tierSlug = typeof user.memberTier === 'string'
    ? user.memberTier
    : tierObj?.slug as string | undefined
  if (tierSlug !== 'diamond') return []

  // 確認是否為生日月
  const birthday = (user as unknown as Record<string, unknown>).birthday as string | undefined
  if (!birthday) return []

  const birthMonth = new Date(birthday).getMonth()
  const currentMonth = new Date().getMonth()
  if (birthMonth !== currentMonth) return []

  const upgrades: string[] = []

  // 生日月升級項目
  upgrades.push('管家服務回應時間升級：所有請求自動提升為「緊急」優先級')
  upgrades.push('生日月免費穿搭諮詢一次')
  upgrades.push('生日月服務預算額度提升 20%')
  upgrades.push('生日月專屬驚喜禮物安排')

  return upgrades
}
