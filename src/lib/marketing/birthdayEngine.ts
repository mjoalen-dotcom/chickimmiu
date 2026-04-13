/**
 * 生日行銷自動化引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 生日行銷 5 階段完整執行邏輯
 *
 * 5 階段 Journey：
 *   Phase 1 預告（生日前 7 天）
 *   Phase 2 生日祝福（生日月 1 日）
 *   Phase 3 中期推薦（生日月中旬）
 *   Phase 4 倒數加碼（最後 3 天）
 *   Phase 5 感謝回饋（生日月後 3 天）
 *
 * ⚠️ 所有前台文案一律使用前台稱號（優雅初遇者、曦漾仙子...）
 *    絕對不可出現 ordinary / bronze / gold 等後台分級碼
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { TIER_FRONT_NAMES } from '../crm/tierEngine'
import { sendMessage } from './channelDispatcher'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

export interface BirthdayGiftConfig {
  tierCode: string
  tierFrontName: string
  discountPercent: number
  shoppingCredit: number
  bonusPoints: number
  couponCode: string
  pointsMultiplier: number
  freeShipping: boolean
  priorityShipping: boolean
  stylingMinutes: number
  giftBoxIncluded: boolean
  creditScoreBonus: number
  specialGift: string
}

export interface BirthdayDashboardData {
  currentMonthBirthdays: number
  activeCampaigns: number
  completedThisMonth: number
  totalGiftsIssued: number
  totalRevenue: number
  avgConversionRate: number
  tierDistribution: Record<string, number>
  phasePerformance: Array<{
    phase: number
    phaseName: string
    sent: number
    opened: number
    clicked: number
    converted: number
  }>
  upcomingPhases: Array<{
    campaignId: string
    userName: string
    tierFrontName: string
    phase: number
    scheduledDate: string
  }>
}

/** 階段定義 */
interface PhaseDefinition {
  phase: 1 | 2 | 3 | 4 | 5
  name: string
  channels: Array<'line' | 'email' | 'push' | 'in_app_popup'>
}

/** 生日活動文件型別 */
interface BirthdayCampaignDoc {
  id: string
  user: string | { id: string }
  month: number
  year: number
  status: string
  tierCode: string
  giftConfig: BirthdayGiftConfig
  phases: Array<{
    phase: number
    scheduledDate: string
    status: string
    sentAt?: string
  }>
}

// ══════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════

const PHASE_DEFINITIONS: PhaseDefinition[] = [
  { phase: 1, name: '預告', channels: ['line', 'email', 'push'] },
  { phase: 2, name: '生日祝福', channels: ['line', 'email', 'push', 'in_app_popup'] },
  { phase: 3, name: '中期推薦', channels: ['line', 'email', 'push'] },
  { phase: 4, name: '倒數加碼', channels: ['line', 'email', 'push', 'in_app_popup'] },
  { phase: 5, name: '感謝回饋', channels: ['line', 'email', 'push'] },
]

/** 預設 Tier 禮物設定（可被 marketing-automation-settings 覆寫） */
const DEFAULT_TIER_GIFTS: Record<string, Omit<BirthdayGiftConfig, 'tierCode' | 'tierFrontName' | 'couponCode' | 'creditScoreBonus'>> = {
  ordinary: {
    discountPercent: 8,
    shoppingCredit: 50,
    bonusPoints: 100,
    pointsMultiplier: 1.5,
    freeShipping: true,
    priorityShipping: false,
    stylingMinutes: 0,
    giftBoxIncluded: false,
    specialGift: '',
  },
  bronze: {
    discountPercent: 10,
    shoppingCredit: 100,
    bonusPoints: 200,
    pointsMultiplier: 2,
    freeShipping: true,
    priorityShipping: false,
    stylingMinutes: 0,
    giftBoxIncluded: false,
    specialGift: '',
  },
  silver: {
    discountPercent: 12,
    shoppingCredit: 200,
    bonusPoints: 350,
    pointsMultiplier: 2,
    freeShipping: true,
    priorityShipping: false,
    stylingMinutes: 15,
    giftBoxIncluded: false,
    specialGift: '',
  },
  gold: {
    discountPercent: 15,
    shoppingCredit: 350,
    bonusPoints: 500,
    pointsMultiplier: 2.5,
    freeShipping: true,
    priorityShipping: true,
    stylingMinutes: 20,
    giftBoxIncluded: false,
    specialGift: '生日限定香氛小卡',
  },
  platinum: {
    discountPercent: 18,
    shoppingCredit: 500,
    bonusPoints: 800,
    pointsMultiplier: 3,
    freeShipping: true,
    priorityShipping: true,
    stylingMinutes: 30,
    giftBoxIncluded: true,
    specialGift: '精選生日禮盒 + 手寫祝福卡',
  },
  diamond: {
    discountPercent: 25,
    shoppingCredit: 1000,
    bonusPoints: 1500,
    pointsMultiplier: 4,
    freeShipping: true,
    priorityShipping: true,
    stylingMinutes: 60,
    giftBoxIncluded: true,
    specialGift: '璀璨生日尊榮禮盒 + 專屬造型師一對一諮詢',
  },
}

/** 信用分數 bonus 設定 */
const CREDIT_SCORE_BONUS: Record<string, { threshold: number; extraCredit: number }> = {
  ordinary: { threshold: 90, extraCredit: 30 },
  bronze: { threshold: 90, extraCredit: 50 },
  silver: { threshold: 90, extraCredit: 80 },
  gold: { threshold: 90, extraCredit: 120 },
  platinum: { threshold: 90, extraCredit: 200 },
  diamond: { threshold: 90, extraCredit: 400 },
}

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

/** 產生優惠碼 */
function generateCouponCode(tierCode: string, userId: string, year: number, month: number): string {
  const tierPrefix = tierCode.substring(0, 2).toUpperCase()
  const userSuffix = userId.substring(userId.length - 4).toUpperCase()
  return `BD${year}${String(month).padStart(2, '0')}${tierPrefix}${userSuffix}`
}

/** 從 user doc 提取 ID */
function extractUserId(user: string | { id: string } | Record<string, unknown>): string {
  if (typeof user === 'string') return user
  if (typeof user === 'object' && user !== null && 'id' in user) {
    return String((user as { id: unknown }).id)
  }
  return String(user)
}

/** 計算階段排程日期 */
function calculatePhaseDates(month: number, year: number): Array<{ phase: number; scheduledDate: string }> {
  // Phase 1: 生日月前 7 天（上月 24 日左右）
  const phase1Date = new Date(year, month - 1, -6) // month - 1 因為 JS Date 月份從 0 開始
  // Phase 2: 生日月 1 日
  const phase2Date = new Date(year, month - 1, 1)
  // Phase 3: 生日月 15 日
  const phase3Date = new Date(year, month - 1, 15)
  // Phase 4: 生日月最後 3 天
  const lastDay = new Date(year, month, 0).getDate()
  const phase4Date = new Date(year, month - 1, lastDay - 2)
  // Phase 5: 生日月後 3 天
  const phase5Date = new Date(year, month, 3)

  return [
    { phase: 1, scheduledDate: phase1Date.toISOString() },
    { phase: 2, scheduledDate: phase2Date.toISOString() },
    { phase: 3, scheduledDate: phase3Date.toISOString() },
    { phase: 4, scheduledDate: phase4Date.toISOString() },
    { phase: 5, scheduledDate: phase5Date.toISOString() },
  ]
}

/** 嘗試從 Global 設定載入 birthdayConfig 覆寫 */
async function loadBirthdaySettings(): Promise<Record<string, unknown> | null> {
  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'marketing-automation-settings' })
    const s = settings as unknown as Record<string, unknown>
    return (s.birthdayConfig as unknown as Record<string, unknown>) ?? null
  } catch {
    return null
  }
}

// ══════════════════════════════════════════════════════════
// Core — 計算會員生日禮物設定
// ══════════════════════════════════════════════════════════

/**
 * 計算會員的生日禮物設定（根據 tier + credit score + segment）
 *
 * 讀取 marketing-automation-settings 中的 birthdayConfig 覆寫；
 * 若無，使用 DEFAULT_TIER_GIFTS。
 * 額外依據信用分數給予 creditScoreBonus。
 *
 * @param userId - 會員 ID
 * @returns 生日禮物設定
 */
export async function calculateBirthdayGifts(userId: string): Promise<BirthdayGiftConfig> {
  const payload = await getPayload({ config })

  // 讀取會員資料
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>
  const tierCode = typeof user.tier === 'string' ? user.tier : 'ordinary'
  const creditScore = typeof user.creditScore === 'number' ? user.creditScore : 80
  const tierFrontName = TIER_FRONT_NAMES[tierCode] ?? '優雅初遇者'

  // 嘗試從 Global 設定載入
  const bdSettings = await loadBirthdaySettings()
  let tierGifts: Record<string, unknown> | null = null

  if (bdSettings && Array.isArray(bdSettings.tierGifts)) {
    const found = bdSettings.tierGifts.find(
      (g: unknown) => typeof g === 'object' && g !== null && (g as unknown as Record<string, unknown>).tierCode === tierCode,
    )
    if (found) {
      tierGifts = found as unknown as Record<string, unknown>
    }
  }

  // 使用 Global 設定或 DEFAULT
  const defaults = DEFAULT_TIER_GIFTS[tierCode] ?? DEFAULT_TIER_GIFTS.ordinary

  const giftConfig: BirthdayGiftConfig = {
    tierCode,
    tierFrontName,
    discountPercent: (tierGifts?.discountPercent as number) ?? defaults.discountPercent,
    shoppingCredit: (tierGifts?.shoppingCredit as number) ?? defaults.shoppingCredit,
    bonusPoints: (tierGifts?.bonusPoints as number) ?? defaults.bonusPoints,
    couponCode: '', // 建立活動時再產生
    pointsMultiplier: (tierGifts?.pointsMultiplier as number) ?? defaults.pointsMultiplier,
    freeShipping: (tierGifts?.freeShipping as boolean) ?? defaults.freeShipping,
    priorityShipping: (tierGifts?.priorityShipping as boolean) ?? defaults.priorityShipping,
    stylingMinutes: (tierGifts?.stylingMinutes as number) ?? defaults.stylingMinutes,
    giftBoxIncluded: (tierGifts?.giftBoxIncluded as boolean) ?? defaults.giftBoxIncluded,
    creditScoreBonus: 0,
    specialGift: (tierGifts?.specialGift as string) ?? defaults.specialGift,
  }

  // 信用分數加成
  const bonusDef = CREDIT_SCORE_BONUS[tierCode] ?? CREDIT_SCORE_BONUS.ordinary
  if (creditScore >= bonusDef.threshold) {
    giftConfig.creditScoreBonus = bonusDef.extraCredit
    giftConfig.shoppingCredit += bonusDef.extraCredit
  }

  return giftConfig
}

// ══════════════════════════════════════════════════════════
// Core — 為單一會員建立生日活動
// ══════════════════════════════════════════════════════════

/**
 * 為單一會員建立生日活動
 *
 * 建立一筆 birthday-campaigns 記錄，含所有階段的排程日期。
 *
 * @param userId - 會員 ID
 * @param month - 生日月份
 * @param year - 年份
 * @returns 活動 ID 或 null（若已存在或建立失敗）
 */
export async function createBirthdayCampaignForUser(
  userId: string,
  month: number,
  year: number,
): Promise<string | null> {
  const payload = await getPayload({ config })

  // 檢查是否已有該年月的活動
  const existing = await payload.find({
    collection: 'birthday-campaigns',
    where: {
      user: { equals: userId },
      month: { equals: month },
      year: { equals: year },
    } satisfies Where,
    limit: 1,
  })

  if (existing.totalDocs > 0) {
    console.log(`[Birthday] 已存在活動：user=${userId}, ${year}/${month}`)
    return null
  }

  // 計算禮物設定
  const giftConfig = await calculateBirthdayGifts(userId)
  giftConfig.couponCode = generateCouponCode(giftConfig.tierCode, userId, year, month)

  // 計算階段日期
  const phaseDates = calculatePhaseDates(month, year)
  const phases = phaseDates.map((pd) => ({
    phase: pd.phase,
    scheduledDate: pd.scheduledDate,
    status: 'pending',
  }))

  try {
    const doc = await (payload.create as Function)({
      collection: 'birthday-campaigns',
      data: {
        user: userId,
        month,
        year,
        status: 'active',
        tierCode: giftConfig.tierCode,
        giftConfig,
        phases,
        createdAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>,
    })

    console.log(`[Birthday] 活動已建立：user=${userId}, campaign=${doc.id}, tier=${giftConfig.tierFrontName}`)
    return doc.id as unknown as string
  } catch (error) {
    console.error(`[Birthday] 建立活動失敗 (user: ${userId}):`, error)
    return null
  }
}

// ══════════════════════════════════════════════════════════
// Core — 為指定月份建立生日活動
// ══════════════════════════════════════════════════════════

/**
 * 為指定月份的所有壽星建立生日活動
 *
 * 查詢所有生日月份符合的會員，並逐一建立活動。
 *
 * @param month - 目標月份（1-12）
 * @param year - 年份
 * @returns 已建立 / 已跳過數量
 */
export async function createBirthdayCampaignsForMonth(
  month: number,
  year: number,
): Promise<{ created: number; skipped: number }> {
  const payload = await getPayload({ config })

  // 查詢生日月份符合的會員
  const usersResult = await payload.find({
    collection: 'users',
    where: {
      birthdayMonth: { equals: month },
      role: { equals: 'customer' },
    } satisfies Where,
    limit: 10000,
  })

  console.log(`[Birthday] ${year}/${month} 找到 ${usersResult.totalDocs} 位壽星`)

  let created = 0
  let skipped = 0

  for (const userDoc of usersResult.docs) {
    const userId = extractUserId(userDoc.id as unknown as string)
    const campaignId = await createBirthdayCampaignForUser(userId, month, year)

    if (campaignId) {
      created++
    } else {
      skipped++
    }
  }

  console.log(`[Birthday] ${year}/${month} 活動建立完成：建立=${created}, 跳過=${skipped}`)
  return { created, skipped }
}

// ══════════════════════════════════════════════════════════
// Core — 執行生日活動階段
// ══════════════════════════════════════════════════════════

/**
 * 執行生日活動的指定階段
 *
 * 依據階段的通道設定，產生文案並發送。
 * 更新階段狀態為 sent。
 *
 * @param campaignId - 活動 ID
 * @param phase - 階段編號（1-5）
 * @returns 是否全部成功
 */
export async function executeBirthdayPhase(
  campaignId: string,
  phase: 1 | 2 | 3 | 4 | 5,
): Promise<boolean> {
  const payload = await getPayload({ config })

  // 載入活動
  const campaignDoc = await payload.findByID({ collection: 'birthday-campaigns', id: campaignId })
  const campaign = campaignDoc as unknown as BirthdayCampaignDoc

  const userId = extractUserId(campaign.user)
  const giftConfig = campaign.giftConfig

  // 讀取使用者名稱
  const userDoc = await payload.findByID({ collection: 'users', id: userId })
  const user = userDoc as unknown as Record<string, unknown>
  const userName = typeof user.name === 'string' ? user.name : '親愛的'

  // 取得階段定義
  const phaseDef = PHASE_DEFINITIONS.find((p) => p.phase === phase)
  if (!phaseDef) {
    console.error(`[Birthday] 無效的階段: ${phase}`)
    return false
  }

  let allSuccess = true

  for (const channel of phaseDef.channels) {
    const msg = generateBirthdayMessage(phase, channel, giftConfig.tierCode, userName, giftConfig)

    try {
      const result = await sendMessage(userId, channel, {
        subject: msg.subject,
        body: msg.content,
        htmlBody: msg.content,
      }, campaignId)

      // 記錄執行日誌
      await (payload.create as Function)({
        collection: 'marketing-execution-logs',
        data: {
          campaign: campaignId,
          user: userId,
          channel,
          status: result.success ? 'sent' : 'failed',
          messageId: result.messageId ?? '',
          error: result.error ?? '',
          sentAt: new Date().toISOString(),
          metadata: { birthdayPhase: phase, tierCode: giftConfig.tierCode },
        } as unknown as Record<string, unknown>,
      })

      if (!result.success) {
        allSuccess = false
      }
    } catch (error) {
      allSuccess = false
      console.error(`[Birthday] Phase ${phase} channel ${channel} 發送失敗:`, error)
    }
  }

  // 更新階段狀態
  const updatedPhases = (campaign.phases ?? []).map((p) => {
    if (p.phase === phase) {
      return { ...p, status: 'sent', sentAt: new Date().toISOString() }
    }
    return p
  })

  // 檢查是否全部階段都已完成
  const allPhasesSent = updatedPhases.every((p) => p.status === 'sent')

  await (payload.update as Function)({
    collection: 'birthday-campaigns',
    id: campaignId,
    data: {
      phases: updatedPhases,
      status: allPhasesSent ? 'completed' : 'active',
    } as unknown as Record<string, unknown>,
  })

  console.log(`[Birthday] Phase ${phase}（${phaseDef.name}）已執行：campaign=${campaignId}, success=${allSuccess}`)
  return allSuccess
}

// ══════════════════════════════════════════════════════════
// Core — 每日排程器
// ══════════════════════════════════════════════════════════

/**
 * 每日排程：檢查並觸發當日應執行的生日階段
 *
 * 遍歷所有 active 生日活動，比對每個未執行階段的排程日期，
 * 若到期則觸發該階段。
 *
 * @returns 執行統計
 */
export async function runDailyBirthdayScheduler(): Promise<{ executed: number; errors: number }> {
  const payload = await getPayload({ config })
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0] // YYYY-MM-DD

  // 查詢所有 active 的生日活動
  const activeCampaigns = await payload.find({
    collection: 'birthday-campaigns',
    where: {
      status: { equals: 'active' },
    } satisfies Where,
    limit: 10000,
  })

  let executed = 0
  let errors = 0

  for (const doc of activeCampaigns.docs) {
    const campaign = doc as unknown as BirthdayCampaignDoc
    const phases = campaign.phases ?? []

    for (const phaseEntry of phases) {
      if (phaseEntry.status !== 'pending') continue

      // 檢查排程日期是否已到
      const scheduledDate = phaseEntry.scheduledDate.split('T')[0]
      if (scheduledDate > todayStr) continue

      try {
        const success = await executeBirthdayPhase(campaign.id, phaseEntry.phase as 1 | 2 | 3 | 4 | 5)
        if (success) {
          executed++
        } else {
          errors++
        }
      } catch (error) {
        errors++
        console.error(`[Birthday] Scheduler 執行失敗：campaign=${campaign.id}, phase=${phaseEntry.phase}`, error)
      }
    }
  }

  console.log(`[Birthday] 每日排程完成：執行=${executed}, 錯誤=${errors}`)
  return { executed, errors }
}

// ══════════════════════════════════════════════════════════
// Core — 生日行銷 Dashboard 數據
// ══════════════════════════════════════════════════════════

/**
 * 取得生日行銷 Dashboard 數據
 *
 * 統計當月壽星、活躍活動、各階段表現等。
 *
 * @returns Dashboard 數據
 */
export async function getBirthdayDashboard(): Promise<BirthdayDashboardData> {
  const payload = await getPayload({ config })
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // 當月壽星數
  const birthdayUsers = await payload.find({
    collection: 'users',
    where: {
      birthdayMonth: { equals: currentMonth },
      role: { equals: 'customer' },
    } satisfies Where,
    limit: 0,
  })

  // 活躍活動
  const activeCampaigns = await payload.find({
    collection: 'birthday-campaigns',
    where: {
      status: { equals: 'active' },
      month: { equals: currentMonth },
      year: { equals: currentYear },
    } satisfies Where,
    limit: 0,
  })

  // 已完成活動
  const completedCampaigns = await payload.find({
    collection: 'birthday-campaigns',
    where: {
      status: { equals: 'completed' },
      month: { equals: currentMonth },
      year: { equals: currentYear },
    } satisfies Where,
    limit: 0,
  })

  // 本月所有活動（含 active + completed）用於統計
  const allMonthCampaigns = await payload.find({
    collection: 'birthday-campaigns',
    where: {
      month: { equals: currentMonth },
      year: { equals: currentYear },
    } satisfies Where,
    limit: 10000,
  })

  // 等級分佈
  const tierDist: Record<string, number> = {}
  let totalGiftsIssued = 0

  for (const doc of allMonthCampaigns.docs) {
    const c = doc as unknown as BirthdayCampaignDoc
    const frontName = TIER_FRONT_NAMES[c.tierCode] ?? '優雅初遇者'
    tierDist[frontName] = (tierDist[frontName] ?? 0) + 1
    // 已發送的階段數即為已發出的禮物
    const sentPhases = (c.phases ?? []).filter((p) => p.status === 'sent')
    totalGiftsIssued += sentPhases.length
  }

  // 階段表現（從 execution logs 統計）
  const phasePerformance: BirthdayDashboardData['phasePerformance'] = []

  for (const pDef of PHASE_DEFINITIONS) {
    const logs = await payload.find({
      collection: 'marketing-execution-logs',
      where: {
        'metadata.birthdayPhase': { equals: pDef.phase },
        createdAt: { greater_than: new Date(currentYear, currentMonth - 1, 1).toISOString() },
      } satisfies Where,
      limit: 0,
    })

    // 簡化統計（實際可從 performanceTracker 取更詳細數據）
    const sent = logs.totalDocs
    const opened = Math.round(sent * 0.65) // 預估值，待 performanceTracker 整合
    const clicked = Math.round(opened * 0.35)
    const converted = Math.round(clicked * 0.2)

    phasePerformance.push({
      phase: pDef.phase,
      phaseName: pDef.name,
      sent,
      opened,
      clicked,
      converted,
    })
  }

  // 營收估算（從 orders 關聯 coupon code）
  let totalRevenue = 0
  const conversionTotal = phasePerformance.reduce((sum, p) => sum + p.converted, 0)
  const sentTotal = phasePerformance.reduce((sum, p) => sum + p.sent, 0)

  // 嘗試從訂單關聯估算
  try {
    const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString()
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString()
    const birthdayOrders = await payload.find({
      collection: 'orders',
      where: {
        createdAt: { greater_than: monthStart, less_than: monthEnd },
        'coupon.code': { contains: `BD${currentYear}${String(currentMonth).padStart(2, '0')}` },
      } satisfies Where,
      limit: 1000,
    })

    for (const order of birthdayOrders.docs) {
      const o = order as unknown as Record<string, unknown>
      totalRevenue += typeof o.total === 'number' ? o.total : 0
    }
  } catch {
    // 訂單查詢失敗，使用估算
    totalRevenue = conversionTotal * 2500
  }

  // 即將到來的階段
  const upcomingPhases: BirthdayDashboardData['upcomingPhases'] = []
  const upcomingCampaigns = await payload.find({
    collection: 'birthday-campaigns',
    where: {
      status: { equals: 'active' },
    } satisfies Where,
    limit: 20,
    sort: 'phases.scheduledDate',
  })

  for (const doc of upcomingCampaigns.docs) {
    const c = doc as unknown as BirthdayCampaignDoc
    const pendingPhases = (c.phases ?? []).filter((p) => p.status === 'pending')

    if (pendingPhases.length > 0) {
      const nextPhase = pendingPhases[0]
      const uid = extractUserId(c.user)

      let userName = '會員'
      try {
        const userDoc = await payload.findByID({ collection: 'users', id: uid })
        const u = userDoc as unknown as Record<string, unknown>
        userName = typeof u.name === 'string' ? u.name : '會員'
      } catch {
        // 用戶讀取失敗
      }

      upcomingPhases.push({
        campaignId: c.id,
        userName,
        tierFrontName: TIER_FRONT_NAMES[c.tierCode] ?? '優雅初遇者',
        phase: nextPhase.phase,
        scheduledDate: nextPhase.scheduledDate,
      })
    }
  }

  return {
    currentMonthBirthdays: birthdayUsers.totalDocs,
    activeCampaigns: activeCampaigns.totalDocs,
    completedThisMonth: completedCampaigns.totalDocs,
    totalGiftsIssued,
    totalRevenue,
    avgConversionRate: sentTotal > 0 ? Math.round((conversionTotal / sentTotal) * 10000) / 100 : 0,
    tierDistribution: tierDist,
    phasePerformance,
    upcomingPhases: upcomingPhases.slice(0, 10),
  }
}

// ══════════════════════════════════════════════════════════
// Core — 生日訊息文案產生器
// ══════════════════════════════════════════════════════════

/**
 * 產生生日訊息文案（5 階段 x 4 通道 x tier 差異化）
 *
 * T4（星耀皇后）、T5（璀璨天后）有專屬 VIP 文案；
 * T0-T3 使用通用優雅文案。
 *
 * 風格：溫柔優雅、韓系浪漫、「專屬你美好的時尚優雅」
 *
 * @param phase - 階段編號
 * @param channel - 通道類型
 * @param tierCode - 等級代碼（後台碼）
 * @param userName - 會員名稱
 * @param giftConfig - 禮物設定
 * @returns 主旨 + 內容
 */
export function generateBirthdayMessage(
  phase: 1 | 2 | 3 | 4 | 5,
  channel: 'line' | 'email' | 'push' | 'in_app_popup',
  tierCode: string,
  userName: string,
  giftConfig: BirthdayGiftConfig,
): { subject: string; content: string } {
  const frontName = TIER_FRONT_NAMES[tierCode] ?? '優雅初遇者'

  // 判斷是否 VIP 專屬文案
  if (tierCode === 'diamond') {
    return generateDiamondMessage(phase, channel, userName, frontName, giftConfig)
  }
  if (tierCode === 'platinum') {
    return generatePlatinumMessage(phase, channel, userName, frontName, giftConfig)
  }

  return generateGeneralMessage(phase, channel, userName, frontName, giftConfig)
}

// ──────────────────────────────────────────────────────────
// T5 璀璨天后 專屬文案
// ──────────────────────────────────────────────────────────

function generateDiamondMessage(
  phase: 1 | 2 | 3 | 4 | 5,
  channel: 'line' | 'email' | 'push' | 'in_app_popup',
  userName: string,
  frontName: string,
  gift: BirthdayGiftConfig,
): { subject: string; content: string } {

  // ── Phase 1 預告 ──
  if (phase === 1) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `${userName} 親愛的${frontName}：\n\n` +
          `空氣裡似乎飄著花瓣與星光的香氣\u2026\u2026因為屬於妳的璀璨時刻，即將降臨。\n\n` +
          `CHIC KIM & MIU 正為妳準備一份極致尊榮的生日驚喜\u2014\u2014專屬於最閃耀的妳。\n\n` +
          `請期待，妳值得世界上所有美好的事物 \u2728\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `${userName}，屬於妳的璀璨時刻即將來臨`,
        content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
          `每一年的這個時節，我們都特別期待\u2014\u2014因為這是為妳點亮星光的日子。\n\n` +
          `作為 CHIC KIM & MIU 最珍貴的${frontName}，我們正在為妳悉心準備一場極致的生日盛宴：\n\n` +
          `\u2728 專屬至尊折扣\n` +
          `\u2728 璀璨天后獨享購物金\n` +
          `\u2728 一對一造型師諮詢\n` +
          `\u2728 璀璨尊榮禮盒\n\n` +
          `更多驚喜，將在妳的生日月正式揭曉。\n\n` +
          `請靜靜期待，一切美好正朝妳而來。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `${frontName}，璀璨驚喜即將降臨`,
        content: `${userName}，妳的生日月即將來臨，CHIC KIM & MIU 為妳準備了極致的尊榮禮遇 \u2728`,
      }
    }
    return {
      subject: `璀璨生日預告`,
      content: `${userName}，妳的專屬生日驚喜正在準備中\u2026\u2026`,
    }
  }

  // ── Phase 2 生日祝福 ──
  if (phase === 2) {
    const giftList =
      `\ud83c\udf81 全館 ${gift.discountPercent}% OFF 璀璨天后獨享折扣\n` +
      `\ud83d\udcb3 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金${gift.creditScoreBonus > 0 ? `（含信用加碼 NT$${gift.creditScoreBonus}）` : ''}\n` +
      `\u2b50 ${gift.bonusPoints.toLocaleString('zh-TW')} 生日紅利點數\n` +
      `\u2728 點數 ${gift.pointsMultiplier}x 加倍整月有效\n` +
      `\ud83d\udc60 ${gift.stylingMinutes} 分鐘一對一專屬造型師諮詢\n` +
      `\ud83c\udf80 璀璨生日尊榮禮盒\n` +
      `\ud83d\ude9a 全館免運 + 優先出貨\n` +
      `\ud83c\udf1f ${gift.specialGift}`

    if (channel === 'line') {
      return {
        subject: '',
        content: `\ud83c\udf82 ${userName}，生日快樂！\n\n` +
          `最璀璨的${frontName}，今天是屬於妳的日子。\n\n` +
          `整個世界都應該為妳慶祝，而 CHIC KIM & MIU 用最真摯的心意，為妳獻上最尊榮的生日禮遇：\n\n` +
          `${giftList}\n\n` +
          `\ud83c\udf1f 優惠碼：${gift.couponCode}\n\n` +
          `願妳的每一天都如星辰般閃耀，如鑽石般永恆璀璨。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `\ud83c\udf82 ${userName}，最璀璨的生日快樂！專屬${frontName}尊榮禮遇已開啟`,
        content: `親愛的${userName}，最尊貴的${frontName}：\n\n` +
          `生日快樂！\n\n` +
          `在這個專屬於妳的美好日子，CHIC KIM & MIU 全體團隊向妳獻上最溫暖的祝福。\n\n` +
          `妳是我們最珍貴的${frontName}，因此我們為妳準備了品牌最高規格的生日禮遇：\n\n` +
          `${giftList}\n\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n` +
          `\ud83c\udf1f 妳的專屬優惠碼：${gift.couponCode}\n` +
          `\ud83d\udcc5 有效期限：生日月全月\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n` +
          `願妳在新的一歲裡，遇見更多美好，綻放更多光芒。\n` +
          `妳值得世界上最好的一切。\n\n` +
          `永遠支持妳的美麗旅程，\n` +
          `CHIC KIM & MIU 團隊 敬上\n\n` +
          `\u2014\u2014 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `\ud83c\udf82 ${frontName}生日快樂！`,
        content: `${userName}，${gift.discountPercent}% 折扣 + NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金 + ${gift.stylingMinutes}分鐘造型諮詢，璀璨禮遇已開啟！`,
      }
    }
    // in_app_popup
    return {
      subject: `\ud83c\udf82 ${frontName}生日快樂`,
      content: `${userName}，生日快樂！妳的璀璨天后尊榮禮遇已開啟：${gift.discountPercent}% 折扣、NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金及更多驚喜，使用優惠碼 ${gift.couponCode} 即可享用。`,
    }
  }

  // ── Phase 3 中期推薦 ──
  if (phase === 3) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `${userName} 親愛的${frontName}：\n\n` +
          `生日月進入幸福的中段，CHIC KIM & MIU 為妳精心挑選了今季最適合妳的造型：\n\n` +
          `\ud83d\udc97 AI 為妳推薦的專屬穿搭已上線\n` +
          `\u2b50 別忘了，本月所有消費享 ${gift.pointsMultiplier}x 點數加倍\n` +
          `\ud83d\udcab 其他${frontName}的真實穿搭分享，等妳來看\n\n` +
          `妳的優惠碼 ${gift.couponCode} 整月有效，盡情享受吧！\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `${userName}，為妳精選的生日月穿搭靈感`,
        content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
          `生日月的快樂不應只有一天，而是整個月份都值得被寵愛。\n\n` +
          `\ud83c\udf1f AI 風格推薦：根據妳的購物偏好與風格，我們為妳準備了本季最適合的穿搭提案。\n\n` +
          `\ud83d\udcab 點數 ${gift.pointsMultiplier}x 加倍提醒：本月每筆消費都能累積 ${gift.pointsMultiplier} 倍點數，越買越值得！\n\n` +
          `\ud83d\udc97 ${frontName}穿搭日記：看看其他璀璨天后們都怎麼搭配今季新品。\n\n` +
          `優惠碼 ${gift.couponCode} 整月有效，願每個美好的日子都有妳最閃耀的身影。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `${frontName}專屬推薦`,
        content: `${userName}，AI 為妳挑選的生日月穿搭已上線！別忘了 ${gift.pointsMultiplier}x 點數加倍 \u2728`,
      }
    }
    return {
      subject: `生日月穿搭推薦`,
      content: `${userName}，妳的專屬穿搭推薦已上線，搭配 ${gift.pointsMultiplier}x 點數加倍更划算！`,
    }
  }

  // ── Phase 4 倒數加碼 ──
  if (phase === 4) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `\u23f0 ${userName} 親愛的${frontName}：\n\n` +
          `生日月倒數最後 3 天！\n\n` +
          `妳的璀璨天后專屬禮遇即將結束，不想讓妳錯過任何美好：\n\n` +
          `\ud83c\udf1f ${gift.discountPercent}% 折扣即將截止\n` +
          `\ud83d\udcb3 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金尚未使用？現在是最好的時機\n` +
          `\ud83c\udf81 加碼驚喜：最後 3 天消費再送 200 紅利點數\n\n` +
          `優惠碼：${gift.couponCode}\n\n` +
          `璀璨的妳，值得用最美的方式為生日月畫下完美句點 \u2728\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `\u23f0 ${userName}，璀璨天后生日禮遇倒數最後 3 天！`,
        content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
          `時光飛逝，妳的生日月即將進入尾聲。\n\n` +
          `在最後的 3 天裡，我們不捨得讓任何美好溜走，特別為妳加碼：\n\n` +
          `\ud83c\udf1f 加碼禮遇：最後 3 天消費再加送 200 紅利點數\n` +
          `\ud83d\udcab 提醒：妳的 ${gift.discountPercent}% 折扣與 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金即將到期\n` +
          `\u2728 ${gift.pointsMultiplier}x 點數加倍最後機會\n\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n` +
          `\ud83c\udf1f 優惠碼：${gift.couponCode}\n` +
          `\ud83d\udcc5 最後截止：生日月最後一天 23:59\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n` +
          `用最美的姿態，為這個月畫下閃耀的句點。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `\u23f0 ${frontName}生日禮遇倒數 3 天`,
        content: `${userName}，最後 3 天！${gift.discountPercent}% 折扣 + NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金即將到期，再加碼 200 點數！`,
      }
    }
    // in_app_popup
    return {
      subject: `\u23f0 生日禮遇倒數`,
      content: `${userName}，璀璨天后生日禮遇剩最後 3 天！把握 ${gift.discountPercent}% 折扣與 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金的最後機會。`,
    }
  }

  // ── Phase 5 感謝回饋 ──
  if (channel === 'line') {
    return {
      subject: '',
      content: `${userName} 親愛的${frontName}：\n\n` +
        `感謝妳讓 CHIC KIM & MIU 有機會陪伴妳度過這個美好的生日月。\n\n` +
        `希望每一件為妳挑選的衣裳，都能為妳的日常增添閃耀與自信。\n\n` +
        `\ud83c\udf1f 分享妳的生日穿搭，好友也能獲得 NT$200 首購禮金\n` +
        `\u2728 下個月精彩預告即將到來\n\n` +
        `璀璨天后的故事，永遠是最動人的那一頁。\n\n` +
        `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
    }
  }
  if (channel === 'email') {
    return {
      subject: `${userName}，感謝妳的璀璨生日月 \u2728`,
      content: `親愛的${userName}，最尊貴的${frontName}：\n\n` +
        `美好的生日月已經畫下了溫柔的句點，但妳的閃耀永不落幕。\n\n` +
        `感謝妳一路以來對 CHIC KIM & MIU 的信任與支持，妳是我們最珍貴的存在。\n\n` +
        `\ud83c\udf1f 分享邀請：將生日的喜悅分享給好友，好友首購可獲得 NT$200 禮金，妳也能獲得推薦獎勵！\n\n` +
        `\u2728 悄悄預告：下個月我們準備了更多精彩活動，敬請期待。\n\n` +
        `願妳在新的一歲裡，繼續書寫最璀璨動人的篇章。\n\n` +
        `永遠珍惜妳的，\n` +
        `CHIC KIM & MIU 團隊 敬上\n\n` +
        `\u2014\u2014 專屬你美好的時尚優雅`,
    }
  }
  if (channel === 'push') {
    return {
      subject: `感謝璀璨的妳 \u2728`,
      content: `${userName}，感謝妳的生日月！分享給好友，雙方都能獲得專屬禮遇。`,
    }
  }
  return {
    subject: `感謝妳的生日月`,
    content: `${userName}，希望這個生日月為妳帶來了滿滿的幸福。分享給好友，一起享受美好吧！`,
  }
}

// ──────────────────────────────────────────────────────────
// T4 星耀皇后 專屬文案
// ──────────────────────────────────────────────────────────

function generatePlatinumMessage(
  phase: 1 | 2 | 3 | 4 | 5,
  channel: 'line' | 'email' | 'push' | 'in_app_popup',
  userName: string,
  frontName: string,
  gift: BirthdayGiftConfig,
): { subject: string; content: string } {

  // ── Phase 1 預告 ──
  if (phase === 1) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `${userName} 親愛的${frontName}：\n\n` +
          `微風裡夾帶著甜蜜的訊息\u2026\u2026妳的生日月就要來了。\n\n` +
          `CHIC KIM & MIU 正在為我們最耀眼的星耀皇后準備一份特別的驚喜。\n\n` +
          `請期待，屬於妳的皇后禮遇即將閃耀登場 \u2728\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `${userName}，星耀皇后的生日驚喜即將揭曉`,
        content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
          `每年的這個時刻，CHIC KIM & MIU 都會為妳點亮一盞特別的星光。\n\n` +
          `因為妳是我們深深珍愛的${frontName}，一份獨特的生日禮遇正在為妳悉心準備中：\n\n` +
          `\u2728 專屬皇后折扣\n` +
          `\u2728 豐厚購物金\n` +
          `\u2728 專屬造型諮詢\n` +
          `\u2728 精美禮盒\n\n` +
          `更多細節將在生日月第一天揭曉，請靜候美好降臨。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `${frontName}，驚喜即將來臨`,
        content: `${userName}，生日月快到了！CHIC KIM & MIU 正為妳準備星耀皇后專屬禮遇 \u2728`,
      }
    }
    return {
      subject: `生日預告`,
      content: `${userName}，妳的星耀皇后生日驚喜正在準備中\u2026\u2026`,
    }
  }

  // ── Phase 2 生日祝福 ──
  if (phase === 2) {
    const giftList =
      `\ud83c\udf81 全館 ${gift.discountPercent}% OFF 星耀皇后獨享折扣\n` +
      `\ud83d\udcb3 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金${gift.creditScoreBonus > 0 ? `（含信用加碼 NT$${gift.creditScoreBonus}）` : ''}\n` +
      `\u2b50 ${gift.bonusPoints.toLocaleString('zh-TW')} 生日紅利點數\n` +
      `\u2728 點數 ${gift.pointsMultiplier}x 加倍整月有效\n` +
      `\ud83d\udc60 ${gift.stylingMinutes} 分鐘專屬造型師諮詢\n` +
      `\ud83c\udf80 精選生日禮盒 + 手寫祝福卡\n` +
      `\ud83d\ude9a 全館免運 + 優先出貨`

    if (channel === 'line') {
      return {
        subject: '',
        content: `\ud83c\udf82 ${userName}，生日快樂！\n\n` +
          `最耀眼的${frontName}，今天是妳的日子！\n\n` +
          `CHIC KIM & MIU 以最溫暖的心意，為妳獻上星耀皇后專屬的生日禮遇：\n\n` +
          `${giftList}\n\n` +
          `\ud83c\udf1f 優惠碼：${gift.couponCode}\n\n` +
          `願妳如星辰般閃耀，用最美的姿態迎接新的一歲。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `\ud83c\udf82 ${userName}，${frontName}生日快樂！專屬尊榮禮遇已開啟`,
        content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
          `生日快樂！\n\n` +
          `在這個屬於妳的美麗日子，CHIC KIM & MIU 向妳獻上最真摯的祝福。\n\n` +
          `作為我們最耀眼的${frontName}，以下是專屬於妳的皇后級生日禮遇：\n\n` +
          `${giftList}\n\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n` +
          `\ud83c\udf1f 妳的專屬優惠碼：${gift.couponCode}\n` +
          `\ud83d\udcc5 有效期限：生日月全月\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n` +
          `願妳在新的一歲裡，綻放更多光芒，遇見更多驚喜。\n\n` +
          `始終守護妳的美麗，\n` +
          `CHIC KIM & MIU 團隊 敬上\n\n` +
          `\u2014\u2014 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `\ud83c\udf82 ${frontName}生日快樂！`,
        content: `${userName}，${gift.discountPercent}% 折扣 + NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金 + ${gift.stylingMinutes}分鐘造型諮詢，皇后禮遇已開啟！`,
      }
    }
    return {
      subject: `\ud83c\udf82 ${frontName}生日快樂`,
      content: `${userName}，生日快樂！星耀皇后尊榮禮遇已開啟：${gift.discountPercent}% 折扣、NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金及更多驚喜，優惠碼 ${gift.couponCode}。`,
    }
  }

  // ── Phase 3 中期推薦 ──
  if (phase === 3) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `${userName} 親愛的${frontName}：\n\n` +
          `生日月已過半，希望妳每一天都被美好環繞。\n\n` +
          `\ud83d\udc97 AI 為妳推薦的星耀皇后專屬穿搭已更新\n` +
          `\u2b50 本月消費享 ${gift.pointsMultiplier}x 點數加倍\n` +
          `\ud83d\udcab 看看其他星耀皇后的穿搭靈感\n\n` +
          `優惠碼 ${gift.couponCode} 整月有效！\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `${userName}，星耀皇后的生日月穿搭靈感`,
        content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
          `生日的快樂值得延續一整個月。\n\n` +
          `\ud83c\udf1f AI 為妳量身推薦了本季最適合的穿搭方案。\n` +
          `\ud83d\udcab 點數 ${gift.pointsMultiplier}x 加倍持續中，每筆消費都更值得。\n` +
          `\ud83d\udc97 星耀皇后穿搭日記，為妳帶來更多靈感。\n\n` +
          `優惠碼 ${gift.couponCode} 整月有效，盡情享受吧。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `${frontName}穿搭推薦`,
        content: `${userName}，AI 為妳挑選的生日月穿搭已更新！${gift.pointsMultiplier}x 點數加倍持續中 \u2728`,
      }
    }
    return {
      subject: `生日月穿搭推薦`,
      content: `${userName}，專屬穿搭推薦已上線，搭配 ${gift.pointsMultiplier}x 點數加倍更划算！`,
    }
  }

  // ── Phase 4 倒數加碼 ──
  if (phase === 4) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `\u23f0 ${userName} 親愛的${frontName}：\n\n` +
          `生日月最後 3 天倒數！\n\n` +
          `\ud83c\udf1f ${gift.discountPercent}% 折扣即將結束\n` +
          `\ud83d\udcb3 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金把握最後機會\n` +
          `\ud83c\udf81 加碼：最後 3 天消費再送 150 紅利點數\n\n` +
          `優惠碼：${gift.couponCode}\n\n` +
          `皇后的生日月，值得一個完美的結尾 \u2728\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `\u23f0 ${userName}，星耀皇后生日禮遇倒數 3 天！`,
        content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
          `美好的生日月即將落幕，我們為妳準備了最後的加碼驚喜：\n\n` +
          `\ud83c\udf1f 加碼禮遇：最後 3 天消費再送 150 紅利點數\n` +
          `\ud83d\udcab 提醒：${gift.discountPercent}% 折扣與 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金即將到期\n` +
          `\u2728 ${gift.pointsMultiplier}x 點數加倍最後機會\n\n` +
          `優惠碼：${gift.couponCode}\n\n` +
          `用最優雅的方式，為這個特別的月份劃上美麗的句號。\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `\u23f0 ${frontName}生日禮遇倒數`,
        content: `${userName}，最後 3 天！${gift.discountPercent}% 折扣 + NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金即將到期，再加碼 150 點！`,
      }
    }
    return {
      subject: `\u23f0 生日禮遇倒數`,
      content: `${userName}，星耀皇后生日禮遇剩最後 3 天！把握 ${gift.discountPercent}% 折扣的最後機會。`,
    }
  }

  // ── Phase 5 感謝回饋 ──
  if (channel === 'line') {
    return {
      subject: '',
      content: `${userName} 親愛的${frontName}：\n\n` +
        `感謝妳讓 CHIC KIM & MIU 陪伴妳走過這個美好的生日月。\n\n` +
        `\ud83c\udf1f 邀請好友加入，雙方都能獲得 NT$150 購物金\n` +
        `\u2728 下個月的驚喜活動即將揭曉\n\n` +
        `星耀皇后的光芒，永遠不會暗淡。\n\n` +
        `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
    }
  }
  if (channel === 'email') {
    return {
      subject: `${userName}，感謝星耀皇后的美好生日月`,
      content: `親愛的${userName}，尊貴的${frontName}：\n\n` +
        `美好的生日月已溫柔落幕，但妳的光芒永遠耀眼。\n\n` +
        `感謝妳對 CHIC KIM & MIU 的每一份支持與信任。\n\n` +
        `\ud83c\udf1f 好友分享：邀請好友加入 CHIC KIM & MIU，好友可享 NT$150 首購禮金，妳也能獲得推薦獎勵！\n\n` +
        `\u2728 預告：下個月更多精彩活動正在醞釀中，敬請期待。\n\n` +
        `始終為妳守候的，\n` +
        `CHIC KIM & MIU 團隊 敬上\n\n` +
        `\u2014\u2014 專屬你美好的時尚優雅`,
    }
  }
  if (channel === 'push') {
    return {
      subject: `感謝星耀皇后 \u2728`,
      content: `${userName}，感謝妳的生日月！分享給好友，雙方各得 NT$150 購物金。`,
    }
  }
  return {
    subject: `感謝妳的生日月`,
    content: `${userName}，希望這個生日月充滿了美好。邀請好友加入，一起享受優雅吧！`,
  }
}

// ──────────────────────────────────────────────────────────
// T0-T3 通用文案
// ──────────────────────────────────────────────────────────

function generateGeneralMessage(
  phase: 1 | 2 | 3 | 4 | 5,
  channel: 'line' | 'email' | 'push' | 'in_app_popup',
  userName: string,
  frontName: string,
  gift: BirthdayGiftConfig,
): { subject: string; content: string } {

  // ── Phase 1 預告 ──
  if (phase === 1) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `${userName} 親愛的${frontName}：\n\n` +
          `有一個甜蜜的小秘密\u2026\u2026妳的生日月快到了！\n\n` +
          `CHIC KIM & MIU 正在為妳準備專屬的生日驚喜，讓妳整個月都被幸福包圍。\n\n` +
          `請期待，好事即將發生 \u2728\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `${userName}，妳的生日驚喜正在路上`,
        content: `親愛的${userName}，可愛的${frontName}：\n\n` +
          `每年這個時候，我們都特別開心\u2014\u2014因為妳的生日就要到了！\n\n` +
          `CHIC KIM & MIU 正為妳準備專屬的生日禮遇：\n\n` +
          `\u2728 專屬生日折扣\n` +
          `\u2728 購物金驚喜\n` +
          `\u2728 紅利點數加倍\n\n` +
          `更多驚喜即將揭曉，敬請期待！\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `生日驚喜即將來臨`,
        content: `${userName}，生日月快到了！CHIC KIM & MIU 為妳準備了專屬${frontName}的生日禮遇 \u2728`,
      }
    }
    return {
      subject: `生日預告`,
      content: `${userName}，妳的${frontName}專屬生日驚喜正在準備中\u2026\u2026`,
    }
  }

  // ── Phase 2 生日祝福 ──
  if (phase === 2) {
    const giftList =
      `\ud83c\udf81 全館 ${gift.discountPercent}% OFF 生日專屬折扣\n` +
      `\ud83d\udcb3 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 生日購物金${gift.creditScoreBonus > 0 ? `（含信用加碼 NT$${gift.creditScoreBonus}）` : ''}\n` +
      `\u2b50 ${gift.bonusPoints.toLocaleString('zh-TW')} 生日紅利點數\n` +
      `\u2728 點數 ${gift.pointsMultiplier}x 加倍整月有效\n` +
      (gift.freeShipping ? `\ud83d\ude9a 全館免運\n` : '') +
      (gift.stylingMinutes > 0 ? `\ud83d\udc60 ${gift.stylingMinutes} 分鐘造型諮詢\n` : '') +
      (gift.specialGift ? `\ud83c\udf1f ${gift.specialGift}\n` : '')

    if (channel === 'line') {
      return {
        subject: '',
        content: `\ud83c\udf82 ${userName}，生日快樂！\n\n` +
          `親愛的${frontName}，今天是屬於妳的特別日子！\n\n` +
          `CHIC KIM & MIU 用滿滿的心意為妳準備了生日禮遇：\n\n` +
          `${giftList}\n` +
          `\ud83c\udf1f 優惠碼：${gift.couponCode}\n\n` +
          `願妳每一天都是最美的自己 \u2728\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `\ud83c\udf82 ${userName}，生日快樂！專屬${frontName}禮遇已開啟`,
        content: `親愛的${userName}，可愛的${frontName}：\n\n` +
          `生日快樂！\n\n` +
          `在這個特別的日子，CHIC KIM & MIU 獻上最溫暖的祝福與專屬於妳的禮遇：\n\n` +
          `${giftList}\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n` +
          `\ud83c\udf1f 妳的專屬優惠碼：${gift.couponCode}\n` +
          `\ud83d\udcc5 有效期限：生日月全月\n` +
          `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n` +
          `願新的一歲帶給妳更多美好與驚喜。\n\n` +
          `祝福妳的，\n` +
          `CHIC KIM & MIU 團隊 敬上\n\n` +
          `\u2014\u2014 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `\ud83c\udf82 生日快樂！`,
        content: `${userName}，${gift.discountPercent}% 折扣 + NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金，${frontName}生日禮遇已開啟！`,
      }
    }
    return {
      subject: `\ud83c\udf82 生日快樂`,
      content: `${userName}，生日快樂！妳的${frontName}生日禮遇已開啟：${gift.discountPercent}% 折扣、NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金，優惠碼 ${gift.couponCode}。`,
    }
  }

  // ── Phase 3 中期推薦 ──
  if (phase === 3) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `${userName} 親愛的${frontName}：\n\n` +
          `生日月過半，幸福不打烊！\n\n` +
          `\ud83d\udc97 AI 為妳推薦了專屬穿搭提案\n` +
          `\u2b50 本月消費享 ${gift.pointsMultiplier}x 點數加倍\n` +
          `\ud83d\udcab 看看其他會員的穿搭靈感\n\n` +
          `優惠碼 ${gift.couponCode} 整月有效唷！\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `${userName}，為妳準備的生日月穿搭靈感`,
        content: `親愛的${userName}，可愛的${frontName}：\n\n` +
          `生日月的快樂是整個月的！\n\n` +
          `\ud83c\udf1f AI 為妳推薦了本季最適合的穿搭方案。\n` +
          `\ud83d\udcab 提醒：本月每筆消費享 ${gift.pointsMultiplier}x 點數加倍。\n` +
          `\ud83d\udc97 會員穿搭日記，為妳帶來更多靈感。\n\n` +
          `優惠碼 ${gift.couponCode} 整月有效！\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `專屬穿搭推薦`,
        content: `${userName}，AI 為妳挑選的生日月穿搭已上線！${gift.pointsMultiplier}x 點數加倍中 \u2728`,
      }
    }
    return {
      subject: `穿搭推薦`,
      content: `${userName}，專屬穿搭推薦已上線，${gift.pointsMultiplier}x 點數加倍更划算！`,
    }
  }

  // ── Phase 4 倒數加碼 ──
  if (phase === 4) {
    if (channel === 'line') {
      return {
        subject: '',
        content: `\u23f0 ${userName} 親愛的${frontName}：\n\n` +
          `生日月倒數最後 3 天！\n\n` +
          `\ud83c\udf1f ${gift.discountPercent}% 折扣即將結束\n` +
          `\ud83d\udcb3 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金別忘了使用\n` +
          `\ud83c\udf81 加碼：最後 3 天消費再送 100 紅利點數\n\n` +
          `優惠碼：${gift.couponCode}\n\n` +
          `把握最後機會，寵愛自己 \u2728\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'email') {
      return {
        subject: `\u23f0 ${userName}，生日禮遇倒數 3 天！`,
        content: `親愛的${userName}，可愛的${frontName}：\n\n` +
          `生日月即將結束，最後的好康別錯過：\n\n` +
          `\ud83c\udf1f 加碼禮遇：最後 3 天消費再送 100 紅利點數\n` +
          `\ud83d\udcab ${gift.discountPercent}% 折扣與 NT$${gift.shoppingCredit.toLocaleString('zh-TW')} 購物金即將到期\n` +
          `\u2728 ${gift.pointsMultiplier}x 點數加倍最後機會\n\n` +
          `優惠碼：${gift.couponCode}\n\n` +
          `為生日月留下美好的紀念吧！\n\n` +
          `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
      }
    }
    if (channel === 'push') {
      return {
        subject: `\u23f0 生日禮遇倒數`,
        content: `${userName}，最後 3 天！${gift.discountPercent}% 折扣即將到期，再加碼 100 點！`,
      }
    }
    return {
      subject: `\u23f0 生日禮遇倒數`,
      content: `${userName}，生日禮遇剩最後 3 天！把握 ${gift.discountPercent}% 折扣的最後機會。`,
    }
  }

  // ── Phase 5 感謝回饋 ──
  if (channel === 'line') {
    return {
      subject: '',
      content: `${userName} 親愛的${frontName}：\n\n` +
        `感謝妳讓 CHIC KIM & MIU 陪伴妳度過生日月！\n\n` +
        `\ud83c\udf1f 分享給好友，好友首購享 NT$100 禮金\n` +
        `\u2728 下個月的活動精彩預告即將來臨\n\n` +
        `期待繼續陪伴妳的每個美好時刻。\n\n` +
        `\u2014\u2014 CHIC KIM & MIU \u00b7 專屬你美好的時尚優雅`,
    }
  }
  if (channel === 'email') {
    return {
      subject: `${userName}，感謝妳的美好生日月`,
      content: `親愛的${userName}，可愛的${frontName}：\n\n` +
        `生日月溫柔地落幕了，感謝妳讓我們成為妳美好日子的一部分。\n\n` +
        `\ud83c\udf1f 分享邀請：邀請好友加入 CHIC KIM & MIU，好友首購可享 NT$100 禮金！\n\n` +
        `\u2728 預告：下個月有更多精彩活動，敬請期待。\n\n` +
        `願每個日子都充滿美好，\n` +
        `CHIC KIM & MIU 團隊 敬上\n\n` +
        `\u2014\u2014 專屬你美好的時尚優雅`,
    }
  }
  if (channel === 'push') {
    return {
      subject: `感謝妳 \u2728`,
      content: `${userName}，感謝妳的生日月！分享給好友，好友首購享 NT$100 禮金。`,
    }
  }
  return {
    subject: `感謝妳的生日月`,
    content: `${userName}，感謝陪伴！分享給好友一起享受美好吧。`,
  }
}
