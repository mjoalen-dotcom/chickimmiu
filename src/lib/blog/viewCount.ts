/**
 * 部落格文章閱讀次數
 * ──────────────────
 * `blog-posts.viewCount` 原本只是個手填欄位（用來承接 PIXNET 搬過來的歷史人氣，
 * 目前 104 篇裡 47 篇有值、合計約 200 萬），全 codebase 沒有任何地方遞增它，
 * 所以後台看到的數字完全不反映站上實際被讀了幾次。
 *
 * 這裡補上自動遞增，並刻意維持「人工仍可修改」：
 *
 *  - **原子疊加而非覆寫**：一律用條件式 `view_count = COALESCE(view_count,0) + 1`。
 *    這樣歷史基數與人工校正值都會被保留，只是往上加；也避免 read-modify-write
 *    在並行下丟失計數。
 *  - **不碰 updated_at**：走原生 SQL 而不是 payload.update()。後台文章列表預設
 *    以 -updatedAt 排序，如果每有人讀一篇就把 updatedAt 推新，列表會被閱讀流量
 *    洗版，「最近編輯過什麼」這個資訊等於報廢。
 *  - **不過濾 status**：計的是「這個頁面實際被送出去並被讀完」，服務端已經決定
 *    要不要給看了。在這裡再過濾一次只會製造難以察覺的漏計。
 *
 * 兩個閱讀來源都會進來：
 *  1. pre.chickimmiu.com/blog/[slug] → BlogViewBeacon → /api/blog/view
 *  2. blog.kimlafayette.com（靜態站）→ 既有的 /api/kim-blog/analytics/track
 *     （路徑形如 `kim-blog:/blog/5069384750/`，那串數字就是 slug）
 */
import { sql } from '@payloadcms/db-sqlite'

import { runSql, affectedRows } from '../db/dialectSafeSql'
import { checkRateLimit } from '../rateLimit'

/** 同一個人重複讀同一篇，這段時間內只計一次 */
export const VIEW_DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000

/**
 * 從路徑取出文章 slug。
 * 吃得下這幾種：
 *   /blog/5069384750
 *   /blog/5069384750/
 *   /blog/5069384750/?visual=20260730
 *   kim-blog:/blog/5069384750/
 * 取不到就回 null（例如 /blog/ 本身、或根本不是文章頁）。
 */
export function extractBlogSlug(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null
  // 去掉 kim-blog: 前綴與 query/hash
  const path = rawPath.replace(/^kim-blog:/, '').split(/[?#]/)[0]
  const m = /^\/blog\/([^/]+)\/?$/.exec(path)
  if (!m) return null
  let slug: string
  try {
    slug = decodeURIComponent(m[1])
  } catch {
    slug = m[1]
  }
  slug = slug.trim()
  // 長度上限與內容基本檢查（slug 目前都是數字，但不寫死以免未來改格式就漏計）
  if (!slug || slug.length > 200) return null
  return slug
}

/**
 * 判斷這次是否該計入（去重）。
 * 用既有的記憶體限流器當去重器：同一 key 在視窗內只放行一次。
 *
 * 取捨說明：記憶體桶在 pm2 重啟後會清空、也不跨 process 共用，所以重啟前後
 * 同一人可能被多計一次。對「閱讀次數」這種聚合指標可接受，換來的是不需要
 * 任何 client 端儲存、也不需要為了去重而多存一張表或多記一個識別碼。
 */
export function shouldCountView(dedupeKey: string): boolean {
  return checkRateLimit(`blogview:${dedupeKey}`, 1, VIEW_DEDUPE_WINDOW_MS).allowed
}

/**
 * 原子遞增指定 slug 的閱讀次數。
 * @returns true = 有這篇文章且已 +1；false = 查無此 slug（不視為錯誤）
 */
export async function incrementBlogViewCount(
  payload: unknown,
  slug: string,
): Promise<boolean> {
  const res = await runSql(
    payload,
    sql`UPDATE blog_posts
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE slug = ${slug}`,
  )
  return affectedRows(res) > 0
}
