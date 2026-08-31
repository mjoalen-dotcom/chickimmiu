import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
import { resolveBearerUser, UNAUTHORIZED_RESPONSE } from '@/lib/auth/resolveBearerUser'
import { memberIdentitySummary } from '@/lib/memberIdentity'

/**
 * GET /api/v1/me
 * ─────────────────
 * 一次拿 APP 首頁所需的所有會員資訊：
 *   - profile（基本資料 + 點數 + 購物金 + 等級）
 *   - 寶物箱（unused + pending_attach 的 UserRewards）
 *   - 遊戲狀態（已同意規範與否、版本號）
 *
 * Auth: Bearer token（由 /api/v1/auth/login 取得）
 *
 * Response 200:
 *   {
 *     success: true,
 *     data: {
 *       user: { id, email, name, points, shoppingCredit, memberTier, ... },
 *       wallet: { points, shoppingCredit, storedValueBalance },
 *       rewards: { unusedCount, pendingAttachCount, items: [...10 筆] },
 *       gameTerms: { acceptedVersion, currentVersion, requiresAcceptance }
 *     }
 *   }
 */
export async function GET(req: NextRequest) {
  const { payload, user } = await resolveBearerUser(req)
  if (!user || user.collection !== 'customers') {
    return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 })
  }

  const userData = user as unknown as Record<string, unknown>

  // 寶物箱：拿 unused + pending_attach 前 10 筆
  let rewards: {
    unusedCount: number
    pendingAttachCount: number
    items: Array<Record<string, unknown>>
  } = { unusedCount: 0, pendingAttachCount: 0, items: [] }
  try {
    const res = await payload.find({
      collection: 'user-rewards',
      where: {
        and: [
          { user: { equals: user.id } },
          { state: { in: ['unused', 'pending_attach'] } },
        ],
      } as Where,
      sort: '-createdAt',
      limit: 10,
      depth: 0,
    })
    const items = res.docs.map((d) => {
      const r = d as unknown as Record<string, unknown>
      return {
        id: r.id,
        rewardType: r.rewardType,
        displayName: r.displayName,
        amount: r.amount,
        state: r.state,
        couponCode: r.couponCode,
        expiresAt: r.expiresAt,
        requiresPhysicalShipping: r.requiresPhysicalShipping,
        redemptionInstructions: r.redemptionInstructions,
      }
    })
    const unusedCount = items.filter((i) => i.state === 'unused').length
    const pendingAttachCount = items.filter((i) => i.state === 'pending_attach').length
    rewards = { unusedCount, pendingAttachCount, items }
  } catch {
    // 寶物箱讀取失敗不擋整個 me endpoint
  }

  // 遊戲規範同意狀態
  let gameTerms: {
    acceptedVersion: string | null
    currentVersion: string
    requiresAcceptance: boolean
    enabled: boolean
  } = { acceptedVersion: null, currentVersion: '0', requiresAcceptance: false, enabled: true }
  try {
    const settings = (await payload.findGlobal({ slug: 'game-settings' })) as unknown as Record<string, unknown>
    const termsCfg = (settings.terms as Record<string, unknown> | undefined) || {}
    const acceptance = (userData.gameTermsAcceptance as Record<string, unknown> | undefined) || {}
    const enabled = termsCfg.enabled !== false
    const currentVersion = (termsCfg.version as string) || '0'
    const acceptedVersion = (acceptance.acceptedVersion as string) || ''
    gameTerms = {
      enabled,
      currentVersion,
      acceptedVersion: acceptedVersion || null,
      requiresAcceptance: enabled && acceptedVersion !== currentVersion,
    }
  } catch {
    // game-settings 讀取失敗 → 預設不擋
  }

  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: userData.email,
        name: userData.name,
        nickname: userData.nickname || null,
        phone: userData.phone,
        points: userData.points || 0,
        shoppingCredit: userData.shoppingCredit || 0,
        storedValueBalance: userData.storedValueBalance || 0,
        memberTier: userData.memberTier,
        gender: userData.gender,
        birthday: userData.birthday,
        referralCode: userData.referralCode,
        consecutiveCheckIns: userData.consecutiveCheckIns || 0,
        totalCheckIns: userData.totalCheckIns || 0,
        lastCheckInDate: userData.lastCheckInDate,
        mbtiProfile: userData.mbtiProfile,
      },
      wallet: {
        points: userData.points || 0,
        shoppingCredit: userData.shoppingCredit || 0,
        storedValueBalance: userData.storedValueBalance || 0,
      },
      rewards,
      gameTerms,
      // Provider-neutral member reference for future web/app/spatial clients.
      // It is an identifier, not an authentication credential or a public DID.
      identity: memberIdentitySummary(userData),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
