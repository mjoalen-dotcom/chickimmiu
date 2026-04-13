import type { Access, FieldAccess } from 'payload'

/**
 * Collection 層級：只有 admin 角色可通過
 */
export const isAdmin: Access = ({ req: { user } }) => {
  return Boolean(user && user.role === 'admin')
}

/**
 * Field 層級：只有 admin 角色可通過（用於限制欄位讀寫，例如 role 欄位）
 */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  return Boolean(user && user.role === 'admin')
}
