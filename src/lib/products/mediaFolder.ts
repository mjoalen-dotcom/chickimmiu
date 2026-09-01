import type { Payload } from 'payload'

/**
 * 商品圖的 Payload 原生媒體資料夾（payload-folders collection）。
 *
 * media 只寫進 collection 而不掛 `folder` 關聯的話，後台媒體庫會一律顯示
 * 「無資料夾」——2026-08/09 兩批一次性 SQL 共歸位 6009 張既有圖就是因為
 * 匯入路徑漏了這一步，這裡是根因修復的共用層（部落格側對應 scripts/
 * import-ckmu-shopline-blog.mjs 與 import-kim-pixnet-post.ts）。
 *
 * 慣例（既有 15,814 張商品圖已證實）：`商品 / <products.name>`。
 */
export const PRODUCT_ROOT_FOLDER_NAME = '商品'

/**
 * upsert 一個媒體資料夾，回傳 id。找不到就建。
 * folderType=['media'] 對應 PG 端 enum enum_payload_folders_folder_type、
 * SQLite 端 text，方言差異由 Payload adapter 處理。
 */
export async function ensureMediaFolder(
  payload: Payload,
  name: string,
  parentId: number | null,
): Promise<number> {
  const existing = await payload.find({
    collection: 'payload-folders',
    where: {
      and: [
        { name: { equals: name } },
        parentId == null ? { folder: { exists: false } } : { folder: { equals: parentId } },
      ],
    },
    sort: 'createdAt',
    limit: 1,
    depth: 0,
  })
  const found = existing.docs[0]
  if (found) return toFolderId(found.id, name)

  const created = await payload.create({
    collection: 'payload-folders',
    data: {
      name,
      folderType: ['media'],
      ...(parentId == null ? {} : { folder: parentId }),
    } as never,
  })
  return toFolderId(created.id, name)
}

/** media.folder 是 number 關聯（PG/SQLite 兩邊 id 都是整數），非整數視為異常。 */
function toFolderId(id: unknown, name: string): number {
  const n = Number(id)
  if (!Number.isFinite(n)) throw new Error(`資料夾「${name}」的 id 非數值：${String(id)}`)
  return n
}

/**
 * 解析（必要時建立）某商品的媒體資料夾 `商品 / <productName>`。
 *
 * 失敗時回 null 而非 throw —— 圖片本身已經下載/上傳成功，不該因為歸檔
 * 這個附屬步驟讓整批匯入掛掉；沒掛到資料夾的圖仍可事後補歸位。
 */
export async function resolveProductMediaFolder(
  payload: Payload,
  productName: unknown,
): Promise<number | null> {
  const name = typeof productName === 'string' ? productName.trim() : ''
  if (!name) return null
  try {
    const rootId = await ensureMediaFolder(payload, PRODUCT_ROOT_FOLDER_NAME, null)
    return await ensureMediaFolder(payload, name, rootId)
  } catch (err) {
    console.error(`[productMediaFolder] 無法解析「${name}」的媒體資料夾：`, err)
    return null
  }
}
