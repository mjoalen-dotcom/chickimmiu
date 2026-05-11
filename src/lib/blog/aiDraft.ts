/**
 * Blog AI Draft — Groq Llama 3.3 70B integration for fashion blog post generation.
 *
 * - Provider: Groq cloud (https://api.groq.com/openai/v1) — OpenAI-compatible
 * - Default model: `llama-3.3-70b-versatile`（覆寫用 GROQ_BLOG_MODEL）
 *   ‧ 比 horoscope 用的 8B-instant 質量大幅提升，價錢仍便宜（每篇文章 < $0.01 USD）
 *   ‧ 之所以另外定 BLOG_MODEL 而不直接複用 horoscope/groq.ts，是因為運勢用 8B 速度
 *     優先，部落格要長文 + 品牌語氣，70B 比較不會掉鏈子
 * - Cost: 每篇預估 ~3000 tokens in + 2000 tokens out ≈ $0.001 USD（Groq 70B 定價）
 * - 失敗會 throw → 呼叫端 catch 後可 retry 或回 fallback
 *
 * 啟用條件：
 *   process.env.GROQ_API_KEY（同 horoscope，沒設就回 503）
 *
 * 取 API key：https://console.groq.com/keys（免費）
 *
 * 將來升級：multimodal（看商品照產出更具體的面料 / 版型描述）需切到 Anthropic
 * Claude 4.6 Sonnet（vision-capable），Groq 目前沒提供 70B vision。
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `你是 CHIC KIM & MIU（CKMU、靚秀國際）的時尚部落格寫手。
品牌定位：韓國設計師款女裝，目標客群 25-45 歲台灣女性，客單 NT$1500-3500，
不打價格戰，走「品質 + 韓國設計故事 + AI 個性化」路線。創辦人金老佛爺
（金赫繆）是 5 萬粉 KOL，太太親自選款。

【絕對禁區（違反會擋下發布）】
1. 絕不寫具體競品名稱（Lulus、ZARA、SHEIN、Uniqlo、東森、Momo、Pinkoi 等等）
2. 絕不寫醫療美容療程效果（拉皮、肉毒、玻尿酸、蘋果肌、瘦身效果保證等）
3. 絕不引用其他人的歌詞、書籍段落、整段轉貼新聞稿
4. 絕不寫具體藝人 / 名人姓名背書（除非品牌已確認合作的 IP），例：金老佛爺直播款是 OK 的
5. 不寫迷信、宗教衝突、政治、性、暴力相關內容
6. 不寫「全網最低價 / 限量搶購 / 錯過就再也沒有」這類煽情用語

【內容風格】
- 中文繁體（台灣用語）
- 語氣：優雅、自信、溫柔但不過度感性
- 段落：每段 80-150 字，總長度依使用者指定 wordCountTarget（範圍 600-2000 字）
- 結構：H2 大段落 + H3 小節；穿插 H3 「穿搭 tip」、「材質筆記」等子標題
- 起頭要鉤住讀者（具體場景、季節變化、社群觀察、街拍洞察）
- 結尾呼應開頭 + 給 1 個明確 CTA（瀏覽商品 / 預約諮詢 / 留言互動）
- 韓國元素：自然帶入（首爾穿搭觀察、東大門面料、韓系 styling 邏輯），
  避免硬塞「韓國時尚」字眼
- 季節感：夏／秋／冬／春對應材質與配色（如夏：亞麻棉麻、淺色系；秋：羊毛、駝色與酒紅）
- 不要列「TOP 10 必買」這種排行榜清單，改用「3 種場合 × 3 套搭法」這類有結構的清單

【JSON Schema（嚴格依此回傳，不要 markdown 圍欄、不要任何前後文字）】
{
  "title": "文章標題（20-30 字、具體有畫面感、不寫 SEO 關鍵字堆疊）",
  "excerpt": "摘要（80-120 字、文案能單獨用在社群推文）",
  "contentMarkdown": "完整文章 Markdown（用 ## 開段、### 開子段，可有 **粗體**、清單、引言）",
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "seoMetaTitle": "SEO 標題（50-60 字內含核心關鍵字）",
  "seoMetaDescription": "SEO 描述（120-155 字、能誘發點擊）"
}

【tags 建議方向】
- 季節：春夏穿搭 / 秋冬穿搭
- 場合：通勤、約會、婚禮、旅行、辦公室
- 風格：韓系、極簡、知性、優雅、休閒、性感、復古
- 單品：洋裝、針織、外套、襯衫、長裙
最多 5 個，避免過於廣泛（例：「穿搭」太空洞）。`

export interface BlogAIDraftInput {
  topic: string
  /** spring / summer / autumn / winter / all */
  season?: 'spring' | 'summer' | 'autumn' | 'winter' | 'all'
  /** 想帶入的商品名稱（給 LLM 自然提及，不會自動插入連結；連結由作者後製） */
  productHints?: string[]
  /** 目標字數（600-2000） */
  wordCountTarget?: number
  /** 額外風格 / 文章方向關鍵字 */
  styleKeywords?: string[]
  /** 文章分類（與 BlogPosts.category options 對齊） */
  category?: 'styling' | 'new-arrivals' | 'brand-story' | 'promotions' | 'trends'
}

export interface BlogAIDraftOutput {
  title: string
  excerpt: string
  contentMarkdown: string
  suggestedTags: string[]
  seoMetaTitle: string
  seoMetaDescription: string
}

interface GroqResponse {
  choices?: Array<{
    message?: { content?: string }
  }>
  error?: { message?: string }
}

const SEASON_ZH: Record<NonNullable<BlogAIDraftInput['season']>, string> = {
  spring: '春季（3-5 月，輕薄、淺色、初夏感）',
  summer: '夏季（6-8 月，透氣、亞麻、淡彩）',
  autumn: '秋季（9-11 月，疊穿、駝色、酒紅、針織）',
  winter: '冬季（12-2 月，毛料、長外套、深色系）',
  all: '不限季節（寫常青題材）',
}

const CATEGORY_ZH: Record<NonNullable<BlogAIDraftInput['category']>, string> = {
  styling: '穿搭教學（重實用 tips、結構式搭配方法）',
  'new-arrivals': '新品介紹（聚焦本季新品的設計概念與材質故事）',
  'brand-story': '品牌故事（分享 CKMU 採購觀察、韓國設計師合作背景）',
  promotions: '優惠活動（介紹當期活動但不喧賓奪主，重點仍在內容價值）',
  trends: '時尚趨勢（觀察韓國 / 全球趨勢，提煉可落地的台灣穿搭建議）',
}

export async function generateBlogDraft(input: BlogAIDraftInput): Promise<BlogAIDraftOutput> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const model = process.env.GROQ_BLOG_MODEL || DEFAULT_MODEL

  const wordCount = clampWordCount(input.wordCountTarget)
  const seasonLine = input.season ? `\n季節：${SEASON_ZH[input.season]}` : ''
  const categoryLine = input.category ? `\n文章分類：${CATEGORY_ZH[input.category]}` : ''
  const productLine =
    input.productHints && input.productHints.length > 0
      ? `\n可自然帶入的商品（不要硬塞、不要寫到全部）：${input.productHints.slice(0, 5).join('、')}`
      : ''
  const styleLine =
    input.styleKeywords && input.styleKeywords.length > 0
      ? `\n額外風格 / 方向關鍵字：${input.styleKeywords.slice(0, 8).join('、')}`
      : ''

  const userPrompt = `主題：${input.topic}
目標字數：約 ${wordCount} 字（±15%）${seasonLine}${categoryLine}${productLine}${styleLine}

請依系統 prompt 規範產出 JSON。記得：
- contentMarkdown 完整可發布、不要留 placeholder（如「在此填入...」）
- suggestedTags 限 3-5 個、具體不空泛
- 不要在 contentMarkdown 重寫 title 當第一個 H1（前台會自動渲染標題）
- 直接回 JSON，不要 markdown 圍欄、不要解釋文字`

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
    // 70B + 4K tokens 通常 5-15 秒；給 60s 緩衝避免短期延遲被誤殺
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  const json = (await res.json()) as GroqResponse
  if (json.error) throw new Error(`Groq API error: ${json.error.message}`)

  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned empty content')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(`Groq returned non-JSON: ${content.slice(0, 300)}`)
  }

  return validateAndNormalize(parsed)
}

function clampWordCount(input?: number): number {
  if (!input || !Number.isFinite(input)) return 1000
  return Math.max(600, Math.min(2000, Math.floor(input)))
}

function validateAndNormalize(raw: unknown): BlogAIDraftOutput {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid LLM JSON shape')
  const r = raw as Record<string, unknown>

  const required = [
    'title',
    'excerpt',
    'contentMarkdown',
    'seoMetaTitle',
    'seoMetaDescription',
  ] as const
  for (const k of required) {
    if (typeof r[k] !== 'string' || !(r[k] as string).trim()) {
      throw new Error(`LLM missing/invalid field: ${k}`)
    }
  }

  const tags = Array.isArray(r.suggestedTags)
    ? r.suggestedTags.filter((t): t is string => typeof t === 'string' && !!t.trim()).slice(0, 5)
    : []

  return {
    title: String(r.title).trim(),
    excerpt: String(r.excerpt).trim(),
    contentMarkdown: String(r.contentMarkdown).trim(),
    suggestedTags: tags,
    seoMetaTitle: String(r.seoMetaTitle).trim(),
    seoMetaDescription: String(r.seoMetaDescription).trim(),
  }
}

/**
 * Build a minimal valid Lexical JSON document from markdown.
 *
 * 這是一個 conservative 的轉換器，足以支援 BlogPosts 的 Lexical 編輯器初始載入：
 *   - 把空行分段 → 每段一個 paragraph node
 *   - 段首 `## ` / `### ` → heading h2 / h3 node
 *   - 段首 `> ` → quote node
 *   - 段首 `- ` 連續行 → unordered list（每行一個 listitem）
 *   - 純文字（`**bold**` / `*italic*` / `[link](url)`）保留為原始 text，
 *     **不在轉換時 parse inline marks** — 之後在 Lexical 編輯器內手動套格式即可
 *
 * 為什麼不接 @payloadcms/richtext-lexical 官方 markdown converter：
 *   - 官方 export 在不同版本的 path 與簽章不穩定，會綁住升級
 *   - 我們只需要「載入時段落分得清」即可，admin 開草稿後本來就要再 polish
 *
 * 之後若要更完整 markdown → Lexical：可改用 unified + remark-parse + 自寫
 * Lexical visitor，或直接用 Anthropic Claude 4.6 Sonnet 直出 Lexical JSON。
 */
export function markdownToBasicLexical(markdown: string): Record<string, unknown> {
  const lines = markdown.split(/\r?\n/)
  const blocks: Array<Record<string, unknown>> = []

  let buf: string[] = []
  let listBuf: string[] = []
  let mode: 'paragraph' | 'list' = 'paragraph'

  const flushParagraph = () => {
    const text = buf.join('\n').trim()
    buf = []
    if (!text) return
    blocks.push(textBlock('paragraph', text))
  }

  const flushList = () => {
    if (listBuf.length === 0) return
    blocks.push({
      type: 'list',
      listType: 'bullet',
      tag: 'ul',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      start: 1,
      children: listBuf.map((item, idx) => ({
        type: 'listitem',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        value: idx + 1,
        children: [textNode(item)],
      })),
    })
    listBuf = []
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '')

    if (mode === 'list' && !line.startsWith('- ')) {
      flushList()
      mode = 'paragraph'
    }

    if (line === '') {
      flushParagraph()
      continue
    }

    if (line.startsWith('## ')) {
      flushParagraph()
      blocks.push(textBlock('heading', line.slice(3).trim(), { tag: 'h2' }))
      continue
    }
    if (line.startsWith('### ')) {
      flushParagraph()
      blocks.push(textBlock('heading', line.slice(4).trim(), { tag: 'h3' }))
      continue
    }
    if (line.startsWith('> ')) {
      flushParagraph()
      blocks.push(textBlock('quote', line.slice(2).trim()))
      continue
    }
    if (line.startsWith('- ')) {
      if (mode !== 'list') {
        flushParagraph()
        mode = 'list'
      }
      listBuf.push(line.slice(2).trim())
      continue
    }

    buf.push(line)
  }
  flushParagraph()
  flushList()

  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: blocks.length > 0 ? blocks : [textBlock('paragraph', '')],
    },
  }
}

function textNode(text: string): Record<string, unknown> {
  return {
    type: 'text',
    version: 1,
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
  }
}

function textBlock(
  blockType: 'paragraph' | 'heading' | 'quote',
  text: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: blockType,
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: [textNode(text)],
    ...extra,
  }
}
