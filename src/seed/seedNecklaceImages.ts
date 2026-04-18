/**
 * 流線金屬長鍊 (Product #80) — Gallery + Description images + product details
 * PAYLOAD_SECRET=<your-secret-from-env> DATABASE_URI=file:./data/chickimmiu.db npx tsx src/seed/seedNecklaceImages.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SHOPLINE_IMG_BASE = 'https://img.shoplineapp.com/media/image_clips'

const PRODUCT_ID = 80

// Gallery images (4) + product-specific description images (2)
const IMAGE_IDS = [
  // Gallery
  '69ca49ea88d181856a9e5fb9',
  '69ca49ea8e92278421df2b39',
  '69ca49ea8e9227a347df25f0',
  '69ca49eaf8a326d145f2238b',
  // Description (product-specific only)
  '69ca49f891ebcac74a670b56',
  '69ca49f907b2ddd30a4a147f',
]

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redir = response.headers.location
        if (redir) {
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          return downloadImage(redir, destPath).then(resolve).catch(reject)
        }
      }
      if (response.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(destPath) } catch {}
        return reject(new Error(`HTTP ${response.statusCode}`))
      }
      response.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', (err) => {
      file.close()
      try { fs.unlinkSync(destPath) } catch {}
      reject(err)
    })
  })
}

async function main() {
  const payload = await getPayload({ config })
  const tmpDir = path.resolve(__dirname, '../../tmp-images')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  console.log('=== 流線金屬長鍊 (ID #80) — images + product details ===\n')

  // 1) Download and upload all images
  const mediaIds: number[] = []

  for (const imageId of IMAGE_IDS) {
    const tmpFile = path.join(tmpDir, `${imageId}.png`)
    const url = `${SHOPLINE_IMG_BASE}/${imageId}/original.png`

    try {
      console.log(`  Downloading ${imageId}...`)
      await downloadImage(url, tmpFile)
      const stats = fs.statSync(tmpFile)
      if (stats.size < 1000) {
        console.log(`    SKIP: file too small (${stats.size} bytes)`)
        continue
      }

      const media = await (payload.create as Function)({
        collection: 'media',
        data: {
          alt: '流線金屬長鍊',
          caption: '流線金屬長鍊',
        },
        file: {
          data: fs.readFileSync(tmpFile),
          mimetype: 'image/png',
          name: `necklace-n2603404-${imageId}.png`,
          size: stats.size,
        },
      })
      console.log(`    Uploaded media #${media.id} (${stats.size} bytes)`)
      mediaIds.push(media.id)
    } catch (err: unknown) {
      console.log(`    ERROR: ${(err as Error).message}`)
    }
  }

  if (mediaIds.length === 0) {
    console.log('\nNo images uploaded. Exiting.')
    process.exit(1)
  }

  // 2) Build images array for the product (all uploaded images)
  const imagesArray = mediaIds.map((id) => ({ image: id }))

  // 3) Build Lexical richText description
  const descriptionContent = {
    root: {
      type: 'root',
      children: [
        {
          type: 'heading',
          tag: 'h2',
          children: [{ type: 'text', text: '流線金屬長鍊', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'SKU: N2603404', format: 1, detail: 0, mode: 'normal', style: '', version: 1 },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          textFormat: 0,
          textStyle: '',
        },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: '售價: NT$680', format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          textFormat: 0,
          textStyle: '',
        },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: '流線設計金屬長鍊，簡約時尚的韓系風格，日常百搭款式。', format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          textFormat: 0,
          textStyle: '',
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }

  // 4) Update product #80
  try {
    await (payload.update as Function)({
      collection: 'products',
      id: PRODUCT_ID,
      data: {
        images: imagesArray,
        price: 680,
        description: descriptionContent,
        tags: [
          { tag: '項鍊' },
          { tag: '韓國飾品' },
          { tag: '韓國' },
          { tag: '韓國項鍊' },
          { tag: 'chickim' },
          { tag: '飾品' },
          { tag: '銀系列' },
          { tag: '925銀鍊' },
        ],
        seo: {
          metaTitle: '流線金屬長鍊 | Chickim',
          metaDescription: '流線金屬長鍊 - 韓國飾品 925銀鍊 NT$680 | chickim 韓國項鍊',
        },
      },
    })
    console.log(`\n  Updated product #${PRODUCT_ID}:`)
    console.log(`    - ${mediaIds.length} images linked`)
    console.log(`    - Price: NT$680`)
    console.log(`    - Description: set`)
    console.log(`    - Tags: 8 SEO keywords`)
    console.log(`    - SEO meta: set`)
  } catch (err: unknown) {
    console.log(`\n  ERROR updating product: ${(err as Error).message}`)
  }

  // Cleanup
  try { fs.rmSync(tmpDir, { recursive: true }) } catch {}
  console.log('\nDone!')
  process.exit(0)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
