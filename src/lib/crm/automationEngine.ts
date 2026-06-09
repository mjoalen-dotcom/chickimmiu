/**
 * 自動化旅程執行引擎
 * ─────────────────────────────────────
 * CHIC KIM & MIU 行銷自動化核心邏輯
 *
 * 負責觸發旅程、執行步驟、管理冷卻與次數限制、持久化等待（resumable）。
 * 步驟動作：發送 LINE / Email / SMS（待第三方憑證）、等待、條件檢查、
 *           新增/移除標籤、更新欄位、發送優惠券。
 *
 * 持久化等待：步驟的 delayMinutes > 0 時，引擎在「執行該步驟前」暫停，
 *   把 automation-logs.{status:'in_progress', currentStep, resumeAt} 寫好後 return；
 *   由 /api/cron/automations 的 resumeDueJourneys 在 resumeAt 到期後續跑。
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

interface ExecutedStep {
  stepOrder: number
  action: string
  success: boolean
  executedAt: string
  note?: string
}

// ── helpers ────────────────────────────────────────────

function refId(v: unknown): string | number | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'object') return (v as Record<string, unknown>).id as string | number | undefined
  return v as string | number
}

/** relationship create 需原型別 id（SQLite integer PK）；numeric string → number。 */
function toIdRef(id: string | number): string | number {
  if (typeof id === 'number') return id
  return /^\d+$/.test(id) ? Number(id) : id
}

function genCouponCode(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')
  return `AJ${ts}${rnd}`
}

// ── Core Functions ─────────────────────────────────────

/**
 * 觸發自動化旅程：查找定義、檢查冷卻/次數、建立 log、從第一步執行。
 */
export async function triggerJourney(
  journeySlug: string,
  context: JourneyTriggerContext,
): Promise<void> {
  const payload = await getPayload({ config })

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

  const canFire = await shouldFireJourney(journeySlug, context.userId)
  if (!canFire) {
    console.log(`[AutomationEngine] 旅程冷卻中或已達上限: ${journeySlug} (user: ${context.userId})`)
    return
  }

  const log = await (payload.create as Function)({
    collection: 'automation-logs',
    data: {
      journey: journey.id,
      // relationship create 需原型別 id（SQLite integer PK）；cron 傳入 String(id) 會驗證失敗
      user: toIdRef(context.userId),
      status: 'triggered',
      currentStep: 0,
      executedSteps: [],
      triggerData: context.data,
    },
  })

  const steps = [...(journey.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder)

  await runJourneyFromStep({
    payload,
    journeySlug,
    logId: log.id as unknown as string,
    userId: context.userId,
    data: context.data,
    steps,
    startIndex: 0,
    executedSteps: [],
    skipFirstDelay: false,
  })
}

/**
 * 從 startIndex 起跑旅程步驟。遇到 delayMinutes>0 的步驟「執行前」暫停（寫 resumeAt 後 return）；
 * condition_check 回 false 則提早結束旅程。skipFirstDelay=true 表示恢復執行時首步延遲已等過。
 */
async function runJourneyFromStep(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
  journeySlug: string
  logId: string
  userId: string
  data: Record<string, unknown>
  steps: JourneyStep[]
  startIndex: number
  executedSteps: ExecutedStep[]
  skipFirstDelay: boolean
}): Promise<void> {
  const { payload, journeySlug, logId, userId, data, steps, startIndex, executedSteps, skipFirstDelay } = args

  const updateLog = (d: Record<string, unknown>) =>
    (payload.update as Function)({ collection: 'automation-logs', id: logId, data: d })

  try {
    await updateLog({ status: 'in_progress' })

    for (let i = startIndex; i < steps.length; i++) {
      const step = steps[i]
      const isFirst = i === startIndex
      const delay = Number(step.delayMinutes) || 0

      // 「執行前」延遲 → 持久化暫停（resumeAt 到期後由 cron resumeDueJourneys 續跑此步）
      if (delay > 0 && !(isFirst && skipFirstDelay)) {
        const resumeAt = new Date(Date.now() + delay * 60_000).toISOString()
        await updateLog({
          status: 'in_progress',
          currentStep: step.stepOrder,
          resumeAt,
          executedSteps,
        })
        console.log(`[AutomationEngine] 旅程暫停 ${delay} 分鐘: ${journeySlug} step ${step.stepOrder}`)
        return
      }

      const success = await executeStep(step, userId, data)
      executedSteps.push({
        stepOrder: step.stepOrder,
        action: step.action,
        success,
        executedAt: new Date().toISOString(),
      })
      await updateLog({ currentStep: step.stepOrder, executedSteps, resumeAt: null })

      // 條件不成立 → 提早結束旅程（不跑後續步驟）
      if (step.action === 'condition_check' && !success) {
        await updateLog({
          status: 'completed',
          completedAt: new Date().toISOString(),
          resumeAt: null,
        })
        console.log(`[AutomationEngine] 條件不成立，旅程提早結束: ${journeySlug} step ${step.stepOrder}`)
        return
      }

      if (!success) {
        console.warn(`[AutomationEngine] 步驟執行失敗: ${journeySlug} step ${step.stepOrder}`)
      }
    }

    await updateLog({
      status: 'completed',
      completedAt: new Date().toISOString(),
      resumeAt: null,
    })
    console.log(`[AutomationEngine] 旅程完成: ${journeySlug} (user: ${userId})`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await updateLog({ status: 'failed', error: errorMessage, resumeAt: null })
    console.error(`[AutomationEngine] 旅程執行錯誤: ${journeySlug}`, error)
  }
}

/**
 * 續跑單一「等待中」的 log（resumeAt 已到期）。
 */
export async function resumeJourney(logDoc: Record<string, unknown>): Promise<void> {
  const payload = await getPayload({ config })

  const journeyId = refId(logDoc.journey)
  let journey: JourneyDoc | null = null
  if (journeyId !== undefined) {
    try {
      journey = (await payload.findByID({
        collection: 'automation-journeys',
        id: journeyId,
        depth: 0,
      })) as unknown as JourneyDoc
    } catch {
      journey = null
    }
  }

  const updateLog = (d: Record<string, unknown>) =>
    (payload.update as Function)({ collection: 'automation-logs', id: logDoc.id as string, data: d })

  if (!journey || !journey.isActive) {
    await updateLog({ status: 'failed', error: '旅程不存在或已停用', resumeAt: null })
    return
  }

  const steps = [...(journey.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder)
  const currentStep = Number(logDoc.currentStep) || 0
  // 恢復「暫停在的那一步」（同 stepOrder）；找不到則找下一個更大的
  let startIndex = steps.findIndex((s) => s.stepOrder === currentStep)
  if (startIndex === -1) startIndex = steps.findIndex((s) => s.stepOrder > currentStep)

  if (startIndex === -1) {
    await updateLog({ status: 'completed', completedAt: new Date().toISOString(), resumeAt: null })
    return
  }

  const userId = String(refId(logDoc.user) ?? '')
  const data = (logDoc.triggerData as Record<string, unknown>) || {}
  const executedSteps = Array.isArray(logDoc.executedSteps)
    ? (logDoc.executedSteps as ExecutedStep[])
    : []

  await runJourneyFromStep({
    payload,
    journeySlug: journey.slug,
    logId: logDoc.id as string,
    userId,
    data,
    steps,
    startIndex,
    executedSteps,
    skipFirstDelay: true, // 首步延遲已等過
  })
}

/**
 * 批次續跑所有到期的等待中旅程（由 /api/cron/automations 呼叫）。
 */
export async function resumeDueJourneys(): Promise<{
  resumed: number
  errors: Array<{ logId: string; error: string }>
}> {
  const payload = await getPayload({ config })
  const now = new Date().toISOString()
  const errors: Array<{ logId: string; error: string }> = []

  const due = await payload.find({
    collection: 'automation-logs',
    where: {
      and: [
        { status: { equals: 'in_progress' } },
        { resumeAt: { less_than_equal: now } },
      ],
    } satisfies Where,
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  let resumed = 0
  for (const log of due.docs) {
    try {
      await resumeJourney(log as unknown as Record<string, unknown>)
      resumed++
    } catch (err) {
      errors.push({ logId: String((log as unknown as Record<string, unknown>).id), error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { resumed, errors }
}

// ── condition_check 評估 ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOp(actual: any, op: string, value: unknown): boolean {
  switch (op) {
    case 'eq':
      return String(actual) === String(value)
    case 'ne':
      return String(actual) !== String(value)
    case 'gt':
      return Number(actual) > Number(value)
    case 'gte':
      return Number(actual) >= Number(value)
    case 'lt':
      return Number(actual) < Number(value)
    case 'lte':
      return Number(actual) <= Number(value)
    case 'in':
      return Array.isArray(value) && (value as unknown[]).map(String).includes(String(actual))
    case 'contains':
      return Array.isArray(actual) && actual.map(String).includes(String(value))
    case 'exists':
      return actual !== undefined && actual !== null && actual !== ''
    default:
      console.warn(`[AutomationEngine] condition_check 未知運算子: ${op}（視為通過）`)
      return true
  }
}

/**
 * 評估 condition_check。step.content = JSON `{ field, op, value }`。
 * 支援 field：tier / tags / orderCount / points / shoppingCredit / storedValueBalance /
 *   creditScore / totalSpent，及任意 user 欄位。
 * 內容非 JSON / 缺 field/op 時視為「通過」（不靜默卡死旅程，僅 console.warn）。
 */
async function evalConditionForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  userId: string,
  content: string,
): Promise<boolean> {
  let cond: { field?: string; op?: string; value?: unknown } | null = null
  try {
    cond = JSON.parse(content)
  } catch {
    console.warn(`[AutomationEngine] condition_check 內容非 JSON（視為通過）: ${content}`)
    return true
  }
  if (!cond || typeof cond !== 'object' || !cond.field || !cond.op) {
    console.warn('[AutomationEngine] condition_check 缺 field/op（視為通過）')
    return true
  }

  const user = (await payload.findByID({ collection: 'users', id: userId, depth: 0 })) as Record<
    string,
    unknown
  >

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let actual: any
  switch (cond.field) {
    case 'tags':
      actual = (Array.isArray(user.tags) ? (user.tags as Array<{ tag?: string }>) : [])
        .map((t) => t?.tag)
        .filter(Boolean)
      break
    case 'orderCount': {
      const r = await payload.find({
        collection: 'orders',
        where: { customer: { equals: userId } } satisfies Where,
        limit: 0,
        depth: 0,
      })
      actual = r.totalDocs
      break
    }
    case 'points':
    case 'shoppingCredit':
    case 'storedValueBalance':
    case 'creditScore':
    case 'totalSpent':
      actual = Number(user[cond.field]) || 0
      break
    default:
      actual = user[cond.field]
  }

  return applyOp(actual, cond.op, cond.value)
}

/**
 * 執行單一旅程步驟。回傳是否成功（condition_check 回傳「條件是否成立」）。
 */
export async function executeStep(
  step: JourneyStep,
  userId: string,
  context: Record<string, unknown>,
): Promise<boolean> {
  try {
    switch (step.action) {
      case 'send_line': {
        // TODO: 整合 LINE Messaging API（待 channel token）
        console.log(`[AutomationEngine] LINE 訊息 → ${userId}: ${step.content.substring(0, 50)}...`)
        return true
      }

      case 'send_email': {
        // templateKey 對應 message-templates id → generatePersonalizedContent 套個人化 +
        // {{變數}}；無 templateKey 則用 step.content。透過 channelDispatcher.sendMessage
        // 真寄（內含免打擾時段 + 行銷退訂 emailSubscribed gate；缺 RESEND_API_KEY
        // 走 console-fallback 不誤寄）。dynamic import 避免載入期模組循環。
        const { sendMessage } = await import('../marketing/channelDispatcher')
        let subject = 'CHIC KIM & MIU'
        let body = step.content || ''
        const tk = (step.templateKey || '').trim()
        if (tk) {
          try {
            const { generatePersonalizedContent } = await import('../marketing/personalizedContent')
            const pc = await generatePersonalizedContent(tk, userId)
            subject = pc.subject || subject
            body = pc.content || body
          } catch (e) {
            console.warn(
              `[AutomationEngine] send_email 載模板 ${tk} 失敗，改用 step.content:`,
              e instanceof Error ? e.message : String(e),
            )
          }
        }
        if (!body) {
          console.warn(`[AutomationEngine] send_email 無內容（userId=${userId}），跳過`)
          return false
        }
        const r = await sendMessage(userId, 'email', { subject, body, htmlBody: body })
        return r.success
      }

      case 'send_sms': {
        // TODO: 整合 SMS Gateway（待簡訊供應商帳號）
        console.log(`[AutomationEngine] SMS → ${userId}: ${step.content.substring(0, 30)}...`)
        return true
      }

      case 'wait': {
        // 延遲由 runJourneyFromStep 的 delayMinutes pre-step 暫停處理；此處為 no-op。
        return true
      }

      case 'condition_check': {
        const payload = await getPayload({ config })
        return await evalConditionForUser(payload, userId, step.content)
      }

      case 'add_tag': {
        const payload = await getPayload({ config })
        const tag = (step.content || '').trim()
        if (!tag) return false
        const user = (await payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
        })) as unknown as Record<string, unknown>
        const tags = Array.isArray(user.tags) ? (user.tags as Array<{ tag?: string }>) : []
        if (tags.some((t) => t?.tag === tag)) return true // 已有，視為成功
        await (payload.update as Function)({
          collection: 'users',
          id: userId,
          data: { tags: [...tags, { tag }] },
        })
        console.log(`[AutomationEngine] 新增標籤「${tag}」→ ${userId}`)
        return true
      }

      case 'remove_tag': {
        const payload = await getPayload({ config })
        const tag = (step.content || '').trim()
        if (!tag) return false
        const user = (await payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
        })) as unknown as Record<string, unknown>
        const tags = Array.isArray(user.tags) ? (user.tags as Array<{ tag?: string }>) : []
        const next = tags.filter((t) => t?.tag !== tag)
        if (next.length === tags.length) return true // 本來就沒有
        await (payload.update as Function)({
          collection: 'users',
          id: userId,
          data: { tags: next },
        })
        console.log(`[AutomationEngine] 移除標籤「${tag}」→ ${userId}`)
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
        const payload = await getPayload({ config })
        // step.content = JSON（選填）：{ displayName?, amount?, expiryDays?, rewardType?, instructions? }
        // step.templateKey 作為 displayName fallback。發到「會員寶物箱」UserRewards（per-user 唯一碼）。
        let spec: Record<string, unknown> = {}
        if (step.content) {
          try {
            spec = JSON.parse(step.content) as Record<string, unknown>
          } catch {
            spec = {}
          }
        }
        const displayName = String(spec.displayName || step.templateKey || '優惠券')
        const amountNum = Number(spec.amount)
        const expiryDays = Number(spec.expiryDays) > 0 ? Number(spec.expiryDays) : 90
        const rewardType =
          spec.rewardType === 'free_shipping_coupon' ? 'free_shipping_coupon' : 'coupon'
        const expiresAt = new Date(Date.now() + expiryDays * 86_400_000).toISOString()

        await (payload.create as Function)({
          collection: 'user-rewards',
          data: {
            user: toIdRef(userId),
            rewardType,
            displayName,
            ...(Number.isFinite(amountNum) && amountNum > 0 ? { amount: amountNum } : {}),
            couponCode: genCouponCode(),
            state: 'unused',
            requiresPhysicalShipping: false,
            expiresAt,
            ...(spec.instructions ? { redemptionInstructions: String(spec.instructions) } : {}),
          },
          overrideAccess: true,
        })
        console.log(`[AutomationEngine] 發送優惠券「${displayName}」→ ${userId}`)
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
 * 檢查旅程是否應該觸發（冷卻時間 + 最大執行次數）。
 */
export async function shouldFireJourney(
  journeySlug: string,
  userId: string,
): Promise<boolean> {
  const payload = await getPayload({ config })

  const journeyResult = await payload.find({
    collection: 'automation-journeys',
    where: { slug: { equals: journeySlug } } satisfies Where,
    limit: 1,
  })

  if (journeyResult.docs.length === 0) return false

  const journey = journeyResult.docs[0] as unknown as JourneyDoc

  if (!journey.isActive) return false

  const logsResult = await payload.find({
    collection: 'automation-logs',
    where: {
      journey: { equals: journey.id },
      user: { equals: userId },
    } satisfies Where,
    sort: '-createdAt',
    limit: 1,
  })

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
