import { createSign } from 'node:crypto'

import type { Where } from 'payload'

import { markdownToBasicLexical } from '@/lib/blog/aiDraft'
import { JOURNEY_TEMPLATES } from '@/lib/crm/journeyDefinitions'

type PayloadLike = {
  find: Function
  findByID: Function
  create: Function
  update: Function
}

type LooseRecord = Record<string, unknown>

export interface WhiteHatRunOptions {
  mode?: 'all' | 'daily' | 'weekly' | 'seo' | 'email' | 'procurement' | 'video'
  commitSEO?: boolean
  source?: 'admin' | 'cron'
}

export interface WhiteHatRunResult {
  ok: true
  mode: string
  emailTemplates?: { created: number; updated: number }
  journeys?: { created: number; updated: number }
  searchConsole?: SearchConsoleImportResult
  seo?: { drafts: number; productsUpdated: number; keywordsUpdated: number }
  weeklyContent?: { contentDrafts: number; blogDrafts: number }
  video?: { drafts: number }
  procurement?: { scored: number }
  operations?: { drafts: number; summary: OperationalSummary }
}

export interface SearchConsoleImportResult {
  configured: boolean
  imported: number
  updated: number
  skipped: number
  error?: string
}

interface ProductLite {
  id: string | number
  name?: string
  slug?: string
  price?: number
  salePrice?: number
  cost?: number
  stock?: number
  isLowStock?: boolean
  isHot?: boolean
  isNew?: boolean
  shortDescription?: string
  material?: string
  status?: string
  collectionTags?: string[]
  seo?: { metaTitle?: string; metaDescription?: string }
  category?: string | number | { title?: string; name?: string; slug?: string }
  sourcing?: {
    fabricInfo?: { material?: string; madeIn?: string; thickness?: string; transparency?: string; elasticity?: string }
  }
}

interface OperationalSummary {
  date: string
  todayOrders: number
  todayRevenue: number
  estimatedGrossProfit: number
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  lowStockProducts: Array<{ id: string | number; name: string; stock: number }>
  customerQuestionCategories: Array<{ category: string; count: number }>
  logisticsAlerts: Array<{ orderNumber: string; ageDays: number; status: string }>
  promotionCandidates: Array<{ id: string | number; name: string; reason: string }>
  engineeringTasks: string[]
}

const SITE_URL = 'https://www.chickimmiu.com'

const LIFECYCLE_EMAIL_TEMPLATES = [
  {
    slug: 'whitehat-welcome-email',
    name: '白帽行銷：新會員歡迎信',
    category: 'welcome',
    subject: '{{user_name}}，歡迎加入 CHIC KIM & MIU',
    body:
      '親愛的 {{user_name}}，歡迎加入 CHIC KIM & MIU。這裡會分享韓國設計師款、穿搭靈感與會員專屬提醒。' +
      '我們只會在妳同意訂閱時寄送行銷內容，也可以隨時取消訂閱。',
  },
  {
    slug: 'whitehat-abandoned-cart-email',
    name: '白帽行銷：未結帳購物車提醒',
    category: 'lifecycle',
    subject: '{{user_name}}，購物車裡的單品還在等妳',
    body:
      '妳上次加入購物車的單品還在。若還在考慮尺寸或搭配，可以回到商品頁看材質、版型與穿搭建議。' +
      '這封信只寄給已訂閱會員，並會受冷卻時間限制。',
  },
  {
    slug: 'whitehat-repeat-purchase-email',
    name: '白帽行銷：老客戶回購提醒',
    category: 'winback',
    subject: '{{user_name}}，最近有幾款很適合妳的韓系新品',
    body:
      '依照妳過去喜歡的風格，我們整理了近期適合通勤、約會與日常生活的新品。不是急著叫妳買，' +
      '而是幫妳少花一點時間找到好搭、耐穿、能重複使用的款式。',
  },
  {
    slug: 'whitehat-vip-new-arrival-email',
    name: '白帽行銷：VIP 專屬新品通知',
    category: 'lifecycle',
    subject: '{{tier_front_name}} 專屬新品預覽',
    body:
      '這一季我們先為 VIP 會員整理新品重點：材質、版型、適合場合與搭配方向。' +
      '內容會以幫助挑選為主，不做全網最低價或壓迫式促銷。',
  },
  {
    slug: 'whitehat-birthday-email',
    name: '白帽行銷：生日優惠券提醒',
    category: 'festival',
    subject: '{{user_name}}，生日月祝福與專屬禮遇',
    body:
      '生日月快樂。CHIC KIM & MIU 為妳準備了生日禮遇，妳可以依照本月真正需要的場合來挑選，' +
      '例如通勤、旅行、聚會或正式場合，不需要為了折扣而勉強購買。',
  },
  {
    slug: 'whitehat-low-stock-internal',
    name: '白帽行銷：低庫存內部提醒',
    category: 'custom',
    subject: '低庫存商品提醒：請確認是否補貨或改推替代款',
    body:
      '這是內部營運提醒，不寄給一般會員。系統會彙整低庫存商品、近 7 日銷售與可替代推廣款，供採購與客服使用。',
  },
]

export function scoreCompetitorPriceRecord(input: LooseRecord): Partial<LooseRecord> {
  const priceTWD = num(input.priceTWD)
  const priceKRW = num(input.priceKRW)
  const estimatedCostTWD = num(input.estimatedCostTWD) || Math.round(priceKRW * 0.023)
  const effectivePrice = priceTWD || Math.round(priceKRW * 0.023 * 2.2)
  const marginPercent = effectivePrice > 0
    ? Math.round(((effectivePrice - estimatedCostTWD) / effectivePrice) * 1000) / 10
    : 0

  const text = `${input.productName ?? ''} ${input.style ?? ''} ${input.material ?? ''}`.toLowerCase()
  const trendScore =
    keywordScore(text, ['korea', '韓', '首爾', '通勤', '婚禮', '正式', '直播', '同款', '新品'], 8, 36) +
    (priceTWD > 0 || priceKRW > 0 ? 14 : 0)
  const marginScore = clamp(Math.round(marginPercent), 0, 40)
  const riskScore = keywordScore(text, ['仿', 'logo', '品牌同款', '侵權', '明星同款'], -10, 30)
  const matchingScore = keywordScore(text, ['通勤', '約會', '婚禮', '旅行', '襯衫', '洋裝', '外套', '針織'], 6, 26)
  const liveScore = keywordScore(text, ['亮片', '顯瘦', '套裝', '洋裝', '直播', '顏色', '修身'], 7, 28)
  const adsScore = keywordScore(text, ['百搭', '通勤', '顯瘦', '小香', '正式', '婚禮', '休閒'], 6, 28)
  const totalScore = clamp(
    Math.round(marginScore * 0.28 + trendScore * 0.2 + riskScore * 0.16 + matchingScore * 0.16 + liveScore * 0.1 + adsScore * 0.1),
    0,
    100,
  )

  const flags: string[] = []
  if (marginPercent >= 45) flags.push('high_margin')
  if (riskScore >= 22) flags.push('low_risk')
  if (liveScore >= 18) flags.push('live_suitable')
  if (adsScore >= 18) flags.push('ad_suitable')
  if (totalScore >= 72) flags.push('reorder_candidate')
  if (totalScore < 55 || riskScore < 12) flags.push('watchlist')

  const recommendation =
    totalScore >= 75
      ? `建議列入採購候選：預估毛利率 ${marginPercent}% ，風格與 CKMU 站內通勤/直播/廣告素材需求相符。`
      : totalScore >= 60
        ? `可小量測試：預估毛利率 ${marginPercent}% ，建議先搭配直播或新品內容驗證點擊與詢問。`
        : `暫緩採購：目前分數 ${totalScore}，請補齊材質、同款市場價格或供應商風險資訊後再判斷。`

  return {
    normalizedName: normalizeName(String(input.productName ?? '')),
    metrics: {
      marginScore,
      trendScore,
      riskScore,
      matchingScore,
      liveScore,
      adsScore,
      estimatedMarginPercent: marginPercent,
    },
    totalScore,
    flags,
    purchaseRecommendation: recommendation,
  }
}

export async function runWhiteHatAutomation(
  payload: PayloadLike,
  options: WhiteHatRunOptions = {},
): Promise<WhiteHatRunResult> {
  const mode = options.mode ?? 'all'
  const result: WhiteHatRunResult = { ok: true, mode }

  if (mode === 'all' || mode === 'email') {
    result.emailTemplates = await ensureLifecycleEmailTemplates(payload)
    result.journeys = await ensureCoreMarketingJourneys(payload)
  }

  if (mode === 'all' || mode === 'seo' || mode === 'weekly') {
    result.searchConsole = await importSearchConsoleKeywords(payload)
    result.seo = await generateProductSEOSuggestions(payload, { commit: Boolean(options.commitSEO) })
  }

  if (mode === 'all' || mode === 'weekly') {
    result.weeklyContent = await createWeeklyBrandContent(payload)
    result.video = await createShortVideoDrafts(payload)
  }

  if (mode === 'all' || mode === 'video') {
    result.video = await createShortVideoDrafts(payload)
  }

  if (mode === 'all' || mode === 'procurement') {
    result.procurement = await scorePendingProcurement(payload)
  }

  if (mode === 'all' || mode === 'daily') {
    result.operations = await createDailyOperationsDrafts(payload)
  }

  return result
}

export async function getWhiteHatDashboard(payload: PayloadLike) {
  const [
    keywords,
    drafts,
    competitors,
    products,
    templates,
    summary,
  ] = await Promise.all([
    payload.find({
      collection: 'search-console-keywords' as never,
      where: { status: { in: ['new', 'reviewing'] } } satisfies Where,
      sort: '-opportunityScore',
      limit: 10,
      depth: 1,
    }),
    payload.find({
      collection: 'marketing-content-drafts' as never,
      sort: '-updatedAt',
      limit: 20,
      depth: 1,
    }),
    payload.find({
      collection: 'competitor-price-records' as never,
      sort: '-totalScore',
      limit: 10,
      depth: 1,
    }),
    payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } } satisfies Where,
      sort: '-updatedAt',
      limit: 100,
      depth: 0,
    }),
    payload.find({
      collection: 'message-templates',
      limit: 100,
      depth: 0,
    }),
    buildOperationalSummary(payload),
  ])

  const productDocs = products.docs as ProductLite[]
  const missingSeo = productDocs.filter((p) => !p.seo?.metaTitle || !p.seo?.metaDescription).length
  const draftDocs = drafts.docs as LooseRecord[]
  const competitorDocs = competitors.docs as LooseRecord[]
  const whitehatTemplates = (templates.docs as LooseRecord[]).filter((t) =>
    String(t.templateSlug ?? '').startsWith('whitehat-'),
  )

  return {
    ok: true,
    overview: {
      seoOpportunities: keywords.totalDocs,
      publishedProductsSampled: products.docs.length,
      missingSeoInSample: missingSeo,
      contentDrafts: drafts.totalDocs,
      procurementRecords: competitors.totalDocs,
      lifecycleEmailTemplates: whitehatTemplates.length,
      gscConfigured: Boolean(process.env.GSC_ACCESS_TOKEN || process.env.GSC_SERVICE_ACCOUNT_JSON),
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
    },
    operations: summary,
    keywords: keywords.docs,
    drafts: draftDocs,
    competitors: competitorDocs,
  }
}

async function ensureLifecycleEmailTemplates(payload: PayloadLike) {
  let created = 0
  let updated = 0

  for (const item of LIFECYCLE_EMAIL_TEMPLATES) {
    const found = await payload.find({
      collection: 'message-templates',
      where: { templateSlug: { equals: item.slug } } satisfies Where,
      limit: 1,
      depth: 0,
    })

    const data = {
      templateName: item.name,
      templateSlug: item.slug,
      channel: 'email',
      category: item.category,
      subject: item.subject,
      htmlContent: renderEmailHTML(item.body),
      isActive: true,
    }

    if (found.docs[0]) {
      await payload.update({ collection: 'message-templates', id: found.docs[0].id, data } as never)
      updated++
    } else {
      await payload.create({ collection: 'message-templates', data } as never)
      created++
    }
  }

  return { created, updated }
}

async function ensureCoreMarketingJourneys(payload: PayloadLike) {
  const core = new Set([
    'welcome_registration',
    'cart_abandoned',
    'dormant_wakeup',
    'birthday_treat',
    'new_product_priority',
    'vip_care',
  ])
  let created = 0
  let updated = 0

  for (const journey of JOURNEY_TEMPLATES.filter((j) => core.has(j.slug))) {
    const found = await payload.find({
      collection: 'automation-journeys',
      where: { slug: { equals: journey.slug } } satisfies Where,
      limit: 1,
      depth: 0,
    })
    if (found.docs[0]) {
      await payload.update({ collection: 'automation-journeys', id: found.docs[0].id, data: journey } as never)
      updated++
    } else {
      await payload.create({ collection: 'automation-journeys', data: journey } as never)
      created++
    }
  }

  return { created, updated }
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}

interface GscAuthResult {
  token: string | null
  method: 'static_token' | 'service_account' | 'none'
  error?: string
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function parseServiceAccount(raw: string): ServiceAccountKey | null {
  try {
    const trimmed = raw.trim()
    // Accept either raw JSON or a base64-encoded JSON blob (easier to store in env).
    const text = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8')
    const json = JSON.parse(text) as Partial<ServiceAccountKey>
    if (typeof json.client_email === 'string' && typeof json.private_key === 'string') {
      return { client_email: json.client_email, private_key: json.private_key, token_uri: json.token_uri }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Mint a short-lived (1h) GSC access token from a service-account key using a
 * self-signed JWT (RS256) exchanged at Google's OAuth token endpoint. This is
 * the durable, cron-safe auth path — unlike a raw GSC_ACCESS_TOKEN which Google
 * expires after ~1 hour and is therefore useless for scheduled runs.
 *
 * Setup: GCP service account + Search Console API enabled, and the SA's
 * client_email added as a user on the GSC property (read access is enough).
 */
async function mintGscAccessTokenFromServiceAccount(sa: ServiceAccountKey): Promise<string | null> {
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  )
  const signingInput = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()
  // private_key parsed from JSON already has real newlines; guard the case where
  // it was stored with literal \n escapes outside of JSON.
  const privateKey = sa.private_key.includes('\\n')
    ? sa.private_key.replace(/\\n/g, '\n')
    : sa.private_key
  const assertion = `${signingInput}.${base64url(signer.sign(privateKey))}`

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`token endpoint HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as { access_token?: string }
  return json.access_token ?? null
}

/**
 * Resolve a usable GSC access token. Priority:
 *  1. GSC_ACCESS_TOKEN (static bearer — for manual/one-off testing only; expires hourly)
 *  2. GSC_SERVICE_ACCOUNT_JSON (raw or base64 JSON — durable, used by cron)
 */
async function resolveGscAccessToken(): Promise<GscAuthResult> {
  if (process.env.GSC_ACCESS_TOKEN) {
    return { token: process.env.GSC_ACCESS_TOKEN, method: 'static_token' }
  }
  const saRaw = process.env.GSC_SERVICE_ACCOUNT_JSON
  if (saRaw) {
    const sa = parseServiceAccount(saRaw)
    if (!sa) {
      return { token: null, method: 'service_account', error: 'GSC_SERVICE_ACCOUNT_JSON 解析失敗（需 raw JSON 或 base64 JSON，含 client_email + private_key）' }
    }
    try {
      const token = await mintGscAccessTokenFromServiceAccount(sa)
      if (!token) return { token: null, method: 'service_account', error: 'token 端點未回傳 access_token' }
      return { token, method: 'service_account' }
    } catch (err) {
      return {
        token: null,
        method: 'service_account',
        error: `換 token 失敗（確認 Search Console API 已啟用 + SA email 已加進 GSC property）：${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }
  return { token: null, method: 'none' }
}

async function importSearchConsoleKeywords(payload: PayloadLike): Promise<SearchConsoleImportResult> {
  const auth = await resolveGscAccessToken()
  const siteUrl = process.env.GSC_SITE_URL || SITE_URL + '/'
  if (!auth.token) {
    // method !== 'none' means credentials were provided but failed → surface the error.
    return {
      configured: auth.method !== 'none',
      imported: 0,
      updated: 0,
      skipped: 0,
      ...(auth.error ? { error: auth.error } : {}),
    }
  }
  const token = auth.token

  const endDate = dateOnly(daysAgo(3))
  const startDate = dateOnly(daysAgo(31))

  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          rowLimit: Number(process.env.GSC_ROW_LIMIT || 250),
          dataState: 'final',
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { configured: true, imported: 0, updated: 0, skipped: 0, error: `GSC HTTP ${res.status}: ${text.slice(0, 180)}` }
    }

    const json = (await res.json()) as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> }
    let imported = 0
    let updated = 0
    let skipped = 0

    for (const row of json.rows ?? []) {
      const [query, page] = row.keys ?? []
      if (!query || !page) {
        skipped++
        continue
      }
      const pagePath = toPath(page)
      const impressions = Math.round(row.impressions ?? 0)
      const clicks = Math.round(row.clicks ?? 0)
      const ctr = Math.round((row.ctr ?? 0) * 10000) / 100
      const position = Math.round((row.position ?? 0) * 10) / 10
      const opportunityScore = scoreSearchOpportunity({ impressions, clicks, ctr, position })
      const targetProduct = await findProductByPagePath(payload, pagePath)
      const data = {
        query,
        pagePath,
        source: 'gsc',
        targetProduct: targetProduct?.id,
        impressions,
        clicks,
        ctr,
        position,
        opportunityScore,
        intent: inferIntent(query),
        status: 'new',
        importedAt: new Date().toISOString(),
      }

      const existing = await payload.find({
        collection: 'search-console-keywords' as never,
        where: {
          and: [
            { query: { equals: query } },
            { pagePath: { equals: pagePath } },
          ],
        } satisfies Where,
        limit: 1,
        depth: 0,
      })
      if (existing.docs[0]) {
        await payload.update({
          collection: 'search-console-keywords' as never,
          id: existing.docs[0].id,
          data,
        })
        updated++
      } else {
        await payload.create({
          collection: 'search-console-keywords' as never,
          data,
        })
        imported++
      }
    }

    return { configured: true, imported, updated, skipped }
  } catch (err) {
    return {
      configured: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function generateProductSEOSuggestions(payload: PayloadLike, options: { commit: boolean }) {
  const products = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } } satisfies Where,
    sort: '-updatedAt',
    limit: 60,
    depth: 1,
  })
  const keywords = await payload.find({
    collection: 'search-console-keywords' as never,
    where: { status: { in: ['new', 'reviewing'] } } satisfies Where,
    sort: '-opportunityScore',
    limit: 200,
    depth: 0,
  })

  let drafts = 0
  let productsUpdated = 0
  let keywordsUpdated = 0

  for (const product of products.docs as ProductLite[]) {
    const matched = matchKeywordsForProduct(product, keywords.docs as LooseRecord[]).slice(0, 5)
    if (matched.length === 0 && product.seo?.metaTitle && product.seo?.metaDescription) continue

    const suggestion = buildProductSEOSuggestion(product, matched)
    await createOrUpdateDraft(payload, {
      type: 'seo_product_meta',
      title: `SEO 建議：${product.name ?? product.slug ?? product.id}`,
      status: 'review',
      targetProduct: product.id,
      targetSegment: 'internal',
      channels: ['product_page'],
      body: `Title:\n${suggestion.title}\n\nMeta Description:\n${suggestion.metaDescription}\n\n文案補強:\n${suggestion.copyPatch}`,
      metadata: {
        productId: product.id,
        productSlug: product.slug,
        sourceKeywords: matched.map((k) => k.query),
        generatedAt: new Date().toISOString(),
      },
    })
    drafts++

    await createOrUpdateDraft(payload, {
      type: 'product_faq',
      title: `FAQ 建議：${product.name ?? product.slug ?? product.id}`,
      status: 'review',
      targetProduct: product.id,
      targetSegment: 'internal',
      channels: ['product_page'],
      body: suggestion.faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n'),
      metadata: {
        productId: product.id,
        productSlug: product.slug,
        faq: suggestion.faq,
        sourceKeywords: matched.map((k) => k.query),
      },
    })
    drafts++

    for (const keyword of matched) {
      await payload.update({
        collection: 'search-console-keywords' as never,
        id: keyword.id,
        data: {
          targetProduct: product.id,
          status: 'reviewing',
          suggestions: {
            title: suggestion.title,
            metaDescription: suggestion.metaDescription,
            faq: suggestion.faq,
            copyPatch: suggestion.copyPatch,
          },
        },
      })
      keywordsUpdated++
    }

    if (options.commit) {
      const existingSeo = product.seo ?? {}
      const shouldUpdateTitle = !existingSeo.metaTitle
      const shouldUpdateDescription = !existingSeo.metaDescription
      if (shouldUpdateTitle || shouldUpdateDescription) {
        await payload.update({
          collection: 'products',
          id: product.id,
          data: {
            seo: {
              ...existingSeo,
              metaTitle: shouldUpdateTitle ? suggestion.title : existingSeo.metaTitle,
              metaDescription: shouldUpdateDescription
                ? suggestion.metaDescription
                : existingSeo.metaDescription,
            },
          },
        } as never)
        productsUpdated++
      }
    }
  }

  return { drafts, productsUpdated, keywordsUpdated }
}

async function createWeeklyBrandContent(payload: PayloadLike) {
  const weekKey = getWeekKey(new Date())
  const products = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } } satisfies Where,
    sort: '-updatedAt',
    limit: 8,
    depth: 1,
  })
  const productNames = (products.docs as ProductLite[]).map((p) => p.name).filter(Boolean).slice(0, 4)
  const adminId = await findFirstAdminId(payload)

  const topics = [
    {
      category: 'styling',
      title: `韓國通勤穿搭筆記：${weekKey} 的 3 個好搭方向`,
      body:
        `## 這週的穿搭觀察\n` +
        `韓系通勤不是把全身穿得很正式，而是讓比例、材質和顏色都看起來舒服。` +
        `本週可以從「乾淨上身、俐落下身、低調亮點配件」三個方向開始。\n\n` +
        `## 可以帶入的單品\n${productNames.map((p) => `- ${p}`).join('\n') || '- 本週新品與熱銷款'}\n\n` +
        `## 金老佛爺口吻素材\n今天不是叫妳買很多，而是挑一件能重複搭配、拍照好看、上班也不尷尬的款式。`,
    },
    {
      category: 'trends',
      title: `首爾街拍靈感：把韓系流行穿成台灣日常`,
      body:
        `## 趨勢不等於照抄\n首爾街拍常見的重點是輪廓感、同色系層次，以及一個能拉出記憶點的細節。` +
        `台灣日常更需要透氣、好走、好整理，所以選款要看材質與場合。\n\n` +
        `## 本週可延伸內容\n- 短版外套搭高腰下身\n- 針織與襯衫的疊穿\n- 婚禮與正式場合的柔和光澤`,
    },
    {
      category: 'brand-story',
      title: `衣服保養與生活風格：讓韓國設計款穿得更久`,
      body:
        `## 好衣服也需要被好好照顧\n韓國設計款的細節常在布料、車線與版型。清洗時先看材質，針織與細緻布料建議反面洗、低速脫水，` +
        `正式洋裝則用透氣防塵袋收納。\n\n` +
        `## 生活化提醒\n買衣服前先想三個場景：上班能不能穿、週末能不能穿、重要場合能不能撐住氣場。三個都成立，這件就很值得留下。`,
    },
  ] as const

  let contentDrafts = 0
  let blogDrafts = 0

  for (const topic of topics) {
    await createOrUpdateDraft(payload, {
      type: 'weekly_article',
      title: topic.title,
      status: 'draft',
      targetSegment: 'all',
      channels: ['blog'],
      body: topic.body,
      metadata: {
        weekKey,
        category: topic.category,
        source: 'weekly-whitehat-content',
        productHints: productNames,
      },
    })
    contentDrafts++

    if (adminId) {
      const slug = `${slugify(topic.title)}-${weekKey.toLowerCase()}`
      const existing = await payload.find({
        collection: 'blog-posts',
        where: { slug: { equals: slug } } satisfies Where,
        limit: 1,
        depth: 0,
      })
      if (!existing.docs[0]) {
        await payload.create({
          collection: 'blog-posts',
          data: {
            title: topic.title,
            slug,
            excerpt: topic.body.replace(/[#*\n-]+/g, ' ').slice(0, 120),
            content: markdownToBasicLexical(topic.body) as never,
            author: adminId,
            category: topic.category,
            tags: [{ tag: '韓國穿搭' }, { tag: '白帽內容' }, { tag: weekKey }],
            status: 'draft',
            seo: {
              metaTitle: `${topic.title} | CHIC KIM & MIU`,
              metaDescription: topic.body.replace(/[#*\n-]+/g, ' ').slice(0, 150),
            },
          } as never,
        })
        blogDrafts++
      }
    }
  }

  return { contentDrafts, blogDrafts }
}

async function createShortVideoDrafts(payload: PayloadLike) {
  const products = await payload.find({
    collection: 'products',
    where: {
      and: [
        { status: { equals: 'published' } },
        { or: [{ isHot: { equals: true } }, { isNew: { equals: true } }] },
      ],
    } satisfies Where,
    sort: '-updatedAt',
    limit: 3,
    depth: 1,
  })
  const docs = products.docs.length > 0
    ? products.docs as ProductLite[]
    : (await payload.find({
        collection: 'products',
        where: { status: { equals: 'published' } } satisfies Where,
        sort: '-updatedAt',
        limit: 3,
        depth: 1,
      })).docs as ProductLite[]

  let drafts = 0
  const weekKey = getWeekKey(new Date())

  for (const product of docs) {
    const name = product.name ?? '本週精選單品'
    const material = getMaterial(product)
    const hook = `${name}，不是只拍好看，是要讓妳真的知道怎麼搭。`
    const body =
      `標題：${name} 這樣搭最不費力\n\n` +
      `旁白腳本：\n` +
      `1. ${hook}\n` +
      `2. 先看版型：適合通勤、約會或正式場合時，重點是比例乾淨。\n` +
      `3. 再看材質：${material || '以商品頁材質資訊為準'}，穿起來的挺度和照顧方式要一起想。\n` +
      `4. 金老佛爺提醒：不要因為流行就買，要看它能不能跟妳衣櫃裡三件以上單品重複搭配。\n\n` +
      `封面文案：這件怎麼搭才不浪費？`

    await createOrUpdateDraft(payload, {
      type: 'short_video_script',
      title: `Reels/Shorts：${name}`,
      status: 'scheduled',
      targetProduct: product.id,
      targetSegment: 'all',
      channels: ['reels', 'shorts'],
      body,
      hashtags: ['#CHICKIMMIU', '#金老佛爺', '#韓國穿搭', '#韓系女裝', '#日常穿搭'],
      scheduledAt: nextWeekdayAt(2, 20, 30).toISOString(),
      metadata: {
        weekKey,
        productSlug: product.slug,
        title: `${name} 這樣搭最不費力`,
        coverCopy: '這件怎麼搭才不浪費？',
      },
    })
    drafts++
  }

  return { drafts }
}

async function scorePendingProcurement(payload: PayloadLike) {
  const result = await payload.find({
    collection: 'competitor-price-records' as never,
    where: { status: { in: ['new', 'reviewed'] } } satisfies Where,
    limit: 100,
    depth: 0,
  })
  let scored = 0
  for (const record of result.docs as LooseRecord[]) {
    await payload.update({
      collection: 'competitor-price-records' as never,
      id: record.id,
      data: scoreCompetitorPriceRecord(record),
    })
    scored++
  }
  return { scored }
}

async function createDailyOperationsDrafts(payload: PayloadLike) {
  const summary = await buildOperationalSummary(payload)
  const date = summary.date
  let drafts = 0

  await createOrUpdateDraft(payload, {
    type: 'ops_summary',
    title: `每日訂單與營運摘要 ${date}`,
    status: 'review',
    targetSegment: 'internal',
    channels: ['internal'],
    body:
      `今日訂單：${summary.todayOrders}\n` +
      `今日營收：NT$${summary.todayRevenue.toLocaleString('zh-TW')}\n` +
      `預估毛利：NT$${summary.estimatedGrossProfit.toLocaleString('zh-TW')}\n\n` +
      `熱賣商品：\n${summary.topProducts.map((p) => `- ${p.name}：${p.quantity} 件 / NT$${p.revenue.toLocaleString('zh-TW')}`).join('\n') || '- 尚無資料'}\n\n` +
      `低庫存商品：\n${summary.lowStockProducts.map((p) => `- ${p.name}：庫存 ${p.stock}`).join('\n') || '- 無'}\n\n` +
      `物流異常：\n${summary.logisticsAlerts.map((o) => `- ${o.orderNumber}：${o.status} 已 ${o.ageDays} 天`).join('\n') || '- 無'}\n\n` +
      `客服問題分類：\n${summary.customerQuestionCategories.map((c) => `- ${c.category}：${c.count}`).join('\n') || '- 尚無待處理分類'}`,
    metadata: summary,
  })
  drafts++

  await createOrUpdateDraft(payload, {
    type: 'restock_advice',
    title: `本週補貨與推廣建議 ${date}`,
    status: 'review',
    targetSegment: 'internal',
    channels: ['internal'],
    body:
      `應補貨：\n${summary.lowStockProducts.map((p) => `- ${p.name}：先確認供應商交期與現有預購需求`).join('\n') || '- 暫無低庫存商品'}\n\n` +
      `應推廣：\n${summary.promotionCandidates.map((p) => `- ${p.name}：${p.reason}`).join('\n') || '- 暫無推薦推廣款'}\n\n` +
      `給 OpenClaw / 工程師的任務指令：\n${summary.engineeringTasks.map((t) => `- ${t}`).join('\n')}`,
    metadata: {
      date,
      lowStockProducts: summary.lowStockProducts,
      promotionCandidates: summary.promotionCandidates,
      engineeringTasks: summary.engineeringTasks,
    },
  })
  drafts++

  return { drafts, summary }
}

async function buildOperationalSummary(payload: PayloadLike): Promise<OperationalSummary> {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  const [todayOrders, weekOrders, lowStock, tickets, oldOrders] = await Promise.all([
    payload.find({
      collection: 'orders',
      where: { createdAt: { greater_than_equal: todayStart.toISOString() } } satisfies Where,
      limit: 500,
      depth: 1,
      pagination: false,
    }),
    payload.find({
      collection: 'orders',
      where: { createdAt: { greater_than_equal: sevenDaysAgo.toISOString() } } satisfies Where,
      limit: 1000,
      depth: 1,
      pagination: false,
    }),
    payload.find({
      collection: 'products',
      where: { isLowStock: { equals: true } } satisfies Where,
      limit: 20,
      depth: 0,
    }),
    payload.find({
      collection: 'customer-service-tickets',
      where: { status: { in: ['open', 'pending'] } } satisfies Where,
      limit: 100,
      depth: 0,
    }).catch(() => ({ docs: [] })),
    payload.find({
      collection: 'orders',
      where: {
        and: [
          { createdAt: { less_than_equal: threeDaysAgo.toISOString() } },
          { status: { in: ['pending', 'processing'] } },
        ],
      } satisfies Where,
      limit: 20,
      depth: 0,
    }),
  ])

  const todayDocs = todayOrders.docs as LooseRecord[]
  const todayRevenue = todayDocs
    .filter((o) => String(o.paymentStatus ?? '') === 'paid')
    .reduce((sum, o) => sum + num(o.total), 0)
  const estimatedGrossProfit = todayDocs.reduce((sum, order) => {
    const items = Array.isArray(order.items) ? order.items as LooseRecord[] : []
    return sum + items.reduce((inner, item) => {
      const unitPrice = num(item.unitPrice)
      const quantity = num(item.quantity)
      const product = item.product as LooseRecord | undefined
      const cost = product && typeof product === 'object' ? num(product.cost) : 0
      return inner + Math.max(0, unitPrice - cost) * quantity
    }, 0)
  }, 0)

  const topMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const order of weekOrders.docs as LooseRecord[]) {
    const items = Array.isArray(order.items) ? order.items as LooseRecord[] : []
    for (const item of items) {
      const name = String(item.productName ?? '未命名商品')
      const row = topMap.get(name) ?? { name, quantity: 0, revenue: 0 }
      row.quantity += num(item.quantity)
      row.revenue += num(item.subtotal)
      topMap.set(name, row)
    }
  }

  const ticketMap = new Map<string, number>()
  for (const ticket of tickets.docs as LooseRecord[]) {
    const key = String(ticket.category ?? ticket.type ?? '未分類客服問題')
    ticketMap.set(key, (ticketMap.get(key) ?? 0) + 1)
  }

  const lowStockProducts = (lowStock.docs as ProductLite[]).map((p) => ({
    id: p.id,
    name: String(p.name ?? p.slug ?? p.id),
    stock: num(p.stock),
  }))

  const promotionCandidates = (weekOrders.docs as LooseRecord[])
    .flatMap((order) => Array.isArray(order.items) ? order.items as LooseRecord[] : [])
    .slice(0, 8)
    .map((item) => {
      const product = item.product as ProductLite | undefined
      return {
        id: product?.id ?? String(item.productName ?? ''),
        name: String(item.productName ?? product?.name ?? '熱銷商品'),
        reason: '近 7 日有銷售紀錄，可優先產短影音與 Email 搭配文案。',
      }
    })
    .filter((row, idx, arr) => arr.findIndex((x) => x.name === row.name) === idx)
    .slice(0, 5)

  return {
    date: dateOnly(new Date()),
    todayOrders: todayOrders.totalDocs ?? todayDocs.length,
    todayRevenue,
    estimatedGrossProfit,
    topProducts: Array.from(topMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    lowStockProducts,
    customerQuestionCategories: Array.from(ticketMap.entries()).map(([category, count]) => ({ category, count })),
    logisticsAlerts: (oldOrders.docs as LooseRecord[]).map((o) => ({
      orderNumber: String(o.orderNumber ?? o.id),
      status: String(o.status ?? 'pending'),
      ageDays: Math.max(0, Math.round((Date.now() - new Date(String(o.createdAt)).getTime()) / 86400000)),
    })),
    promotionCandidates,
    engineeringTasks: [
      process.env.GSC_ACCESS_TOKEN || process.env.GSC_SERVICE_ACCOUNT_JSON ? 'GSC 已設定；可檢查 SEO 回寫結果與 CTR 變化。' : '設定 GSC_SERVICE_ACCOUNT_JSON + GSC_SITE_URL，啟用 Search Console 關鍵字匯入。',
      '確認 /api/cron/whitehat-marketing 已加入 GitHub Actions 並有 CRON_SECRET。',
      '若要自動發布 Reels/Shorts，下一步需接 Meta / YouTube 官方發布 API 與審核佇列。',
      '將低庫存提醒串到採購或內部 Email，只寄給 staff，不寄給一般會員。',
    ],
  }
}

function buildProductSEOSuggestion(product: ProductLite, keywords: LooseRecord[]) {
  const name = product.name ?? '韓系精選單品'
  const category = getCategoryLabel(product)
  const material = getMaterial(product)
  const keywordText = keywords.map((k) => String(k.query ?? '')).filter(Boolean).slice(0, 3)
  const primary = keywordText[0] || `${category} 韓系穿搭`
  const title = truncate(`${name}｜${primary}｜CHIC KIM & MIU`, 58)
  const metaDescription = truncate(
    `${name} 適合${inferOccasion(product, keywordText)}。${material ? `材質重點：${material}。` : ''}` +
      `提供韓國設計感穿搭建議、尺寸與保養提醒，幫妳挑到真正能重複搭配的款式。`,
    150,
  )
  const faq = [
    {
      question: `${name} 適合什麼場合？`,
      answer: `適合${inferOccasion(product, keywordText)}，也可依商品頁尺寸與材質資訊調整搭配方式。`,
    },
    {
      question: `${name} 如何保養？`,
      answer: material
        ? `建議依 ${material} 的特性低溫或反面清洗，細緻材質可使用洗衣袋並避免高溫烘乾。`
        : '建議依商品洗滌標示處理，細緻衣料可使用洗衣袋並避免高溫烘乾。',
    },
    {
      question: '如果尺寸不確定怎麼辦？',
      answer: '可先參考商品頁尺寸表、材質彈性與客服建議。正式場合款建議預留活動空間。',
    },
  ]
  const copyPatch =
    `可把「${primary}」自然放入商品短描述，補上場合、材質與搭配方式；` +
    `避免關鍵字堆疊，讓搜尋者一眼知道這件適合誰、怎麼穿、怎麼保養。`

  return { title, metaDescription, faq, copyPatch }
}

async function createOrUpdateDraft(payload: PayloadLike, data: LooseRecord) {
  const found = await payload.find({
    collection: 'marketing-content-drafts' as never,
    where: {
      and: [
        { type: { equals: data.type } },
        { title: { equals: data.title } },
      ],
    } satisfies Where,
    limit: 1,
    depth: 0,
  })

  if (found.docs[0]) {
    await payload.update({
      collection: 'marketing-content-drafts' as never,
      id: found.docs[0].id,
      data,
    })
  } else {
    await payload.create({
      collection: 'marketing-content-drafts' as never,
      data,
    })
  }
}

async function findFirstAdminId(payload: PayloadLike): Promise<string | number | null> {
  const users = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } } satisfies Where,
    sort: 'createdAt',
    limit: 1,
    depth: 0,
  })
  return users.docs[0]?.id ?? null
}

async function findProductByPagePath(payload: PayloadLike, pagePath: string): Promise<ProductLite | null> {
  const match = pagePath.match(/\/products\/([^/?#]+)/)
  if (!match?.[1]) return null
  const slug = decodeURIComponent(match[1])
  const result = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } } satisfies Where,
    limit: 1,
    depth: 0,
  })
  return (result.docs[0] as ProductLite | undefined) ?? null
}

function matchKeywordsForProduct(product: ProductLite, keywords: LooseRecord[]) {
  const slug = String(product.slug ?? '')
  const nameTokens = normalizeName(String(product.name ?? '')).split('-').filter((t) => t.length >= 2)
  return keywords
    .filter((k) => {
      const pagePath = String(k.pagePath ?? '')
      const query = normalizeName(String(k.query ?? ''))
      return (slug && pagePath.includes(`/products/${slug}`)) || nameTokens.some((t) => query.includes(t))
    })
    .sort((a, b) => num(b.opportunityScore) - num(a.opportunityScore))
}

function scoreSearchOpportunity(row: { impressions: number; clicks: number; ctr: number; position: number }) {
  const impressionScore = clamp(Math.round(row.impressions / 20), 0, 35)
  const ctrScore = row.impressions >= 50 && row.ctr < 2 ? 35 : row.ctr < 4 ? 24 : 10
  const positionScore = row.position <= 3 ? 10 : row.position <= 12 ? 24 : row.position <= 25 ? 18 : 8
  return clamp(impressionScore + ctrScore + positionScore, 0, 100)
}

function inferIntent(query: string) {
  const q = query.toLowerCase()
  if (/[洋裝|襯衫|外套|針織|褲|裙|包|商品|價格|尺寸]/.test(q)) return 'product'
  if (/[穿搭|搭配|顯瘦|通勤|約會|婚禮]/.test(q)) return 'styling'
  if (/[洗|保養|收納|材質|縮水]/.test(q)) return 'care'
  if (/[chic|kim|miu|金老佛爺|靚秀]/i.test(q)) return 'brand'
  if (/[生活|旅行|上班|日常]/.test(q)) return 'lifestyle'
  return 'unknown'
}

function inferOccasion(product: ProductLite, keywords: string[]) {
  const text = `${product.name ?? ''} ${product.shortDescription ?? ''} ${keywords.join(' ')} ${(product.collectionTags ?? []).join(' ')}`
  if (/婚禮|正式|formal/i.test(text)) return '婚禮、聚會與正式場合'
  if (/通勤|上班|襯衫|西裝/i.test(text)) return '通勤、上班與日常外出'
  if (/旅行|休閒|rush/i.test(text)) return '旅行、週末與日常休閒'
  if (/直播|金老佛爺|jin-live/i.test(text)) return '直播穿搭、聚會與日常亮點'
  return '日常穿搭、約會與輕正式場合'
}

function getMaterial(product: ProductLite) {
  return product.material || product.sourcing?.fabricInfo?.material || ''
}

function getCategoryLabel(product: ProductLite) {
  const category = product.category
  if (typeof category === 'object' && category) {
    return category.title || category.name || category.slug || '韓系女裝'
  }
  return '韓系女裝'
}

function renderEmailHTML(body: string) {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
  return `<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif; line-height: 1.8; color: #1A1F36;">${escaped}</div>`
}

function keywordScore(text: string, keywords: string[], each: number, base: number) {
  const score = base + keywords.reduce((sum, kw) => sum + (text.includes(kw.toLowerCase()) ? each : 0), 0)
  return clamp(score, 0, 40)
}

function num(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function truncate(input: string, max: number) {
  return input.length > max ? input.slice(0, max - 1) : input
}

function normalizeName(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function slugify(input: string) {
  return normalizeName(input).slice(0, 58) || 'whitehat-draft'
}

function dateOnly(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000)
}

function toPath(url: string) {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

function getWeekKey(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000)
  const week = Math.ceil((diffDays + start.getUTCDay() + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function nextWeekdayAt(day: number, hour: number, minute: number) {
  const now = new Date()
  const target = new Date(now)
  const diff = (day + 7 - target.getDay()) % 7 || 7
  target.setDate(target.getDate() + diff)
  target.setHours(hour, minute, 0, 0)
  return target
}
