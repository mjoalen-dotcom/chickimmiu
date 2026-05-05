import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/currencies
 * ──────────────────────
 * 公開讀取啟用的幣別清單 + 對 TWD 匯率。前台 localeStore.fetchCurrencies()
 * 在 Providers mount 時呼叫一次，cache 進 zustand store 後直接讀。
 *
 * 失敗時回 fallback（TWD only），保證前台 UI 不爆。
 *
 * Response:
 *   {
 *     currencies: [
 *       { code: 'TWD', label: '新台幣', symbol: 'NT$',
 *         rateAgainstTwd: 1, decimalPlaces: 0, isActive: true, displayOrder: 1 },
 *       ...
 *     ]
 *   }
 */
export const dynamic = 'force-dynamic'

const FALLBACK_TWD = {
  code: 'TWD',
  label: '新台幣',
  symbol: 'NT$',
  rateAgainstTwd: 1,
  decimalPlaces: 0,
  isActive: true,
  displayOrder: 1,
}

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'currencies',
      where: { isActive: { equals: true } },
      sort: 'displayOrder',
      limit: 50,
      depth: 0,
    })

    const currencies = result.docs.map((doc: unknown) => {
      const d = doc as Record<string, unknown>
      return {
        code: String(d.code ?? ''),
        label: String(d.label ?? ''),
        symbol: String(d.symbol ?? ''),
        rateAgainstTwd: typeof d.rateAgainstTwd === 'number' ? d.rateAgainstTwd : 1,
        decimalPlaces: typeof d.decimalPlaces === 'number' ? d.decimalPlaces : 0,
        isActive: d.isActive !== false,
        displayOrder: typeof d.displayOrder === 'number' ? d.displayOrder : 100,
      }
    })

    return NextResponse.json({
      currencies: currencies.length > 0 ? currencies : [FALLBACK_TWD],
    })
  } catch {
    return NextResponse.json({ currencies: [FALLBACK_TWD] })
  }
}
