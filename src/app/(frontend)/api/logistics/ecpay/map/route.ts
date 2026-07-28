import { NextRequest, NextResponse } from 'next/server'
import {
  loadEcpayLogisticsConfig,
  buildCvsMapParams,
  carrierToLogisticsSubType,
} from '@/lib/logistics/ecpayLogisticsMap'

/**
 * POST /api/logistics/ecpay/map — 產生 ECPay 電子地圖選店表單參數。
 * 結帳頁點「從地圖選擇門市」→ 打這支拿 { action, params }，前端組
 * hidden form auto-submit 整頁導向綠界地圖；選店結果由綠界以顧客
 * 瀏覽器 POST 到 /api/logistics/ecpay/map/reply 再 303 導回結帳頁。
 *
 * 不需要登入（此時訂單還沒建立，選店本身無副作用）。
 * production 憑證未設 → 503，前端 fallback 手動輸入門市。
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { carrier?: string; isCollection?: boolean }
      | null
    const carrier = body?.carrier?.trim() || ''
    if (!carrier) {
      return NextResponse.json({ error: '缺少物流商代碼' }, { status: 400 })
    }

    const cfg = loadEcpayLogisticsConfig()
    if (!cfg.isConfigured) {
      return NextResponse.json(
        { error: '物流地圖尚未開通，請直接輸入門市資訊' },
        { status: 503 },
      )
    }
    if (!carrierToLogisticsSubType(cfg, carrier)) {
      return NextResponse.json(
        { error: '此物流方式不支援地圖選店，請直接輸入門市資訊' },
        { status: 400 },
      )
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '')
    const ua = req.headers.get('user-agent') || ''
    const params = buildCvsMapParams(cfg, {
      carrier,
      isCollection: Boolean(body?.isCollection),
      serverReplyURL: `${siteUrl}/api/logistics/ecpay/map/reply`,
      device: /Mobile|Android|iPhone|iPad/i.test(ua) ? 1 : 0,
    })

    return NextResponse.json({ action: cfg.mapUrl, params, sandbox: cfg.sandbox })
  } catch (err) {
    console.error('[ecpay-logistics] map route error:', err)
    return NextResponse.json({ error: '地圖開啟失敗，請稍後再試' }, { status: 500 })
  }
}
