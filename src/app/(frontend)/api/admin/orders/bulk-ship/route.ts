import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Order } from '@/payload-types'

type UniformBody = {
  mode: 'uniform'
  orderNumbers: string[]
  carrier: string
  trackingNumber: string
}

type MappingBody = {
  mode: 'mapping'
  rows: Array<{ orderNumber: string; carrier: string; trackingNumber: string }>
}

type Body = UniformBody | MappingBody

type ResultRow = { orderNumber: string; reason?: string }

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return Response.json({ error: '權限不足' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: '無效的請求內容' }, { status: 400 })
  }

  // Normalise payload into a uniform list of {orderNumber, carrier, trackingNumber} rows
  const rows: Array<{ orderNumber: string; carrier: string; trackingNumber: string }> = []
  if (body.mode === 'uniform') {
    if (!body.carrier || !body.trackingNumber || !Array.isArray(body.orderNumbers)) {
      return Response.json({ error: 'uniform 模式缺少 carrier / trackingNumber / orderNumbers' }, { status: 400 })
    }
    for (const n of body.orderNumbers) {
      const trimmed = String(n || '').trim()
      if (!trimmed) continue
      rows.push({ orderNumber: trimmed, carrier: body.carrier, trackingNumber: body.trackingNumber })
    }
  } else if (body.mode === 'mapping') {
    if (!Array.isArray(body.rows)) {
      return Response.json({ error: 'mapping 模式缺少 rows' }, { status: 400 })
    }
    for (const r of body.rows) {
      const orderNumber = String(r.orderNumber || '').trim()
      const carrier = String(r.carrier || '').trim()
      const trackingNumber = String(r.trackingNumber || '').trim()
      if (!orderNumber || !carrier || !trackingNumber) continue
      rows.push({ orderNumber, carrier, trackingNumber })
    }
  } else {
    return Response.json({ error: '未知的 mode（須為 uniform 或 mapping）' }, { status: 400 })
  }

  if (rows.length === 0) {
    return Response.json({ error: '沒有可處理的列' }, { status: 400 })
  }

  const succeeded: ResultRow[] = []
  const skipped: ResultRow[] = []

  for (const row of rows) {
    try {
      const found = await payload.find({
        collection: 'orders',
        where: { orderNumber: { equals: row.orderNumber } },
        limit: 1,
        depth: 0,
      })
      const order = found.docs[0]
      if (!order) {
        skipped.push({ orderNumber: row.orderNumber, reason: '訂單不存在' })
        continue
      }
      const status = (order as unknown as { status?: string }).status
      if (status === 'shipped' || status === 'delivered') {
        skipped.push({ orderNumber: row.orderNumber, reason: `已是 ${status} 狀態` })
        continue
      }
      if (status === 'cancelled' || status === 'refunded') {
        skipped.push({ orderNumber: row.orderNumber, reason: `${status} 訂單不可出貨` })
        continue
      }

      // Merge carrier into shippingMethod group; preserve existing fields.
      const existingShippingMethod = (order as Order).shippingMethod ?? {}
      const updateData: Partial<Order> = {
        shippingMethod: { ...existingShippingMethod, carrier: row.carrier },
        trackingNumber: row.trackingNumber,
        status: 'shipped',
      }

      await payload.update({
        collection: 'orders',
        id: order.id as number,
        data: updateData,
      })

      succeeded.push({ orderNumber: row.orderNumber })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      skipped.push({ orderNumber: row.orderNumber, reason: msg })
    }
  }

  return Response.json({
    succeededCount: succeeded.length,
    skippedCount: skipped.length,
    succeeded,
    skipped,
  })
}
