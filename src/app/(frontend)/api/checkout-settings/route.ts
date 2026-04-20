import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/checkout-settings
 * ───────────────────────────
 * 公開讀取 CheckoutSettings global。
 * Checkout page 在 client 端呼叫這支拿即時設定（TOS / 必填欄位 / minOrder / 備註）。
 * 失敗時回 fallback，確保結帳流程不會被 global 讀取錯擋住。
 */
export const dynamic = 'force-dynamic'

const FALLBACK = {
  requireTOS: true,
  tosLinkText: '同意服務條款與隱私權政策',
  requireMarketingConsent: false,
  marketingConsentText: '我願意收到 CHIC KIM & MIU 最新活動與優惠資訊',
  fieldRequirements: {
    phoneRequired: true,
    birthdayRequired: false,
    nationalIdRequired: false,
    genderRequired: false,
  },
  checkoutAsGuest: true,
  minOrderAmount: 0,
  maxItemsPerOrder: 99,
  notes: {
    allowOrderNote: true,
    orderNoteLabel: '給賣家的備註',
    orderNoteMaxLength: 200,
  },
}

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({
      slug: 'checkout-settings',
      depth: 0,
    })) as unknown as Record<string, unknown>

    const fieldReq = (settings.fieldRequirements ?? {}) as Record<string, unknown>
    const notes = (settings.notes ?? {}) as Record<string, unknown>

    return NextResponse.json({
      requireTOS: settings.requireTos !== false,
      tosLinkText: typeof settings.tosLinkText === 'string' && settings.tosLinkText
        ? settings.tosLinkText
        : FALLBACK.tosLinkText,
      requireMarketingConsent: Boolean(settings.requireMarketingConsent),
      marketingConsentText:
        typeof settings.marketingConsentText === 'string' && settings.marketingConsentText
          ? settings.marketingConsentText
          : FALLBACK.marketingConsentText,
      fieldRequirements: {
        phoneRequired: fieldReq.phoneRequired !== false,
        birthdayRequired: Boolean(fieldReq.birthdayRequired),
        nationalIdRequired: Boolean(fieldReq.nationalIdRequired),
        genderRequired: Boolean(fieldReq.genderRequired),
      },
      checkoutAsGuest: settings.checkoutAsGuest !== false,
      minOrderAmount:
        typeof settings.minOrderAmount === 'number' && Number.isFinite(settings.minOrderAmount)
          ? Math.max(0, settings.minOrderAmount)
          : 0,
      maxItemsPerOrder:
        typeof settings.maxItemsPerOrder === 'number' && Number.isFinite(settings.maxItemsPerOrder)
          ? Math.max(1, settings.maxItemsPerOrder)
          : FALLBACK.maxItemsPerOrder,
      notes: {
        allowOrderNote: notes.allowOrderNote !== false,
        orderNoteLabel:
          typeof notes.orderNoteLabel === 'string' && notes.orderNoteLabel
            ? notes.orderNoteLabel
            : FALLBACK.notes.orderNoteLabel,
        orderNoteMaxLength:
          typeof notes.orderNoteMaxLength === 'number' && Number.isFinite(notes.orderNoteMaxLength)
            ? Math.max(1, notes.orderNoteMaxLength)
            : FALLBACK.notes.orderNoteMaxLength,
      },
    })
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
