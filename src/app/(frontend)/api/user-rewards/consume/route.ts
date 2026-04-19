import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/user-rewards/consume
 *   body: { rewardId: number }
 *
 * 會員手動將電子券標記為「已使用」的後端。
 *   - 必須登入（Payload session cookie）
 *   - 必須是獎項擁有者（reward.user === session.user.id）
 *   - 只允許 state === 'unused' → 'consumed'（pending_attach 表示正在排隊隨單寄
 *     出，不應直接跳 consumed；已 shipped / consumed / expired 也不再變動）
 *   - UserRewards collection `update` access 仍是 admin-only，這裡 overrideAccess
 *     + 自行做擁有者檢查，避免放寬整個 collection 的 update 權限。
 */

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const headers = request.headers
  const { user } = await payload.auth({ headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let rewardId: number | undefined
  try {
    const body = (await request.json()) as { rewardId?: unknown }
    if (typeof body?.rewardId === 'number') rewardId = body.rewardId
    else if (typeof body?.rewardId === 'string' && /^\d+$/.test(body.rewardId)) {
      rewardId = Number(body.rewardId)
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!rewardId) {
    return NextResponse.json({ error: 'reward_id_required' }, { status: 400 })
  }

  let reward: Record<string, unknown>
  try {
    reward = (await payload.findByID({
      collection: 'user-rewards',
      id: rewardId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const ownerId = typeof reward.user === 'number' ? reward.user : Number(reward.user)
  if (Number.isNaN(ownerId) || ownerId !== Number(user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const state = String(reward.state ?? '')
  if (state !== 'unused') {
    return NextResponse.json(
      { error: 'invalid_state', state, message: '此獎項目前狀態不可標記為已使用' },
      { status: 409 },
    )
  }

  // 過期 guard — lazy afterRead 會把 expired 標起來，但 DB 欄位還是 unused，
  // 這裡用 expiresAt 做第二層檢查避免過期券被手動消費掉。
  const expiresAt = reward.expiresAt ? new Date(String(reward.expiresAt)).getTime() : NaN
  if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
    return NextResponse.json(
      { error: 'expired', message: '此獎項已過期，無法標記為已使用' },
      { status: 409 },
    )
  }

  await payload.update({
    collection: 'user-rewards',
    id: rewardId,
    data: {
      state: 'consumed',
      consumedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, rewardId, state: 'consumed' })
}
