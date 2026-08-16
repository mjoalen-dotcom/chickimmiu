import type { Access } from 'payload'

/**
 * Admin 看全部；其他角色只能看自己的資料
 * 回傳 Where 物件時，Payload 會把它轉成 SQL WHERE 條件
 */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false

  // req.user 是 User | Customer 聯集（見 access/isAdmin.ts 註解）。Customer
  // 沒有 role，這裡讀不到 'admin'，直接落到下面的 self-scoping，正是顧客
  // 只能看自己資料的預期行為。
  if ((user as { role?: string }).role === 'admin') return true

  return {
    id: {
      equals: user.id,
    },
  }
}
