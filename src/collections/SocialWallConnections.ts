import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdminFieldLevel } from '../access/isAdmin'
import { socialWallOwnerOrAdminAccess } from '../lib/social-wall/owner-access'

const setConnectionOwner: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  const isPlatformAdmin = Boolean(req.user && 'role' in req.user && req.user.role === 'admin')
  if (operation !== 'create' || isPlatformAdmin) return data
  if (!req.user?.id) throw new Error('登入後才能建立社群連線')
  return { ...data, owner: req.user.id }
}

export const SocialWallConnections: CollectionConfig = {
  slug: 'social-wall-connections',
  labels: { singular: '社群連線', plural: '社群連線' },
  admin: {
    group: 'Ⓦ 牆聚 WallGather',
    useAsTitle: 'username',
    defaultColumns: ['username', 'owner', 'provider', 'status', 'lastSyncedAt'],
    description: 'Meta 官方授權連線。存取權杖只保留祕密管理服務的參照，不在資料庫存明文。',
  },
  access: {
    read: (args) => socialWallOwnerOrAdminAccess(args),
    create: ({ req: { user } }) => Boolean(user?.id),
    update: (args) => socialWallOwnerOrAdminAccess(args),
    delete: (args) => socialWallOwnerOrAdminAccess(args),
  },
  hooks: { beforeChange: [setConnectionOwner] },
  fields: [
    { name: 'owner', label: '擁有者', type: 'relationship', relationTo: 'customers', required: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'provider', label: '平台', type: 'select', required: true, defaultValue: 'instagram', options: [{ label: 'Instagram', value: 'instagram' }], admin: { width: '33%' } },
        { name: 'externalAccountId', label: '平台帳號 ID', type: 'text', required: true, index: true, admin: { width: '33%', readOnly: true } },
        { name: 'username', label: '帳號名稱', type: 'text', required: true, admin: { width: '34%' } },
      ],
    },
    { name: 'displayName', label: '顯示名稱', type: 'text' },
    { name: 'profilePictureUrl', label: '頭像網址', type: 'text' },
    {
      name: 'status', label: '連線狀態', type: 'select', required: true, defaultValue: 'pending', index: true,
      options: [
        { label: '等待授權', value: 'pending' },
        { label: '已連線', value: 'active' },
        { label: '權限到期', value: 'expired' },
        { label: '已撤銷', value: 'revoked' },
        { label: '同步錯誤', value: 'error' },
      ],
    },
    {
      name: 'tokenReference',
      label: '存取權杖祕密參照',
      type: 'text',
      access: { read: isAdminFieldLevel, create: isAdminFieldLevel, update: isAdminFieldLevel },
      admin: { description: '只存 Vault／祕密管理服務 key，不存 Meta token 本文。', readOnly: true },
    },
    {
      type: 'row',
      fields: [
        { name: 'tokenExpiresAt', label: '授權到期', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'lastSyncedAt', label: '最後同步', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'nextSyncAt', label: '下次同步', type: 'date', admin: { width: '34%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    { name: 'lastError', label: '最近錯誤', type: 'textarea', admin: { readOnly: true } },
  ],
}
