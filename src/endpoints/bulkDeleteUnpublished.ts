import type { Endpoint, PayloadRequest } from 'payload'

/**
 * POST /api/products/admin/bulk-delete-unpublished
 * ─────────────────────────────────────────────────
 * Admin-only：一鍵清理「未上架（draft）+ 已下架（archived）」商品。
 *
 * 三個 action：
 *   - 'scan'    → 列出所有非 published 商品（id/name/slug/status/totalSold/...）
 *   - 'inspect' → 給單一 product id，列出 5 個關鍵 collection 的引用筆數 + 樣本
 *                 用來診斷「為什麼這個測試商品刪不掉」
 *   - 'delete'  → body { ids: number[] }，逐個 `req.payload.delete`，
 *                 失敗時把錯誤訊息忠實回傳，不擋其他 id
 *
 * 為什麼不查全部 22 個 reference collection：
 *   - DB schema 顯示所有 FK 都是 ON DELETE SET NULL / CASCADE
 *     （baseline migration line 264/550/1658/1820/1878/2152/...），
 *     所以「FK 卡住刪除」幾乎不會發生
 *   - 真正可能擋刪除的是 access policy / hook，而試刪一次就能抓到錯誤
 *   - 只列 5 個對營運最有意義的 collection：訂單 / 退貨 / 退款 / 換貨 / 評價
 *     這 5 個 row 存在 = 商品真的賣過 → 通常該保留只標 archived，不要硬刪
 *
 * 對齊既有 endpoint pattern：bulkFixLinks / linkIntegrityScan
 *   - admin role gate
 *   - overrideAccess: true
 *   - 同步 for-loop，無 transaction（封測量級夠用）
 */

type ScanBody = { action: 'scan'; limit?: number }
type InspectBody = { action: 'inspect'; id: number }
type DeleteBody = { action: 'delete'; ids: number[] }
type Body = ScanBody | InspectBody | DeleteBody

type RefSlot = {
  collection: 'orders' | 'returns' | 'refunds' | 'exchanges' | 'product-reviews'
  path: string
  label: string
}

const REF_SLOTS: RefSlot[] = [
  { collection: 'orders', path: 'items.product', label: '訂單' },
  { collection: 'returns', path: 'items.product', label: '退貨單' },
  { collection: 'refunds', path: 'items.product', label: '退款單' },
  { collection: 'exchanges', path: 'items.product', label: '換貨單' },
  { collection: 'product-reviews', path: 'product', label: '商品評價' },
]

export const bulkDeleteUnpublishedEndpoint: Endpoint = {
  path: '/admin/bulk-delete-unpublished',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const user = req.user
    if (!user || (user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    let body: Body
    try {
      body = (await req.json?.()) as Body
      if (!body || !body.action) {
        return Response.json({ error: 'missing action' }, { status: 400 })
      }
    } catch {
      return Response.json({ error: 'invalid json' }, { status: 400 })
    }

    try {
      switch (body.action) {
        case 'scan':
          return await handleScan(req, body)
        case 'inspect':
          return await handleInspect(req, body)
        case 'delete':
          return await handleDelete(req, body)
        default:
          return Response.json({ error: 'unknown action' }, { status: 400 })
      }
    } catch (e) {
      req.payload.logger.error({ msg: 'bulk-delete-unpublished failed', err: e })
      return Response.json(
        { error: 'internal', detail: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      )
    }
  },
}

async function handleScan(req: PayloadRequest, body: ScanBody) {
  const limit = Math.min(Math.max(body.limit ?? 500, 1), 5000)
  const res = await req.payload.find({
    collection: 'products',
    where: { status: { not_equals: 'published' } },
    limit,
    pagination: false,
    depth: 0,
    sort: 'updatedAt',
    overrideAccess: true,
  })

  const docs = (res.docs as unknown as Array<Record<string, unknown>>).map((d) => ({
    id: d.id as number,
    name: (d.name as string) ?? '(未命名)',
    slug: (d.slug as string) ?? '',
    status: (d.status as string) ?? 'draft',
    totalSold: Number(d.totalSold ?? 0),
    stock: Number(d.stock ?? 0),
    price: Number(d.price ?? 0),
    createdAt: (d.createdAt as string) ?? null,
    updatedAt: (d.updatedAt as string) ?? null,
  }))

  const draftCount = docs.filter((d) => d.status === 'draft').length
  const archivedCount = docs.filter((d) => d.status === 'archived').length

  return Response.json({
    ok: true,
    action: 'scan',
    total: docs.length,
    draftCount,
    archivedCount,
    docs,
  })
}

async function handleInspect(req: PayloadRequest, body: InspectBody) {
  const id = Number(body.id)
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: 'invalid id' }, { status: 400 })
  }

  // 1) 商品本體
  let product: Record<string, unknown> | null = null
  try {
    product = (await req.payload.findByID({
      collection: 'products',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return Response.json({ error: 'product not found' }, { status: 404 })
  }

  // 2) 5 個關鍵 collection referrer 計數 + sample
  const referrers: Array<{
    collection: string
    label: string
    count: number
    samples: Array<{ id: number; meta?: string }>
  }> = []

  for (const slot of REF_SLOTS) {
    try {
      const r = await req.payload.find({
        collection: slot.collection,
        where: { [slot.path]: { equals: id } },
        limit: 5,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      // totalDocs 在 pagination:false 時不一定回，但 docs.length 已是 limit 內，
      // 為了拿真實 count 改用一次 limit:0 拉 count（Payload v3 支援 limit:0 + pagination:true）
      let count = r.docs.length
      try {
        const c = await req.payload.find({
          collection: slot.collection,
          where: { [slot.path]: { equals: id } },
          limit: 0,
          pagination: true,
          depth: 0,
          overrideAccess: true,
        })
        if (typeof c.totalDocs === 'number') count = c.totalDocs
      } catch {
        // fallback to docs.length
      }

      referrers.push({
        collection: slot.collection,
        label: slot.label,
        count,
        samples: (r.docs as unknown as Array<Record<string, unknown>>).map((d) => ({
          id: d.id as number,
          meta: pickMeta(slot.collection, d),
        })),
      })
    } catch (e) {
      referrers.push({
        collection: slot.collection,
        label: slot.label,
        count: -1,
        samples: [
          {
            id: 0,
            meta: `查詢失敗：${e instanceof Error ? e.message : String(e)}`,
          },
        ],
      })
    }
  }

  return Response.json({
    ok: true,
    action: 'inspect',
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      totalSold: Number(product.totalSold ?? 0),
      stock: Number(product.stock ?? 0),
    },
    referrers,
    hint: buildHint(product, referrers),
  })
}

async function handleDelete(req: PayloadRequest, body: DeleteBody) {
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((x) => Number.isFinite(x)) : []
  if (ids.length === 0) {
    return Response.json({ error: 'no ids' }, { status: 400 })
  }
  if (ids.length > 1000) {
    return Response.json({ error: 'too many ids (max 1000)' }, { status: 400 })
  }

  const deleted: number[] = []
  const failed: Array<{ id: number; name?: string; err: string }> = []

  for (const id of ids) {
    // 先讀名字 / 狀態，刪除前留個 log 線索
    let name: string | undefined
    let status: string | undefined
    try {
      const doc = (await req.payload.findByID({
        collection: 'products',
        id,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      name = doc.name as string
      status = doc.status as string
    } catch {
      failed.push({ id, err: '商品不存在或已被刪除' })
      continue
    }

    // 安全閘：只接受 draft / archived；published 一律拒（避免誤刪正在賣的商品）
    if (status === 'published') {
      failed.push({ id, name, err: '已上架商品不允許用此工具刪除（請先下架）' })
      continue
    }

    try {
      await req.payload.delete({
        collection: 'products',
        id,
        overrideAccess: true,
      })
      deleted.push(id)
    } catch (e) {
      failed.push({
        id,
        name,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return Response.json({
    ok: true,
    action: 'delete',
    requested: ids.length,
    deletedCount: deleted.length,
    failedCount: failed.length,
    deleted,
    failed,
  })
}

function pickMeta(slug: string, d: Record<string, unknown>): string {
  switch (slug) {
    case 'orders':
      return `訂單 #${d.orderNumber ?? d.id} · ${d.orderStatus ?? ''}`
    case 'returns':
      return `退貨單 #${d.returnNumber ?? d.id} · ${d.status ?? ''}`
    case 'refunds':
      return `退款單 #${d.refundNumber ?? d.id} · ${d.status ?? ''}`
    case 'exchanges':
      return `換貨單 #${d.exchangeNumber ?? d.id} · ${d.status ?? ''}`
    case 'product-reviews':
      return `評價 ★${d.rating ?? '?'} · ${(d.title as string | undefined)?.slice(0, 20) ?? ''}`
    default:
      return `#${d.id}`
  }
}

function buildHint(
  product: Record<string, unknown>,
  referrers: Array<{ label: string; count: number }>,
): string {
  const totalRefs = referrers.reduce((s, r) => s + Math.max(r.count, 0), 0)
  const status = product.status as string
  const totalSold = Number(product.totalSold ?? 0)

  if (status === 'published') {
    return '此商品目前處於「已上架」，本工具只能刪除 draft / archived。請先在商品列表把它改為「已下架」再來。'
  }
  if (totalRefs === 0) {
    return '✅ 沒有任何訂單 / 退換貨 / 評價引用，理論上可安全刪除。如果在後台列表點刪卻失敗，多半是 admin UI 沒按到確認，或網路問題；用本工具按「刪除已勾選」即可。'
  }
  const lines = referrers
    .filter((r) => r.count > 0)
    .map((r) => `  • ${r.label}: ${r.count} 筆`)
    .join('\n')
  return (
    `⚠️ 此商品被以下資料引用（FK 自動 SET NULL，刪除後這些紀錄的「商品」欄位會變空）：\n${lines}\n` +
    (totalSold > 0
      ? `\n📊 totalSold = ${totalSold}，代表確實有銷售紀錄。建議改為「已下架」保留銷售歷史，不要硬刪。`
      : '\n本工具仍可刪除，但會留下空 reference 的歷史單據。')
  )
}
