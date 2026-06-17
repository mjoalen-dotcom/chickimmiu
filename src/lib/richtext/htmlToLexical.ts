/**
 * HTML / plain-text → Payload Lexical richText 轉換工具。
 *
 * 背景：Shopline 之類的匯入若把「原始 HTML 字串」直接塞進 richText 欄位
 * （如 products.description），SQLite/Drizzle 以 json-mode 讀取時會對該值
 * JSON.parse → 整列 throw → 一筆壞資料毒死整個 collection 查詢
 * （前台首頁輪播 + 商品列表全部消失）。
 *
 * 任何寫入 richText 欄位的匯入流程都應先用本工具把字串轉成合法 Lexical，
 * 或交給 Products collection 的 beforeValidate 守門自動處理。
 */

type LexicalTextNode = {
  type: 'text'
  text: string
  format: number
  detail: number
  mode: 'normal'
  style: string
  version: 1
}

type LexicalParagraphNode = {
  type: 'paragraph'
  children: LexicalTextNode[]
  direction: 'ltr' | null
  format: ''
  indent: 0
  version: 1
  textFormat?: 0
}

export type LexicalRoot = {
  root: {
    type: 'root'
    children: LexicalParagraphNode[]
    direction: 'ltr'
    format: ''
    indent: 0
    version: 1
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
}

/** 把 HTML 拆成一行行可讀文字（保留 <a> 連結為「文字 (網址)」，丟棄純圖片/裸 URL 殘渣）。 */
function htmlToLines(html: string): string[] {
  let s = String(html)
  // <a href="url">text</a> → "text (url)"，無內文則保留 url。
  s = s.replace(/<a\b[^>]*?href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
    const t = inner.replace(/<[^>]+>/g, '').trim()
    return t && !t.includes(href) ? `${t} (${href})` : href
  })
  // 區塊邊界轉換行。
  s = s
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(div|p|li|tr|h[1-6]|section|article)\s*>/gi, '\n')
    .replace(/<\s*(div|p|li|tr|h[1-6]|section|article)[^>]*>/gi, '\n')
  // 移除其餘所有標籤。
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0)
    // 丟掉純裸 URL 行（多為匯出殘留的圖片/連結，非實質描述文字）。
    .filter((l) => !/^https?:\/\/\S+$/i.test(l))
}

function paragraph(text: string): LexicalParagraphNode {
  return {
    type: 'paragraph',
    children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
  }
}

function emptyParagraph(): LexicalParagraphNode {
  return { type: 'paragraph', children: [], direction: null, format: '', indent: 0, version: 1 }
}

function buildRoot(lines: string[]): LexicalRoot {
  const children = lines.map(paragraph)
  if (children.length === 0) children.push(emptyParagraph())
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

/** HTML 字串 → 合法 Lexical richText 物件。 */
export function htmlToLexical(html: string): LexicalRoot {
  return buildRoot(htmlToLines(html))
}

/** 純文字（依換行分段）→ 合法 Lexical richText 物件。 */
export function textToLexical(text: string): LexicalRoot {
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return buildRoot(lines)
}

/**
 * 守門：把任意輸入正規化成「安全可存」的 richText 值。
 * - 已是 Lexical 物件（含 root）→ 原樣回傳。
 * - 字串 → 視為 HTML 或純文字轉成 Lexical（空字串回傳 null）。
 * - null/undefined → 原樣回傳（欄位可空）。
 * 永不回傳「以 < 開頭的裸字串」，杜絕 json-mode JSON.parse 崩潰。
 */
export function coerceToLexical(value: unknown): LexicalRoot | null | undefined {
  if (value == null) return value as null | undefined
  if (typeof value === 'object') {
    // 已經是 Lexical（或其他物件）→ 交給 Payload 既有驗證，不動。
    if ('root' in (value as Record<string, unknown>)) return value as LexicalRoot
    return value as never
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    return /<[a-z!/][\s\S]*>/i.test(trimmed) ? htmlToLexical(trimmed) : textToLexical(trimmed)
  }
  // 其他型別（數字等）→ 當純文字。
  return textToLexical(String(value))
}
