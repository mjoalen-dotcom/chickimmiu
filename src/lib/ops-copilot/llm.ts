/**
 * Ops Copilot — LLM 分流層
 * ─────────────────────────────────────
 * 混合分流（2026-08-06 Alan 拍板）：
 *
 *   主腦（需要 tool use + 多步推理）→ Anthropic Claude
 *     · 營運日報敘述、資料查詢對話、行動建議
 *     · 原生 tool use 才能可靠地串我們 76 個 collection 的查詢鏈
 *
 *   量產（單次生成、低風險）→ Groq Llama（沿用既有 GROQ_API_KEY）
 *     · 部落格草稿、DM 文案、星座 —— 見 lib/blog/aiDraft.ts、lib/horoscope/groq.ts
 *     · 本檔的 generateBulkText() 是給 Ops Copilot 產文案用的統一入口
 *
 * env：
 *   ANTHROPIC_API_KEY      必填，缺了主腦功能回 503（日報退回程式版 fallback）
 *   OPS_COPILOT_MODEL      預設 claude-opus-5。想省錢改 claude-sonnet-5（約 1/2 價）
 *   OPS_COPILOT_EFFORT     預設 medium（low|medium|high|xhigh|max）
 *   GROQ_API_KEY           量產路徑用；缺了 generateBulkText() throw，呼叫端自行 fallback
 *
 * ⚠️ claude-opus-5 不接受 temperature / top_p / top_k，送了會 400。要控風格用 prompt。
 * ⚠️ opus-5 thinking 預設開啟，max_tokens 是「思考 + 回覆」的總上限，別設太小。
 */

import Anthropic from '@anthropic-ai/sdk'

import { GROQ_DEFAULT_MODEL as GROQ_COMPAT_DEFAULT, groqReasoningParams } from '../ai/groqCompat'

const DEFAULT_MODEL = 'claude-opus-5'
const DEFAULT_EFFORT = 'medium'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
// 2026-08-22：llama-3.3-70b-versatile 已被 Groq 退役，統一改用共用預設
const GROQ_DEFAULT_MODEL = GROQ_COMPAT_DEFAULT

let cachedClient: Anthropic | null = null

/** 取得 Anthropic client；沒有金鑰回 null（呼叫端負責 degrade，不 throw） */
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return cachedClient
}

export function getModel(): string {
  return process.env.OPS_COPILOT_MODEL || DEFAULT_MODEL
}

function getEffort(): 'low' | 'medium' | 'high' | 'xhigh' | 'max' {
  const raw = process.env.OPS_COPILOT_EFFORT || DEFAULT_EFFORT
  const allowed = ['low', 'medium', 'high', 'xhigh', 'max'] as const
  return (allowed as readonly string[]).includes(raw)
    ? (raw as 'low' | 'medium' | 'high' | 'xhigh' | 'max')
    : DEFAULT_EFFORT
}

/** 主腦：單次文字生成（無工具）。用於日報敘述。 */
export async function generateText(args: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  const client = getAnthropic()
  if (!client) throw new Error('ANTHROPIC_API_KEY not set')

  const res = await client.messages.create({
    model: getModel(),
    max_tokens: args.maxTokens ?? 8000,
    output_config: { effort: getEffort() },
    system: args.system,
    messages: [{ role: 'user', content: args.prompt }],
  })

  // opus-5 的安全分類器可能擋下請求，回 200 但 stop_reason='refusal'、content 可能是空陣列。
  // 先檢查 stop_reason 再讀 content，否則 content[0] 會炸。
  if (res.stop_reason === 'refusal') {
    throw new Error('LLM refused the request')
  }

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

// ── 工具迴圈 ────────────────────────────────────────────

export interface LlmToolDef {
  name: string
  description: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input_schema: any
  /** 執行器。**必須是唯讀的** —— chat 迴圈不允許有副作用的工具。 */
  run: (input: Record<string, unknown>) => Promise<unknown>
}

export interface ToolLoopResult {
  text: string
  /** 這輪實際被呼叫過的工具，回傳給前端做「AI 查了什麼」的透明度顯示 */
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>
}

/**
 * 手寫 agentic loop（非 SDK beta tool runner）。
 * 選手寫的理由：我們要在每一輪硬性攔截工具白名單，且不想讓 production 依賴 beta API。
 *
 * maxIterations 是跑掉的保險絲 —— 一次對話最多 8 輪工具呼叫，超過就把目前結果回傳。
 */
export async function runToolLoop(args: {
  system: string
  messages: Anthropic.MessageParam[]
  tools: LlmToolDef[]
  maxTokens?: number
  maxIterations?: number
}): Promise<ToolLoopResult> {
  const client = getAnthropic()
  if (!client) throw new Error('ANTHROPIC_API_KEY not set')

  const toolByName = new Map(args.tools.map((t) => [t.name, t]))
  const messages: Anthropic.MessageParam[] = [...args.messages]
  const toolCalls: ToolLoopResult['toolCalls'] = []
  const maxIterations = args.maxIterations ?? 8

  let lastText = ''

  for (let i = 0; i < maxIterations; i++) {
    const res = await client.messages.create({
      model: getModel(),
      max_tokens: args.maxTokens ?? 8000,
      output_config: { effort: getEffort() },
      system: args.system,
      tools: args.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      messages,
    })

    if (res.stop_reason === 'refusal') {
      return { text: '（這個問題被模型的安全機制擋下了，請換個問法。）', toolCalls }
    }

    lastText = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    if (res.stop_reason !== 'tool_use') {
      return { text: lastText, toolCalls }
    }

    const uses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    // 完整 content 要原樣塞回去（含 thinking / tool_use blocks），只取 text 會壞掉。
    messages.push({ role: 'assistant', content: res.content })

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of uses) {
      const tool = toolByName.get(use.name)
      if (!tool) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: `Unknown tool: ${use.name}`,
          is_error: true,
        })
        continue
      }
      const input = (use.input ?? {}) as Record<string, unknown>
      toolCalls.push({ name: use.name, input })
      try {
        const out = await tool.run(input)
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(out ?? null),
        })
      } catch (err) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: err instanceof Error ? err.message : 'tool failed',
          is_error: true,
        })
      }
    }

    // 平行工具呼叫的結果必須在**同一則** user message 內全部回去，
    // 拆成多則會讓模型之後不再平行呼叫。
    messages.push({ role: 'user', content: results })
  }

  return {
    text:
      lastText ||
      `（查詢步驟超過 ${maxIterations} 輪上限已中止，請把問題拆小一點再問。）`,
    toolCalls,
  }
}

// ── 量產路徑（Groq） ────────────────────────────────────

/**
 * 量產：單次文字生成，走 Groq Llama。
 * 用於 DM 文案、活動說明這類「量大、低風險、不需要推理鏈」的產出。
 * 沒設 GROQ_API_KEY 會 throw —— 呼叫端要自己準備模板 fallback。
 */
export async function generateBulkText(args: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_OPS_MODEL || GROQ_DEFAULT_MODEL,
      max_tokens: args.maxTokens ?? 1500,
      temperature: 0.7,
      ...groqReasoningParams(process.env.GROQ_OPS_MODEL || GROQ_DEFAULT_MODEL),
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.prompt },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    error?: { message: string }
    choices?: Array<{ message?: { content?: string } }>
  }
  if (json.error) throw new Error(`Groq API error: ${json.error.message}`)
  return (json.choices?.[0]?.message?.content || '').trim()
}
