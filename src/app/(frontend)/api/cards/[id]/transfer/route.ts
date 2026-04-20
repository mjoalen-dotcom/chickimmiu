import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/cards/:id/transfer
 *   body: { toEmail: string }
 *
 * 把造型卡轉送給其他會員（封測期不做轉讓 code，直接 email 直轉）。
 *
 * 約束：
 *   - 必須登入
 *   - card.owner === currentUser
 *   - card.status === 'active'
 *   - toEmail 必須是站內會員（找不到就 404）
 *   - 不能轉給自己
 *
 * 副作用：
 *   - card: owner → targetUser，ownerNicknameSnapshot 更新
 *   - originalOwner 永遠不變
 *   - 寫 CardEvent(action='transfer', fromUser=me, toUser=target)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const payload = await getPayload({ config })
  const headers = request.headers
  const { user } = await payload.auth({ headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const cardId = Number(id)
  if (!Number.isFinite(cardId)) {
    return NextResponse.json({ error: 'invalid_card_id' }, { status: 400 })
  }

  let toEmail: string
  try {
    const body = (await request.json()) as { toEmail?: unknown }
    if (typeof body?.toEmail !== 'string' || body.toEmail.trim().length === 0) {
      return NextResponse.json({ error: 'to_email_required' }, { status: 400 })
    }
    toEmail = body.toEmail.trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // ── 取卡 ──
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
      { error: 'invalid_state', state: card.status, message: '只有持有中的卡可以轉送' },
      { status: 409 },
    )
  }

  // ── 找目標會員 ──
  const userFind = await payload.find({
    collection: 'users',
    where: { email: { equals: toEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const target = userFind.docs[0] as unknown as
    | { id: number | string; name?: string; email?: string }
    | undefined
  if (!target) {
    return NextResponse.json(
      { error: 'recipient_not_found', message: '找不到此 email 對應的會員' },
      { status: 404 },
    )
  }
  if (Number(target.id) === Number(user.id)) {
    return NextResponse.json({ error: 'cannot_transfer_to_self' }, { status: 400 })
  }

  // ── 轉卡 ──
  const targetIdNum = Number(target.id)
  await payload.update({
    collection: 'collectible-cards',
    id: cardId,
    data: {
      owner: targetIdNum,
      ownerNicknameSnapshot: target.name || target.email || '',
    },
    overrideAccess: true,
  })

  await payload.create({
    collection: 'collectible-card-events',
    data: {
      card: cardId,
      action: 'transfer',
      fromUser: Number(user.id),
      toUser: targetIdNum,
      notes: `會員轉送`,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    ok: true,
    cardId,
    newOwnerEmail: target.email,
    newOwnerName: target.name,
  })
}
