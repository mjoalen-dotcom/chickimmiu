/**
 * 商品 → MBTI 個性類型自動推薦
 * ────────────────────────────────
 * 取商品的 tags / collectionTags / category / name / description 文字，
 * 對 16 型 keyword map 做 substring 計分（大小寫不敏感），
 * 回 top 3 (score > 0)。全 0 時回空陣列（admin 自己選）。
 */

import { MBTI_KEYWORD_MAP } from './mbtiPersonalityMapping'
import { MBTI_TYPE_LIST, type MBTIType } from './mbtiResults'

export interface ProductLikeForRecommend {
  name?: string | null
  description?: unknown // Payload richText 結構或字串
  tags?: Array<{ tag?: string | null }> | null
  collectionTags?: string[] | null
  category?: { title?: string | null } | string | number | null
}

/** 將 Payload richText 結構/字串/任意值平展成字串（取前 200 字防 noise） */
function flattenText(value: unknown, depth = 0): string {
  if (value == null || depth > 5) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map((v) => flattenText(v, depth + 1)).join(' ')
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    // Payload Lexical/Slate richText: text / children / root.children
    const parts: string[] = []
    if (typeof obj.text === 'string') parts.push(obj.text)
    if (obj.children) parts.push(flattenText(obj.children, depth + 1))
    if (obj.root) parts.push(flattenText(obj.root, depth + 1))
    return parts.join(' ')
  }
  return ''
}

export function suggestPersonalityTypes(product: ProductLikeForRecommend): MBTIType[] {
  // 1. 收集所有可比對的 token
  const tokens: string[] = []
  if (product.name) tokens.push(product.name.toLowerCase())
  if (product.tags) {
    for (const t of product.tags) {
      if (t?.tag) tokens.push(t.tag.toLowerCase())
    }
  }
  if (product.collectionTags) {
    for (const ct of product.collectionTags) tokens.push(ct.toLowerCase())
  }
  if (product.category && typeof product.category === 'object' && 'title' in product.category) {
    const title = (product.category as { title?: string | null }).title
    if (title) tokens.push(title.toLowerCase())
  }
  const desc = flattenText(product.description).slice(0, 200).toLowerCase()
  if (desc) tokens.push(desc)

  if (tokens.length === 0) return []

  // 2. 對 16 型計分
  const scores: Array<{ type: MBTIType; score: number }> = MBTI_TYPE_LIST.map((type) => {
    const keywords = MBTI_KEYWORD_MAP[type].map((k) => k.toLowerCase())
    let score = 0
    for (const token of tokens) {
      for (const kw of keywords) {
        if (token.includes(kw) || kw.includes(token)) {
          score++
          break // 同個 token 對同型只算一次（避免長 description 灌水）
        }
      }
    }
    return { type, score }
  })

  // 3. 取 top 3 (score > 0)
  return scores
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.type)
}
