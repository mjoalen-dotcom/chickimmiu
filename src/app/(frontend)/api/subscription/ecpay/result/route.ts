import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/subscription/ecpay/result — 訂閱 AioCheckOut 的 OrderResultURL。
 * 顧客瀏覽器付款完成後由綠界 POST 導回，這裡只負責把人帶回訂閱頁；
 * 狀態變更一律走 server-to-server 的 /callback（比照訂單 result 路由）。
 */
export const dynamic = 'force-dynamic'

function backUrl(req: NextRequest, paid: boolean): URL {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '')
  return new URL(`/account/subscription${paid ? '?paid=1' : ''}`, siteUrl)
}

export async function POST(req: NextRequest) {
  let paid = false
  try {
    const text = await req.text()
    paid = new URLSearchParams(text).get('RtnCode') === '1'
  } catch {
    /* 直接導回 */
  }
  return NextResponse.redirect(backUrl(req, paid), 303)
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(backUrl(req, false), 303)
}
