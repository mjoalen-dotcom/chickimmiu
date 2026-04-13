import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * CRM Credit Score API
 * GET  /api/crm/credit-score?userId=xxx — 取得會員信用分數、狀態、歷史紀錄
 * POST /api/crm/credit-score            — 管理員調整信用分數
 */

// ── 信用分數狀態對照表 ──
const STATUS_THRESHOLDS = [
  { min: 90, status: 'excellent', label: '優質好客人' },
  { min: 60, status: 'normal', label: '一般' },
  { min: 40, status: 'watchlist', label: '觀察名單' },
  { min: 30, status: 'warning', label: '警示名單' },
  { min: 1, status: 'blacklist', label: '黑名單' },
  { min: -Infinity, status: 'suspended', label: '已停權' },
] as const

function getCreditStatus(score: number) {
  for (const tier of STATUS_THRESHOLDS) {
    if (score >= tier.min) {
      return { status: tier.status, statusLabel: tier.label }
    }
  }
  return { status: 'suspended', statusLabel: '已停權' }
}

// 進度條：顯示目前分數與下一個等級門檻
function getProgressBar(score: number) {
  const thresholds = [90, 60, 40, 30]
  for (const threshold of thresholds) {
    if (score < threshold) {
      return { current: score, nextThreshold: threshold }
    }
  }
  return { current: score, nextThreshold: 100 }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId 參數' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 取得使用者
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '找不到該會員' },
        { status: 404 },
      )
    }

    // 信用分數：從最近的 CreditScoreHistory 取得，或預設 80
    const historyResult = await payload.find({
      collection: 'credit-score-history',
      where: {
        user: { equals: userId },
      } as never,
      sort: '-createdAt',
      limit: 10,
    })

    const latestEntry = historyResult.docs[0]
    const score = latestEntry ? (latestEntry.newScore as number) ?? 80 : 80
    const { status, statusLabel } = getCreditStatus(score)
    const progressBar = getProgressBar(score)

    return NextResponse.json({
      success: true,
      data: {
        score,
        status,
        statusLabel,
        history: historyResult.docs.map((entry) => ({
          id: entry.id,
          previousScore: entry.previousScore,
          newScore: entry.newScore,
          change: entry.change,
          reason: entry.reason,
          description: entry.description,
          createdAt: entry.createdAt,
        })),
        progressBar,
      },
    })
  } catch (error) {
    console.error('CRM Credit Score GET error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, reason, change, description } = body

    if (!userId || !reason || change === undefined || change === null) {
      return NextResponse.json(
        { success: false, error: '缺少必要欄位：userId, reason, change' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 取得目前分數
    const historyResult = await payload.find({
      collection: 'credit-score-history',
      where: {
        user: { equals: userId },
      } as never,
      sort: '-createdAt',
      limit: 1,
    })

    const currentScore = historyResult.docs[0]
      ? (historyResult.docs[0].newScore as number) ?? 80
      : 80

    const newScore = Math.max(0, Math.min(100, currentScore + change))

    // 建立異動紀錄
    const entry = await (payload.create as Function)({
      collection: 'credit-score-history',
      data: {
        user: userId,
        previousScore: currentScore,
        newScore,
        change,
        reason,
        description: description || '',
      },
    })

    const { status, statusLabel } = getCreditStatus(newScore)

    return NextResponse.json({
      success: true,
      message: '信用分數已調整',
      data: {
        previousScore: currentScore,
        newScore,
        change,
        status,
        statusLabel,
        entryId: entry.id,
      },
    })
  } catch (error) {
    console.error('CRM Credit Score POST error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 },
    )
  }
}
