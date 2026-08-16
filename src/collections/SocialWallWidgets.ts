import { randomBytes } from 'node:crypto'
import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { socialWallOwnerOrAdminAccess } from '../lib/social-wall/owner-access'

const assignWidgetIdentity: CollectionBeforeValidateHook = ({ data, operation }) => {
  if (operation === 'create' && !data?.publicId) {
    return { ...data, publicId: `wall_${randomBytes(9).toString('base64url').toLowerCase()}` }
  }
  return data
}

const setWidgetOwner: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (!req.user?.id) throw new Error('登入後才能儲存社群牆')
  const isPlatformAdmin = 'role' in req.user && req.user.role === 'admin'
  const owner = isPlatformAdmin ? data?.owner : req.user.id
  if (operation === 'create' && !owner) throw new Error('社群牆必須指定擁有者')

  if (data?.connection && !isPlatformAdmin) {
    await req.payload.findByID({
      collection: 'social-wall-connections',
      id: typeof data.connection === 'object' ? data.connection.id : data.connection,
      overrideAccess: false,
      req,
    })
  }

  return isPlatformAdmin ? data : { ...data, owner: req.user.id }
}

export const SocialWallWidgets: CollectionConfig = {
  slug: 'social-wall-widgets',
  labels: { singular: '社群牆', plural: '社群牆' },
  admin: {
    group: 'Ⓦ 牆聚 WallGather',
    useAsTitle: 'name',
    defaultColumns: ['name', 'owner', 'status', 'publicId', 'updatedAt'],
    description: '網站嵌入元件與繁中視覺設定；前台不直接公開 collection API。',
  },
  access: {
    read: (args) => socialWallOwnerOrAdminAccess(args),
    create: ({ req: { user } }) => Boolean(user?.id),
    update: (args) => socialWallOwnerOrAdminAccess(args),
    delete: (args) => socialWallOwnerOrAdminAccess(args),
  },
  hooks: { beforeValidate: [assignWidgetIdentity], beforeChange: [setWidgetOwner] },
  fields: [
    { name: 'owner', label: '擁有者', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'connection', label: '社群連線', type: 'relationship', relationTo: 'social-wall-connections', required: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'name', label: '名稱', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'publicId', label: '公開 Widget ID', type: 'text', required: true, unique: true, index: true, admin: { width: '50%', readOnly: true } },
      ],
    },
    {
      name: 'status', label: '狀態', type: 'select', required: true, defaultValue: 'draft', index: true,
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已發布', value: 'published' },
        { label: '已暫停', value: 'suspended' },
        { label: '已封存', value: 'archived' },
      ],
    },
    {
      name: 'appearance', label: '視覺設定', type: 'group',
      fields: [
        {
          type: 'row', fields: [
            { name: 'layout', label: '版型', type: 'select', required: true, defaultValue: 'grid', options: [{ label: '網格', value: 'grid' }, { label: '橫向滑動', value: 'carousel' }], admin: { width: '25%' } },
            { name: 'columns', label: '桌面欄數', type: 'number', required: true, defaultValue: 3, min: 2, max: 4, admin: { width: '25%' } },
            { name: 'gap', label: '間距 px', type: 'number', required: true, defaultValue: 12, min: 0, max: 28, admin: { width: '25%' } },
            { name: 'radius', label: '圓角 px', type: 'number', required: true, defaultValue: 16, min: 0, max: 32, admin: { width: '25%' } },
          ],
        },
        {
          type: 'row', fields: [
            { name: 'theme', label: '主題', type: 'select', required: true, defaultValue: 'light', options: [{ label: '亮色', value: 'light' }, { label: '沙色', value: 'sand' }, { label: '深色', value: 'dark' }], admin: { width: '34%' } },
            { name: 'showCaption', label: '顯示貼文說明', type: 'checkbox', defaultValue: true, admin: { width: '33%' } },
            { name: 'showStats', label: '顯示互動數', type: 'checkbox', defaultValue: true, admin: { width: '33%' } },
          ],
        },
      ],
    },
    { name: 'maxPosts', label: '最多顯示貼文', type: 'number', required: true, defaultValue: 12, min: 1, max: 50 },
    { name: 'publishedAt', label: '發布時間', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
