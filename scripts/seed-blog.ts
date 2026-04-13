import { createRequire } from 'module'
import path from 'path'

const require2 = createRequire(import.meta.url)
const libsqlPath = path.resolve('node_modules/.pnpm/@libsql+client@0.14.0/node_modules/@libsql/client')
const { createClient } = require2(libsqlPath)

function uid() { return Math.random().toString(36).slice(2, 10) }

function lexicalText(text: string) {
  return JSON.stringify({
    root: {
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
        direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '',
      }],
      direction: 'ltr', format: '', indent: 0, version: 1,
    },
  })
}

async function main() {
  const db = createClient({ url: 'file:./data/chickimmiu.db' })
  const now = new Date().toISOString()

  // Check blog_posts schema
  const cols = await db.execute("PRAGMA table_info('blog_posts')")
  const colNames = cols.rows.map((c: any) => c.name as string)
  console.log('blog_posts columns:', colNames.join(', '))

  // Check blog_categories
  try {
    const catCols = await db.execute("PRAGMA table_info('blog_categories')")
    console.log('blog_categories columns:', catCols.rows.map((c: any) => c.name).join(', '))
  } catch { console.log('No blog_categories table') }

  // Create blog categories if table exists
  const hasCategoryId = colNames.includes('category_id')
  let categoryMap: Record<string, number> = {}

  if (hasCategoryId) {
    try {
      const cats = [
        { name: '穿搭教學', slug: 'styling-tips' },
        { name: '時尚趨勢', slug: 'fashion-trends' },
        { name: '品牌故事', slug: 'brand-stories' },
      ]
      for (const c of cats) {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO blog_categories (name, slug, updated_at, created_at) VALUES (?, ?, ?, ?)',
          args: [c.name, c.slug, now, now],
        })
      }
      const catRows = await db.execute('SELECT id, slug FROM blog_categories')
      for (const r of catRows.rows) categoryMap[r.slug as string] = r.id as number
      console.log('Blog categories:', Object.keys(categoryMap).join(', '))
    } catch (e) {
      console.log('Could not create blog categories:', (e as Error).message)
    }
  }

  // Get existing media for featured images (use product images)
  const media = await db.execute('SELECT id FROM media WHERE filename NOT LIKE \'hero%\' AND filename NOT LIKE \'about%\' ORDER BY id LIMIT 3')
  const mediaIds = media.rows.map((r: any) => r.id as number)
  console.log('Media IDs for blog images:', mediaIds)

  // Determine required columns
  const hasContent = colNames.includes('content')
  const hasStatus = colNames.includes('status')
  const hasPublishedAt = colNames.includes('published_at')
  const hasFeaturedImage = colNames.includes('featured_image_id')
  const hasExcerpt = colNames.includes('excerpt')
  const hasAuthor = colNames.includes('author_id')

  // Get admin user for author
  let authorId: number | null = null
  if (hasAuthor) {
    const admin = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
    if (admin.rows.length > 0) authorId = admin.rows[0].id as number
  }

  const posts = [
    {
      title: '夏日約會穿搭指南：名媛風洋裝這樣搭',
      slug: 'summer-date-styling-guide',
      excerpt: '從甜美到優雅，掌握約會穿搭的 5 個關鍵要素，讓你成為全場焦點。',
      content: '約會穿搭是每位女性最在意的時尚課題。本篇將分享如何運用 CHIC KIM & MIU 的名媛風洋裝，打造不同風格的約會造型。從配色到配件搭配，每個細節都不放過。',
      category: 'styling-tips',
      publishedAt: '2026-04-01T08:00:00.000Z',
      mediaIdx: 0,
    },
    {
      title: '職場穿搭新定義：優雅又專業的通勤造型',
      slug: 'office-chic-commute-style',
      excerpt: '告別無聊的辦公室穿搭，用簡約俐落的褲裝打造專業又時尚的職場形象。',
      content: '現代職場對穿搭的要求已經不僅僅是正式，更要展現個人風格。本篇介紹如何用直筒褲、微喇叭褲等百搭單品，輕鬆打造兼顧專業與時髦的通勤造型。',
      category: 'fashion-trends',
      publishedAt: '2026-03-25T08:00:00.000Z',
      mediaIdx: 1,
    },
    {
      title: '春夏必備單品：百搭直筒褲的 5 種穿法',
      slug: 'spring-summer-straight-pants-5-ways',
      excerpt: '一條直筒褲就能變化出 5 種風格，從休閒到正式通通搞定。',
      content: '直筒褲是衣櫃裡最實穿的單品之一。本篇將展示如何搭配不同上衣、鞋款和配件，讓同一條褲子展現截然不同的風格，從週末休閒到商務場合都適用。',
      category: 'styling-tips',
      publishedAt: '2026-03-18T08:00:00.000Z',
      mediaIdx: 2,
    },
  ]

  for (const post of posts) {
    const fields: string[] = ['title', 'slug']
    const placeholders: string[] = ['?', '?']
    const values: unknown[] = [post.title, post.slug]

    if (hasContent) {
      fields.push('content')
      placeholders.push('?')
      values.push(lexicalText(post.content))
    }
    if (hasExcerpt) {
      fields.push('excerpt')
      placeholders.push('?')
      values.push(post.excerpt)
    }
    if (hasStatus) {
      fields.push('status')
      placeholders.push('?')
      values.push('published')
    }
    if (hasPublishedAt) {
      fields.push('published_at')
      placeholders.push('?')
      values.push(post.publishedAt)
    }
    if (hasFeaturedImage && mediaIds[post.mediaIdx]) {
      fields.push('featured_image_id')
      placeholders.push('?')
      values.push(mediaIds[post.mediaIdx])
    }
    if (hasCategoryId && categoryMap[post.category]) {
      fields.push('category_id')
      placeholders.push('?')
      values.push(categoryMap[post.category])
    }
    if (hasAuthor && authorId) {
      fields.push('author_id')
      placeholders.push('?')
      values.push(authorId)
    }
    fields.push('updated_at', 'created_at')
    placeholders.push('?', '?')
    values.push(now, now)

    await db.execute({
      sql: `INSERT INTO blog_posts (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      args: values,
    })
    console.log('Created blog post:', post.title)
  }

  console.log('\nDone! Blog posts seeded.')
}

main().catch((e) => { console.error(e); process.exit(1) })
