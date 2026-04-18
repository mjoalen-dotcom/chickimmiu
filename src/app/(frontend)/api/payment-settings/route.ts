import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/payment-settings
 * ----------------------------
 * 公開讀取 GlobalSettings.payment 的 COD 與啟用方式設定。
 * Checkout client component fetch 這支拿即時設定（避免硬寫預設）。
 *
 * 失敗時回 fallback 預設值，讓 checkout 至少能跑下去（不擋下單流程）。
 */
export const dynamic = 'force-dynamic'

const FALLBACK = {
  enabledMethods: ['ecpay', 'cash_cod'] as string[],
  codDefaultFee: 30,
  codMaxAmount: 20000,
}

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({
      slug: 'global-settings',
      depth: 0,
    })) as unknown as { payment?: Record<string, unknown> }

    const payment = (settings?.payment ?? {}) as Record<string, unknown>
    return NextResponse.json({
      enabledMethods: Array.isArray(payment.enabledMethods)
        ? (payment.enabledMethods as string[])
        : FALLBACK.enabledMethods,
      codDefaultFee:
        typeof payment.codDefaultFee === 'number' ? payment.codDefaultFee : FALLBACK.codDefaultFee,
      codMaxAmount:
        typeof payment.codMaxAmount === 'number' ? payment.codMaxAmount : FALLBACK.codMaxAmount,
    })
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
