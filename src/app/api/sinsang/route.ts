import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Sinsang Market API Proxy
 * GET /api/sinsang?id={商品ID}
 *
 * 從後台讀取 access token，轉發到 Sinsang Market API
 * 僅限 admin 角色呼叫
 */
export async function GET(req: NextRequest) {
  try {
    const goodsId = req.nextUrl.searchParams.get('id')

    if (!goodsId || !/^\d+$/.test(goodsId)) {
      return NextResponse.json(
        { success: false, error: '請輸入有效的商品 ID（純數字）' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // 讀取系統設定中的 token
    const globalSettings = await payload.findGlobal({ slug: 'global-settings' })
    const sinsang = globalSettings.sinsangMarket as unknown as Record<string, unknown> | undefined
    const accessToken = sinsang?.accessToken as string | undefined
    const defaultRate = (sinsang?.krwToTwdRate as number) ?? 0.023

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: '連線逾時，請至系統設定更新 Access Token' },
        { status: 401 },
      )
    }

    // 呼叫 Sinsang Market API
    const apiUrl = `https://abara.sinsang.market/api/v1/goods/${goodsId}/detail`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'access-token': accessToken,
        platform: 'WEB',
        global: 'zh-TW',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      if (response.status === 404 || response.status === 400) {
        return NextResponse.json(
          { success: false, error: '查無此商品，請確認 ID 是否正確' },
          { status: 404 },
        )
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { success: false, error: '連線逾時，請至系統設定更新 Access Token' },
          { status: 401 },
        )
      }
      return NextResponse.json(
        { success: false, error: `Sinsang API 回傳錯誤 (${response.status})` },
        { status: response.status },
      )
    }

    const data = await response.json()

    if (!data?.content) {
      return NextResponse.json(
        { success: false, error: '查無此商品，請確認 ID 是否正確' },
        { status: 404 },
      )
    }

    const content = data.content as unknown as Record<string, unknown>

    // 格式化材質
    const mixtureRate = content.newMixtureRate as Array<{ material: string; rate: number }> | undefined
    const materialText = mixtureRate
      ? mixtureRate.map(m => `${m.material} ${m.rate}%`).join('、')
      : ''

    // 布料資訊
    const fabric = content.fabric as unknown as Record<string, unknown> | undefined

    // 回傳格式化資料
    return NextResponse.json({
      success: true,
      defaultRate,
      data: {
        // 前台欄位
        name: content.name as string || '',
        priceKRW: content.price as number || 0,
        colors: (content.colorTranslated as string[]) || [],
        sizes: (content.size as string[]) || [],
        material: materialText,
        madeIn: (content.madeInCountry as string) || '',
        fabric: {
          thickness: (fabric?.thickness as string) || '',
          transparency: (fabric?.transparency as string) || '',
          elasticity: (fabric?.elasticity as string) || '',
        },
        // 後台內部欄位
        sourceId: String(content.wgIdx || goodsId),
        supplierName: (content.storeName as string) || '',
        supplierLocation: (content.storeLocation as string) || '',
        originalDescription: (content.description as string) || '',
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return NextResponse.json(
        { success: false, error: '無法連線至 Sinsang Market，請稍後再試' },
        { status: 504 },
      )
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { success: false, error: '無法連線至 Sinsang Market，請稍後再試' },
        { status: 503 },
      )
    }
    console.error('Sinsang proxy error:', error)
    return NextResponse.json(
      { success: false, error: '伺服器內部錯誤' },
      { status: 500 },
    )
  }
}
