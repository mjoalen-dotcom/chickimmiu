import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CartVariant = {
  colorName?: string
  colorCode?: string
  size?: string
  sku?: string
}

type CartItem = {
  productId: string
  slug: string
  name: string
  image?: string
  price: number
  salePrice?: number
  variant?: CartVariant
  quantity: number
}

const MAX_ITEMS = 50
const MAX_QTY = 99

function sanitizeItems(input: unknown): CartItem[] {
  if (!Array.isArray(input)) return []
  const clean: CartItem[] = []
  for (const raw of input.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const productId = typeof r.productId === 'string' ? r.productId : ''
    const slug = typeof r.slug === 'string' ? r.slug : ''
    const name = typeof r.name === 'string' ? r.name : ''
    const price = typeof r.price === 'number' && r.price >= 0 ? r.price : 0
    const quantity =
      typeof r.quantity === 'number' && r.quantity > 0
        ? Math.min(Math.floor(r.quantity), MAX_QTY)
        : 0
    if (!productId || !slug || !name || quantity <= 0) continue

    const item: CartItem = { productId, slug, name, price, quantity }
    if (typeof r.image === 'string') item.image = r.image
    if (typeof r.salePrice === 'number' && r.salePrice >= 0) item.salePrice = r.salePrice
    if (r.variant && typeof r.variant === 'object') {
      const v = r.variant as Record<string, unknown>
      item.variant = {
        ...(typeof v.colorName === 'string' ? { colorName: v.colorName } : {}),
        ...(typeof v.colorCode === 'string' ? { colorCode: v.colorCode } : {}),
        ...(typeof v.size === 'string' ? { size: v.size } : {}),
        ...(typeof v.sku === 'string' ? { sku: v.sku } : {}),
      }
    }
    clean.push(item)
  }
  return clean
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    const result = await payload.find({
      collection: 'carts',
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 0,
    })

    const doc = result.docs[0] as { items?: unknown } | undefined
    const items = Array.isArray(doc?.items) ? (doc.items as CartItem[]) : []
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[api/cart GET]', err)
    return NextResponse.json({ items: [], error: 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: { items?: unknown }
  try {
    body = (await req.json()) as { items?: unknown }
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const items = sanitizeItems(body.items)

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthenticated' }, { status: 401 })
    }

    const existing = await payload.find({
      collection: 'carts',
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      const id = (existing.docs[0] as { id: string | number }).id
      await payload.update({
        collection: 'carts',
        id,
        data: { items: items as unknown as Record<string, unknown> },
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'carts',
        data: {
          user: Number(user.id),
          items: items as unknown as Record<string, unknown>,
        },
        overrideAccess: true,
      })
    }

    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('[api/cart POST]', err)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: 'unauthenticated' }, { status: 401 })
    }

    const existing = await payload.find({
      collection: 'carts',
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      const id = (existing.docs[0] as { id: string | number }).id
      await payload.update({
        collection: 'carts',
        id,
        data: { items: [] as unknown as Record<string, unknown> },
        overrideAccess: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/cart DELETE]', err)
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 })
  }
}
