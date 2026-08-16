import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * WishlistItems Collection — 會員收藏清單（DB 持久化）
 * ──────────────────────────────────────────────────
 * 每筆 = 一個 (會員, 商品) 收藏關係（row-per-item，非整包 array）。
 * 好處：加入 / 移除 = 單筆 create / delete；天然去重（API 端檢查 user+product
 *       唯一）；「此商品是否已收藏」= 單筆 count 查詢；高流量友善。
 *
 * 為何要 DB：原本收藏只存 localStorage（換裝置 / 清快取就消失）。改用此表後：
 *   - 登入時 client 端 WishlistSync 會把 localStorage 的收藏 merge 進 DB，
 *     再以 DB 為準回填 zustand store（跨裝置一致）。
 *   - 登入狀態下 add / remove 會即時同步到此表。
 *   - 未登入仍純走 localStorage（此表不寫）。
 *
 * 寫入 / 讀取路徑：前台 → /api/account/wishlist（GET/POST/DELETE）
 *   + /api/account/wishlist/merge（登入時批次合併）→ 皆以 cookie 驗證的 user 為界。
 *
 * 注意：前台一律走上述 API（overrideAccess + 以 authed user 限縮），admin 端
 *   存取設為 isAdmin（後台可查特定會員收藏）。
 */
export const WishlistItems: CollectionConfig = {
  slug: 'wishlist-items',
  labels: { singular: '收藏項目', plural: '收藏清單' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'product', 'createdAt'],
    group: '③ 會員與 CRM',
    description: '會員收藏清單（DB 持久化，跨裝置）。前台「收藏」愛心寫入此表。',
    pagination: { defaultLimit: 50, limits: [25, 50, 100, 200] },
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  indexes: [
    // 同一會員同一商品只應有一筆；查「我的收藏」/「是否已收藏」都靠這組
    { fields: ['user', 'product'], unique: true },
  ],
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
    },
    {
      name: 'product',
      label: '商品',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
  ],
  timestamps: true,
}
