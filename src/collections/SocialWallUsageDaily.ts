import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { socialWallOwnerOrAdminAccess } from '../lib/social-wall/owner-access'

export const SocialWallUsageDaily: CollectionConfig = {
  slug: 'social-wall-usage-daily',
  labels: { singular: '社群牆每日用量', plural: '社群牆每日用量' },
  admin: {
    group: 'Ⓦ 牆聚 WallGather',
    useAsTitle: 'date',
    defaultColumns: ['date', 'widget', 'owner', 'successfulLoads', 'deniedLoads'],
    description: '依日彙總載入與拒絕次數；原始 IP 不保留。',
  },
  access: {
    read: (args) => socialWallOwnerOrAdminAccess(args),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'owner', label: '擁有者', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'widget', label: '社群牆', type: 'relationship', relationTo: 'social-wall-widgets', required: true, index: true },
    { name: 'date', label: '日期', type: 'text', required: true, index: true, admin: { description: 'UTC YYYY-MM-DD' } },
    {
      type: 'row', fields: [
        { name: 'successfulLoads', label: '成功載入', type: 'number', required: true, defaultValue: 0, min: 0, admin: { width: '33%' } },
        { name: 'deniedLoads', label: '拒絕載入', type: 'number', required: true, defaultValue: 0, min: 0, admin: { width: '33%' } },
        { name: 'uniqueHostCount', label: '來源網域數', type: 'number', required: true, defaultValue: 0, min: 0, admin: { width: '34%' } },
      ],
    },
  ],
}
