import type { Payload } from 'payload'

export function getCategoryId(c: unknown): number | null {
  if (c == null) return null
  if (typeof c === 'object' && 'id' in (c as Record<string, unknown>)) {
    const id = (c as { id: unknown }).id
    const n = Number(id)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(c)
  return Number.isFinite(n) ? n : null
}

export async function bumpCategoryCount(
  payload: Payload,
  categoryId: number,
  delta: number,
): Promise<void> {
  const cat = await payload.findByID({
    collection: 'categories',
    id: categoryId,
    depth: 0,
  })
  const current = cat?.productCount
  const currentNum = typeof current === 'number' ? current : 0
  const next = Math.max(0, currentNum + delta)
  await payload.update({
    collection: 'categories',
    id: categoryId,
    data: { productCount: next },
    depth: 0,
  })
}
