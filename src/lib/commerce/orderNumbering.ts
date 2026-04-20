import type { Payload } from 'payload'

/**
 * 訂單編號產生器（讀 OrderSettings.numbering）
 * ─────────────────────────────────────────
 * 規則：prefix + (includeDate ? YYYYMMDD : '') + zfill(seq, sequenceDigits)
 *   - sequenceResetDaily=yes：seq 每天從 1 開始（以 createdAt 當日日期為界）
 *   - sequenceResetDaily=no：seq 全局遞增（LIKE prefix% 找最大）
 *
 * 呼叫者：Orders.ts beforeChange — operation=create 時產生編號。
 *
 * Race condition：Orders.orderNumber unique 約束擋住 dup；上層可重試 1-2 次。
 * 若 race 連 3 次都中（幾乎不可能），fallback 用 timestamp 保證不擋下單。
 */

export type OrderNumberingSettings = {
  prefix?: string
  includeDate?: boolean
  sequenceDigits?: number
  sequenceResetDaily?: boolean
}

function pad(n: number, width: number): string {
  const s = String(Math.max(0, Math.floor(n)))
  return s.length >= width ? s : '0'.repeat(width - s.length) + s
}

function formatDate(now: Date): string {
  // 用 TW timezone（UTC+8）決定當日界線，避免 UTC 跨日造成客戶看到 seq 回退
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000
  const tw = new Date(utc + 8 * 60 * 60_000)
  const y = tw.getUTCFullYear()
  const m = pad(tw.getUTCMonth() + 1, 2)
  const d = pad(tw.getUTCDate(), 2)
  return `${y}${m}${d}`
}

export async function generateOrderNumber(
  payload: Payload,
  settings: OrderNumberingSettings | null | undefined,
  now: Date = new Date(),
): Promise<string> {
  const prefix = (settings?.prefix ?? 'CKMU').trim() || 'CKMU'
  const includeDate = settings?.includeDate !== false
  const digits = Math.max(1, Math.min(10, Math.floor(settings?.sequenceDigits ?? 3)))
  const resetDaily = settings?.sequenceResetDaily !== false

  const dateStr = includeDate ? formatDate(now) : ''
  const searchPrefix = `${prefix}${dateStr}`

  // 找目前最大 seq
  let seq = 1
  try {
    const likePattern =
      includeDate && resetDaily
        ? `${searchPrefix}%`
        : includeDate && !resetDaily
          ? `${prefix}%`
          : `${prefix}%`

    const existing = await payload.find({
      collection: 'orders',
      where: {
        orderNumber: { like: likePattern },
      },
      sort: '-orderNumber',
      limit: 1,
      depth: 0,
      pagination: false,
    })

    const lastDoc = existing.docs[0] as unknown as { orderNumber?: string } | undefined
    if (lastDoc?.orderNumber) {
      const tail = lastDoc.orderNumber.replace(searchPrefix, '')
      const parsed = parseInt(tail, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        seq = parsed + 1
      }
    }
  } catch (err) {
    payload.logger?.warn?.({
      err,
      msg: 'generateOrderNumber: failed to query max seq, falling back to 1',
    })
  }

  return `${searchPrefix}${pad(seq, digits)}`
}

/**
 * Backfill 的舊單編號：CKMU + zfill(id, 8)。beforeChange hook 碰到已有 orderNumber
 * 的情況不覆寫，所以這 helper 只給 migration / repair script 用。
 */
export function legacyOrderNumberFromId(id: number | string, prefix = 'CKMU'): string {
  const n = typeof id === 'number' ? id : parseInt(String(id), 10)
  const safe = Number.isFinite(n) && n > 0 ? n : 0
  return `${prefix}${pad(safe, 8)}`
}
