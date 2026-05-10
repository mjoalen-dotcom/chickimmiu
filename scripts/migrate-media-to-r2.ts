/**
 * Media → R2 一次性遷移
 * ─────────────────────
 * 把 public/media/ 下所有現存檔案推到 R2 bucket（與 payload.config.ts 的
 * s3Storage plugin 配置一致），key = filename。已有同名 object 跳過 (idempotent)。
 *
 * 為什麼能這樣推：Payload Media 的 DB 紀錄存的是 filename + sizes meta。當 plugin
 * 接管後，前台讀取 `/api/media/file/<filename>` 會由 plugin 改打 R2，所以「把現
 * 有實體檔案搬到 R2」就完成遷移，不必動 DB。
 *
 * 用法（local dev 或 prod /var/www/chickimmiu）：
 *   MIGRATE_DRY_RUN=1 pnpm payload run scripts/migrate-media-to-r2.ts
 *   MIGRATE_DRY_RUN=0 pnpm payload run scripts/migrate-media-to-r2.ts
 *
 * Env：
 *   MIGRATE_DRY_RUN=1        只列出要傳的檔（預設 1，安全）
 *   MIGRATE_DRY_RUN=0        實際傳檔
 *   MIGRATE_LIMIT=N          最多處理 N 個檔（測試用，預設 0=全跑）
 *   MIGRATE_DELETE_LOCAL=1   傳完且 HEAD R2 確認 200 後刪本地檔（謹慎用）
 *   MEDIA_DIR=path           覆寫媒體目錄（預設 ./public/media）
 *
 * 必要 R2 env（與 payload.config.ts 共用）：
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME
 */

import fs from 'fs'
import path from 'path'
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

const DRY_RUN = process.env.MIGRATE_DRY_RUN !== '0' // 預設 dry-run
const LIMIT = parseInt(process.env.MIGRATE_LIMIT || '0', 10) || 0
const DELETE_LOCAL = process.env.MIGRATE_DELETE_LOCAL === '1'
const MEDIA_DIR = process.env.MEDIA_DIR || path.resolve(process.cwd(), 'public/media')

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, '')
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    pdf: 'application/pdf',
    svg: 'image/svg+xml',
  }
  return map[e] || 'application/octet-stream'
}

async function main() {
  console.log('=== Media → R2 一次性遷移 ===')
  console.log(`mode:         ${DRY_RUN ? 'DRY RUN（不實際傳）' : 'COMMIT（會傳到 R2）'}`)
  console.log(`media dir:    ${MEDIA_DIR}`)
  console.log(`limit:        ${LIMIT || '無限制'}`)
  console.log(`delete local: ${DELETE_LOCAL ? '是（傳完即刪本地）' : '否'}`)

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    console.error(
      '❌ R2 env 不齊全（要 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME）',
    )
    process.exit(1)
  }
  console.log(`bucket:       ${R2_BUCKET_NAME}`)

  if (!fs.existsSync(MEDIA_DIR)) {
    console.error(`❌ 媒體目錄不存在：${MEDIA_DIR}`)
    process.exit(1)
  }

  const allEntries = fs.readdirSync(MEDIA_DIR, { withFileTypes: true })
  const files = allEntries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.')) // 跳過 .DS_Store / .gitkeep

  console.log(`local files:  ${files.length}`)
  if (files.length === 0) {
    console.log('沒有檔案要遷移，結束。')
    return
  }

  const target = LIMIT > 0 ? files.slice(0, LIMIT) : files

  const s3 = new S3Client({
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
  })

  let uploaded = 0
  let skipped = 0
  let failed = 0
  let bytes = 0
  const startedAt = Date.now()

  for (let i = 0; i < target.length; i++) {
    const filename = target[i]
    const localPath = path.join(MEDIA_DIR, filename)
    const stats = fs.statSync(localPath)
    const sizeMb = (stats.size / 1024 / 1024).toFixed(2)
    const ext = path.extname(filename)
    const contentType = mimeFromExt(ext)

    const prefix = `[${i + 1}/${target.length}]`

    // HEAD 看 R2 有沒有 — idempotent
    let alreadyOnR2 = false
    try {
      await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: filename }))
      alreadyOnR2 = true
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
      if (e?.$metadata?.httpStatusCode !== 404 && e?.name !== 'NotFound') {
        console.error(`${prefix} HEAD 失敗 ${filename}: ${(err as Error).message}`)
        failed++
        continue
      }
    }

    if (alreadyOnR2) {
      console.log(`${prefix} SKIP   ${filename} (${sizeMb} MB) — 已存在於 R2`)
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`${prefix} WOULD  ${filename} (${sizeMb} MB) → ${contentType}`)
      continue
    }

    try {
      const body = fs.readFileSync(localPath)
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: filename,
          Body: body,
          ContentType: contentType,
          // 與 plugin acl: 'public-read' 對齊；R2 也支援 ACL header
          ACL: 'public-read',
        }),
      )
      uploaded++
      bytes += stats.size
      console.log(`${prefix} UP     ${filename} (${sizeMb} MB)`)

      if (DELETE_LOCAL) {
        // 再 HEAD 一次確認 R2 真的有了再刪
        await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: filename }))
        fs.unlinkSync(localPath)
        console.log(`${prefix} RM     ${localPath}`)
      }
    } catch (err) {
      failed++
      console.error(`${prefix} FAIL   ${filename}: ${(err as Error).message}`)
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  const mb = (bytes / 1024 / 1024).toFixed(1)
  console.log('\n=== 結果 ===')
  console.log(`uploaded: ${uploaded}`)
  console.log(`skipped:  ${skipped}`)
  console.log(`failed:   ${failed}`)
  console.log(`bytes:    ${mb} MB`)
  console.log(`elapsed:  ${elapsed}s`)
  if (failed > 0) {
    console.log('\n⚠️ 有失敗檔案，請檢查上方 FAIL 行決定是否重跑（再跑一次會跳過已成功的）')
    process.exit(2)
  }
}

await main()
