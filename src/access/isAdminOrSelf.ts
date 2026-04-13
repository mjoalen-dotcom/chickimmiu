import type { Access } from 'payload'

/**
 * Admin 看全部；其他角色只能看自己的資料
 * 回傳 Where 物件時，Payload 會把它轉成 SQL WHERE 條件
 */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false

  if (user.role === 'admin') return true

  return {
    id: {
      equals: user.id,
    },
  }
}
