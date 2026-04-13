import type { Access } from 'payload'

/**
 * admin 與 partner 都可通過
 * 用於分潤、對帳等 Partner 後台相關 collection
 * 實際細節（partner 只能看自己的 commission）會在個別 collection 內再加 where 條件
 */
export const isAdminOrPartner: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.role === 'admin' || user.role === 'partner'
}
