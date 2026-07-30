import { createHash } from 'node:crypto'
import { parseDocument } from 'htmlparser2'

type MediaId = number | string

interface HtmlNode {
  type: string
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: HtmlNode[]
}

export interface LexicalImportNode {
  type: string
  children?: LexicalImportNode[]
  [key: string]: unknown
}

export interface PixnetLexicalImport {
  content: {
    root: LexicalImportNode
  }
  embeddedMediaIds: MediaId[]
  missingImageSources: string[]
  nodeCounts: Record<string, number>
}

const BLOCK_TAGS = new Set([
  'article',
  'aside',
  'body',
  'div',
  'figure',
  'footer',
  'header',
  'main',
  'nav',
  'section',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
])

const SKIP_TAGS = new Set([
  'iframe',
  'noscript',
  'script',
  'style',
  'svg',
  'template',
])

function textNode(text: string, format = 0): LexicalImportNode {
  return {
    type: 'text',
    version: 1,
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
  }
}

function lineBreakNode(): LexicalImportNode {
  return { type: 'linebreak', version: 1 }
}

function nodeId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

function elementName(node: HtmlNode): string {
  return String(node.name || '').toLowerCase()
}

function normalizedImageSource(value: string): string {
  const source = value.trim()
  if (!source) return ''
  try {
    const parsed = new URL(source, 'https://blog.kimlafayette.com')
    return parsed.pathname
  } catch {
    return source.split(/[?#]/, 1)[0] || ''
  }
}

function safeLink(value: string): string | null {
  const href = value.trim()
  if (
    href.startsWith('/') ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return href
  }
  try {
    const parsed = new URL(href)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : null
  } catch {
    return null
  }
}

function alignment(node: HtmlNode): string {
  const style = node.attribs?.style || ''
  const match = style.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)/i)
  return match?.[1]?.toLowerCase() || ''
}

function mergeTextNodes(nodes: LexicalImportNode[]): LexicalImportNode[] {
  const merged: LexicalImportNode[] = []
  for (const node of nodes) {
    const previous = merged.at(-1)
    if (
      node.type === 'text' &&
      previous?.type === 'text' &&
      previous.format === node.format &&
      previous.style === node.style
    ) {
      previous.text = `${String(previous.text || '')}${String(node.text || '')}`
    } else {
      merged.push(node)
    }
  }

  const first = merged[0]
  if (first?.type === 'text') first.text = String(first.text || '').replace(/^\s+/, '')
  const last = merged.at(-1)
  if (last?.type === 'text') last.text = String(last.text || '').replace(/\s+$/, '')
  return merged.filter(
    (node) => node.type !== 'text' || String(node.text || '').length > 0,
  )
}

function descendantImage(node: HtmlNode): HtmlNode | null {
  if (elementName(node) === 'img') return node
  for (const child of node.children || []) {
    const found = descendantImage(child)
    if (found) return found
  }
  return null
}

function uploadNode(
  node: HtmlNode,
  mediaBySource: Map<string, MediaId>,
  missing: Set<string>,
  embedded: MediaId[],
): LexicalImportNode | null {
  const source = normalizedImageSource(node.attribs?.src || '')
  if (!source) return null
  const mediaId = mediaBySource.get(source)
  if (mediaId == null) {
    missing.add(source)
    return null
  }
  if (!embedded.includes(mediaId)) embedded.push(mediaId)
  return {
    type: 'upload',
    version: 3,
    format: '',
    id: nodeId(`upload:${source}`),
    fields: {},
    relationTo: 'media',
    value: mediaId,
  }
}

function inlineNodes(
  nodes: HtmlNode[],
  mediaBySource: Map<string, MediaId>,
  missing: Set<string>,
  embedded: MediaId[],
  inheritedFormat = 0,
): LexicalImportNode[] {
  const result: LexicalImportNode[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      const text = String(node.data || '').replace(/\s+/g, ' ')
      if (text) result.push(textNode(text, inheritedFormat))
      continue
    }

    const name = elementName(node)
    if (!name || SKIP_TAGS.has(name)) continue
    if (name === 'br') {
      result.push(lineBreakNode())
      continue
    }
    if (name === 'picture' || name === 'img') {
      const image = name === 'img' ? node : descendantImage(node)
      const upload = image
        ? uploadNode(image, mediaBySource, missing, embedded)
        : null
      if (upload) result.push(upload)
      continue
    }

    let format = inheritedFormat
    if (name === 'strong' || name === 'b') format |= 1
    if (name === 'em' || name === 'i') format |= 2
    if (name === 's' || name === 'del' || name === 'strike') format |= 4
    if (name === 'u') format |= 8
    if (name === 'code') format |= 16
    if (name === 'sub') format |= 32
    if (name === 'sup') format |= 64

    const children = inlineNodes(
      node.children || [],
      mediaBySource,
      missing,
      embedded,
      format,
    )

    if (name === 'a') {
      const href = safeLink(node.attribs?.href || '')
      const hasUpload = children.some((child) => child.type === 'upload')
      if (href && !hasUpload && children.length > 0) {
        result.push({
          type: 'link',
          version: 3,
          id: nodeId(`link:${href}:${result.length}`),
          direction: 'ltr',
          format: '',
          indent: 0,
          fields: {
            doc: null,
            linkType: 'custom',
            newTab: node.attribs?.target === '_blank',
            url: href,
          },
          children,
        })
      } else {
        result.push(...children)
      }
      continue
    }

    result.push(...children)
  }

  return mergeTextNodes(result)
}

function paragraphNode(
  children: LexicalImportNode[],
  format = '',
): LexicalImportNode {
  return {
    type: 'paragraph',
    version: 1,
    direction: 'ltr',
    format,
    indent: 0,
    textFormat: 0,
    textStyle: '',
    children,
  }
}

function headingNode(
  tag: string,
  children: LexicalImportNode[],
  format = '',
): LexicalImportNode {
  return {
    type: 'heading',
    tag,
    version: 1,
    direction: 'ltr',
    format,
    indent: 0,
    children,
  }
}

function splitInlineBlock(
  inline: LexicalImportNode[],
  createBlock: (children: LexicalImportNode[]) => LexicalImportNode,
): LexicalImportNode[] {
  const blocks: LexicalImportNode[] = []
  let buffer: LexicalImportNode[] = []

  const flush = () => {
    buffer = mergeTextNodes(buffer)
    if (buffer.length > 0) blocks.push(createBlock(buffer))
    buffer = []
  }

  for (const node of inline) {
    if (node.type === 'upload') {
      flush()
      blocks.push(node)
    } else {
      buffer.push(node)
    }
  }
  flush()
  return blocks
}

function listNodes(
  node: HtmlNode,
  mediaBySource: Map<string, MediaId>,
  missing: Set<string>,
  embedded: MediaId[],
): LexicalImportNode[] {
  const listType = elementName(node) === 'ol' ? 'number' : 'bullet'
  const listItems: LexicalImportNode[] = []
  const trailingUploads: LexicalImportNode[] = []

  for (const item of node.children || []) {
    if (elementName(item) !== 'li') continue
    const inline = inlineNodes(
      item.children || [],
      mediaBySource,
      missing,
      embedded,
    )
    const text = inline.filter((child) => child.type !== 'upload')
    trailingUploads.push(...inline.filter((child) => child.type === 'upload'))
    listItems.push({
      type: 'listitem',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      value: listItems.length + 1,
      children: text.length > 0 ? text : [textNode('')],
    })
  }

  if (listItems.length === 0) return trailingUploads
  return [
    {
      type: 'list',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      listType,
      start: 1,
      tag: listType === 'number' ? 'ol' : 'ul',
      children: listItems,
    },
    ...trailingUploads,
  ]
}

function flowNodes(
  nodes: HtmlNode[],
  mediaBySource: Map<string, MediaId>,
  missing: Set<string>,
  embedded: MediaId[],
): LexicalImportNode[] {
  const result: LexicalImportNode[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      const value = String(node.data || '').replace(/\s+/g, ' ').trim()
      if (value) result.push(paragraphNode([textNode(value)]))
      continue
    }

    const name = elementName(node)
    if (!name || SKIP_TAGS.has(name)) continue
    if (name === 'picture' || name === 'img') {
      const image = name === 'img' ? node : descendantImage(node)
      const upload = image
        ? uploadNode(image, mediaBySource, missing, embedded)
        : null
      if (upload) result.push(upload)
      continue
    }
    if (name === 'hr') {
      result.push({ type: 'horizontalrule', version: 1 })
      continue
    }
    if (name === 'ul' || name === 'ol') {
      result.push(...listNodes(node, mediaBySource, missing, embedded))
      continue
    }
    if (name === 'p') {
      const inline = inlineNodes(
        node.children || [],
        mediaBySource,
        missing,
        embedded,
      )
      result.push(
        ...splitInlineBlock(inline, (children) =>
          paragraphNode(children, alignment(node)),
        ),
      )
      continue
    }
    if (/^h[1-6]$/.test(name)) {
      const inline = inlineNodes(
        node.children || [],
        mediaBySource,
        missing,
        embedded,
      )
      result.push(
        ...splitInlineBlock(inline, (children) =>
          headingNode(name, children, alignment(node)),
        ),
      )
      continue
    }
    if (name === 'blockquote') {
      const inline = inlineNodes(
        node.children || [],
        mediaBySource,
        missing,
        embedded,
      )
      const text = inline.filter((child) => child.type !== 'upload')
      if (text.length > 0) {
        result.push({
          type: 'quote',
          version: 1,
          direction: 'ltr',
          format: alignment(node),
          indent: 0,
          children: text,
        })
      }
      result.push(...inline.filter((child) => child.type === 'upload'))
      continue
    }

    if (BLOCK_TAGS.has(name) || name === 'table') {
      result.push(
        ...flowNodes(node.children || [], mediaBySource, missing, embedded),
      )
      continue
    }

    const inline = inlineNodes(
      [node],
      mediaBySource,
      missing,
      embedded,
    )
    result.push(
      ...splitInlineBlock(inline, (children) => paragraphNode(children)),
    )
  }

  return result
}

function countNodes(node: LexicalImportNode, counts: Record<string, number>) {
  counts[node.type] = (counts[node.type] || 0) + 1
  for (const child of node.children || []) countNodes(child, counts)
}

export function convertPixnetHtmlToLexical(
  html: string,
  mediaBySourceInput: Map<string, MediaId>,
): PixnetLexicalImport {
  const mediaBySource = new Map<string, MediaId>()
  for (const [source, id] of mediaBySourceInput) {
    mediaBySource.set(normalizedImageSource(source), id)
  }

  const document = parseDocument(html, {
    decodeEntities: true,
    lowerCaseAttributeNames: true,
    lowerCaseTags: true,
  }) as unknown as HtmlNode
  const missing = new Set<string>()
  const embeddedMediaIds: MediaId[] = []
  const children = flowNodes(
    document.children || [],
    mediaBySource,
    missing,
    embeddedMediaIds,
  )
  const root: LexicalImportNode = {
    type: 'root',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children:
      children.length > 0 ? children : [paragraphNode([textNode('')])],
  }
  const nodeCounts: Record<string, number> = {}
  countNodes(root, nodeCounts)

  return {
    content: { root },
    embeddedMediaIds,
    missingImageSources: [...missing],
    nodeCounts,
  }
}
