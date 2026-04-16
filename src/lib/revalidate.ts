/**
 * Safe revalidation helper
 * ────────────────────────
 * 在 Payload collection hooks 裡觸發 Next.js ISR/data cache 失效。
 *
 * Payload hooks 有時會在「非 request context」下執行（例如 seed 腳本、
 * migration、background job），那時候 revalidatePath/revalidateTag 會
 * 丟錯。我們把它包起來，吃掉那種 error 就好——seed 腳本本來就沒有需要
 * 通知前端。
 *
 * 在正常 CMS 操作下（admin panel 裡存檔），hooks 是跑在 request context
 * 裡的，revalidate 會正常觸發 → 前台 /products 和 /products/[slug] 會
 * 立刻拿到新資料。
 */
import { revalidatePath, revalidateTag } from 'next/cache'

export function safeRevalidate(paths: string[] = [], tags: string[] = []): void {
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // Ignored: not in request context (seed / migration / job)
    }
  }
  for (const t of tags) {
    try {
      revalidateTag(t)
    } catch {
      // Ignored: not in request context
    }
  }
}

/**
 * 統一的商品相關路徑重新驗證
 * （/products 列表、/products/[slug] 詳細頁、首頁的 featured 區塊）
 */
export function revalidateProduct(slug?: string | null): void {
  const paths = ['/', '/products']
  if (slug) paths.push(`/products/${slug}`)
  safeRevalidate(paths, ['products'])
}

/**
 * 分類資料變動時
 * （分類頁 + 商品列表 + 首頁分類 block）
 */
export function revalidateCategory(slug?: string | null): void {
  const paths = ['/', '/products']
  if (slug) paths.push(`/category/${slug}`)
  safeRevalidate(paths, ['categories', 'products'])
}

/**
 * 媒體變動時（通常是圖片被換掉或重新上傳），統一 revalidate 前台所有主要頁。
 */
export function revalidateMedia(): void {
  safeRevalidate(['/', '/products'], ['products', 'media'])
}

/**
 * 全站 layout 變動（header、footer、公告 bar、全站追蹤碼等）
 * ────────────────────────────────────────
 * `revalidatePath('/', 'layout')` 會 invalidate root layout 的所有 sub-paths
 * 的 HTML + data cache，確保每個頁面下次請求都重新 render 並取得新的
 * header/footer 內容。
 *
 * 用於 NavigationSettings / GlobalSettings — 改了這兩個 global 影響整站。
 */
export function revalidateLayout(): void {
  try {
    revalidatePath('/', 'layout')
  } catch {
    // Ignored: not in request context
  }
}
