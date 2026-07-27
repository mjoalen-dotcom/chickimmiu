import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { loadEcpayConfig, buildPeriodCheckoutParams } from '@/lib/payment/ecpay'
import { getActiveMembership } from '@/lib/subscription/activate'

/**
 * POST /api/subscription/ecpay/create — 訂閱購買第一段。
 * body: { planSlug, cycle: 'monthly' | 'yearly' }
 *
 * 建 user-subscriptions pending 紀錄 → 回綠界定期定額 AioCheckOut 表單參數，
 * 前端 auto-submit 導向綠界。首期授權結果回 /api/subscription/ecpay/callback。
 * production 憑證未設 → 503（比照訂單金流，絕不用測試商店收真錢）。
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { planSlug?: string; cycle?: string }
      | null
    const planSlug = body?.planSlug?.trim()
    const cycle = body?.cycle === 'yearly' ? 'yearly' : 'monthly'
    if (!planSlug) {
      return NextResponse.json({ error: '缺少方案' }, { status: 400 })
    }

    const cfg = loadEcpayConfig()
    if (!cfg.isConfigured) {
      return NextResponse.json(
        { error: '線上金流尚未開通，請聯繫客服' },
        { status: 503 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 已有生效訂閱不能重複訂
    const existing = await getActiveMembership(payload, user as unknown as Record<string, unknown>)
    if (existing) {
      return NextResponse.json({ error: '您已有生效中的訂閱方案' }, { status: 400 })
    }

    const found = await payload.find({
      collection: 'subscription-plans',
      where: { slug: { equals: planSlug }, isActive: { equals: true } },
      limit: 1,
      depth: 0,
    })
    const plan = found.docs[0] as
      | {
          id: number | string
          name?: string
          pricing?: { monthlyPrice?: number | null; yearlyPrice?: number | null } | null
        }
      | undefined
    if (!plan) {
      return NextResponse.json({ error: '查無此方案' }, { status: 404 })
    }
    const amount =
      cycle === 'yearly' ? Number(plan.pricing?.yearlyPrice) : Number(plan.pricing?.monthlyPrice)
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: '此方案未提供該繳費週期' }, { status: 400 })
    }

    // 先建 pending 紀錄，CustomField1 = SUB:<id> 讓 callback 回查
    const sub = (await payload.create({
      collection: 'user-subscriptions',
      data: {
        user: user.id,
        plan: plan.id,
        status: 'pending',
        billingCycle: cycle,
        amount,
      } as never,
      overrideAccess: true,
    })) as unknown as { id: number | string }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '')
    const params = buildPeriodCheckoutParams(cfg, {
      subscriptionId: sub.id,
      planName: plan.name || '訂閱方案',
      amount,
      cycle,
      siteUrl,
    })

    // 母交易號先存起來（解約 CreditCardPeriodAction 需要）
    await payload.update({
      collection: 'user-subscriptions',
      id: sub.id,
      data: { ecpay: { merchantTradeNo: params.MerchantTradeNo, periodType: params.PeriodType, execTimes: Number(params.ExecTimes) } } as never,
      overrideAccess: true,
    })

    payload.logger.info(
      `[subscription] create sub=${sub.id} user=${user.id} plan=${planSlug} cycle=${cycle} amount=${amount} tradeNo=${params.MerchantTradeNo} sandbox=${cfg.sandbox}`,
    )
    return NextResponse.json({ action: cfg.checkoutUrl, params })
  } catch (err) {
    console.error('[subscription/create] error:', err)
    return NextResponse.json({ error: '建立訂閱失敗，請稍後再試' }, { status: 500 })
  }
}
