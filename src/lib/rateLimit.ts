/**
 * In-memory rate-limit helper
 * ---------------------------
 * 單機 pm2 (Hetzner) 足夠。多節點要換 Redis / Cloudflare KV，
 * 因為 Map 狀態只活在單一 process。
 *
 * 狀態結構：{ count, resetAt }；resetAt 過期就重置 count。
 * Map 的 GC：自然過期（新 request 觸發 reset），無長期累積風險
 * 因為 key 空間被 IP+path 有限枚舉。
 */
type Hit = { count: number; resetAt: number }

const hits = new Map<string, Hit>()

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; remaining: 0; retryAfter: number }

export function check(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const record = hits.get(key)

  if (!record || record.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((record.resetAt - now) / 1000) }
  }

  record.count++
  return { ok: true, remaining: limit - record.count }
}
