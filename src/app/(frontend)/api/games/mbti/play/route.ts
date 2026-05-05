import { NextRequest, NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { playMBTIQuiz, getMBTIPlayStatus } from '@/lib/games/gameActions'
import type { MBTIAnswers, LifestyleAnswers } from '@/lib/games/mbtiQuizEngine'

/**
 * GET /api/games/mbti/play
 * Pre-flight 檢查：開始測驗前 client 先 fetch 一次拿到動態 cost / 餘額 / 已測次數
 * 不扣點。回傳 status: getMBTIPlayStatus 結果
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    const headers = await nextHeaders()
    const { user } = await payload.auth({ headers })
    if (!user) {
      return NextResponse.json(
        { canPlay: false, reason: 'unauthenticated', message: '請先登入後再進行測驗' },
        { status: 401 },
      )
    }
    const status = await getMBTIPlayStatus(user.id as number)
    return NextResponse.json(status, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json(
      { canPlay: false, reason: 'server_error', message: `無法取得測驗狀態：${message}` },
      { status: 500 },
    )
  }
}

/**
 * POST /api/games/mbti/play
 * Body: {
 *   answers: { [questionId]: 'E'|'I'|'S'|'N'|'T'|'F'|'J'|'P' },         // 28 題
 *   lifestyleAnswers?: { [questionId]: 'urban'|'vacation'|'party'|'cozy' } // 4 題（PR-Y MBTI64）
 * }
 * Auth: 需登入（Payload session cookie）
 *
 * 回 playMBTIQuiz 結果（含 mbtiType、primaryOccasion、subPersonality、推薦商品、剩餘點數）
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const headers = await nextHeaders()
    const { user } = await payload.auth({ headers })

    if (!user) {
      return NextResponse.json(
        { success: false, message: '請先登入後再進行測驗' },
        { status: 401 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const answers = (body?.answers ?? {}) as MBTIAnswers
    const lifestyleAnswers = (body?.lifestyleAnswers ?? {}) as LifestyleAnswers

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { success: false, message: 'answers 必須是物件' },
        { status: 400 },
      )
    }

    const result = await playMBTIQuiz(user.id as number, answers, lifestyleAnswers)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json(
      { success: false, message: `MBTI 測驗發生錯誤：${message}` },
      { status: 500 },
    )
  }
}
