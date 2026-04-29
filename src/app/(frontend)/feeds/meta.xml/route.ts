import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { buildCatalogFeed } from '@/lib/ads/feedBuilder'
import type { AdsCatalogSetting } from '@/payload-types'

/**
 * /feeds/meta.xml
 * ────────────────
 * Meta Commerce Manager 商品 feed（RSS 2.0 + g: namespace）
 *
 * 後台路徑：Meta Commerce Manager → 目錄 → 資料來源 → 排程的 Feed → 貼此 URL
 * 平台預設爬取頻率：每天一次（可調 1-24 小時）
 *
 * Token 驗證：
 *   若 ads-catalog-settings.general.feedSecretToken 有值，
 *   則 URL 必須帶 ?token=<token> 參數，否則回 401。
 *
 * 快取：HTTP Cache-Control max-age 由 settings.general.feedCacheTtlMinutes 控制
 *      （Meta 爬蟲依此 cache，平台後台再依排程拉）
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const payload = await getPayload({ config })

  const settings = (await payload.findGlobal({
    slug: 'ads-catalog-settings',
    depth: 0,
  })) as AdsCatalogSetting

  // Token gate
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

  const result = await buildCatalogFeed({ payload, flavor: 'meta', siteUrl })

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
      'X-Feed-Flavor': 'meta',
    },
  })
}
