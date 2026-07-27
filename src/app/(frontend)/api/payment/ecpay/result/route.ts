import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/payment/ecpay/result — AioCheckOut 的 OrderResultURL。
 * 綠界在顧客付款完成後，用顧客瀏覽器對這裡發 POST（帶同 callback 的欄位），
 * 我們只負責把人導回訂單成功頁。**狀態變更一律走 server-to-server 的
 * /callback**，這裡不碰資料庫，所以也不需要驗章（CustomField1 只拿來組
 * 自家站內路徑，無 open-redirect 風險）。
 */
export const dynamic = 'force-dynamic'

function successUrl(req: NextRequest, orderNumber: string): URL {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '')
  const dest = orderNumber
    ? `/checkout/success/${encodeURIComponent(orderNumber)}`
    : '/account/orders'
  return new URL(dest, siteUrl)
}

export async function POST(req: NextRequest) {
  let orderNumber = ''
  try {
    const text = await req.text()
    orderNumber = new URLSearchParams(text).get('CustomField1') || ''
  } catch {
    /* 導回訂單列表 */
  }
  return NextResponse.redirect(successUrl(req, orderNumber), 303)
}

// 直接用瀏覽器打（或綠界異常走 GET）時導去訂單列表
export async function GET(req: NextRequest) {
  return NextResponse.redirect(successUrl(req, ''), 303)
}
