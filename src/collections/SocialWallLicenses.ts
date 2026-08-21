import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { isAdmin, isAdminFieldLevel } from '../access/isAdmin'
import { normalizeAllowedHostPattern } from '../lib/social-wall/domain-policy'
import { socialWallOwnerOrAdminAccess } from '../lib/social-wall/owner-access'

const normalizeLicensedHost: CollectionBeforeValidateHook = ({ data }) => {
  if (!data?.hostPattern) return data
  data.hostPattern = normalizeAllowedHostPattern(data.hostPattern, {
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  })
  return data
}

export const SocialWallLicenses: CollectionConfig = {
  slug: 'social-wall-licenses',
  labels: { singular: '網域授權', plural: '網域授權' },
  admin: {
    group: 'Ⓦ 牆聚 WallGather',
    useAsTitle: 'hostPattern',
    defaultColumns: ['hostPattern', 'widget', 'owner', 'status', 'issuedAt'],
    description: '精確網域或受限子網域授權；不保存可直接使用的原始 license key。',
  },
  access: {
    read: (args) => socialWallOwnerOrAdminAccess(args),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: { beforeValidate: [normalizeLicensedHost] },
  fields: [
    { name: 'owner', label: '擁有者', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'widget', label: '社群牆', type: 'relationship', relationTo: 'social-wall-widgets', required: true, index: true },
    { name: 'hostPattern', label: '授權網域', type: 'text', required: true, index: true, admin: { description: '例：blog.kimlafayette.com；正式環境不接受 localhost 或全域 *。' } },
    {
      name: 'status', label: '狀態', type: 'select', required: true, defaultValue: 'active', index: true,
      options: [{ label: '有效', value: 'active' }, { label: '暫停', value: 'suspended' }, { label: '撤銷', value: 'revoked' }, { label: '到期', value: 'expired' }],
    },
    {
      name: 'licenseKeyHash', label: '授權金鑰雜湊', type: 'text',
      access: { read: isAdminFieldLevel, create: isAdminFieldLevel, update: isAdminFieldLevel },
      admin: { readOnly: true, description: '只存不可逆雜湊；原始金鑰若啟用，僅核發時顯示一次。' },
    },
    {
      type: 'row', fields: [
        { name: 'issuedAt', label: '核發時間', type: 'date', required: true, defaultValue: () => new Date().toISOString(), admin: { width: '34%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'expiresAt', label: '授權到期', type: 'date', index: true, admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'revokedAt', label: '撤銷時間', type: 'date', admin: { width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
  ],
}
