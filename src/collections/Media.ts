import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { isAdmin } from '../access/isAdmin'
import { revalidateMedia } from '../lib/revalidate'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Media Collection
 * ----------------
 * 所有圖片與檔案上傳的統一入口。
 * - staticDir 存放在專案根目錄的 public/media
 * - 自動產生多種尺寸（thumbnail / card / tablet / desktop）
 * - 只有管理員可以刪除，全站可讀取
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: '媒體資源',
    description: '圖片、影片與檔案上傳',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: isAdmin,
  },
  hooks: {
    afterChange: [() => revalidateMedia()],
    afterDelete: [() => revalidateMedia()],
  },
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*', 'video/mp4', 'application/pdf'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 400,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 1024,
        position: 'centre',
      },
      {
        name: 'tablet',
        width: 1024,
        position: 'centre',
      },
      {
        name: 'desktop',
        width: 1920,
        position: 'centre',
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: '替代文字（SEO / 無障礙）',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      label: '說明文字',
      type: 'text',
    },
  ],
}
