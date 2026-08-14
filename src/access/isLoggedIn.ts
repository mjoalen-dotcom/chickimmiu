import type { Access, FieldAccess } from 'payload'

/**
 * 任何已登入使用者皆可通過
 */
export const isLoggedIn: Access = ({ req: { user } }) => {
  return Boolean(user)
}

/**
 * Field 層級：任何已登入使用者皆可通過（用於限制內部欄位不對未登入公開）
 */
export const isLoggedInFieldLevel: FieldAccess = ({ req: { user } }) => {
  return Boolean(user)
}
