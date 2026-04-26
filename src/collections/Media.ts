import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { isAdmin } from '../access/isAdmin'
import { revalidateMedia } from '../lib/revalidate'
import { importFromSupplierEndpoint } from '../endpoints/importFromSupplier'

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
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'folder', 'mimeType', 'filesize', 'updatedAt'],
    listSearchableFields: ['filename', 'alt', 'folder'],
    description:
      '圖片 / 影片 / PDF 上傳。檔案大小上限：圖片 8 MB、影片 50 MB、PDF 10 MB。' +
      '支援格式：jpeg / png / webp / gif / mp4 / pdf。' +
      '若要上傳多張商品圖，請於「後台使用說明 → 商品圖整批上傳」查看正確資料夾命名與排序規則。',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: isAdmin,
  },
  endpoints: [importFromSupplierEndpoint],
  hooks: {
    // 上傳驗證：白名單 MIME、大小上限、禁路徑字元
    //   - 替 Payload 的 mimeTypes 做二次校驗（防 multipart 偽造）
    //   - Media 可被任何登入使用者上傳（access.create: Boolean(user)），
    //     UGC 也走這條，故 customer 攻擊面的主要防線在此
    beforeChange: [
      async ({ req, data, operation }) => {
        if (operation !== 'create') return data
        const f = req?.file
        if (!f) return data
        const mt = String(f.mimetype || '')
        const MAX_IMAGE = 8 * 1024 * 1024
        const MAX_VIDEO = 50 * 1024 * 1024
        const MAX_PDF = 10 * 1024 * 1024
        const max = mt.startsWith('video/')
          ? MAX_VIDEO
          : mt === 'application/pdf'
            ? MAX_PDF
            : MAX_IMAGE
        if (typeof f.size === 'number' && f.size > max) {
          throw new Error(`檔案過大（上限 ${Math.round(max / 1024 / 1024)}MB）`)
        }
        // Path traversal / subdir：禁 /、\、..（Payload 會再 sanitise，但多一層）
        const name = String(f.name || '')
        if (/[/\\]|\.\./.test(name)) {
          throw new Error('非法檔名（禁止路徑字元）')
        }
        // MIME 白名單二次把關（image/* 已在 upload.mimeTypes 收緊，這裡再確認）
        const allow = /^(image\/(jpeg|png|webp|gif)|video\/mp4|application\/pdf)$/
        if (!allow.test(mt)) {
          throw new Error('不支援的檔案格式')
        }
        return data
      },
    ],
    afterChange: [() => revalidateMedia()],
    afterDelete: [() => revalidateMedia()],
  },
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    // 去掉 image/* 萬用字元（image/svg+xml 是 XSS 向量）
    // 若未來要加 avif/heic 請顯式列出
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf'],
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
      name: 'uploadRulesNotice',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/MediaUploadRulesNotice',
        },
      },
    },
    {
      name: 'alt',
      label: '替代文字（SEO / 無障礙）',
      type: 'text',
      required: true,
      admin: {
        description: '給視障朋友與搜尋引擎用的圖片描述；例如「藍色洋裝正面商品照」。',
      },
    },
    {
      name: 'caption',
      label: '說明文字',
      type: 'text',
    },
    {
      name: 'folder',
      label: '相簿 / 資料夾名稱',
      type: 'text',
      index: true,
      admin: {
        description:
          '用於分類整理媒體資源，例如商品貨號（SS25-001）、活動名稱（2026-春季型錄）、' +
          '或用途分類（banner、lookbook、ugc）。列表頁可用此欄位搜尋或篩選。',
      },
    },
  ],
}
