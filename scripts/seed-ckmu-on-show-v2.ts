/**
 * Seed CKMU ON SHOW — Stage 1.5 (v2)
 * ────────────────────────────────────
 * 升級 Stage 1：
 *   - 把 lookbook-grid items（陣列）→ 升級成 celebrity-features collection（後台 CRUD）
 *   - 每位藝人加 tagline / bio / brandQuote 三段文案
 *   - 主頁 lookbook-grid block 換成 celebrity-grid block（async pull collection）
 *
 * 18 位文案稿件（從 chickimmiu.com 各 ckmuonshow-XX 子頁 + 公開資訊組合）：
 *   - tagline 一句介紹（7-15 字）
 *   - bio 30-50 字節目背景
 *   - brandQuote 20-30 字 CKMU 致敬詞（簡潔不矯情）
 *
 * 重用 Stage 1 已上傳的 media id 15966-15983（不重複下載）。
 *
 * Usage:
 *   pnpm payload run scripts/seed-ckmu-on-show-v2.ts
 *
 * Env:
 *   SEED_DRY_RUN=1   只 plan 不寫 DB
 *   SEED_WIPE=1      先 delete 所有既有 celebrity-features 再重建（重跑用）
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY_RUN = process.env.SEED_DRY_RUN === '1'
const WIPE = process.env.SEED_WIPE === '1'

const PAGE_SLUG = 'ckmu-on-show'
const FALLBACK_URL = '/category/dresses'

type CelebSeed = {
  sortOrder: number
  name: string
  program: string
  // Stage 1 上傳到 media 的 filename，用來反查 media id
  photoFilename: string
  tagline: string
  bio: string
  brandQuote: string
  linkType: 'pdp' | 'url' | 'none'
  productSlug?: string
  linkUrl?: string
}

const CELEBS: CelebSeed[] = [
  {
    sortOrder: 1,
    name: '陳美鳳',
    program: '美鳳有約',
    photoFilename: 'ckmu-on-show-01-陳美鳳.png',
    tagline: '國民阿姐的優雅日常',
    bio: '三立《美鳳有約》主持人，40 年資歷的國民阿姐，以親和力與時尚品味成為跨世代女性的造型典範。',
    brandQuote: '美鳳姐每一次出鏡的得體，是 CKMU 對「莊重不僵硬」最好的詮釋。',
    linkType: 'pdp',
    productSlug: '現貨-特殊v領優雅洋裝-2色-m--2e2308',
  },
  {
    sortOrder: 2,
    name: '劉祝華',
    program: '錢線百分百',
    photoFilename: 'ckmu-on-show-02-劉祝華.png',
    tagline: '財經主播・Joyce Liu',
    bio: '非凡新聞《錢線百分百》財經主播，俐落分析間流露專業女性的鏡頭氣場。',
    brandQuote: '主播台前的精準，配 Bethany 蝴蝶結方領的優雅 — 剛剛好。',
    linkType: 'pdp',
    productSlug: '現貨-bethany-蝴蝶結方領洋裝-短袖長版-pink-sm--091460',
  },
  {
    sortOrder: 3,
    name: '韓瑜',
    program: '阿叔',
    photoFilename: 'ckmu-on-show-03-韓瑜.png',
    tagline: '八點檔女主角的甜美底氣',
    bio: '民視八點檔《阿叔》女主角，戲裡戲外都展現韓式甜美與都會幹練的雙面魅力。',
    brandQuote: '螢光幕前的浪漫，落在生活就是 CKMU 香香風的剛剛好。',
    linkType: 'pdp',
    productSlug: '現貨-香香風優雅排釦洋裝黑色-sm--5c0175',
  },
  {
    sortOrder: 4,
    name: 'Melody',
    program: '11 點熱吵店',
    photoFilename: 'ckmu-on-show-04-Melody.png',
    tagline: '金鐘獎主持人・時尚銳眼',
    bio: 'TVBS《11 點熱吵店》主持人，以犀利幽默與精準時尚 sense 成為話題女王。',
    brandQuote: 'Melody 挑衣服的眼光，正好印證 CKMU 對「俐落而不過頭」的堅持。',
    linkType: 'url',
    linkUrl: FALLBACK_URL,
  },
  {
    sortOrder: 5,
    name: '楊智捷',
    program: '非凡新聞 / StayRich',
    photoFilename: 'ckmu-on-show-05-楊智捷.png',
    tagline: '財經女力的鏡頭氣場',
    bio: '非凡新聞主播兼《StayRich 小資理財藍圖》主持人，知性質感是她的招牌風格。',
    brandQuote: 'Audrey 緞面拼接洋裝 — 主播台的優雅標配。',
    linkType: 'pdp',
    productSlug: '現貨-audrey-緞面拼接洋裝-粉色-s-cea9da',
  },
  {
    sortOrder: 6,
    name: '高昱晴',
    program: '非凡新聞台',
    photoFilename: 'ckmu-on-show-06-高昱晴.png',
    tagline: '新生代主播的清新氣質',
    bio: '非凡新聞主播，鏡頭前的明亮笑容與專業播報是電視觀眾的清晨日常。',
    brandQuote: '雪紡袖的輕盈，接住主播台前的舒適自在。',
    linkType: 'pdp',
    productSlug: '現貨-翻領排扣雪紡袖洋裝黑色-sl--921ec1',
  },
  {
    sortOrder: 7,
    name: '葉俞璘',
    program: '小資理財藍圖',
    photoFilename: 'ckmu-on-show-07-葉俞璘.png',
    tagline: '知性親和的講師魅力',
    bio: '《小資理財藍圖》節目核心成員，以親和力把財經知識帶進每個家庭。',
    brandQuote: '格紋層次香香洋裝 — 知性女性最溫柔的鎧甲。',
    linkType: 'pdp',
    productSlug: '現貨-格紋層次香香洋裝-粉紅色-s--6fad33',
  },
  {
    sortOrder: 8,
    name: '廖廷娟',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-08-廖廷娟.png',
    tagline: '主播台的優雅與分寸',
    bio: '東森新聞主播，沈穩語調與得體儀態是觀眾每日的安心儀式。',
    brandQuote: '優雅方領排扣襯衫 — 新聞女性最有分寸的工作美學。',
    linkType: 'pdp',
    productSlug: '現貨-優雅方領排扣襯衫-2色-s--7a2f71',
  },
  {
    sortOrder: 9,
    name: '丁士芬',
    program: '東森財經新聞',
    photoFilename: 'ckmu-on-show-09-丁士芬.png',
    tagline: '財經鏡頭的俐落知性',
    bio: '東森財經主播 Sophia Ting (IG @shihfent)，鏡頭前後都散發都會專業女性的自信。',
    brandQuote: '一件得體洋裝，就是主播鏡頭前最可靠的搭檔。',
    linkType: 'url',
    linkUrl: FALLBACK_URL,
  },
  {
    sortOrder: 10,
    name: '王淑麗',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-10-王淑麗.png',
    tagline: '氣象主播的溫暖晨光',
    bio: '東森氣象主播，每日清晨用最溫暖的笑容為觀眾預報晴雨。',
    brandQuote: '像她報的好天氣 — CKMU 是每一天最舒服的安心款。',
    linkType: 'url',
    linkUrl: FALLBACK_URL,
  },
  {
    sortOrder: 11,
    name: '房業涵',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-11-房業涵.png',
    tagline: '主播鏡頭裡的時尚分寸',
    bio: '東森新聞主播，台前精準播報、台後對穿搭品味細膩入微。',
    brandQuote: '主播的優雅，是把日常衣服穿得不慌不忙。',
    linkType: 'url',
    linkUrl: FALLBACK_URL,
  },
  {
    sortOrder: 12,
    name: '陳靜宜',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-12-陳靜宜.png',
    tagline: '主播台的清雅韻味',
    bio: '東森新聞主播，柔和音色與素雅選衣品味令觀眾印象深刻。',
    brandQuote: 'TARA 綁帶無袖襯衫的乾淨線條 — 知性女性的低調宣告。',
    linkType: 'pdp',
    productSlug: '現貨-tara-氣質綁帶無袖襯衫-2色-free--eb360a',
  },
  {
    sortOrder: 13,
    name: '李樺仙',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-13-李樺仙.png',
    tagline: '採訪到播報的細膩用心',
    bio: '東森新聞主播，從採訪到播報一貫的細膩用心，造型亦如其人。',
    brandQuote: '抓褶領珍珠釦襯衫 — 端莊穿出現代的甜。',
    linkType: 'pdp',
    productSlug: '現貨-nadine-抓褶領珍珠釦襯衫-4色-free--9c3094',
  },
  {
    sortOrder: 14,
    name: '張予馨',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-14-張予馨.png',
    tagline: '新生代主播的明亮甜美',
    bio: '東森新聞主播，朝氣笑容與層次造型成為螢幕新風景。',
    brandQuote: 'Faithra 翻領包釦襯衫 — 新世代主播的甜酷宣言。',
    linkType: 'pdp',
    productSlug: '現貨-faithra-甜美寬翻領包釦襯衫-2色-free--323c55',
  },
  {
    sortOrder: 15,
    name: '林季瑩',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-15-林季瑩.png',
    tagline: '鏡頭前後的浪漫主播',
    bio: '東森新聞主播，溫婉氣質與輕盈造型同樣令人難忘。',
    brandQuote: 'Yvonne 浪漫 V 領花苞袖 — 主播台下最柔軟的時刻。',
    linkType: 'pdp',
    productSlug: '現貨-yvonne-浪漫v領花苞袖洋裝-杏色-m--2fc4ec',
  },
  {
    sortOrder: 16,
    name: '呂心喻',
    program: '東森新聞台',
    photoFilename: 'ckmu-on-show-16-呂心喻.png',
    tagline: '沉穩中的靈動女力',
    bio: '東森新聞主播，沈穩台風與專業學養兼具，是觀眾信賴的螢光幕日常。',
    brandQuote: '一件好剪裁 — 工作女性最有效率的妝點。',
    linkType: 'url',
    linkUrl: FALLBACK_URL,
  },
  {
    sortOrder: 17,
    name: '葉子菁',
    program: '東森財經台',
    photoFilename: 'ckmu-on-show-17-葉子菁.png',
    tagline: '財經主播的優雅信念',
    bio: '東森財經主播，把複雜的市場分析說成觀眾聽得懂的優雅日常。',
    brandQuote: '衣品如其播報 — 清晰、有力、不喧嘩。',
    linkType: 'url',
    linkUrl: FALLBACK_URL,
  },
  {
    sortOrder: 18,
    name: '劉佩綺',
    program: '趨勢造夢者',
    photoFilename: 'ckmu-on-show-18-劉佩綺.png',
    tagline: '趨勢前線的女性視角',
    bio: '《趨勢造夢者》節目主持人，以前瞻視野與細膩眼光帶觀眾看見趨勢的另一面。',
    brandQuote: 'Faithra 翻領包釦的俐落感 — 趨勢工作者最會說話的細節。',
    linkType: 'pdp',
    productSlug: '現貨-faithra-甜美寬翻領包釦襯衫-2色-free--323c55',
  },
]

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

async function main() {
  log('🌱 CKMU ON SHOW — Stage 1.5 (v2): CelebrityFeatures collection seed')
  if (DRY_RUN) log('   (DRY-RUN — no DB writes)')
  if (WIPE) log('   (WIPE — will delete existing celebrity-features rows first)')

  const payload = await getPayload({ config })

  // ── 1. lookup media IDs by filename (Stage 1 已上傳的圖) ──
  log('\n🖼️  Looking up Stage 1 uploaded media by filename...')
  const mediaIdByFilename: Record<string, number> = {}
  for (const c of CELEBS) {
    const found = await payload.find({
      collection: 'media',
      where: { filename: { equals: c.photoFilename } },
      limit: 1,
      depth: 0,
    })
    const doc = found.docs[0] as unknown as { id: number } | undefined
    if (doc) {
      mediaIdByFilename[c.photoFilename] = doc.id
    } else {
      throw new Error(`Media file not found: ${c.photoFilename}. Run Stage 1 seed first.`)
    }
  }
  log(`   ✓ Resolved ${Object.keys(mediaIdByFilename).length}/${CELEBS.length} media files`)

  // ── 2. lookup product IDs by slug ──
  log('\n📦 Looking up product IDs...')
  const productIdBySlug: Record<string, number> = {}
  const uniqueSlugs = Array.from(
    new Set(
      CELEBS.filter((c) => c.linkType === 'pdp' && c.productSlug).map(
        (c) => c.productSlug as string,
      ),
    ),
  )
  for (const slug of uniqueSlugs) {
    const found = await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    const doc = found.docs[0] as unknown as { id: number } | undefined
    if (doc) {
      productIdBySlug[slug] = doc.id
      log(`   ✓ ${slug} → id=${doc.id}`)
    } else {
      log(`   ✗ MISSING: ${slug}`)
    }
  }

  // ── 3. WIPE existing celebrity-features rows if requested ──
  if (WIPE && !DRY_RUN) {
    const existing = await payload.find({
      collection: 'celebrity-features',
      limit: 1000,
      depth: 0,
    })
    log(`\n🗑️  Deleting ${existing.docs.length} existing celebrity-features rows...`)
    for (const d of existing.docs as unknown as Array<{ id: number }>) {
      await payload.delete({ collection: 'celebrity-features', id: d.id })
    }
  }

  // ── 4. create celebrity-features rows ──
  log('\n👤 Creating celebrity-features rows...')
  for (const c of CELEBS) {
    const photoId = mediaIdByFilename[c.photoFilename]
    const productId = c.productSlug ? productIdBySlug[c.productSlug] : undefined

    const data: Record<string, unknown> = {
      name: c.name,
      program: c.program,
      photo: photoId,
      tagline: c.tagline,
      bio: c.bio,
      brandQuote: c.brandQuote,
      sortOrder: c.sortOrder,
      status: 'published',
    }
    if (c.linkType === 'pdp' && productId) {
      data.linkType = 'pdp'
      data.linkedProduct = productId
    } else if (c.linkType === 'pdp' && !productId) {
      // 對應商品找不到，降級到 /category/dresses
      data.linkType = 'url'
      data.linkUrl = FALLBACK_URL
    } else if (c.linkType === 'url') {
      data.linkType = 'url'
      data.linkUrl = c.linkUrl
    } else {
      data.linkType = 'none'
    }

    if (DRY_RUN) {
      log(
        `   [dry-run] ${c.sortOrder}. ${c.name} (${c.program}) — link=${data.linkType}, photo_id=${photoId}`,
      )
      continue
    }

    const created = (await payload.create({
      collection: 'celebrity-features',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
    })) as unknown as { id: number }
    log(`   ✓ ${c.sortOrder}. ${c.name} → id=${created.id}`)
  }

  // ── 5. replace lookbook-grid block in /pages/ckmu-on-show with celebrity-grid ──
  log('\n📄 Updating /pages/ckmu-on-show: replacing lookbook-grid with celebrity-grid...')
  const pageFound = await payload.find({
    collection: 'pages',
    where: { slug: { equals: PAGE_SLUG } },
    limit: 1,
    depth: 0,
  })
  const page = pageFound.docs[0] as unknown as { id: number; layout?: unknown[] } | undefined
  if (!page) {
    log(`   ✗ Page /pages/${PAGE_SLUG} not found. Run Stage 1 seed first.`)
    return
  }

  const oldLayout = (page.layout as Array<Record<string, unknown>>) || []
  const newLayout = oldLayout.map((block) => {
    if (block.blockType === 'lookbook-grid') {
      return {
        blockType: 'celebrity-grid',
        heading: 'ON SHOW · 18 位藝人穿搭',
        subheading: '點圖直跳同款商品。滑鼠移到卡片浮現節目背景與品牌致敬詞。',
        columns: '4',
        showBioOnHover: true,
      }
    }
    return block
  })

  if (DRY_RUN) {
    const lookbookCount = oldLayout.filter((b) => b.blockType === 'lookbook-grid').length
    const celebrityCount = newLayout.filter((b) => b.blockType === 'celebrity-grid').length
    log(
      `   [dry-run] Would replace ${lookbookCount} lookbook-grid block(s) with ${celebrityCount} celebrity-grid block(s)`,
    )
  } else {
    await payload.update({
      collection: 'pages',
      id: page.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { layout: newLayout as any },
    })
    log(`   ✓ Page id=${page.id} updated`)
  }

  log('\n🎉 Done. Visit: https://pre.chickimmiu.com/pages/ckmu-on-show')
}

await main()
