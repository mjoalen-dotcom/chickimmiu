import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const revalidate = 60

type ShippingType = 'convenience_store' | 'home_delivery' | 'international'

type CarrierCode =
  | 'tcat'
  | 'hct'
  | '711'
  | 'family'
  | 'hilife'
  | 'ok'
  | 'post'
  | 'dhl'
  | 'fedex'
  | 'other'

function carrierType(carrier: string): ShippingType {
  switch (carrier) {
    case '711':
    case 'family':
    case 'hilife':
    case 'ok':
      return 'convenience_store'
    case 'dhl':
    case 'fedex':
      return 'international'
    case 'tcat':
    case 'hct':
    case 'post':
    case 'other':
    default:
      return 'home_delivery'
  }
}

type RawMethod = {
  id: string | number
  name?: string
  carrier?: CarrierCode
  description?: string
  baseFee?: number
  freeShippingThreshold?: number
  estimatedDays?: string
  sortOrder?: number
  regions?: string[]
}

type RawGlobalShipping = {
  globalFreeShippingThreshold?: number
  defaultShippingFee?: number
}

export async function GET() {
  try {
    const payload = await getPayload({ config })

    const global = (await payload.findGlobal({ slug: 'global-settings' })) as {
      shipping?: RawGlobalShipping
    }
    const shipping = global.shipping ?? {}
    const globalFreeShippingThreshold =
      typeof shipping.globalFreeShippingThreshold === 'number'
        ? shipping.globalFreeShippingThreshold
        : 1000
    const defaultShippingFee =
      typeof shipping.defaultShippingFee === 'number' ? shipping.defaultShippingFee : 60

    const result = await payload.find({
      collection: 'shipping-methods',
      where: { isActive: { equals: true } },
      limit: 100,
      sort: 'sortOrder',
      depth: 0,
    })

    const methods = (result.docs as RawMethod[]).map((m) => {
      const carrier = (m.carrier ?? 'other') as CarrierCode
      return {
        id: String(m.id),
        name: m.name ?? '',
        carrier,
        description: m.description ?? '',
        fee: typeof m.baseFee === 'number' ? m.baseFee : defaultShippingFee,
        freeThreshold:
          typeof m.freeShippingThreshold === 'number' && m.freeShippingThreshold > 0
            ? m.freeShippingThreshold
            : globalFreeShippingThreshold,
        estimatedDays: m.estimatedDays ?? '',
        type: carrierType(carrier),
        regions: Array.isArray(m.regions) ? m.regions : ['taiwan'],
      }
    })

    return NextResponse.json(
      {
        globalFreeShippingThreshold,
        defaultShippingFee,
        methods,
      },
      {
        headers: {
          // Cache 1min public; content rarely changes
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (err) {
    console.error('[api/shipping-settings]', err)
    // Fallback payload so UI can still render with sane defaults
    return NextResponse.json(
      {
        globalFreeShippingThreshold: 1000,
        defaultShippingFee: 60,
        methods: [],
        error: 'failed',
      },
      { status: 500 },
    )
  }
}
