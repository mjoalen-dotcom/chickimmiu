import type { Access } from 'payload'

/**
 * 任何已登入使用者皆可通過
 */
export const isLoggedIn: Access = ({ req: { user } }) => {
  return Boolean(user)
}
