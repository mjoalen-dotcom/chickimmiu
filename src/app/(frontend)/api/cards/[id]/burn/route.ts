import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { COMMON_BURN_POINTS } from '@/utils/collectibleCardConstants'

/**
 * POST /api/cards/:id/burn
 *
 * 會員主動銷毀造型卡換點。
 *
 * 約束：
 *   - 必須登入
 *   - card.owner === currentUser
 *   - card.status === 'active'
 *
 * 點數規則：
 *   - common 卡：COMMON_BURN_POINTS（30 點，寫死在 constants）
 *   - limited 卡：template.burnPointsReward（admin 可調，預設 500）
 *
 * 副作用：
 *   - card: status → 'burned', owner → null
 *   - users.points += X
 *   - 寫 PointsTransaction(type='earn', source='card_burn')
 *   - 寫 CardEvent(action='burn', fromUser=me, pointsDelta=+X)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const cardId = Number(id)
  if (!Number.isFinite(cardId)) {
    return NextResponse.json({ error: 'invalid_card_id' }, { status: 400 })
  }

  let card: Record<string, unknown>
  try {
    card = (await payload.findByID({
      collection: 'collectible-cards',
      id: cardId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'card_not_found' }, { status: 404 })
  }

  const cardOwnerId =
    typeof card.owner === 'number'
      ? card.owner
      : typeof card.owner === 'string'
        ? Number(card.owner)
        : NaN
  if (Number.isNaN(cardOwnerId) || cardOwnerId !== Number(user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (String(card.status ?? '') !== 'active') {
    return NextResponse.json(
      { error: 'invalid_state', state: card.status, message: '只有持有中的卡可以銷毀' },
      { status: 409 },
    )
  }

  // ── 算點數 ──
  let pointsAwarded = COMMON_BURN_POINTS
  const cardType = String(card.cardType ?? '')
  if (cardType === 'limited' && card.template != null) {
    try {
      const tmplId = typeof card.template === 'number' ? card.template : Number(card.template)
      const tmpl = (await payload.findByID({
        collection: 'collectible-card-templates',
        id: tmplId,
        depth: 0,
        overrideAccess: true,
      })) as unknown as { burnPointsReward?: number }
      pointsAwarded = Number(tmpl?.burnPointsReward ?? 500)
    } catch {
      pointsAwarded = 500 // fallback
    }
  }

  // ── 銷毀 + 入帳 ──
  await payload.update({
    collection: 'collectible-cards',
    id: cardId,
    data: {
      status: 'burned',
      owner: null,
    },
    overrideAccess: true,
  })

  const myIdNum = Number(user.id)

  // user points 累加
  const fresh = (await payload.findByID({
    collection: 'users',
    id: myIdNum,
    depth: 0,
    overrideAccess: true,
  })) as unknown as { points?: number }
  const newPoints = Number(fresh?.points ?? 0) + pointsAwarded
  await payload.update({
    collection: 'users',
    id: myIdNum,
    data: { points: newPoints },
    overrideAccess: true,
  })

  // PointsTransaction 流水
  try {
    await payload.create({
      collection: 'points-transactions',
      data: {
        user: myIdNum,
        type: 'earn',
        amount: pointsAwarded,
        source: 'card_burn',
        description: `銷毀造型卡 ${cardType === 'limited' ? '（限量）' : '（普通）'}`,
      },
      overrideAccess: true,
    })
  } catch (err) {
    // 不 block：流水失敗只紀錄，不 rollback 點數（避免整筆失敗體感差）
    console.error('[cards/burn] PointsTransaction 建立失敗：', err)
  }

  // CardEvent
  await payload.create({
    collection: 'collectible-card-events',
    data: {
      card: cardId,
      action: 'burn',
      fromUser: myIdNum,
      pointsDelta: pointsAwarded,
      notes: `銷毀 ${cardType}（+${pointsAwarded} 點）`,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    ok: true,
    cardId,
    cardType,
    pointsAwarded,
    newPointsBalance: newPoints,
  })
}
