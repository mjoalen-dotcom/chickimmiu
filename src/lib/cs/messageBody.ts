/**
 * Messages.body 是 richText（Lexical）欄位。
 * Web chat 只送純文字，這裡集中做「純文字 ⇄ 最小 Lexical state」轉換，
 * 免得每個 channel adapter 各寫一份、格式不一致。
 */

export function textToRichText(text: string): Record<string, unknown> {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: null,
          children: [{ type: 'text', version: 1, text }],
        },
      ],
    },
  }
}

export function richTextToPlain(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as Record<string, unknown>
    if (typeof n.text === 'string') out.push(n.text)
    if (Array.isArray(n.children)) n.children.forEach(walk)
    if (n.root) walk(n.root)
  }
  walk(value)
  return out.join('').trim()
}
