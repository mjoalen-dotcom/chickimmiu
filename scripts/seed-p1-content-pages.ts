/**
 * Seed P1 內容頁遷移 — Shopline → Pages collection
 * ────────────────────────────────────────────────
 * 2 頁（docs/session-prompts/36 第 4 節 P1 項目）：
 *   /pages/offline-shop-1 — 預約體驗 SHOWROOM（電話/LINE/地址/營業時間）
 *   /pages/tagckmu        — 穿搭分享領購物金（活動規則）
 *
 * 冪等：以 slug upsert（存在就整頁覆蓋 layout + seo；admin 後續手改不受 seed 重跑影響
 * 的話請勿再跑本 script）。
 *
 * Usage:
 *   pnpm payload run scripts/seed-p1-content-pages.ts
 * Env:
 *   SEED_DRY_RUN=1   只 plan 不寫 DB
 */

import { getPayload } from 'payload'
import config from '@payload-config'

const DRY_RUN = process.env.SEED_DRY_RUN === '1'

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(msg)
}

/** Lexical helpers — 純文字段落 / 標題（同 seed-brand-anthem-blog.ts pattern） */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function richText(...nodes: any[]) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: nodes,
    },
  }
}

const LINE_OA_URL = 'https://lin.ee/AYWzgKW'

const PAGES = [
  {
    slug: 'offline-shop-1',
    title: '預約體驗 SHOWROOM',
    seo: {
      metaTitle: '預約體驗 SHOWROOM | CHIC KIM & MIU',
      metaDescription:
        'CHIC KIM & MIU 台北 SHOWROOM 一對一預約體驗：專屬穿搭顧問、實品試穿。台北市基隆路一段68號9樓，週一至週五 09:30–18:00，電話 02-2718-9488。',
    },
    layout: [
      {
        blockType: 'hero-banner',
        heading: '預約體驗 SHOWROOM',
        subheading: '一對一專屬穿搭服務 · 實品試穿 · 韓國設計選品',
        ctaText: '透過 LINE 立即預約',
        ctaLink: LINE_OA_URL,
        overlay: 30,
      },
      {
        blockType: 'rich-content',
        content: richText(
          lexicalParagraph(
            'CHIC KIM & MIU 的台北 SHOWROOM 採預約制，由專屬顧問為您服務。你可以在這裡實際觸摸布料、試穿當季新品，並獲得依身形與場合的一對一穿搭建議。',
          ),
          lexicalHeading('預約方式', 'h3'),
          lexicalParagraph('電話預約：02-2718-9488'),
          lexicalParagraph('LINE 預約：官方帳號 @ckmu（點下方按鈕加入）'),
          lexicalHeading('SHOWROOM 資訊', 'h3'),
          lexicalParagraph('地址：台北市基隆路一段68號9樓'),
          lexicalParagraph('營業時間：週一至週五 09:30–18:00（例假日休息）'),
          lexicalParagraph('鄰近捷運市政府站，建議搭乘大眾運輸前往。'),
          lexicalHeading('溫馨提醒', 'h3'),
          lexicalParagraph(
            '為確保每位顧客都能享有完整的顧問服務，請務必提前預約；未預約之臨時來訪可能無法即時安排接待。',
          ),
        ),
      },
      {
        blockType: 'cta',
        heading: '準備好體驗了嗎？',
        description: '加入 LINE 官方帳號 @ckmu，告訴我們你方便的時間，顧問將盡快與你確認預約。',
        buttonText: 'LINE 預約 @ckmu',
        buttonLink: LINE_OA_URL,
        style: 'primary',
      },
    ],
  },
  {
    slug: 'tagckmu',
    title: '#CKMU 穿搭分享領購物金',
    seo: {
      metaTitle: '#CKMU 穿搭分享領購物金 | CHIC KIM & MIU',
      metaDescription:
        '分享你的 CHIC KIM & MIU 穿搭照，標記 #CKMU，即可獲得購物金回饋。活動規則與參加方式看這裡。',
    },
    layout: [
      {
        blockType: 'hero-banner',
        heading: '#CKMU 穿搭分享',
        subheading: '曬出你的 CKMU 穿搭，領購物金回饋',
        ctaText: '立即投稿',
        ctaLink: LINE_OA_URL,
        overlay: 30,
      },
      {
        blockType: 'rich-content',
        content: richText(
          lexicalParagraph(
            '穿上 CHIC KIM & MIU，你就是最好的代言人。分享你的穿搭照並標記品牌，審核通過即可獲得購物金回饋，還有機會被選為精選穿搭、登上品牌社群與官網。',
          ),
          lexicalHeading('參加方式', 'h3'),
          lexicalParagraph('1. 穿上任一 CHIC KIM & MIU 商品拍攝穿搭照。'),
          lexicalParagraph(
            '2. 發佈到 Instagram 或 Facebook，公開貼文並加上 hashtag #CKMU 與 #chickimmiu。',
          ),
          lexicalParagraph(
            '3. 將貼文連結與訂單編號透過 LINE 官方帳號 @ckmu 傳給我們完成登記。',
          ),
          lexicalParagraph('4. 審核通過後，購物金將直接存入你的會員帳戶。'),
          lexicalHeading('回饋內容', 'h3'),
          lexicalParagraph(
            '每次審核通過的分享可獲得購物金回饋（金額依當期活動公告為準）；被選為精選穿搭另有加碼獎勵。',
          ),
        ),
      },
      {
        blockType: 'faq',
        heading: '常見問題',
        questions: [
          {
            question: '購物金多久入帳？',
            answer: richText(
              lexicalParagraph('登記後 3–5 個工作天內完成審核，審核通過即入帳，可在會員中心「點數與購物金」查看。'),
            ),
          },
          {
            question: '同一張訂單可以分享多次嗎？',
            answer: richText(
              lexicalParagraph('同一張訂單以一次回饋為限；購買多次、分享多次則每張訂單皆可登記。'),
            ),
          },
          {
            question: '照片有什麼要求？',
            answer: richText(
              lexicalParagraph(
                '需可清楚看到 CHIC KIM & MIU 商品的實穿照（非平拍），貼文需維持公開至少 30 天；模糊、翻拍或非本人穿著的照片將不予通過。',
              ),
            ),
          },
          {
            question: '購物金怎麼使用？',
            answer: richText(
              lexicalParagraph('結帳時可直接折抵訂單金額，使用規則依購物金使用條款為準。'),
            ),
          },
        ],
      },
      {
        blockType: 'cta',
        heading: '你的穿搭，值得被看見',
        description: '現在就把你的 #CKMU 穿搭分享出來，透過 LINE @ckmu 完成登記領取購物金。',
        buttonText: '透過 LINE 登記領購物金',
        buttonLink: LINE_OA_URL,
        style: 'primary',
      },
    ],
  },
]

async function main() {
  const payload = await getPayload({ config })

  for (const def of PAGES) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: def.slug } },
      limit: 1,
      depth: 0,
    })

    const data = {
      title: def.title,
      slug: def.slug,
      status: 'published',
      layout: def.layout,
      seo: def.seo,
    }

    if (DRY_RUN) {
      log(`[DRY] ${existing.docs.length ? 'update' : 'create'} /pages/${def.slug}（${def.layout.length} blocks）`)
      continue
    }

    if (existing.docs.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'pages',
        id: existing.docs[0].id,
        data,
      })
      log(`✓ updated /pages/${def.slug} (id=${existing.docs[0].id})`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = await (payload as any).create({ collection: 'pages', data })
      log(`✓ created /pages/${def.slug} (id=${created.id})`)
    }
  }

  log('\n🎉 Done. Visit:')
  log('   https://pre.chickimmiu.com/pages/offline-shop-1')
  log('   https://pre.chickimmiu.com/pages/tagckmu')
}

await main()
