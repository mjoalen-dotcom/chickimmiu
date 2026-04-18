import type { Access, CollectionConfig, Where } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * Per-user shopping cart (server-side persistence).
 * One row per user — enforced by `unique: true` on `user`. Guests have no row
 * and rely on localStorage only; merge happens on login via /api/cart.
 */
const isOwnCart: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { user: { equals: user.id } } as Where
}

export const Carts: CollectionConfig = {
  slug: 'carts',
  labels: { singular: '購物車', plural: '購物車' },
  admin: {
    group: '商城',
    useAsTitle: 'id',
    description: '會員登入後的伺服端購物車（一會員一筆）',
    defaultColumns: ['user', 'updatedAt'],
    hidden: ({ user }) => user?.role !== 'admin',
  },
  access: {
    read: isOwnCart,
    create: ({ req: { user } }) => Boolean(user),
    update: isOwnCart,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'user',
      label: '會員',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'items',
      label: '購物車內容',
      type: 'json',
      defaultValue: [],
      admin: {
        description: 'CartItem[] — productId / slug / name / image / price / salePrice / variant / quantity',
      },
    },
  ],
  timestamps: true,
}
