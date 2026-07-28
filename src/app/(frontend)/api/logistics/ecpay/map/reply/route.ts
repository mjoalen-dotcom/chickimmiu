import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/logistics/ecpay/map/reply — 電子地圖的 ServerReplyURL。
 * 綠界在顧客選完門市後，用「顧客瀏覽器」對這裡發表單 POST（欄位：
 * MerchantID / LogisticsSubType / CVSStoreID / CVSStoreName /
 * CVSAddress / CVSTelephone / CVSOutSide / ExtraData），規格沒有
 * CheckMacValue 可驗。這裡不碰資料庫，只把門市資訊塞進 query
 * 303 導回結帳頁；結帳頁 mount 時讀 query 回填 storeInfo（表單
 * 其他欄位靠 sessionStorage 草稿還原，購物車本身是 persist 的）。
 *
 * 門市名稱/地址是公開資訊，走 query string 無隱私疑慮；303 之後
 * 結帳頁會 history.replaceState 清掉參數。
 */
export const dynamic = 'force-dynamic'

function checkoutUrl(req: NextRequest, store?: Record<string, string>): URL {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, '')
  const url = new URL('/checkout', siteUrl)
  if (store && store.CVSStoreID) {
    url.searchParams.set('cvs', '1')
    url.searchParams.set('cvsStoreId', store.CVSStoreID)
    url.searchParams.set('cvsStoreName', store.CVSStoreName || '')
    url.searchParams.set('cvsAddress', store.CVSAddress || '')
    if (store.CVSTelephone) url.searchParams.set('cvsTelephone', store.CVSTelephone)
    if (store.LogisticsSubType) url.searchParams.set('cvsSubType', store.LogisticsSubType)
  }
  return url
}

export async function POST(req: NextRequest) {
  const store: Record<string, string> = {}
  try {
    const text = await req.text()
    new URLSearchParams(text).forEach((v, k) => {
      store[k] = v
    })
  } catch {
    /* 空門市 → 導回結帳頁，前端維持原狀 */
  }
  return NextResponse.redirect(checkoutUrl(req, store), 303)
}

// 顧客在地圖頁按上一頁或直接 GET 時，單純導回結帳頁
export async function GET(req: NextRequest) {
  return NextResponse.redirect(checkoutUrl(req), 303)
}
