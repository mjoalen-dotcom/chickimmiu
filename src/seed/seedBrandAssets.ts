/**
 * Seed brand assets into Media + wire them to GlobalSettings.site
 * ──────────────────────────────────────────────────────────────
 * 目的：把 `public/` 下前台已在用的 LOGO / favicon / apple-touch / og-image
 *       匯入 Media collection，並設到 GlobalSettings.site 的 4 個欄位，
 *       讓 /admin/globals/global-settings 能在 UI 上看到、管理這些圖。
 *
 * 限制：
 *   - Media collection mimeTypes 白名單禁 SVG 與 ICO（PR #4 security-polish，
 *     SVG 是 XSS 向量，ICO 非主流）。故：
 *       · logo.svg  → 用 sharp 光柵化成 PNG（800×800）再上傳
 *       · favicon   → 改用已存在的 icon-192.png（現代瀏覽器吃 PNG favicon）
 *
 * 冪等：以 Media.filename 為 key 做 lookup；已上傳者複用 ID，不重建。
 * 不覆蓋：若 GlobalSettings.site.<field> 已有值，跳過該欄位（不蓋使用者上傳）。
 *
 * Usage:
 *   pnpm seed:brand           # 實際寫入 DB
 *   pnpm seed:brand:dry       # 只印 log，不動 DB
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import path from 'node:path'
import fs from 'node:fs'
import sharp from 'sharp'

type AssetPlan = {
  field: 'logo' | 'favicon' | 'appleTouchIcon' | 'ogImage'
  sourcePath: string
  uploadName: string
  mimetype: string
  alt: string
  rasterize?: boolean
}

const DRY_RUN = process.argv.includes('--dry-run')

function log(msg: string) {
  process.stderr.write('[seedBrandAssets] ' + msg + '\n')
}

const keepAlive = setInterval(() => {}, 60_000)

process.on('unhandledRejection', (e: unknown) => {
  log('UNHANDLED REJECTION: ' + (e instanceof Error ? e.stack || e.message : String(e)))
  process.exit(1)
})

// Resolve repo root from src/seed/seedBrandAssets.ts → ../../
// Using `import.meta.url` would require ESM gymnastics; `process.cwd()` is
// the project root when invoked via `pnpm seed:brand`.
const ROOT = process.cwd()
const PUBLIC = path.join(ROOT, 'public')

const PLAN: AssetPlan[] = [
  {
    field: 'logo',
    sourcePath: path.join(PUBLIC, 'images', 'logo-ckmu.svg'),
    uploadName: 'logo-ckmu.png',
    mimetype: 'image/png',
    alt: 'CHIC KIM & MIU Logo',
    rasterize: true,
  },
  {
    field: 'favicon',
    sourcePath: path.join(PUBLIC, 'icon-192.png'),
    uploadName: 'favicon-192.png',
    mimetype: 'image/png',
    alt: 'CHIC KIM & MIU Favicon',
  },
  {
    field: 'appleTouchIcon',
    sourcePath: path.join(PUBLIC, 'apple-touch-icon.png'),
    uploadName: 'apple-touch-icon.png',
    mimetype: 'image/png',
    alt: 'CHIC KIM & MIU Apple Touch Icon',
  },
  {
    field: 'ogImage',
    sourcePath: path.join(PUBLIC, 'og-image.png'),
    uploadName: 'og-image.png',
    mimetype: 'image/png',
    alt: 'CHIC KIM & MIU Social Share',
  },
]

async function prepareBuffer(a: AssetPlan): Promise<Buffer> {
  if (a.rasterize) {
    // SVG → PNG at 800px wide (preserves aspect). density=300 gives crisp
    // rasterization of vector source. withoutEnlargement=false lets us scale
    // up from a 500×500 viewBox to 800×800 for retina displays.
    return await sharp(a.sourcePath, { density: 300 })
      .resize({ width: 800, withoutEnlargement: false })
      .png()
      .toBuffer()
  }
  return fs.readFileSync(a.sourcePath)
}

async function main() {
  log('start; dry-run=' + DRY_RUN)
  const payload = await getPayload({ config })

  const mediaIds: Partial<Record<AssetPlan['field'], number | string>> = {}

  for (const a of PLAN) {
    if (!fs.existsSync(a.sourcePath)) {
      log(`✗ ${a.field}: source missing — ${a.sourcePath}`)
      continue
    }

    // Idempotent lookup by filename
    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: a.uploadName } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      const id = existing.docs[0].id
      log(`= ${a.field}: reuse media id=${id} (${a.uploadName})`)
      mediaIds[a.field] = id as number
      continue
    }

    const buffer = await prepareBuffer(a)
    log(`→ ${a.field}: upload ${a.uploadName} (${Math.round(buffer.length / 1024)} KB)`)

    if (DRY_RUN) {
      log(`  (dry-run, skip create)`)
      continue
    }

    const media = await (payload.create as (args: unknown) => Promise<{ id: number | string }>)({
      collection: 'media',
      data: { alt: a.alt },
      file: {
        data: buffer,
        mimetype: a.mimetype,
        name: a.uploadName,
        size: buffer.length,
      },
    })
    log(`  ✓ id=${media.id}`)
    mediaIds[a.field] = media.id
  }

  // Update GlobalSettings.site, skipping any field already set by user
  const current = await payload.findGlobal({ slug: 'global-settings', depth: 0 })
  const site = ((current as Record<string, unknown>).site || {}) as Record<string, unknown>
  const patch: Record<string, unknown> = { ...site }
  const changes: string[] = []

  for (const [k, v] of Object.entries(mediaIds)) {
    if (v == null) continue
    if (patch[k]) {
      log(`· skip site.${k} — already set (id=${String(patch[k])})`)
      continue
    }
    patch[k] = v
    changes.push(`${k}=${v}`)
  }

  if (changes.length === 0) {
    log('✓ nothing to update on GlobalSettings.site')
  } else if (DRY_RUN) {
    log('DRY: would set ' + changes.join(', '))
  } else {
    await payload.updateGlobal({
      slug: 'global-settings',
      data: { site: patch } as unknown as Parameters<typeof payload.updateGlobal>[0]['data'],
    })
    log('✓ GlobalSettings.site updated: ' + changes.join(', '))
  }

  log('done')
  clearInterval(keepAlive)
  process.exit(0)
}

main().catch((e: unknown) => {
  log('ERROR: ' + (e instanceof Error ? e.stack || e.message : String(e)))
  process.exit(1)
})
