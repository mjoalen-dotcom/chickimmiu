import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * AI 客服知識庫（Phase 7 精簡版）
 * ────────────────────────────
 * 知識來源刻意「全部走 CMS」，不在程式碼裡寫死答案：
 *   1. faq-page-settings global（/faq 頁同一份資料 → 後台改完 AI 立刻跟著改）
 *   2. global-settings.businessInfo（地址／電話／營業時間）＋ customerService（LINE OA）
 *
 * 為什麼要做檢索（retrieve）而不是把整份 FAQ 丟給模型：
 *   - Groq 免費層有 TPM 上限，整份 FAQ（~40 題）每次帶入很快就被限流
 *   - 題目越多雜訊越多，模型越容易拿錯段落回答
 *   → 用中文 bigram 重疊度挑 top-K 段落，prompt 穩定在 ~1.5k token
 *
 * 快取：module-level 5 分鐘。後台改 FAQ 後最慢 5 分鐘生效（可呼叫
 * invalidateKnowledgeBase() 立即失效）。
 */

export interface KBEntry {
  category: string
  q: string
  a: string
}

export interface BusinessFacts {
  brandName: string
  legalName?: string
  phone?: string
  email?: string
  address?: string
  businessHours?: string
  lineOaId?: string
  lineOaUrl?: string
  siteUrl: string
}

export interface KnowledgeBase {
  entries: KBEntry[]
  facts: BusinessFacts
  loadedAt: number
}

const TTL_MS = 5 * 60 * 1000
let cache: KnowledgeBase | null = null

export function invalidateKnowledgeBase(): void {
  cache = null
}

/** Lexical richText → 純文字（AI prompt 只需要文字，格式無意義） */
function lexicalToText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (typeof n.text === 'string') out.push(n.text)
    const children = n.children
    if (Array.isArray(children)) children.forEach(walk)
    if (n.root) walk(n.root)
  }
  walk(value)
  return out.join('').replace(/\s+/g, ' ').trim()
}

export async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const facts: BusinessFacts = { brandName: 'CHIC KIM & MIU', siteUrl }
  const entries: KBEntry[] = []

  try {
    const payload = await getPayload({ config })
    const [faqRaw, globalRaw] = await Promise.all([
      payload.findGlobal({ slug: 'faq-page-settings', depth: 0 }),
      payload.findGlobal({ slug: 'global-settings', depth: 0 }),
    ])
    const faq = faqRaw as unknown as Record<string, unknown>
    const global = globalRaw as unknown as Record<string, unknown>

    const categories = (faq?.categories as Array<Record<string, unknown>>) || []
    for (const cat of categories) {
      const catTitle = String(cat?.title || '')
      const items = (cat?.items as Array<Record<string, unknown>>) || []
      for (const item of items) {
        const q = String(item?.question || '').trim()
        const a = (lexicalToText(item?.richAnswer) || String(item?.answer || '')).trim()
        if (q && a) entries.push({ category: catTitle, q, a })
      }
    }

    const biz = (global?.businessInfo || {}) as Record<string, unknown>
    const cs = (global?.customerService || {}) as Record<string, unknown>
    const site = (global?.site || {}) as Record<string, unknown>
    facts.brandName = String(site.siteName || 'CHIC KIM & MIU')
    facts.legalName = (biz.legalName as string) || undefined
    facts.phone = (biz.phone as string) || undefined
    facts.email = (biz.email as string) || undefined
    facts.address = (biz.address as string) || undefined
    facts.businessHours = (biz.businessHours as string) || undefined
    facts.lineOaId = (cs.lineOaId as string) || undefined
    facts.lineOaUrl = (cs.lineOaUrl as string) || undefined
  } catch {
    // DB 掛掉不能讓客服視窗整個死掉：回空知識庫，AI 層會走「轉真人」路徑
  }

  cache = { entries, facts, loadedAt: Date.now() }
  return cache
}

/* ── 中文檢索：bigram 重疊度 ───────────────────────────────── */

const PUNCT_RE = /[\s，。、？！：；「」『』（）()[\]{}<>~!@#$%^&*_+\-=|\/'"?.,:;]+/g

function normalize(s: string): string {
  return s.toLowerCase().replace(PUNCT_RE, '')
}

function bigrams(s: string): string[] {
  const n = normalize(s)
  if (n.length <= 1) return n ? [n] : []
  const out: string[] = []
  for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2))
  return out
}

export interface ScoredEntry extends KBEntry {
  score: number
}

/**
 * 依問題挑出最相關的 FAQ 段落。
 * 問題端命中權重 3、答案端 1 —— 問題相似代表同一個意圖，答案相似可能只是共用詞彙。
 */
export function retrieve(question: string, entries: KBEntry[], topN = 6): ScoredEntry[] {
  const qGrams = bigrams(question)
  if (!qGrams.length || !entries.length) return []
  const qSet = new Set(qGrams)

  const scored = entries.map((e) => {
    const inQ = new Set(bigrams(e.q))
    const inA = new Set(bigrams(e.a))
    let score = 0
    for (const g of qSet) {
      if (inQ.has(g)) score += 3
      else if (inA.has(g)) score += 1
    }
    // 以問題長度正規化，避免長答案靠篇幅取勝
    return { ...e, score: score / Math.sqrt(qSet.size) }
  })

  return scored
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

/** 把商家事實整理成 prompt 用的條列（只列有值的欄位） */
export function factsToLines(facts: BusinessFacts): string[] {
  const lines: string[] = [`品牌：${facts.brandName}`]
  if (facts.legalName) lines.push(`公司：${facts.legalName}`)
  if (facts.address) lines.push(`地址：${facts.address}`)
  if (facts.businessHours) lines.push(`營業時間：${facts.businessHours}`)
  if (facts.phone) lines.push(`客服電話：${facts.phone}`)
  if (facts.email) lines.push(`客服信箱：${facts.email}`)
  if (facts.lineOaId) lines.push(`LINE 官方帳號：${facts.lineOaId}`)
  lines.push(`官網：${facts.siteUrl}`)
  return lines
}
