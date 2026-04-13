/**
 * 自動化旅程執行引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷自動化核心邏輯
 *
 * 負責觸發旅程、執行步驟、管理冷卻與次數限制。
 * 步驟動作包含：發送 LINE、Email、SMS、等待、條件檢查、
 * 新增/移除標籤、更新欄位、發送優惠券。
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

// ── Types ──────────────────────────────────────────────

export interface JourneyStep {
  stepOrder: number
  action:
    | 'send_line'
    | 'send_email'
    | 'send_sms'
    | 'wait'
    | 'condition_check'
    | 'add_tag'
    | 'remove_tag'
    | 'update_field'
    | 'assign_coupon'
  delayMinutes: number
  templateKey: string
  content: string
}

export interface JourneyTriggerContext {
  userId: string
  event: string
  data: Record<string, unknown>
}

interface JourneyDoc {
  id: string
  slug: string
  name: string
  isActive: boolean
  steps: JourneyStep[]
  maxExecutionsPerUser?: number
  cooldownHours?: number
  conditions?: Record<string, unknown>
}

// ── Core Functions ─────────────────────────────────────

/**
 * 觸發自動化旅程
 *
 * 依據 journeySlug 查找旅程定義，檢查冷卻與次數限制後，
 * 建立執行紀錄並依序執行步驟。
 *
 * @param journeySlug - 旅程的唯一識別碼
 * @param context - 觸發上下文（userId、event、附加資料）
 */
export async function triggerJourney(
  journeySlug: string,
  context: JourneyTriggerContext,
): Promise<void> {
  const payload = await getPayload({ config })

  // 查找旅程定義
  const journeyResult = await payload.find({
    collection: 'automation-journeys',
    where: { slug: { equals: journeySlug } } satisfies Where,
    limit: 1,
  })

  if (journeyResult.docs.length === 0) {
    console.warn(`[AutomationEngine] 找不到旅程: ${journeySlug}`)
    return
  }

  const journey = journeyResult.docs[0] as unknown as JourneyDoc

  if (!journey.isActive) {
    console.log(`[AutomationEngine] 旅程已停用: ${journeySlug}`)
    return
  }

  // 檢查是否應該觸發
  const canFire = await shouldFireJourney(journeySlug, context.userId)
  if (!canFire) {
    console.log(`[AutomationEngine] 旅程冷卻中或已達上限: ${journeySlug} (user: ${context.userId})`)
    return
  }

  // 建立執行紀錄
  const log = await (payload.create as Function)({
    collection: 'automation-logs',
    data: {
      journey: journey.id,
      user: context.userId,
      status: 'triggered',
      currentStep: 0,
      executedSteps: [],
      triggerData: context.data,
    },
  })

  const logId = log.id as unknown as string

  // 排序步驟
  const steps = [...(journey.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder)

  // 依序執行步驟
  const executedSteps: Array<{ stepOrder: number; action: string; success: boolean; executedAt: string }> = []

  try {
    await (payload.update as Function)({
      collection: 'automation-logs',
      id: logId,
      data: { status: 'in_progress' },
    })

    for (const step of steps) {
      const success = await executeStep(step, context.userId, context.data)

      executedSteps.push({
        stepOrder: step.stepOrder,
        action: step.action,
        success,
        executedAt: new Date().toISOString(),
      })

      await (payload.update as Function)({
        collection: 'automation-logs',
        id: logId,
        data: {
          currentStep: step.stepOrder,
          executedSteps,
        },
      })

      if (!success) {
        console.warn(`[AutomationEngine] 步驟執行失敗: ${journeySlug} step ${step.stepOrder}`)
      }
    }

    // 完成
    await (payload.update as Function)({
      collection: 'automation-logs',
      id: logId,
      data: {
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
    })

    console.log(`[AutomationEngine] 旅程完成: ${journeySlug} (user: ${context.userId})`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await (payload.update as Function)({
      collection: 'automation-logs',
      id: logId,
      data: {
        status: 'failed',
        error: errorMessage,
      },
    })
    console.error(`[AutomationEngine] 旅程執行錯誤: ${journeySlug}`, error)
  }
}

/**
 * 執行單一旅程步驟
 *
 * 根據 action 類型分派至對應的處理邏輯。
 * 目前為佔位實作，待整合實際的 LINE Messaging API、
 * Email Service、SMS Gateway 後替換。
 *
 * @param step - 步驟定義
 * @param userId - 目標會員 ID
 * @param context - 觸發時的附加資料
 * @returns 是否成功
 */
export async function executeStep(
  step: JourneyStep,
  userId: string,
  context: Record<string, unknown>,
): Promise<boolean> {
  try {
    switch (step.action) {
      case 'send_line': {
        // TODO: 整合 LINE Messaging API
        console.log(`[AutomationEngine] LINE 訊息 → ${userId}: ${step.content.substring(0, 50)}...`)
        return true
      }

      case 'send_email': {
        // TODO: 整合 Email Service (Resend / SES)
        console.log(`[AutomationEngine] Email → ${userId}: template=${step.templateKey}`)
        return true
      }

      case 'send_sms': {
        // TODO: 整合 SMS Gateway
        console.log(`[AutomationEngine] SMS → ${userId}: ${step.content.substring(0, 30)}...`)
        return true
      }

      case 'wait': {
        // 等待步驟：在生產環境中由排程器處理延遲
        console.log(`[AutomationEngine] 等待 ${step.delayMinutes} 分鐘`)
        return true
      }

      case 'condition_check': {
        // 條件檢查：依據 templateKey 中定義的條件判斷
        console.log(`[AutomationEngine] 條件檢查: ${step.templateKey}`)
        return true
      }

      case 'add_tag': {
        const payload = await getPayload({ config })
        // TODO: 當 Users 支援 tags 欄位後實作
        console.log(`[AutomationEngine] 新增標籤: ${step.content} → ${userId}`)
        return true
      }

      case 'remove_tag': {
        const payload = await getPayload({ config })
        // TODO: 當 Users 支援 tags 欄位後實作
        console.log(`[AutomationEngine] 移除標籤: ${step.content} → ${userId}`)
        return true
      }

      case 'update_field': {
        const payload = await getPayload({ config })
        try {
          const fieldData = JSON.parse(step.content) as unknown as Record<string, unknown>
          await (payload.update as Function)({
            collection: 'users',
            id: userId,
            data: fieldData,
          })
          return true
        } catch {
          console.error(`[AutomationEngine] update_field 內容格式錯誤: ${step.content}`)
          return false
        }
      }

      case 'assign_coupon': {
        // TODO: 整合 Coupon 系統
        console.log(`[AutomationEngine] 發送優惠券: ${step.templateKey} → ${userId}`)
        return true
      }

      default: {
        console.warn(`[AutomationEngine] 未知的步驟動作: ${step.action}`)
        return false
      }
    }
  } catch (error) {
    console.error(`[AutomationEngine] 步驟執行失敗:`, error)
    return false
  }
}

/**
 * 檢查旅程是否應該觸發
 *
 * 驗證條件：
 * 1. 冷卻時間是否已過
 * 2. 是否已達最大執行次數
 *
 * @param journeySlug - 旅程識別碼
 * @param userId - 會員 ID
 * @returns 是否可以觸發
 */
export async function shouldFireJourney(
  journeySlug: string,
  userId: string,
): Promise<boolean> {
  const payload = await getPayload({ config })

  // 查找旅程定義
  const journeyResult = await payload.find({
    collection: 'automation-journeys',
    where: { slug: { equals: journeySlug } } satisfies Where,
    limit: 1,
  })

  if (journeyResult.docs.length === 0) return false

  const journey = journeyResult.docs[0] as unknown as JourneyDoc

  if (!journey.isActive) return false

  // 查找該用戶的歷史執行紀錄
  const logsResult = await payload.find({
    collection: 'automation-logs',
    where: {
      journey: { equals: journey.id },
      user: { equals: userId },
    } satisfies Where,
    sort: '-createdAt',
    limit: 1,
  })

  // 檢查最大執行次數
  if (journey.maxExecutionsPerUser && journey.maxExecutionsPerUser > 0) {
    const allLogsResult = await payload.find({
      collection: 'automation-logs',
      where: {
        journey: { equals: journey.id },
        user: { equals: userId },
        status: { in: ['completed', 'in_progress'] },
      } satisfies Where,
      limit: 0,
    })

    if (allLogsResult.totalDocs >= journey.maxExecutionsPerUser) {
      return false
    }
  }

  // 檢查冷卻時間
  if (journey.cooldownHours && journey.cooldownHours > 0 && logsResult.docs.length > 0) {
    const lastLog = logsResult.docs[0] as unknown as { createdAt: string }
    const lastExecution = new Date(lastLog.createdAt)
    const cooldownMs = journey.cooldownHours * 60 * 60 * 1000
    const now = new Date()

    if (now.getTime() - lastExecution.getTime() < cooldownMs) {
      return false
    }
  }

  return true
}
