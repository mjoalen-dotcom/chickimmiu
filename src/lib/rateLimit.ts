/**
 * 簡易 in-memory rate limiter — sliding-window token log。
 *
 * 設計原則：
 *   - SQLite 單進程部署 → 單 Map 即可，無跨進程同步需求
 *   - 若未來升級多進程 / multi-pod，需改 Redis + Lua script atomic window
 *   - 不做 distributed 一致性：本限流僅擋濫用，不做 billing 層級的精確計數
 *   - 每個 key 儲存最多 maxRequests 筆時間戳，O(window) space per user
 *
 * 典型用法：
 *   const check = checkRateLimit(`social-submit:${userId}`, 10, 60_000)
 *   if (!check.allowed) return 429 with Retry-After: check.retryAfter
 */

const buckets = new Map<string, number[]>()

// 避免 Map 無限增長；每當 size 超門檻就做一次淡化掃描
const GC_THRESHOLD = 10_000
const GC_PROBABILITY = 0.01

export interface RateLimitResult {
  allowed: boolean
  /** 若未 allowed，建議客戶端幾秒後重試（秒數；下限 1）*/
  retryAfter: number
  /** 目前窗內已使用次數（含本次嘗試，未通過時不含）*/
  used: number
  /** 窗內上限 */
  limit: number
}

/**
 * @param key          同一限流桶的 key（建議含 userId + action）
 * @param maxRequests  窗內最多允許次數
 * @param windowMs     窗寬毫秒
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key) || []
  // Drop expired entries
  const fresh = bucket.filter((t) => now - t < windowMs)

  if (fresh.length >= maxRequests) {
    const oldest = fresh[0]
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
    // 不更新 bucket — 拒絕的請求不計入（否則會無限延後解禁）
    buckets.set(key, fresh)
    return { allowed: false, retryAfter, used: fresh.length, limit: maxRequests }
  }

  fresh.push(now)
  buckets.set(key, fresh)

  // Opportunistic GC — 有機率清掉久沒碰的 keys
  if (buckets.size > GC_THRESHOLD && Math.random() < GC_PROBABILITY) {
    const cutoff = now - windowMs * 4
    for (const [k, v] of buckets.entries()) {
      if (v.length === 0 || v[v.length - 1] < cutoff) {
        buckets.delete(k)
      }
    }
  }

  return { allowed: true, retryAfter: 0, used: fresh.length, limit: maxRequests }
}

/** 測試用：清空所有桶 */
export function _resetRateLimitForTests(): void {
  buckets.clear()
}

/**
 * 限流用的來源 IP（唯一正確實作，勿各自複製）
 * ─────────────────────────────────────────────
 * ⚠️ 絕不可取 X-Forwarded-For 的**第一段**——那段是 client 自己送的，
 * 攻擊者每次換一個假 IP 就能無限繞過限流。nginx 會設 X-Real-IP，並把真正
 * 的來源附加在 XFF 的**最後一段**，所以優先讀 X-Real-IP，退而取 XFF 末段。
 *
 * 2026-08-17 稽核：當時 5 個自訂限流各自實作，其中
 * newsletter/subscribe 與 kim-blog/analytics/track 取的是第一段（可繞過），
 * 已全部改用本函式。
 */
export function clientIpForRateLimit(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]!
  }
  return 'unknown'
}
