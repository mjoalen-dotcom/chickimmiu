import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Affiliate } from '@/payload-types'

/**
 * POST /api/partner/withdrawals
 * ──────────────────────────────
 * 合作夥伴提交提款申請。Affiliates.withdrawalRequests 欄位是 admin-only
 * field-level access（partner 不能直接經 REST/Local API 寫入），所以走這支
 * 信任的 server route：自己驗證身分＋餘額後，用 overrideAccess:true 寫入。
 *
 * 送出當下就從 withdrawableAmount 扣除申請金額（改記進「待審核」狀態），
 * 避免同一合作夥伴連續送出多筆超過餘額的申請造成超額請款。
 * 若 admin 之後駁回該筆申請，需要手動把金額退回 withdrawableAmount——
 * 目前沒有自動退回的 hook，這是已知的後續待補項目。
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const role = (user as { role?: string }).role
  if (role !== 'partner' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: { amount?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })
  }

  const affRes = await payload.find({
    collection: 'affiliates',
    where: { user: { equals: user.id } },
    limit: 1,
    depth: 0,
  })
  const affiliate = affRes.docs[0] as Affiliate | undefined
  if (!affiliate) {
    return NextResponse.json({ ok: false, error: 'no_affiliate_record' }, { status: 404 })
  }

  const withdrawable = affiliate.withdrawableAmount || 0
  if (amount > withdrawable) {
    return NextResponse.json({ ok: false, error: 'insufficient_balance' }, { status: 400 })
  }

  try {
    await payload.update({
      collection: 'affiliates',
      id: affiliate.id,
      data: {
        withdrawableAmount: withdrawable - amount,
        withdrawalRequests: [
          ...(affiliate.withdrawalRequests || []),
          {
            amount,
            status: 'pending',
            requestedAt: new Date().toISOString(),
          },
        ],
      },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    payload.logger?.error?.({ err, msg: '[partner/withdrawals] update failed' })
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }
}
