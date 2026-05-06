import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildCatalogFeed } from '@/lib/ads/feedBuilder'
import type { AdsCatalogSetting } from '@/payload-types'

/**
 * /feeds/google.xml
 * ──────────────────
 * Google Merchant Center 商品 feed（RSS 2.0 + g: namespace）
 *
 * 後台路徑：Merchant Center → 產品 → 動態消息 → 已排定的擷取 → 貼此 URL
 * 平台預設爬取頻率：可選每天 / 每 7 天 / 每 30 天
 *
 * 與 /feeds/meta.xml 共用 buildCatalogFeed()；目前僅 channel <title>/<description> 有差，
 * 之後若要分流（例如 Google 多輸出 product_highlight / pattern / material 等欄位）
 * 可在 feedBuilder 加 flavor branch。
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config })

  const settings = (await payload.findGlobal({
    slug: 'ads-catalog-settings',
    depth: 0,
  })) as AdsCatalogSetting

  const requiredToken = settings?.general?.feedSecretToken?.trim()
  if (requiredToken) {
    const provided = request.nextUrl.searchParams.get('token')?.trim() || ''
    if (provided !== requiredToken) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://chickimmiu.com'

  const result = await buildCatalogFeed({ payload, flavor: 'google', siteUrl })

  if (!result.enabled) {
    return new NextResponse('Feed disabled — enable in 廣告目錄設定', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new NextResponse(result.xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${result.cacheTtlSeconds}, s-maxage=${result.cacheTtlSeconds}`,
      'X-Feed-Items': String(result.itemCount),
      'X-Feed-Products': String(result.productCount),
      'X-Feed-Flavor': 'google',
    },
  })
}
