/**
 * 行銷活動編排引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷活動核心執行邏輯
 *
 * 負責啟動活動、篩選目標受眾、多通道派發、A/B 測試整合、
 * 暫停 / 恢復 / 結束活動，以及產生成效報告。
 *
 * 所有執行紀錄寫入 marketing-execution-logs。
 *
 * ⚠️ 前台介面一律只顯示 TIER_FRONT_NAMES
 *    絕對不可出現 bronze / silver / gold 等金屬分級名稱
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { sendMessage } from './channelDispatcher'
import { generatePersonalizedContent } from './personalizedContent'
import { createABTest, assignVariant } from './abTestEngine'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

export interface CampaignContext {
  campaignId: string
  targetUsers: string[]
  channels: string[]
  personalizedContent: boolean
  abTestEnabled: boolean
}

/** 活動文件的通用型別（從 marketing-campaigns 讀取） */
interface CampaignDoc {
  id: string
  name: string
  status: string
  channels: string[]
  targetSegments: string[]
  creditScoreFilter?: { minScore?: number; maxScore?: number }
  tierFilter?: string[]
  personalizedContent: boolean
  abTestEnabled: boolean
  abTestVariants?: Array<{
    variantName: string
    variantSlug: string
    templateId: string
    percentage: number
  }>
  abTestWinnerMetric?: string
  templateId?: string
  scheduledAt?: string
  splitRatio?: number[]
  maxSendsPerUser?: number
}

// ══════════════════════════════════════════════════════════
// Helper — 載入活動設定
// ══════════════════════════════════════════════════════════

/**
 * 從 marketing-campaigns 載入活動設定
 *
 * @param campaignId - 活動 ID
 * @returns 活動文件
 */
async function loadCampaign(campaignId: string): Promise<CampaignDoc> {
  const payload = await getPayload({ config })
  const doc = await payload.findByID({ collection: 'marketing-campaigns', id: campaignId })
  return doc as unknown as CampaignDoc
}

// ══════════════════════════════════════════════════════════
// Core — 啟動行銷活動
// ══════════════════════════════════════════════════════════

/**
 * 啟動行銷活動 — 載入活動設定，篩選目標受眾，派發訊息
 *
 * 流程：
 * 1. 載入活動設定
 * 2. 篩選目標受眾（客群 + 信用分數 + 等級）
 * 3. 若啟用 A/B 測試，建立測試記錄並依比例分組
 * 4. 逐一為目標會員執行活動步驟
 * 5. 回傳發送統計
 *
 * @param campaignId - 活動 ID
 * @returns 發送成功 / 失敗數量，以及 A/B 測試 ID（若有）
 */
export async function launchCampaign(
  campaignId: string,
): Promise<{ sent: number; failed: number; abTestId?: string }> {
  const payload = await getPayload({ config })
  const campaign = await loadCampaign(campaignId)

  // 更新活動狀態為進行中
  await (payload.update as Function)({
    collection: 'marketing-campaigns',
    id: campaignId,
    data: { status: 'active' } as unknown as Record<string, unknown>,
  })

  console.log(`[Marketing] 啟動活動: ${campaign.name} (${campaignId})`)

  // 篩選目標受眾
  const targetUsers = await filterTargetAudience(campaignId)
  console.log(`[Marketing] 篩選到 ${targetUsers.length} 位目標會員`)

  if (targetUsers.length === 0) {
    console.log('[Marketing] 無目標會員，活動結束')
    await (payload.update as Function)({
      collection: 'marketing-campaigns',
      id: campaignId,
      data: { status: 'completed' } as unknown as Record<string, unknown>,
    })
    return { sent: 0, failed: 0 }
  }

  // 建立 A/B 測試（若啟用）
  let abTestId: string | undefined
  if (campaign.abTestEnabled && campaign.abTestVariants && campaign.abTestVariants.length > 0) {
    try {
      abTestId = await createABTest(
        campaignId,
        campaign.abTestVariants,
        campaign.abTestWinnerMetric ?? 'clickRate',
      )
      console.log(`[Marketing] A/B 測試已建立: ${abTestId}`)
    } catch (error) {
      console.error('[Marketing] A/B 測試建立失敗:', error)
    }
  }

  // 逐一執行
  let sent = 0
  let failed = 0

  for (const userId of targetUsers) {
    try {
      // 決定 A/B 變體
      let abVariant: string | undefined
      if (abTestId && campaign.abTestVariants && campaign.abTestVariants.length > 0) {
        const variantDefs = campaign.abTestVariants.map((v) => ({
          variantSlug: v.variantSlug,
          percentage: v.percentage,
        }))
        abVariant = assignVariant(userId, variantDefs)
      }

      const success = await executeCampaignForUser(campaignId, userId, abVariant)
      if (success) {
        sent++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`[Marketing] 會員 ${userId} 活動執行失敗:`, error)
      failed++
    }
  }

  console.log(`[Marketing] 活動 ${campaign.name} 發送完成: 成功=${sent}, 失敗=${failed}`)

  return { sent, failed, abTestId }
}

// ══════════════════════════════════════════════════════════
// Core — 篩選目標受眾
// ══════════════════════════════════════════════════════════

/**
 * 根據活動設定篩選目標會員（客群 + 信用分數 + 等級）
 *
 * 邏輯：
 * 1. 從 member-segments 查詢 targetSegments 中的會員
 * 2. 再依 creditScoreFilter 和 tierFilter 進一步過濾 users
 *
 * @param campaignId - 活動 ID
 * @returns 符合條件的會員 ID 陣列
 */
export async function filterTargetAudience(campaignId: string): Promise<string[]> {
  const payload = await getPayload({ config })
  const campaign = await loadCampaign(campaignId)

  // 第一步：從 member-segments 撈出目標客群的會員
  const segmentWhere: Where = {
    currentSegment: { in: campaign.targetSegments },
  }

  const segmentResults = await payload.find({
    collection: 'member-segments',
    where: segmentWhere satisfies Where,
    limit: 10000,
  })

  // 擷取 userId
  const candidateUserIds: string[] = segmentResults.docs.map((doc) => {
    const d = doc as unknown as Record<string, unknown>
    const userId = d.user
    if (typeof userId === 'string') return userId
    if (typeof userId === 'object' && userId !== null && 'id' in userId) {
      return String((userId as { id: unknown }).id)
    }
    return String(userId)
  })

  if (candidateUserIds.length === 0) return []

  // 第二步：從 users 過濾信用分數 + 等級
  const userWhere: Where = {
    id: { in: candidateUserIds },
  }

  // 信用分數篩選
  if (campaign.creditScoreFilter) {
    if (typeof campaign.creditScoreFilter.minScore === 'number') {
      userWhere['creditScore'] = {
        ...(userWhere['creditScore'] as unknown as Record<string, unknown> ?? {}),
        greater_than_equal: campaign.creditScoreFilter.minScore,
      }
    }
    if (typeof campaign.creditScoreFilter.maxScore === 'number') {
      userWhere['creditScore'] = {
        ...(userWhere['creditScore'] as unknown as Record<string, unknown> ?? {}),
        less_than_equal: campaign.creditScoreFilter.maxScore,
      }
    }
  }

  // 等級篩選
  if (campaign.tierFilter && campaign.tierFilter.length > 0) {
    userWhere['tier'] = { in: campaign.tierFilter }
  }

  const usersResult = await payload.find({
    collection: 'users',
    where: userWhere satisfies Where,
    limit: 10000,
  })

  return usersResult.docs.map((u) => {
    const id = (u as unknown as Record<string, unknown>).id
    return typeof id === 'string' ? id : String(id)
  })
}

// ══════════════════════════════════════════════════════════
// Core — 為單一會員執行活動
// ══════════════════════════════════════════════════════════

/**
 * 為每位會員執行活動步驟（多通道發送）
 *
 * 1. 若啟用個人化內容，使用 personalizedContent 模組產生內容
 * 2. 依 channels 設定逐一發送
 * 3. 建立 marketing-execution-logs 紀錄
 *
 * @param campaignId - 活動 ID
 * @param userId - 會員 ID
 * @param abVariant - A/B 測試變體代碼（可選）
 * @returns 是否全部通道發送成功
 */
export async function executeCampaignForUser(
  campaignId: string,
  userId: string,
  abVariant?: string,
): Promise<boolean> {
  const payload = await getPayload({ config })
  const campaign = await loadCampaign(campaignId)

  // 決定使用的模板 ID
  let templateId = campaign.templateId ?? ''
  if (abVariant && campaign.abTestVariants) {
    const variant = campaign.abTestVariants.find((v) => v.variantSlug === abVariant)
    if (variant) {
      templateId = variant.templateId
    }
  }

  // 產生內容
  let subject = ''
  let body = ''
  let htmlBody = ''

  if (campaign.personalizedContent && templateId) {
    try {
      const personalized = await generatePersonalizedContent(templateId, userId)
      subject = personalized.subject
      body = personalized.content
      htmlBody = personalized.content
    } catch (error) {
      console.error(`[Marketing] 個人化內容產生失敗 (user: ${userId}):`, error)
      body = '感謝您的支持！'
      subject = '來自 CHIC KIM & MIU 的訊息'
    }
  } else {
    // 非個人化：直接從模板載入
    if (templateId) {
      try {
        const template = await payload.findByID({
          collection: 'message-templates',
          id: templateId,
        })
        const tpl = template as unknown as Record<string, unknown>
        subject = typeof tpl.subject === 'string' ? tpl.subject : ''
        body = typeof tpl.content === 'string' ? tpl.content : ''
        htmlBody = typeof tpl.htmlContent === 'string' ? tpl.htmlContent : body
      } catch {
        console.error(`[Marketing] 模板載入失敗: ${templateId}`)
      }
    }
  }

  // 多通道發送
  let allSuccess = true
  const channels = campaign.channels ?? []

  for (const channel of channels) {
    try {
      const result = await sendMessage(
        userId,
        channel as 'line' | 'email' | 'sms' | 'push' | 'in_app_popup' | 'edm',
        { subject, body, htmlBody },
        campaignId,
      )

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
          abVariant: abVariant ?? '',
          sentAt: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      })

      if (!result.success) {
        allSuccess = false
        console.error(`[Marketing] 通道 ${channel} 發送失敗 (user: ${userId}): ${result.error}`)
      }
    } catch (error) {
      allSuccess = false
      console.error(`[Marketing] 通道 ${channel} 執行錯誤 (user: ${userId}):`, error)

      // 即使失敗也記錄
      await (payload.create as Function)({
        collection: 'marketing-execution-logs',
        data: {
          campaign: campaignId,
          user: userId,
          channel,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          abVariant: abVariant ?? '',
          sentAt: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      })
    }
  }

  return allSuccess
}

// ══════════════════════════════════════════════════════════
// Core — 暫停活動
// ══════════════════════════════════════════════════════════

/**
 * 暫停活動
 *
 * 將活動狀態設為 paused，後續的排程發送將被暫停。
 *
 * @param campaignId - 活動 ID
 */
export async function pauseCampaign(campaignId: string): Promise<void> {
  const payload = await getPayload({ config })

  await (payload.update as Function)({
    collection: 'marketing-campaigns',
    id: campaignId,
    data: { status: 'paused' } as unknown as Record<string, unknown>,
  })

  console.log(`[Marketing] 活動已暫停: ${campaignId}`)
}

// ══════════════════════════════════════════════════════════
// Core — 恢復活動
// ══════════════════════════════════════════════════════════

/**
 * 恢復活動
 *
 * 將活動狀態設為 active，恢復排程發送。
 *
 * @param campaignId - 活動 ID
 */
export async function resumeCampaign(campaignId: string): Promise<void> {
  const payload = await getPayload({ config })

  await (payload.update as Function)({
    collection: 'marketing-campaigns',
    id: campaignId,
    data: { status: 'active' } as unknown as Record<string, unknown>,
  })

  console.log(`[Marketing] 活動已恢復: ${campaignId}`)
}

// ══════════════════════════════════════════════════════════
// Core — 結束活動並產生成效報告
// ══════════════════════════════════════════════════════════

/**
 * 結束活動並產生成效報告
 *
 * 統計各通道的發送成功率、開信率、點擊率等指標，
 * 並將活動狀態設為 completed。
 *
 * @param campaignId - 活動 ID
 * @returns 報告摘要
 */
export async function completeCampaign(
  campaignId: string,
): Promise<{ summary: Record<string, unknown> }> {
  const payload = await getPayload({ config })

  // 取得所有執行紀錄
  const logsQuery: Where = { campaign: { equals: campaignId } }
  const logsResult = await payload.find({
    collection: 'marketing-execution-logs',
    where: logsQuery satisfies Where,
    limit: 10000,
  })

  const logs = logsResult.docs as unknown as Array<Record<string, unknown>>

  // 統計各通道
  const channelStats: Record<string, { sent: number; failed: number; total: number }> = {}
  let totalSent = 0
  let totalFailed = 0

  for (const log of logs) {
    const channel = typeof log.channel === 'string' ? log.channel : 'unknown'
    const status = typeof log.status === 'string' ? log.status : 'unknown'

    if (!channelStats[channel]) {
      channelStats[channel] = { sent: 0, failed: 0, total: 0 }
    }
    channelStats[channel].total++

    if (status === 'sent') {
      channelStats[channel].sent++
      totalSent++
    } else {
      channelStats[channel].failed++
      totalFailed++
    }
  }

  // 計算成功率
  const totalLogs = logs.length
  const successRate = totalLogs > 0 ? Math.round((totalSent / totalLogs) * 100) : 0

  // 統計不重複會員數
  const uniqueUsers = new Set(logs.map((l) => String(l.user))).size

  const summary: Record<string, unknown> = {
    campaignId,
    totalMessages: totalLogs,
    totalSent,
    totalFailed,
    successRate,
    uniqueUsers,
    channelStats,
    completedAt: new Date().toISOString(),
  }

  // 更新活動狀態
  await (payload.update as Function)({
    collection: 'marketing-campaigns',
    id: campaignId,
    data: {
      status: 'completed',
      summary,
    } as unknown as Record<string, unknown>,
  })

  console.log(`[Marketing] 活動已結束: ${campaignId}，成功率 ${successRate}%`)

  return { summary }
}
