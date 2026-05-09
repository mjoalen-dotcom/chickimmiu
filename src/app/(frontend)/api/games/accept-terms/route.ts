import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/games/accept-terms
 * ─────────────────────────────
 * 會員首次進 /games 顯示同意書 modal，勾選後 POST 到此。
 * 寫入 users.gameTermsAcceptance.{acceptedAt, acceptedVersion, adultConfirmed, acceptanceIp}。
 *
 * 後端必驗：
 *   1. 已登入
 *   2. 若 GameSettings.compliance.requireAdultConfirmation = true，body.adultConfirmed 必須 true
 *
 * 寫入後 GET /api/games 回傳的 termsState.requiresAcceptance 即變 false。
 *
 * Phase C 立即上線；Phase F v1 API 會新增 token-based 版本給 APP 用。
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const settings = (await payload.findGlobal({ slug: 'game-settings' })) as unknown as Record<string, unknown>
    const terms = (settings.terms as Record<string, unknown> | undefined) || {}
    const compliance = (settings.compliance as Record<string, unknown> | undefined) || {}
    const currentVersion = (terms.version as string) || '0'
    const requireAdult = compliance.requireAdultConfirmation !== false

    let body: { adultConfirmed?: boolean } = {}
    try { body = await req.json() } catch { /* 容許空 body */ }

    if (requireAdult && !body.adultConfirmed) {
      return NextResponse.json(
        { success: false, error: '依遊戲規範需確認您已年滿 20 歲' },
        { status: 400 },
      )
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    await (payload.update as Function)({
      collection: 'users',
      id: user.id,
      data: {
        gameTermsAcceptance: {
          acceptedAt: new Date().toISOString(),
          acceptedVersion: currentVersion,
          adultConfirmed: Boolean(body.adultConfirmed),
          acceptanceIp: ip,
        },
      } as never,
    })

    return NextResponse.json({
      success: true,
      data: {
        acceptedVersion: currentVersion,
        acceptedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('accept-terms error', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
