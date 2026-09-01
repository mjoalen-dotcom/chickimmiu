import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getActivitySettings, ok, fail, CODES } from '@/lib/app-activities/common'

/**
 * GET /api/app/activities/settings
 * ────────────────────────────────
 * App 專屬三項活動的設定（工單 2026-08-25 共通規則 #2：獎勵數值後台可調，
 * 且需有端點供 App 讀取 —— App 用這些值渲染畫面與送出前預檢，兩邊不各寫死一份）。
 *
 * 不需登入（純設定值，無個人資料）。
 * bannedWords 刻意不回傳 —— 由後端判定即可，回傳等於把過濾清單交給要規避它的人。
 */
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const s = await getActivitySettings(payload)

    return ok({
      travelRead: {
        isActive: s.travelRead.isActive,
        pointsPerArticle: s.travelRead.pointsPerArticle,
      },
      groupBuyShare: {
        isActive: s.groupBuyShare.isActive,
        sharePoints: s.groupBuyShare.sharePoints,
        featuredPoints: s.groupBuyShare.featuredPoints,
        minContentLength: s.groupBuyShare.minContentLength,
        maxImages: s.groupBuyShare.maxImages,
        editableHours: s.groupBuyShare.editableHours,
        maxCommentLength: 300,
      },
      stepChallenge: {
        isActive: s.stepChallenge.isActive,
        dailyMilestones: s.stepChallenge.dailyMilestones,
        weeklyMilestone: s.stepChallenge.weeklyMilestone,
      },
    })
  } catch (err) {
    console.error('[app/activities/settings] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
