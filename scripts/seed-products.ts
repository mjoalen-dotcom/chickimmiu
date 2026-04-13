/**
 * Seed Products Script
 * ────────────────────
 * Creates categories, media records, and products
 * using existing images from public/media/
 *
 * Usage: npx tsx scripts/seed-products.ts
 */
import { createRequire } from 'module'
import path from 'path'

const require2 = createRequire(import.meta.url)
const DB_PATH = 'file:./data/chickimmiu.db'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

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
  const libsqlPath = path.resolve(
    'node_modules/.pnpm/@libsql+client@0.14.0/node_modules/@libsql/client',
  )
  const { createClient } = require2(libsqlPath)
  const db = createClient({ url: DB_PATH })
  const now = new Date().toISOString()

  console.log('🌱 Seeding products...\n')

  // 1. Categories
  console.log('📂 Creating categories...')
  const categories = [
    { name: '洋裝', slug: 'dresses', icon: 'dress', sortOrder: 1 },
    { name: '褲款', slug: 'pants', icon: 'pants', sortOrder: 2 },
    { name: '上衣', slug: 'tops', icon: 'shirt', sortOrder: 3 },
    { name: '外套', slug: 'outerwear', icon: 'jacket', sortOrder: 4 },
    { name: '配件', slug: 'accessories', icon: 'accessory', sortOrder: 5 },
  ]
  for (const c of categories) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO categories (name, slug, icon, sort_order, is_active, updated_at, created_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)`,
      args: [c.name, c.slug, c.icon, c.sortOrder, now, now],
    })
  }
  const catRows = await db.execute('SELECT id, slug FROM categories')
  const catMap: Record<string, number> = {}
  for (const r of catRows.rows) catMap[r.slug as string] = r.id as number
  console.log('  ✅ Categories:', Object.keys(catMap).join(', '))

  // 2. Media records for existing product images
  console.log('🖼️  Creating media records...')
  const imageFiles = [
    { filename: 'penelope-ladylike-tweed-dress-69aecd18.webp', size: 61052 },
    { filename: 'abigail-pink-leg-lengthening-flare-jeans-69ca6b88.webp', size: 53348 },
    { filename: 'beck-wide-waistband-pleated-cropped-pants-69d46359.webp', size: 51180 },
    { filename: 'y2k-personality-oval-sunglasses-69aedc34.webp', size: 38714 },
    { filename: 'beck-wide-waistband-pleated-cropped-pants-69d46356.webp', size: 34084 },
    { filename: 'abigail-pink-leg-lengthening-flare-jeans-69ca6b88-1.webp', size: 29232 },
    { filename: 'yves-ultra-slim-micro-flare-trousers-69b8068e.webp', size: 20738 },
    { filename: 'candace-clean-straight-cropped-pants-69d46381.webp', size: 20176 },
    { filename: 'candace-clean-straight-cropped-pants-69d4638e.webp', size: 13382 },
  ]

  const mediaIds: Record<string, number> = {}
  for (const img of imageFiles) {
    const url = '/api/media/file/' + img.filename
    const existing = await db.execute({
      sql: 'SELECT id FROM media WHERE filename = ?',
      args: [img.filename],
    })
    if (existing.rows.length > 0) {
      mediaIds[img.filename] = existing.rows[0].id as number
    } else {
      const altText = img.filename.replace(/[-_]\w{8}(-\d)?\.webp$/, '').replace(/-/g, ' ')
      const r = await db.execute({
        sql: `INSERT INTO media (filename, url, alt, mime_type, filesize, width, height, updated_at, created_at)
              VALUES (?, ?, ?, 'image/webp', ?, 800, 1067, ?, ?)`,
        args: [img.filename, url, altText, img.size, now, now],
      })
      mediaIds[img.filename] = Number(r.lastInsertRowid)
    }
  }
  console.log('  ✅ Media records:', Object.keys(mediaIds).length)

  // 3. Products
  console.log('👗 Creating products...')
  const products = [
    {
      name: 'Penelope 名媛風粗花呢洋裝',
      slug: 'penelope-ladylike-tweed-dress',
      price: 2980, salePrice: 2380,
      cat: 'dresses', isNew: 1, isHot: 1, stock: 45,
      img: 'penelope-ladylike-tweed-dress-69aecd18.webp',
      desc: '優雅名媛風粗花呢洋裝，精緻剪裁展現女性完美曲線。適合約會、宴會等場合。',
    },
    {
      name: 'Abigail 粉紅色顯腿長喇叭褲',
      slug: 'abigail-pink-flare-jeans',
      price: 1680, salePrice: null,
      cat: 'pants', isNew: 1, isHot: 0, stock: 60,
      img: 'abigail-pink-leg-lengthening-flare-jeans-69ca6b88.webp',
      desc: '粉色系喇叭褲，高腰設計拉長腿部線條，春夏必備百搭單品。',
    },
    {
      name: 'Beck 寬腰帶百褶九分褲（白）',
      slug: 'beck-pleated-cropped-pants-white',
      price: 1880, salePrice: 1580,
      cat: 'pants', isNew: 1, isHot: 1, stock: 38,
      img: 'beck-wide-waistband-pleated-cropped-pants-69d46359.webp',
      desc: '寬腰帶設計百褶九分褲，修身顯瘦，通勤約會兩相宜。',
    },
    {
      name: 'Y2K 個性橢圓太陽眼鏡',
      slug: 'y2k-oval-sunglasses',
      price: 890, salePrice: 690,
      cat: 'accessories', isNew: 0, isHot: 1, stock: 120,
      img: 'y2k-personality-oval-sunglasses-69aedc34.webp',
      desc: 'Y2K 復古風格橢圓太陽眼鏡，UV400 防紫外線，時髦出街必備。',
    },
    {
      name: 'Beck 寬腰帶百褶九分褲（黑）',
      slug: 'beck-pleated-cropped-pants-black',
      price: 1880, salePrice: null,
      cat: 'pants', isNew: 0, isHot: 1, stock: 52,
      img: 'beck-wide-waistband-pleated-cropped-pants-69d46356.webp',
      desc: '經典黑色版本寬腰帶百褶九分褲，俐落有型。',
    },
    {
      name: 'Abigail 粉紅喇叭褲（淺色）',
      slug: 'abigail-pink-flare-jeans-light',
      price: 1680, salePrice: 1380,
      cat: 'pants', isNew: 1, isHot: 0, stock: 35,
      img: 'abigail-pink-leg-lengthening-flare-jeans-69ca6b88-1.webp',
      desc: '淺粉色款式，更顯甜美清新。高腰喇叭版型，修飾身材效果極佳。',
    },
    {
      name: 'Yves 極致修身微喇叭長褲',
      slug: 'yves-ultra-slim-micro-flare',
      price: 1980, salePrice: null,
      cat: 'pants', isNew: 1, isHot: 0, stock: 42,
      img: 'yves-ultra-slim-micro-flare-trousers-69b8068e.webp',
      desc: '極致修身微喇叭剪裁，完美修飾腿型，打造長腿比例。',
    },
    {
      name: 'Candace 俐落直筒九分褲',
      slug: 'candace-straight-cropped-pants',
      price: 1580, salePrice: null,
      cat: 'pants', isNew: 0, isHot: 1, stock: 55,
      img: 'candace-clean-straight-cropped-pants-69d46381.webp',
      desc: '簡潔俐落直筒版型，百搭好穿，職場通勤首選。',
    },
    {
      name: 'Candace 俐落直筒褲（深色）',
      slug: 'candace-straight-pants-dark',
      price: 1580, salePrice: 1280,
      cat: 'pants', isNew: 0, isHot: 0, stock: 48,
      img: 'candace-clean-straight-cropped-pants-69d4638e.webp',
      desc: '深色版本直筒褲，更顯穩重成熟，適合各種正式場合。',
    },
  ]

  for (const p of products) {
    const r = await db.execute({
      sql: `INSERT INTO products (name, slug, description, price, sale_price, category_id, stock, is_new, is_hot, status, updated_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
      args: [p.name, p.slug, lexicalText(p.desc), p.price, p.salePrice, catMap[p.cat], p.stock, p.isNew, p.isHot, now, now],
    })
    const productId = Number(r.lastInsertRowid)
    const imgId = mediaIds[p.img]
    await db.execute({
      sql: 'INSERT INTO products_images (_order, _parent_id, id, image_id) VALUES (1, ?, ?, ?)',
      args: [productId, uid(), imgId],
    })
  }
  console.log('  ✅ ' + products.length + ' products created')

  // 4. Variants
  console.log('📏 Adding product variants...')
  const allProducts = await db.execute('SELECT id, slug FROM products')
  for (const p of allProducts.rows) {
    const slug = p.slug as string
    const isAccessory = slug.includes('sunglasses')
    const sizes = isAccessory ? ['F'] : ['S', 'M', 'L']
    for (let i = 0; i < sizes.length; i++) {
      const colorName = isAccessory ? '黑色' : (i === 0 ? '白色' : i === 1 ? '黑色' : '粉色')
      const colorCode = colorName === '白色' ? '#FFFFFF' : colorName === '粉色' ? '#FFB6C1' : '#000000'
      const sku = `CKMU-${slug.slice(0, 8).toUpperCase()}-${sizes[i]}`
      await db.execute({
        sql: 'INSERT INTO products_variants (_order, _parent_id, id, color_name, color_code, size, sku, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [i + 1, p.id, uid(), colorName, colorCode, sizes[i], sku, Math.floor(Math.random() * 20) + 5],
      })
    }
  }
  console.log('  ✅ Variants added')

  console.log('\n🎉 Done! Products seeded successfully.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
