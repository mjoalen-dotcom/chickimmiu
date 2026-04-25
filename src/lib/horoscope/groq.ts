import type { HoroscopeContent, HoroscopeGenInput } from './types'
import { STYLE_KEYWORDS_VOCAB } from './types'
import { ZODIAC_LABELS } from './zodiac'

/**
 * Groq Llama 3.1 8B integration for daily horoscope generation.
 *
 * - API：Groq cloud (https://api.groq.com/openai/v1) — OpenAI-compatible
 * - Default model: `llama-3.1-8b-instant`（覆寫用 GROQ_MODEL）
 * - Cost: < $1 USD/year for 12 signs × 2 genders × 365 days at封測 traffic
 * - 失敗會 throw → 呼叫端 catch 後 fallback 到 seed
 *
 * 啟用條件：
 *   process.env.HOROSCOPE_LLM_PROVIDER === 'groq' && process.env.GROQ_API_KEY
 *
 * 取 API key：https://console.groq.com/keys（免費）
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.1-8b-instant'

const SYSTEM_PROMPT = `你是 CHIC KIM & MIU 品牌的星座運勢生成器。
你的任務是為「指定星座 × 指定性別 × 指定日期」生成一份運勢內容，回傳純 JSON。

【絕對禁區（違反會導致法律與品牌風險）】
1. 絕不討論「個股、加密貨幣、特定金融產品」名稱或操作建議
2. 絕不給出「醫療診斷、健康治療、用藥」相關建議
3. 不寫迷信、宗教衝突、政治、性、暴力相關文字
4. 「財運」段落只能寫日常理財心態（記帳/儲蓄/克制衝動消費），絕不提「股票/基金/虛擬貨幣」
5. 「注意事項」只能寫日常生活提醒（飲食/作息/情緒/言行），絕不提具體疾病或治療

【內容風格】
- 中文繁體（台灣用語）
- 每段 50–80 字、語氣溫暖正向但不浮誇
- 穿搭建議要呼應今日 4 項運勢提醒（e.g. 財運受沖時建議穩重色系）
- 男性穿搭用「紳士、俐落、溫文」風格詞；女性用「優雅、溫柔、自信」風格詞

【JSON Schema（嚴格依此回傳，不要 markdown 圍欄）】
{
  "workFortune": "工作運描述",
  "relationshipFortune": "人際運描述",
  "moneyFortune": "財運描述",
  "cautionFortune": "注意事項",
  "outfitAdvice": "穿搭建議（呼應上面 4 項）",
  "luckyColors": ["顏色1", "顏色2"],
  "styleKeywords": ["enum1", "enum2"]
}

【styleKeywords 限定詞彙】
只能從以下 enum 挑 1–2 個（不可亂創）：
- "jin-live" 金老佛爺直播款
- "jin-style" 金金同款
- "host-style" 主播同款
- "brand-custom" 品牌自訂款
- "formal-dresses" 正式洋裝
- "rush" 現貨速到
- "celebrity-style" 藝人穿搭
`

interface GroqResponse {
  choices?: Array<{
    message?: { content?: string }
  }>
  error?: { message?: string }
}

export async function generateViaGroq(input: HoroscopeGenInput): Promise<HoroscopeContent> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL
  const label = ZODIAC_LABELS[input.sign]
  const genderZh = input.gender === 'male' ? '男性' : '女性'

  const birthTimeLine = input.birthTime
    ? `\n出生時間：${input.birthTime}（24 小時制；可參考此時辰調整氣質傾向，但仍以太陽星座為主）`
    : ''

  const userPrompt = `日期：${input.date}
星座：${label.zh} (${label.dateRange})，元素：${label.element}
性別：${genderZh}${birthTimeLine}

請依照系統 prompt 規範，生成今日運勢 JSON。styleKeywords 必須從這 7 個 enum 中挑：
${STYLE_KEYWORDS_VOCAB.map((k) => `"${k}"`).join(', ')}

回傳純 JSON，不要任何 markdown 圍欄或解釋文字。`

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
    // timeout safety — Groq usually responds in <2s
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as GroqResponse
  if (json.error) throw new Error(`Groq API error: ${json.error.message}`)

  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned empty content')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(`Groq returned non-JSON: ${content.slice(0, 200)}`)
  }

  return validateAndNormalize(parsed)
}

function validateAndNormalize(raw: unknown): HoroscopeContent {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid LLM JSON shape')
  }
  const r = raw as Record<string, unknown>
  const requiredText = [
    'workFortune',
    'relationshipFortune',
    'moneyFortune',
    'cautionFortune',
    'outfitAdvice',
  ] as const
  for (const k of requiredText) {
    if (typeof r[k] !== 'string' || !r[k]) {
      throw new Error(`Missing/invalid field: ${k}`)
    }
  }

  const luckyColors = Array.isArray(r.luckyColors)
    ? r.luckyColors.filter((c): c is string => typeof c === 'string').slice(0, 3)
    : []

  const styleRaw = Array.isArray(r.styleKeywords)
    ? r.styleKeywords.filter((s): s is string => typeof s === 'string')
    : []
  const styleKeywords = styleRaw
    .filter((s) => (STYLE_KEYWORDS_VOCAB as readonly string[]).includes(s))
    .slice(0, 2)

  return {
    workFortune: String(r.workFortune),
    relationshipFortune: String(r.relationshipFortune),
    moneyFortune: String(r.moneyFortune),
    cautionFortune: String(r.cautionFortune),
    outfitAdvice: String(r.outfitAdvice),
    luckyColors,
    styleKeywords,
  }
}
