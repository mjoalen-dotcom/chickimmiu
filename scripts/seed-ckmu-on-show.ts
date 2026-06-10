/**
 * Seed CKMU ON SHOW Page — Stage 1
 * ─────────────────────────────────
 * 從 Shopline 舊站 (chickimmiu.com/pages/ckmu-on-show) 搬遷藝人媒體曝光牆到
 * pre.chickimmiu.com 的 /pages/ckmu-on-show，並升級為「曝光 → 直接導購」漏斗。
 *
 * 變化：
 *   - URL 沿用 /pages/ckmu-on-show（SEO 零中斷）
 *   - 18 位藝人卡片（lookbook-grid 4 欄）
 *   - 12 位精準對應 pre 站 PDP（點圖直跳商品頁）
 *   - 6 位 fallback 連 /category/dresses（原 Shopline 商品未 migrate 或屬 placeholder）
 *   - 加入 magazine-cover hero / pull-quote / product-showcase 熱銷 / cta / faq
 *
 * 商品 mapping 依據（2026-05-12 從 chickimmiu.com 各 ckmuonshow-XX 子頁抓 + pre 站 API 比對）：
 *   - pre 站 1272 件商品，其中 12 件對到原藝人主打單品
 *   - 6 位無對應：4 號 Melody（純形象代言）、9/10/11/16/17（商品未 migrate 或 placeholder）
 *
 * Usage:
 *   pnpm payload run scripts/seed-ckmu-on-show.ts
 *
 * Env:
 *   SEED_DRY_RUN=1   只 parse + 跑 product lookup，不寫 DB
 *   SEED_REPLACE=1   找到既有同 slug Page 就先 delete 再建（重跑用）
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY_RUN = process.env.SEED_DRY_RUN === '1'
const REPLACE = process.env.SEED_REPLACE === '1'

// ── 18 位藝人原始資料 ─────────────────────────────────────────────────
type Celebrity = {
  name: string
  program: string
  imageUrl: string
  linkType: 'pdp' | 'category'
  productSlug?: string
  productName?: string
}

const CELEBS: Celebrity[] = [
  {
    name: '陳美鳳',
    program: '美鳳有約',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/673addc3a958d5000a967f7f/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-特殊v領優雅洋裝-2色-m--2e2308',
    productName: '特殊V領優雅洋裝',
  },
  {
    name: '劉祝華',
    program: '錢線百分百',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/67fc8380358f9f000e08eaf7/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-bethany-蝴蝶結方領洋裝-短袖長版-pink-sm--091460',
    productName: 'Bethany 蝴蝶結方領洋裝',
  },
  {
    name: '韓瑜',
    program: '阿叔',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/673ade7b278954000dc8daee/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-香香風優雅排釦洋裝黑色-sm--5c0175',
    productName: '香香風優雅排釦洋裝',
  },
  {
    name: 'Melody',
    program: '11 點熱吵店',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/6743fef8117400000c7b8bc1/750x.png',
    linkType: 'category', // 原站本就無 view link，純形象代言
  },
  {
    name: '楊智捷',
    program: '非凡新聞台 / StayRich',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/6788a350a218a3000e5f128f/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-audrey-緞面拼接洋裝-粉色-s-cea9da',
    productName: 'Audrey 緞面拼接洋裝',
  },
  {
    name: '高昱晴',
    program: '非凡新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/6909c8b00266ea001049a2db/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-翻領排扣雪紡袖洋裝黑色-sl--921ec1',
    productName: '翻領排扣雪紡袖洋裝',
  },
  {
    name: '葉俞璘',
    program: '小資理財藍圖',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/6880b8fe1fc5b742e6d1363d/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-格紋層次香香洋裝-粉紅色-s--6fad33',
    productName: '格紋層次香香洋裝',
  },
  {
    name: '廖廷娟',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/6909cce35dad440012c20229/750x.jpg',
    linkType: 'pdp',
    productSlug: '現貨-優雅方領排扣襯衫-2色-s--7a2f71',
    productName: '優雅方領排扣襯衫',
  },
  {
    name: '丁士芬',
    program: '東森財經新聞',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/692d6b86dd6aad0016112b7d/750x.png',
    linkType: 'category', // 原 view 是 placeholder koreadress-1-1-1-2-2-1-1
  },
  {
    name: '王淑麗',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/693fc8a39b884a7c3fdbc25c/750x.png',
    linkType: 'category', // 同丁士芬，placeholder
  },
  {
    name: '房業涵',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/6909cb3b10c258001208836f/750x.png',
    linkType: 'category', // 整輯商品 (Riley/香香收腰A字) 未 migrate
  },
  {
    name: '陳靜宜',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/6909cc292bb5f9001073e75e/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-tara-氣質綁帶無袖襯衫-2色-free--eb360a',
    productName: 'TARA 氣質綁帶無袖襯衫',
  },
  {
    name: '李樺仙',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/692e9635e5304c001677c0ab/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-nadine-抓褶領珍珠釦襯衫-4色-free--9c3094',
    productName: 'Nadine 抓褶領珍珠釦襯衫',
  },
  {
    name: '張予馨',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/692e9f17e66cd94c53897253/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-faithra-甜美寬翻領包釦襯衫-2色-free--323c55',
    productName: 'Faithra 甜美寬翻領包釦襯衫',
  },
  {
    name: '林季瑩',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/692d6934eaae600bfcafb77a/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-yvonne-浪漫v領花苞袖洋裝-杏色-m--2fc4ec',
    productName: 'Yvonne 浪漫V領花苞袖洋裝',
  },
  {
    name: '呂心喻',
    program: '東森新聞台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/692e9e69e14441001851c069/750x.png',
    linkType: 'category', // 原 Renee 款 pre 站不同款 (連衣短裙 vs 無袖洋裝)
  },
  {
    name: '葉子菁',
    program: '東森財經台',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/692ea05b6b47ddaa955367e5/750x.png',
    linkType: 'category', // 原 Shopline 子頁無商品列出
  },
  {
    name: '劉佩綺',
    program: '趨勢造夢者',
    imageUrl: 'https://shoplineimg.com/559df3efe37ec64e9f000092/693fc698a184e587355a1661/750x.png',
    linkType: 'pdp',
    productSlug: '現貨-faithra-甜美寬翻領包釦襯衫-2色-free--323c55',
    productName: 'Faithra 甜美寬翻領包釦襯衫',
  },
]

const PAGE_SLUG = 'ckmu-on-show'
const FALLBACK_URL = '/category/dresses'

function imgFilename(idx: number, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9一-龥]/g, '')
  return `ckmu-on-show-${String(idx + 1).padStart(2, '0')}-${safe}.png`
}

function lexicalText(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
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
}

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

async function main() {
  log('🌱 Seeding CKMU ON SHOW page (Stage 1)...')
  if (DRY_RUN) log('   (DRY-RUN mode — no DB writes, no image upload)')
  if (REPLACE) log('   (REPLACE mode — will delete existing page if found)')

  const payload = await getPayload({ config })

  // ── 1. lookup product IDs by slug ──
  log('\n📦 Looking up product IDs from Products collection...')
  const productIdsBySlug: Record<string, number> = {}
  const uniqueSlugs = Array.from(
    new Set(
      CELEBS.filter((c) => c.linkType === 'pdp' && c.productSlug).map(
        (c) => c.productSlug as string,
      ),
    ),
  )
  let missingProducts = 0
  for (const slug of uniqueSlugs) {
    const found = await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    const doc = found.docs[0] as unknown as { id: number } | undefined
    if (doc) {
      productIdsBySlug[slug] = doc.id
      log(`  ✓ ${slug} → id=${doc.id}`)
    } else {
      log(`  ✗ MISSING: ${slug}`)
      missingProducts++
    }
  }
  if (missingProducts > 0) {
    log(`\n⚠️  ${missingProducts} product(s) not found. Those cards will fall back to ${FALLBACK_URL}.`)
  }

  // ── 2. download + upload 18 celebrity images ──
  log('\n🖼️  Downloading celebrity images from Shopline + uploading to Payload Media...')
  const mediaIds: number[] = []
  for (let i = 0; i < CELEBS.length; i++) {
    const c = CELEBS[i]
    const filename = imgFilename(i, c.name)
    try {
      const { buffer, mimetype, size } = await fetchImage(c.imageUrl)
      if (DRY_RUN) {
        log(`  ${i + 1}. ${c.name} → ${filename} (${size} bytes, ${mimetype}) [dry-run]`)
        mediaIds.push(0)
        continue
      }
      const created = (await payload.create({
        collection: 'media',
        data: { alt: `${c.name} 於《${c.program}》節目穿著 CKMU` },
        file: { data: buffer, name: filename, mimetype, size },
      })) as unknown as { id: number }
      mediaIds.push(created.id)
      log(`  ${i + 1}. ${c.name} → media id=${created.id} (${filename}, ${size} bytes)`)
    } catch (e) {
      log(`  ✗ ${i + 1}. ${c.name} FAILED: ${(e as Error).message}`)
      throw e
    }
  }

  // ── 3. assemble lookbook-grid items ──
  const lookbookItems = CELEBS.map((c, i) => {
    const productId =
      c.linkType === 'pdp' && c.productSlug ? productIdsBySlug[c.productSlug] : undefined
    const item: Record<string, unknown> = {
      image: mediaIds[i] || undefined,
      name: c.name,
      tags: [{ text: c.program }],
    }
    if (productId) {
      item.linkedProduct = productId
    } else {
      item.linkUrl = FALLBACK_URL
    }
    return item
  })

  // ── 4. pick 6 unique showcase products (in CELEBS order) ──
  const showcaseProductIds: number[] = []
  for (const c of CELEBS) {
    if (c.linkType === 'pdp' && c.productSlug && productIdsBySlug[c.productSlug]) {
      const id = productIdsBySlug[c.productSlug]
      if (!showcaseProductIds.includes(id)) showcaseProductIds.push(id)
      if (showcaseProductIds.length >= 6) break
    }
  }
  log(`\n🛍️  Showcase products (TOP ${showcaseProductIds.length}): ${showcaseProductIds.join(', ')}`)

  // ── 5. assemble Page payload ──
  const layout = [
    {
      blockType: 'magazine-cover',
      issueLabel: 'CKMU ON SHOW · MEDIA FEATURES',
      heading: '電視螢幕上的 CKMU',
      subheading: '從《美鳳有約》到《11 點熱吵店》，國民藝人都在穿',
      layout: 'center',
      theme: 'light',
      cornerLabels: [{ text: '主編精選' }, { text: '媒體曝光' }],
    },
    {
      blockType: 'pull-quote',
      quote: '一件好衣服，從來不只是衣服——它是場合裡的姿態，鏡頭前的底氣。',
      source: '電視名人 × CKMU',
      font: 'serif',
      alignment: 'center',
    },
    {
      blockType: 'lookbook-grid',
      heading: 'ON SHOW · 18 位藝人穿搭',
      columns: '4',
      items: lookbookItems,
    },
    ...(showcaseProductIds.length > 0
      ? [
          {
            blockType: 'product-showcase',
            heading: 'ON SHOW 熱銷單品',
            products: showcaseProductIds,
            displayStyle: 'grid',
          },
        ]
      : []),
    {
      blockType: 'cta',
      heading: '節目造型贊助 · 媒體合作邀請',
      description:
        '專業電視藝人造型贊助、平面媒體合作、KOL 穿搭企劃，CKMU 期待與您共創內容。',
      buttonText: '聯絡我們',
      buttonLink: '/contact',
      style: 'primary',
    },
    {
      blockType: 'faq',
      heading: 'ON SHOW 常見問題',
      questions: [
        {
          question: '藝人穿過的同款還有現貨嗎？',
          answer: lexicalText(
            '部分節目穿搭已加入「現貨速到」庫存，點擊藝人卡片可直接前往該款商品頁；若顯示售完可加入心願清單，補貨會收到通知。',
          ),
        },
        {
          question: '節目播出後多久可以買到同款？',
          answer: lexicalText(
            'CKMU 多數現貨款於節目播出當週上架；訂購款最快 7-14 個工作天到貨。建議追蹤金老佛爺 Live 或加入 LINE @ckmu 即時掌握。',
          ),
        },
        {
          question: '我是節目造型師，想合作 CKMU 服飾贊助怎麼辦？',
          answer: lexicalText(
            '歡迎透過下方「聯絡我們」表單留言並標註「媒體合作」，CKMU 公關專員會於 1-2 個工作天內回覆；或直接洽 LINE @ckmu。',
          ),
        },
      ],
    },
  ]

  const pageData = {
    title: 'CKMU ON SHOW',
    slug: PAGE_SLUG,
    status: 'published',
    layout,
    seo: {
      metaTitle: 'CKMU ON SHOW｜美鳳有約、阿叔、11 點熱吵店等 18 位藝人同款穿搭',
      metaDescription:
        '陳美鳳、Melody、韓瑜、楊智捷等 18 位電視藝人在節目中穿著 CKMU。點圖直接購買同款 — 台灣設計、韓國工藝、現貨速到。',
    },
  }

  // ── 6. delete existing page if REPLACE mode ──
  if (REPLACE && !DRY_RUN) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: PAGE_SLUG } },
      limit: 1,
      depth: 0,
    })
    const doc = existing.docs[0] as unknown as { id: number } | undefined
    if (doc) {
      await payload.delete({ collection: 'pages', id: doc.id })
      log(`\n🗑️  Deleted existing page id=${doc.id}`)
    }
  }

  // ── 7. create the Page ──
  if (DRY_RUN) {
    log(
      `\n[dry-run] Would create Page: slug=${PAGE_SLUG}, blocks=${layout.length}, lookbook items=${lookbookItems.length}, showcase products=${showcaseProductIds.length}`,
    )
  } else {
    const created = (await payload.create({
      collection: 'pages',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: pageData as any,
    })) as unknown as { id: number; slug: string }
    log(`\n✅ Page created: id=${created.id}, slug=${created.slug}`)
    log(`   Visit: /pages/${created.slug}`)
  }

  log('\n🎉 Done.')
}

await main()
