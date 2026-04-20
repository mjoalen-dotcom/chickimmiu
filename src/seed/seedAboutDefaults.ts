/**
 * Seed AboutPageSettings — Our Vision content + Legacy Gallery images
 * ────────────────────────────────────────────────────────────────────
 * 目的：把 `/about` 頁面目前靠 code fallback 顯示的兩段內容寫進 DB
 *       讓 admin 可以在「全站設定 → 關於我們」直接改文案、換圖。
 *
 *   - ourVision.content        ← DEFAULT_VISION_CONTENT（2 段）
 *   - legacyGallery.images[]   ← 42 張 /images/about-legacy/*.png
 *
 * 冪等：只在欄位為空時寫入；已手動填過則跳過，不蓋 admin 編輯結果。
 *
 * Usage:
 *   pnpm seed:about           # 實際寫入 DB
 *   pnpm seed:about:dry       # 只印 log，不動 DB
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const DRY_RUN = process.argv.includes('--dry-run')

function log(msg: string) {
  process.stderr.write('[seedAboutDefaults] ' + msg + '\n')
}

const keepAlive = setInterval(() => {}, 60_000)

process.on('unhandledRejection', (e: unknown) => {
  log('UNHANDLED REJECTION: ' + (e instanceof Error ? e.stack || e.message : String(e)))
  process.exit(1)
})

const DEFAULT_VISION_CONTENT = [
  '靚秀國際有限公司（Chic Show International）期許能提供讓每個人成為時尚焦點的服裝。',
  '我們的 LOGO 由「CHIC KIM & MIU」組成，以圓形鈕扣的造型呈現，象徵每個人時尚美好的關鍵節點。就像一顆鈕扣，將布料的兩端優雅連結，創造出保暖、美觀且充滿優雅氣質的經典，我們衷心希望透過每一件服裝，讓每個人找到專屬於自己的時尚美好，讓生命的每一段旅程，都成為難忘的經典時刻。',
].join('\n\n')

const DEFAULT_GALLERY_IMAGES = Array.from({ length: 42 }, (_, i) => ({
  src: `/images/about-legacy/${String(i + 1).padStart(2, '0')}.png`,
  alt: `CKMU 品牌相簿 ${i + 1}`,
}))

async function main() {
  log('start; dry-run=' + DRY_RUN)
  const payload = await getPayload({ config })

  const current = (await payload.findGlobal({
    slug: 'about-page-settings',
    depth: 0,
  })) as unknown as Record<string, unknown>

  const ourVision = (current.ourVision || {}) as Record<string, unknown>
  const legacyGallery = (current.legacyGallery || {}) as Record<string, unknown>

  const visionContentExisting = typeof ourVision.content === 'string' ? ourVision.content.trim() : ''
  const galleryImagesExisting = Array.isArray(legacyGallery.images) ? legacyGallery.images : []

  const patch: Record<string, unknown> = {}
  const changes: string[] = []

  if (!visionContentExisting) {
    patch.ourVision = {
      ...ourVision,
      content: DEFAULT_VISION_CONTENT,
    }
    changes.push(`ourVision.content (${DEFAULT_VISION_CONTENT.length} chars, 2 paragraphs)`)
  } else {
    log(`· skip ourVision.content — already set (${visionContentExisting.length} chars)`)
  }

  if (galleryImagesExisting.length === 0) {
    patch.legacyGallery = {
      ...legacyGallery,
      images: DEFAULT_GALLERY_IMAGES,
    }
    changes.push(`legacyGallery.images (42 images)`)
  } else {
    log(`· skip legacyGallery.images — already has ${galleryImagesExisting.length} image(s)`)
  }

  if (changes.length === 0) {
    log('✓ nothing to update — both fields already populated in DB')
    clearInterval(keepAlive)
    process.exit(0)
  }

  if (DRY_RUN) {
    log('DRY: would set ' + changes.join('; '))
    clearInterval(keepAlive)
    process.exit(0)
  }

  await payload.updateGlobal({
    slug: 'about-page-settings',
    data: patch as unknown as Parameters<typeof payload.updateGlobal>[0]['data'],
  })

  log('✓ AboutPageSettings updated: ' + changes.join('; '))
  log('done')
  clearInterval(keepAlive)
  process.exit(0)
}

// ⚠️ MUST be top-level await — `payload run` does `await import(script); process.exit(0);`.
// A fire-and-forget `main().catch(...)` returns the module promise immediately and the
// CLI exits before getPayload() resolves, so you'd see "start" then silent exit 0.
await main().catch((e: unknown) => {
  log('FATAL: ' + (e instanceof Error ? e.stack || e.message : String(e)))
  process.exit(1)
})
