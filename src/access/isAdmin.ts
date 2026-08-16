import type { Access, FieldAccess } from 'payload'

// req.user 現在是 User | Customer 的聯集（APP-API-001 步驟16：customers 分離
// 後兩個 collection 都有 auth）。Customer 沒有 role 欄位，所以這裡用寬鬆型別
// 讀取——顧客文件本身讀不到 'admin'，自然回傳 false，不需要另外判斷是哪個
// collection 來的principal。

/**
 * Collection 層級：只有 admin 角色可通過
 */
export const isAdmin: Access = ({ req: { user } }) => {
  return (user as { role?: string } | undefined)?.role === 'admin'
}

/**
 * Field 層級：只有 admin 角色可通過（用於限制欄位讀寫，例如 role 欄位）
 */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return (user as { role?: string } | undefined)?.role === 'admin'
}
