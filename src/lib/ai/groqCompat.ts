/**
 * Groq 模型線相容層（2026-08-22）
 * ─────────────────────────────
 * Groq 於 2026-08 全面退役 llama 系聊天模型（llama-3.1-8b-instant /
 * llama-3.3-70b-versatile 皆 404 model_not_found），現行陣容為 reasoning
 * 模型（qwen3.6 / openai gpt-oss 系）。兩個坑：
 *   1. 舊模型名寫死在四個呼叫點 → 統一改從這裡拿預設。
 *   2. reasoning 模型會把 max_tokens 燒在思考鏈上，且各家 reasoning_effort
 *      合法值不同（qwen 只吃 none/default；gpt-oss 吃 low/medium/high）——
 *      不帶對參數會 json_validate_failed（空 failed_generation）。
 *
 * 預設 qwen/qwen3.6-27b：2026-08-22 以真實運勢 prompt 實測，繁中品質與
 * 字數規格遵循度優於 gpt-oss-20b。各站可用既有 env（GROQ_MODEL /
 * GROQ_BLOG_MODEL / GROQ_BLOG_SEO_MODEL / GROQ_OPS_MODEL）覆寫；
 * GROQ_REASONING_EFFORT 可全域強制 effort 值（設 off = 不帶參數）。
 */

export const GROQ_DEFAULT_MODEL = 'qwen/qwen3.6-27b'

export function groqReasoningEffort(model: string): string | undefined {
  const env = process.env.GROQ_REASONING_EFFORT?.trim()
  if (env) return env === 'off' ? undefined : env
  if (model.startsWith('qwen/')) return 'none'
  if (model.startsWith('openai/gpt-oss')) return 'low'
  return undefined
}

/** spread 進 chat/completions body：`...groqReasoningParams(model)` */
export function groqReasoningParams(model: string): Record<string, unknown> {
  const effort = groqReasoningEffort(model)
  return effort ? { reasoning_effort: effort } : {}
}
