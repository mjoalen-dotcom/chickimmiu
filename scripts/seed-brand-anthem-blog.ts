/**
 * Seed: Confidence is the Silhouette — 品牌主題曲 blog post
 * ────────────────────────────────────────────────────────────
 * 上傳：
 *   - /tmp/anthem/confidence-is-the-silhouette.mp4 → Media (heroVideo)
 *   - /tmp/anthem/confidence-is-the-silhouette.mp3 → Media (heroAudio)
 *   - /tmp/anthem/confidence-poster.jpg            → Media (featuredImage / poster)
 *
 * 建立 blog post：
 *   - slug:        confidence-is-the-silhouette
 *   - 內含：創作緣起（編輯部審過版本）
 *   - lyrics 欄位：空字串（admin 之後自己貼歌詞）
 *   - mediaCredit: 作詞作曲 / 監製：Alan Miao
 *   - featured:    true（釘選 /blog 列表頂部）
 *   - category:    brand-story
 *
 * Usage (on prod after SCP files到 /tmp/anthem)：
 *   pnpm payload run scripts/seed-brand-anthem-blog.ts
 *
 * Env:
 *   SEED_REPLACE=1   找到既有同 slug post 就 delete 再建
 *   SEED_DRY_RUN=1   只 plan，不寫
 */

import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'

const DRY_RUN = process.env.SEED_DRY_RUN === '1'
const REPLACE = process.env.SEED_REPLACE === '1'

const ASSETS_DIR = '/tmp/anthem'
const POST_SLUG = 'confidence-is-the-silhouette'

const FILES = [
  {
    field: 'video',
    path: path.join(ASSETS_DIR, 'confidence-is-the-silhouette.mp4'),
    filename: 'confidence-is-the-silhouette.mp4',
    mimetype: 'video/mp4',
    alt: 'CKMU Brand Anthem — Confidence is the Silhouette (MV)',
    width: 1024,
    height: 1024,
  },
  {
    field: 'audio',
    path: path.join(ASSETS_DIR, 'confidence-is-the-silhouette.mp3'),
    filename: 'confidence-is-the-silhouette.mp3',
    mimetype: 'audio/mpeg',
    alt: 'CKMU Brand Anthem — Confidence is the Silhouette (audio)',
  },
  {
    field: 'poster',
    path: path.join(ASSETS_DIR, 'confidence-poster.jpg'),
    filename: 'confidence-poster.jpg',
    mimetype: 'image/jpeg',
    alt: 'Confidence is the Silhouette poster',
    width: 1024,
    height: 1024,
  },
]

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

/** Lexical helpers — 寫純文字段落 */
function lexicalParagraph(text: string) {
  return {
    type: 'paragraph',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    children: [
      { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
    ],
  }
}

function lexicalHeading(text: string, tag: 'h2' | 'h3' = 'h3') {
  return {
    type: 'heading',
    tag,
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: [
      { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
    ],
  }
}

function buildContent() {
  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children: [
        lexicalHeading('創作緣起'),
        lexicalParagraph(
          '這是 CKMU 的第一首品牌形象主題曲。我一直相信：女性最美的輪廓，不是剪裁出來的，是自信穿戴出來的。',
        ),
        lexicalParagraph(
          'CKMU 從第一天就不只是賣衣服 — 我們替每一位跨世代台灣女性精挑韓系設計，希望她穿上後，比照鏡子裡看見的，多一份篤定。',
        ),
        lexicalParagraph(
          '「Silhouette」是輪廓，是身形，也是一個人走進房間時旁人記住的剪影。我把這個信念寫成歌，用 Modern K-Pop 的城市感包起來 — 因為自信本來就該有節奏。',
        ),
        lexicalParagraph(
          '這首歌送給每一位走進 CKMU 的女性：你選的不是哪件洋裝，是你心中那個越來越清晰的自己。',
        ),
        lexicalParagraph('— Alan Miao'),
      ],
    },
  }
}

async function main() {
  log('🎵 Seeding brand anthem blog post')
  if (DRY_RUN) log('   (DRY-RUN)')
  if (REPLACE) log('   (REPLACE — delete existing post first)')

  const payload = await getPayload({ config })

  // ── 1. 確認檔案存在 ─────────────────────────────
  log('\n📁 Verifying asset files...')
  for (const f of FILES) {
    if (!fs.existsSync(f.path)) {
      throw new Error(
        `Missing file: ${f.path} — scp 上 /tmp/anthem/ 後再跑 (mp3 + mp4 + poster)`,
      )
    }
    const stat = fs.statSync(f.path)
    log(`   ✓ ${f.filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`)
  }

  // ── 2. 上傳 media（idempotent — 用 filename 反查） ──
  log('\n🖼️  Uploading to Payload Media...')
  const mediaIds: Record<string, number> = {}
  for (const f of FILES) {
    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: f.filename } },
      limit: 1,
      depth: 0,
    })
    const existingDoc = existing.docs[0] as unknown as { id: number } | undefined
    if (existingDoc) {
      mediaIds[f.field] = existingDoc.id
      log(`   reuse ${f.filename} → media id=${existingDoc.id}`)
      continue
    }
    if (DRY_RUN) {
      log(`   [dry-run] would upload ${f.filename}`)
      mediaIds[f.field] = 0
      continue
    }
    const buffer = fs.readFileSync(f.path)
    const created = (await payload.create({
      collection: 'media',
      data: { alt: f.alt },
      file: {
        data: buffer,
        name: f.filename,
        mimetype: f.mimetype,
        size: buffer.byteLength,
      },
    })) as unknown as { id: number }
    mediaIds[f.field] = created.id
    log(`   ✓ uploaded ${f.filename} → media id=${created.id}`)
  }

  // ── 3. find admin user for author ──
  log('\n👤 Finding admin user for author...')
  const adminResult = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1,
    depth: 0,
  })
  const admin = adminResult.docs[0] as unknown as { id: number } | undefined
  if (!admin) {
    throw new Error('No admin user found — author field is required')
  }
  log(`   ✓ author id=${admin.id}`)

  // ── 4. WIPE existing if REPLACE ──
  if (REPLACE && !DRY_RUN) {
    const existing = await payload.find({
      collection: 'blog-posts',
      where: { slug: { equals: POST_SLUG } },
      limit: 1,
      depth: 0,
    })
    const doc = existing.docs[0] as unknown as { id: number } | undefined
    if (doc) {
      await payload.delete({ collection: 'blog-posts', id: doc.id })
      log(`\n🗑️  Deleted existing post id=${doc.id}`)
    }
  }

  // ── 5. 確認 post 不存在 ──
  const dup = await payload.find({
    collection: 'blog-posts',
    where: { slug: { equals: POST_SLUG } },
    limit: 1,
    depth: 0,
  })
  if (dup.docs.length > 0 && !REPLACE) {
    log(
      `\n⏭  Post slug=${POST_SLUG} 已存在 (id=${(dup.docs[0] as unknown as { id: number }).id})，跳過。要重建用 SEED_REPLACE=1。`,
    )
    return
  }

  // ── 6. 建 post ──
  log('\n📝 Creating blog post...')
  const postData = {
    title: 'Confidence is the Silhouette｜CKMU 品牌主題曲',
    slug: POST_SLUG,
    excerpt:
      '當衣服穿到位，自信就成了你的輪廓。CKMU 第一首品牌形象主題曲收錄於 Urban Icon Collection，獻給每一位走進 CKMU 的女性。',
    content: buildContent(),
    featuredImage: mediaIds.poster,
    heroVideo: mediaIds.video,
    heroAudio: mediaIds.audio,
    lyrics: '', // 留空 — admin 之後進 /admin/collections/blog-posts 自己貼歌詞
    mediaCredit: '作詞作曲 / 監製：Alan Miao',
    featured: true,
    author: admin.id,
    category: 'brand-story',
    status: 'published',
    publishedAt: new Date().toISOString(),
    tags: [
      { tag: 'Brand Anthem' },
      { tag: 'Urban Icon Collection' },
      { tag: 'Confidence' },
    ],
    seo: {
      metaTitle: 'Confidence is the Silhouette｜CKMU 第一首品牌主題曲',
      metaDescription:
        '收錄於 Urban Icon Collection 的 CKMU 第一首品牌形象主題曲，獻給每一位走進 CKMU 的女性。Modern K-Pop 城市感，由 Alan Miao 作詞作曲。',
    },
  }

  if (DRY_RUN) {
    log(`   [dry-run] post slug=${POST_SLUG}, featured=true, heroVideo+heroAudio set`)
    return
  }

  const created = (await payload.create({
    collection: 'blog-posts',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: postData as any,
  })) as unknown as { id: number; slug: string }
  log(`   ✓ Post created id=${created.id}, slug=${created.slug}`)
  log('\n🎉 Done. Visit:')
  log(`   - /blog (頂部釘選 hero card)`)
  log(`   - /blog/${POST_SLUG}`)
  log(`   - Admin to edit lyrics: /admin/collections/blog-posts/${created.id}`)
}

await main()
