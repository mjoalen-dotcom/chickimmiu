import type { Payload } from 'payload'
import { normalizeMediaUrl } from '@/lib/media-url'

/**
 * 收藏清單 server 端共用工具
 * ──────────────────────────
 * 把 wishlist-items（含 depth 展開的 product）序列化成前台 zustand
 * WishlistItem 形狀，供 GET / merge 兩條 route 共用。
 */

export interface SerializedWishlistItem {
  productId: string
  slug: string
  name: string
  image?: string
  price: number
  salePrice?: number
}

function firstImage(product: Record<string, unknown>): string | undefined {
  const images = product.images as { image?: { url?: string } | number }[] | undefined
  if (!images?.length) return undefined
  const img = images[0]?.image
  if (typeof img === 'object' && img !== null) {
    return normalizeMediaUrl((img as { url?: string }).url)
  }
  return undefined
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** 把展開後的 product 物件轉成 WishlistItem；資料不全回 null（跳過）。 */
export function serializeProduct(
  product: Record<string, unknown>,
): SerializedWishlistItem | null {
  if (!product || typeof product !== 'object') return null
  const { id, slug, name } = product
  if (id == null || !slug || !name) return null
  return {
    productId: String(id),
    slug: String(slug),
    name: String(name),
    image: firstImage(product),
    price: toNumber(product.price) ?? 0,
    salePrice: toNumber(product.salePrice),
  }
}

/**
 * 讀某會員完整收藏清單（已序列化、依加入時間新→舊）。
 *
 * 刻意分兩段查：先 depth:0 取收藏列（只含 product id，不 populate user/product），
 * 再以一次 `id IN (...)` 把商品連同圖片 depth:1 撈回來。
 * 好處：(1) 不會連帶 populate user relationship（省查詢、也不依賴 users 表）；
 *       (2) 不論收藏幾筆都只 2 次查詢。
 * 已不存在的商品（被刪）自動略過。
 */
export async function getUserWishlist(
  payload: Payload,
  userId: string | number,
): Promise<SerializedWishlistItem[]> {
  const res = await payload.find({
    collection: 'wishlist-items',
    where: { user: { equals: userId } },
    depth: 0,
    limit: 500,
    sort: '-createdAt',
  })

  // 保留收藏順序的 product id 清單
  const orderedIds: string[] = []
  for (const doc of res.docs) {
    const p = doc.product
    const pid =
      typeof p === 'object' && p !== null
        ? String((p as { id: unknown }).id)
        : p != null
          ? String(p)
          : null
    if (pid) orderedIds.push(pid)
  }
  if (orderedIds.length === 0) return []

  const prodRes = await payload.find({
    collection: 'products',
    where: { id: { in: orderedIds } },
    depth: 1, // 展開 images[].image 取得圖片 url
    limit: 500,
  })

  const byId = new Map<string, SerializedWishlistItem>()
  for (const prod of prodRes.docs) {
    const s = serializeProduct(prod as unknown as Record<string, unknown>)
    if (s) byId.set(s.productId, s)
  }

  // 依收藏順序輸出，跳過已不存在的商品
  const items: SerializedWishlistItem[] = []
  for (const pid of orderedIds) {
    const s = byId.get(pid)
    if (s) items.push(s)
  }
  return items
}
