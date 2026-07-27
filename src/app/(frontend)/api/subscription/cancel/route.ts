import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { loadEcpayConfig, cancelPeriodAtEcpay } from '@/lib/payment/ecpay'
import { type SubDoc } from '@/lib/subscription/activate'
import { sendSubscriptionCancelledEmail } from '@/lib/email/subscriptionCancelled'

/**
 * POST /api/subscription/cancel — 取消訂閱（停用綠界後續扣款）。
 * 已付期間權益保留到 currentPeriodEnd（membership.validUntil 不動），
 * 只停後續：綠界 CreditCardPeriodAction Action=Cancel（不可逆）+
 * 本地 status=cancelled。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const found = await payload.find({
      collection: 'user-subscriptions',
      where: { user: { equals: user.id }, status: { equals: 'active' } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    })
    const sub = found.docs[0] as unknown as SubDoc | undefined
    if (!sub) {
      return NextResponse.json({ error: '沒有生效中的訂閱' }, { status: 404 })
    }

    const tradeNo = sub.ecpay?.merchantTradeNo
    if (tradeNo) {
      const cfg = loadEcpayConfig()
      const r = await cancelPeriodAtEcpay(cfg, tradeNo)
      payload.logger.info(
        `[subscription] sub=${sub.id} 綠界解約 tradeNo=${tradeNo} RtnCode=${r.rtnCode} RtnMsg=${r.rtnMsg}`,
      )
      // 10100050 = 該筆已無後續可停用（已停/已滿期），視同成功不擋
      if (!r.ok && r.rtnCode !== '10100050') {
        return NextResponse.json(
          { error: `綠界解約失敗（${r.rtnMsg || r.rtnCode}），請聯繫客服` },
          { status: 502 },
        )
      }
    }

    const updated = (await payload.update({
      collection: 'user-subscriptions',
      id: sub.id,
      data: {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelReason: '會員自行取消',
      } as never,
      overrideAccess: true,
    })) as unknown as SubDoc

    // membership.validUntil 保留（權益到期末）；status 由訂閱紀錄表達
    sendSubscriptionCancelledEmail(payload, updated).catch((err) =>
      console.error('[subscription] 取消通知信寄送失敗:', err),
    )

    return NextResponse.json({
      ok: true,
      validUntil: updated.currentPeriodEnd || null,
    })
  } catch (err) {
    console.error('[subscription/cancel] error:', err)
    return NextResponse.json({ error: '取消失敗，請稍後再試' }, { status: 500 })
  }
}
