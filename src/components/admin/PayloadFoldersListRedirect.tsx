import { redirect } from 'next/navigation'

/**
 * PayloadFoldersListRedirect
 * ──────────────────────────
 * 把 `/admin/collections/payload-folders` 的預設清單頁（純文字 table，
 * 列出 name / parent / updatedAt）導向 Media 集合的 By-Folder 視覺化瀏覽器
 * `/admin/collections/media/payload-folders`（樹狀 + 縮圖 grid + drag-drop）。
 *
 * 為什麼要這樣：
 *   - 「媒體資料夾」nav 連結放在「媒體資源」group 是 PR #137 為了把 folder
 *     入口分組到正確位置；但點進去看到的是 Payload 預設的 collection
 *     表格列表，跟視覺版相比明顯比較不直覺
 *   - Payload 的 nav 連結固定指向 `/admin/collections/<slug>`，無法直接改
 *     URL；最乾淨的解法是覆寫 `views.list.Component` 然後 server-side
 *     redirect 到視覺版路徑
 *   - 編輯個別資料夾走 `views.edit`（`/admin/collections/payload-folders/<id>`），
 *     是另一條路由，不受此 redirect 影響
 *
 * 對應 src/payload.config.ts `folders.collectionOverrides[0]`。
 */
export default function PayloadFoldersListRedirect() {
  redirect('/admin/collections/media/payload-folders')
}
