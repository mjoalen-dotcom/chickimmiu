/**
 * Seed CKMU ON SHOW Galleries — Stage 2
 * ──────────────────────────────────────
 * 把原 Shopline /pages/ckmuonshow-XX 子頁的所有「藝人穿搭整輯」照片搬到
 * pre 站 — 每位藝人下載 N 張圖 → 上傳 Media → 寫入 celebrity_features.
 * galleryImages array → 子頁 /celebrity/{slug} 顯示成 masonry gallery。
 *
 * 圖片 URL 來源：2026-05-12 從原 Shopline 17 個 ckmuonshow-XX 子頁
 * （Melody 無子頁所以不抓）batch WebFetch 得出。共用 3 張 banner/logo
 * 已過濾掉 (69f1685a, 689c4633, 672af0e1)。
 *
 * 楊智捷/劉祝華有 60+ 張商品 collage — 取前 15 張代表性圖，其他全包。
 *
 * 冪等：對已有 galleryImages 的藝人，SKIP（不重複下載）；用 SEED_REPLACE=1
 * 強制重跑（先清空既有再下載）。
 *
 * Usage:
 *   pnpm payload run scripts/seed-ckmu-on-show-galleries.ts
 *
 * Env:
 *   SEED_DRY_RUN=1   只 plan 不下載/寫 DB
 *   SEED_REPLACE=1   清空既有 galleryImages 再重建
 *   SEED_LIMIT=N     每位藝人最多 N 張（debug 用）
 *   SEED_ONLY=01,02  只跑指定 slug（逗號分隔）
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY_RUN = process.env.SEED_DRY_RUN === '1'
const REPLACE = process.env.SEED_REPLACE === '1'
const LIMIT_PER_CELEB = parseInt(process.env.SEED_LIMIT || '0', 10) || 0
const ONLY_SLUGS = (process.env.SEED_ONLY || '').split(',').filter(Boolean)

const SHOPLINE_PREFIX = 'https://shoplineimg.com/559df3efe37ec64e9f000092/'

// URL 只存 hash + size (e.g. "673ae99bd251bf000e5c090c/750x.png")
// seed 跑時拼 SHOPLINE_PREFIX + hash + '?' 重組完整 URL
type GalleryData = {
  slug: string // celebrity-features.slug (01-18)
  imageHashes: string[] // 不含 prefix 的 hash/size 部分
}

const GALLERIES: GalleryData[] = [
  {
    slug: '01', // 陳美鳳 — ckmuonshow-01
    imageHashes: [
      '673ae99bd251bf000e5c090c/750x.png',
      '67288ab675a75efaa40b1f86/750x.png',
      '67288ab513e960cac414da68/750x.png',
      '67288ab65397745e08c59345/750x.png',
      '67288ab6eae3480ddf0788a1/750x.png',
      '67288ab61fd15b374e0c56fc/750x.png',
      '67288ab539346d06e9f5f3fe/750x.png',
      '67288ab569db890340d74797/750x.png',
      '67288ab574a8c1898545de82/750x.png',
    ],
  },
  {
    slug: '02', // 劉祝華 — ckmuonshow-04 (取前 15 張)
    imageHashes: [
      '67fc7ee75821ca000f6ec2bb/750x.png',
      '67fc7ecb050205000fcf14b0/750x.png',
      '67fc7ee7e2e18e000e915572/750x.png',
      '67e51043d77daa000f971052/750x.png',
      '67fc7ee70d6d92000ddc474b/750x.png',
      '67e5104387e88c000c385f1f/750x.png',
      '67e5103e377d89000ab0b90d/750x.png',
      '67e5103ec777ca000e328a95/750x.png',
      '67e5103e0f7bd2001042b20e/750x.png',
      '67e5103eb72183000f15c34c/750x.png',
      '67e5103e291002000f5c20e0/750x.png',
      '67fc7ee7aa718361bcfcfa51/750x.png',
      '67fc7ee7909a0a000bd7df68/750x.png',
      '67fc7ee782c468000a00753c/750x.png',
      '6788a25fdc2e63000b05773d/750x.png',
    ],
  },
  {
    slug: '03', // 韓瑜 — ckmuonshow-02
    imageHashes: [
      '673ae9571757ce000a571ec6/750x.png',
      '67288ab5861928fd72adaad6/750x.png',
      '67288ab6a2fa6e397ddb1c49/750x.png',
      '67288ab662638c408e972664/750x.png',
      '67288ab6f02caaed2482af78/750x.png',
      '67288ab5eae348f252078d3e/750x.png',
    ],
  },
  // 04 Melody — 無子頁，跳過
  {
    slug: '05', // 楊智捷 — ckmuonshow-03 (取前 15 張)
    imageHashes: [
      '68aeacfa7317220016b402fd/750x.png',
      '68aeacfa4b925f000a0542c8/750x.png',
      '68aeacfa6722e5000ae64b44/750x.png',
      '68aeacfa3ad08b000c069d38/750x.png',
      '68aead058335bd001870f537/750x.png',
      '68aead05f685a80018fc81a2/750x.png',
      '67fc82979619c7000d475947/750x.png',
      '67fc8297500a1c000b04b4c3/750x.png',
      '676e0622563544000ed22afb/750x.png',
      '676e06227ed407000b5a3930/750x.png',
      '6788a4c52cddd1000a26d768/750x.png',
      '67a5ccd3c3a119000b2b65bd/750x.png',
      '67fc82963d0891000ca8aced/750x.png',
      '68ae9d6a20a3c2000e16fd81/750x.png',
      '6735719aeb2e857c63036b19/750x.png',
    ],
  },
  {
    slug: '06', // 高昱晴 — ckmuonshow-06
    imageHashes: [
      '692ea6fe4368f9000a669686/750x.png',
      '692ea6febffd3cf4433a7efa/750x.png',
      '692ea6feaf8b92001876b731/750x.png',
      '692ea6febffd3c00103b0d9a/750x.png',
      '6880b45a1ef209000c70fb73/750x.png',
      '6880b4600cd6280014dda7b2/750x.png',
      '68ae86dc3ad08b0014068764/750x.png',
      '6880b48475c9240010b5f56d/750x.png',
      '6880b46dd0cee30012c2bf21/750x.png',
      '6880b488444bd6000cb0a8a0/750x.png',
      '6880b48d9348860012c4b87f/750x.png',
      '6880b450dbf2bb00141b783e/750x.png',
      '68ae86dcdaacb30018d3cc31/750x.png',
      '68ae86dc20a3c2001816eebd/750x.png',
      '68ae86dcb9a9cf000a252709/750x.png',
      '68ae86dcffb2c1000ec1c269/750x.png',
    ],
  },
  {
    slug: '07', // 葉俞璘 — ckmuonshow-07
    imageHashes: [
      '6880b67511b945000a9c5219/750x.png',
      '6880b68c8cdea5000cf1eaed/750x.png',
      '6880b6ca9cc45300185fff79/750x.png',
      '6880b70615e429000ef090cb/750x.png',
      '6880b725d0899d001887aa59/750x.png',
      '6880b76ceb0fda00109d0a88/750x.png',
      '68ae7fa2e828e2000e0c92d3/750x.png',
      '68ae7fa24e315b0018cdd4ab/750x.png',
      '68ae7fa277dcfe001216a380/750x.png',
      '68ae7fa2950f57000cc25b5e/750x.png',
      '68ae7fa255d5a10018ff5ef5/750x.png',
      '68ae7fa211282d0018c59475/750x.png',
      '68ae7fabe828e2000c0c8f33/750x.png',
      '68ae7fab77ab9800124bb6aa/750x.png',
      '68ae7fabf55c35000cd15a51/750x.png',
    ],
  },
  {
    slug: '08', // 廖廷娟 — ckmuonshow-10
    imageHashes: [
      '690484479c4d7800163996ea/750x.jpg',
      '6904846ae2a688000e96fa84/750x.png',
      '692d673f58b083510dc9c5e9/750x.png',
    ],
  },
  {
    slug: '09', // 丁士芬 — 692d6a34c4c464590b7513c2
    imageHashes: ['692d6abe3a1ecc739998360d/750x.png'],
  },
  {
    slug: '10', // 王淑麗 — ckmuonshow-20
    imageHashes: ['693fc8ed15732d7d99eeb7aa/750x.png'],
  },
  {
    slug: '11', // 房業涵 — ckmuonshow-08
    imageHashes: [
      '69047aa0570f09000a2f0a88/750x.png',
      '69047aefcd61e600189af578/750x.png',
    ],
  },
  {
    slug: '12', // 陳靜宜 — ckmuonshow-09
    imageHashes: [
      '69047e69690247001601ff2c/750x.png',
      '69047e719080fa0012519690/750x.png',
    ],
  },
  {
    slug: '13', // 李樺仙 — ckmuonshow-11
    imageHashes: [
      '691af6b051ca40001090f61c/750x.png',
      '691af6a5787ab6000c2444f5/750x.png',
      '691af5fa83e0f70014443a75/750x.png',
      '692e95c3a6e343000ebba7dc/750x.png',
      '692e95c492fe560014f37d34/750x.png',
    ],
  },
  {
    slug: '14', // 張予馨 — ckmuonshow-14
    imageHashes: [
      '692e9ac3f3e8b7b625cf2432/750x.png',
      '692e9ac3bffd3cd8b83a2e82/750x.png',
    ],
  },
  {
    slug: '15', // 林季瑩 — ckmuonshow-12
    imageHashes: [
      '692d67ee5a61360c4f84b1d5/750x.png',
      '692d6807545a1225cd7e319b/750x.png',
      '692d680b0e5c2a01b51d8a57/750x.png',
      '692d6810126e3a00166aa14c/750x.png',
    ],
  },
  {
    slug: '16', // 呂心喻 — ckmuonshow-15
    imageHashes: [
      '692e9d1fe5304c000c77c85b/750x.png',
      '692e9d206c314c0011fc99e1/750x.png',
    ],
  },
  {
    slug: '17', // 葉子菁 — ckmuonshow-16
    imageHashes: ['692e9fea2ce29b521c00211c/750x.png'],
  },
  {
    slug: '18', // 劉佩綺 — ckmuonshow-18
    imageHashes: ['693fc5a5ce3e76115499ac29/750x.png'],
  },
]

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function fetchImage(
  url: string,
): Promise<{ buffer: Buffer; mimetype: string; size: number }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} -> HTTP ${res.status}`)
  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const mimetype =
    res.headers.get('content-type')?.split(';')[0]?.trim() ||
    (url.toLowerCase().includes('.jpg') ? 'image/jpeg' : 'image/png')
  return { buffer, mimetype, size: buffer.byteLength }
}

function filenameFor(slug: string, idx: number, ext: 'png' | 'jpg'): string {
  return `ckmu-on-show-gallery-${slug}-${String(idx + 1).padStart(2, '0')}.${ext}`
}

async function main() {
  log('🌱 Seeding CKMU ON SHOW galleries (Stage 2)')
  if (DRY_RUN) log('   (DRY-RUN — no DB writes / no image downloads)')
  if (REPLACE) log('   (REPLACE — will clear existing galleryImages first)')
  if (LIMIT_PER_CELEB > 0) log(`   (LIMIT=${LIMIT_PER_CELEB} per celebrity)`)
  if (ONLY_SLUGS.length > 0) log(`   (ONLY=${ONLY_SLUGS.join(',')})`)

  const payload = await getPayload({ config })

  const targetGalleries = ONLY_SLUGS.length
    ? GALLERIES.filter((g) => ONLY_SLUGS.includes(g.slug))
    : GALLERIES

  let totalUploaded = 0
  let totalSkipped = 0

  for (const g of targetGalleries) {
    log(`\n👤 slug=${g.slug} — ${g.imageHashes.length} images`)

    // 1. find celebrity
    const found = await payload.find({
      collection: 'celebrity-features',
      where: { slug: { equals: g.slug } },
      limit: 1,
      depth: 0,
    })
    const celeb = found.docs[0] as unknown as
      | { id: number; name: string; galleryImages?: unknown[] }
      | undefined
    if (!celeb) {
      log(`   ✗ celebrity slug=${g.slug} not found, skipping`)
      continue
    }
    log(`   celebrity: ${celeb.name} (id=${celeb.id})`)

    const existingGallery = (celeb.galleryImages as unknown[]) || []
    if (existingGallery.length > 0 && !REPLACE) {
      log(`   ⏭  has ${existingGallery.length} existing images, SKIP (use SEED_REPLACE=1 to redo)`)
      totalSkipped += g.imageHashes.length
      continue
    }

    // 2. download + upload each image
    const hashesToProcess = LIMIT_PER_CELEB > 0
      ? g.imageHashes.slice(0, LIMIT_PER_CELEB)
      : g.imageHashes

    const galleryItems: Array<{ image: number; caption?: string }> = []
    for (let i = 0; i < hashesToProcess.length; i++) {
      const hash = hashesToProcess[i]
      const url = `${SHOPLINE_PREFIX}${hash}?`
      const ext = hash.endsWith('.jpg') ? 'jpg' : 'png'
      const filename = filenameFor(g.slug, i, ext)

      // 先檢查既有 media（重複下載防護）
      const existingMedia = await payload.find({
        collection: 'media',
        where: { filename: { equals: filename } },
        limit: 1,
        depth: 0,
      })
      const existingMediaDoc = existingMedia.docs[0] as unknown as { id: number } | undefined
      if (existingMediaDoc) {
        galleryItems.push({ image: existingMediaDoc.id })
        log(`   ${i + 1}. ${filename} → reused id=${existingMediaDoc.id}`)
        continue
      }

      try {
        if (DRY_RUN) {
          log(`   ${i + 1}. [dry-run] ${url}`)
          continue
        }
        const { buffer, mimetype, size } = await fetchImage(url)
        const created = (await payload.create({
          collection: 'media',
          data: { alt: `${celeb.name} 節目穿搭整輯 #${i + 1}` },
          file: { data: buffer, name: filename, mimetype, size },
        })) as unknown as { id: number }
        galleryItems.push({ image: created.id })
        totalUploaded++
        log(`   ${i + 1}. ${filename} → media id=${created.id} (${size} bytes)`)
      } catch (e) {
        log(`   ✗ ${i + 1}. ${url}: ${(e as Error).message}`)
      }
    }

    // 3. update celebrity galleryImages
    if (!DRY_RUN && galleryItems.length > 0) {
      await payload.update({
        collection: 'celebrity-features',
        id: celeb.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { galleryImages: galleryItems as any },
      })
      log(`   ✓ Updated celebrity-features.galleryImages (${galleryItems.length} items)`)
    }
  }

  log(`\n🎉 Done. Uploaded ${totalUploaded} new images, skipped ${totalSkipped}.`)
  log('\nVerify:')
  log('   - https://pre.chickimmiu.com/celebrity/01 (陳美鳳 9 圖)')
  log('   - https://pre.chickimmiu.com/celebrity/05 (楊智捷 15 圖)')
  log('   - https://pre.chickimmiu.com/celebrity/06 (高昱晴 16 圖)')
}

await main()
