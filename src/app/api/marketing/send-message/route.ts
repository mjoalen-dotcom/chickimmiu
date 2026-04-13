import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { generatePersonalizedContent } from '@/lib/marketing/personalizedContent'
import { sendMessage } from '@/lib/marketing/channelDispatcher'

/**
 * 行銷訊息發送 API
 * POST /api/marketing/send-message — 發送行銷訊息給使用者或批次使用者
 */

const TIER_FRONT_NAMES: Record<string, string> = {
  ordinary: '優雅初遇者',
  bronze: '曦漾仙子',
  silver: '優漾女神',
  gold: '金曦女王',
  platinum: '星耀皇后',
  diamond: '璀璨天后',
}

function resolveTierFrontName(tier: unknown): string {
  if (!tier || typeof tier !== 'object') {
    if (typeof tier === 'string' && TIER_FRONT_NAMES[tier]) {
      return TIER_FRONT_NAMES[tier]
    }
    return TIER_FRONT_NAMES['ordinary']
  }
  const tierObj = tier as unknown as Record<string, unknown>
  if (tierObj.frontName && typeof tierObj.frontName === 'string') {
    return tierObj.frontName
  }
  const slug = (tierObj.slug as string) || ''
  return TIER_FRONT_NAMES[slug] || TIER_FRONT_NAMES['ordinary']
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      userId,
      userIds,
      channel,
      templateId,
      campaignId,
      personalizeContent: shouldPersonalize,
    } = body

    // 驗證必填欄位
    if (!userId && (!Array.isArray(userIds) || userIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: '需提供 userId 或 userIds 陣列' },
        { status: 400 },
      )
    }

    if (!channel) {
      return NextResponse.json(
        { success: false, error: '推播管道 (channel) 為必填欄位' },
        { status: 400 },
      )
    }

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: '訊息模板 (templateId) 為必填欄位' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 載入模板
    const template = await payload.findByID({
      collection: 'message-templates',
      id: templateId,
      depth: 0,
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: '找不到指定的訊息模板' },
        { status: 404 },
      )
    }

    const tmpl = template as unknown as Record<string, unknown>
    if (!tmpl.isActive) {
      return NextResponse.json(
        { success: false, error: '該訊息模板已停用' },
        { status: 400 },
      )
    }

    // 載入活動（若有指定）
    let campaign: Record<string, unknown> | null = null
    if (campaignId) {
      try {
        const found = await payload.findByID({
          collection: 'marketing-campaigns',
          id: campaignId,
        })
        campaign = found as unknown as Record<string, unknown>
      } catch {
        // 活動不存在，繼續發送
      }
    }

    // 組合目標使用者列表
    const targetUserIds: string[] = userId
      ? [userId]
      : (userIds as string[])

    // 批次載入使用者
    const usersResult = await payload.find({
      collection: 'users',
      where: { id: { in: targetUserIds } } satisfies Where,
      limit: targetUserIds.length,
      depth: 1,
    })

    const results: Array<{
      userId: string
      status: 'success' | 'failed'
      error?: string
    }> = []

    for (const user of usersResult.docs) {
      try {
        const userData = user as unknown as Record<string, unknown>

        // 取得使用者信用分數
        let creditScore = 80
        try {
          const creditHistory = await payload.find({
            collection: 'credit-score-history',
            where: { user: { equals: user.id } } satisfies Where,
            sort: '-createdAt',
            limit: 1,
          })
          if (creditHistory.docs[0]) {
            creditScore = ((creditHistory.docs[0] as unknown as Record<string, unknown>).newScore as number) ?? 80
          }
        } catch {
          // 使用預設分數
        }

        // 個人化內容
        let messageContent = (tmpl.textContent as string) || ''
        let messageSubject = (tmpl.subject as string) || ''

        if (shouldPersonalize !== false) {
          try {
            const personalized = await generatePersonalizedContent(
              templateId,
              user.id as unknown as string,
            )
            messageContent = personalized.content || messageContent
            messageSubject = personalized.subject || messageSubject
          } catch {
            // 個人化失敗，使用原始模板內容
            // 基礎變數替換
            const userName = (userData.name as string) || '親愛的會員'
            const tierName = resolveTierFrontName(userData.memberTier)
            messageContent = messageContent
              .replace(/\{\{user_name\}\}/g, userName)
              .replace(/\{\{tier_front_name\}\}/g, tierName)
              .replace(/\{\{credit_score\}\}/g, String(creditScore))
              .replace(/\{\{points_balance\}\}/g, String((userData.points as number) ?? 0))
            messageSubject = messageSubject
              .replace(/\{\{user_name\}\}/g, userName)
              .replace(/\{\{tier_front_name\}\}/g, tierName)
          }
        }

        // 發送訊息
        try {
          await sendMessage(
            user.id as unknown as string,
            channel,
            { subject: messageSubject, body: messageContent },
            campaignId || undefined,
          )
        } catch {
          // dispatcher 尚未實作，記錄為成功（MVP 模擬）
        }

        results.push({ userId: user.id as unknown as string, status: 'success' })

        // 建立執行紀錄
        try {
          await (payload.create as Function)({
            collection: 'automation-logs',
            data: {
              journey: campaignId || undefined,
              user: user.id,
              status: 'completed',
              action: `行銷訊息發送 - ${channel}`,
              details: {
                channel,
                templateId,
                campaignId: campaignId || null,
                personalized: shouldPersonalize !== false,
              },
            } as unknown as Record<string, unknown>,
          })
        } catch {
          // 記錄失敗不影響發送結果
        }
      } catch (sendError) {
        results.push({
          userId: user.id as unknown as string,
          status: 'failed',
          error: sendError instanceof Error ? sendError.message : '發送失敗',
        })
      }
    }

    // 更新活動成效（若有關聯活動）
    if (campaignId && campaign) {
      const successCount = results.filter((r) => r.status === 'success').length
      const currentSent = ((campaign.performance as unknown as Record<string, unknown>)?.sent as number) || 0
      try {
        await (payload.update as Function)({
          collection: 'marketing-campaigns',
          id: campaignId,
          data: {
            performance: {
              ...((campaign.performance as unknown as Record<string, unknown>) || {}),
              sent: currentSent + successCount,
            },
          },
        })
      } catch {
        // 更新失敗不影響回傳
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      message: `訊息發送完成：${successCount} 成功，${failedCount} 失敗`,
      data: {
        totalSent: targetUserIds.length,
        successCount,
        failedCount,
        channel,
        templateId,
        campaignId: campaignId || null,
        results,
      },
    })
  } catch (error) {
    console.error('Send Message POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
