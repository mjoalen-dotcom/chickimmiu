type UnknownRecord = Record<string, unknown>

interface LexicalNode extends UnknownRecord {
  type?: string
  text?: string
  format?: number | string
  tag?: string
  listType?: string
  url?: string
  children?: LexicalNode[]
  value?: unknown
  fields?: UnknownRecord
}

export interface KimBlogFeedImage {
  sourceUrl: string
  alt: string
  src: string
  mobileSrc: null
  srcSet: string
  width: number | null
  height: number | null
  bytes: number
}

const CATEGORY_LABELS: Record<string, string> = {
  styling: '穿搭教學',
  'new-arrivals': '新品介紹',
  'brand-story': '品牌故事',
  promotions: '優惠活動',
  trends: '時尚趨勢',
  fashion: '時尚流行',
  beauty: '美容彩妝',
  shopping: '購物情報',
  food: '美食料理',
  lifestyle: '生活綜合',
  parenting: '親子育兒',
  travel: '旅遊紀錄',
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safeLink(value: unknown): string | null {
  const url = String(value ?? '').trim()
  if (
    url.startsWith('/') ||
    url.startsWith('#') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  ) {
    return url
  }
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

function absoluteMediaUrl(value: unknown, baseUrl: string): string | null {
  const url = String(value ?? '').trim()
  if (!url) return null
  try {
    const parsed = new URL(url, `${baseUrl}/`)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

function numericDimension(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function childrenOf(node: LexicalNode, baseUrl: string): string {
  return (node.children ?? []).map((child) => renderNode(child, baseUrl)).join('')
}

function alignmentAttribute(node: LexicalNode): string {
  const alignment = String(node.format ?? '')
  return /^(left|center|right|justify)$/.test(alignment)
    ? ` style="text-align:${alignment}"`
    : ''
}

function renderText(node: LexicalNode): string {
  let html = escapeHtml(node.text ?? '')
  const format = typeof node.format === 'number' ? node.format : 0
  if (format & 16) html = `<code>${html}</code>`
  if (format & 1) html = `<strong>${html}</strong>`
  if (format & 2) html = `<em>${html}</em>`
  if (format & 8) html = `<u>${html}</u>`
  if (format & 4) html = `<s>${html}</s>`
  if (format & 32) html = `<sub>${html}</sub>`
  if (format & 64) html = `<sup>${html}</sup>`
  return html
}

function renderUpload(node: LexicalNode, baseUrl: string): string {
  const media =
    node.value && typeof node.value === 'object' ? (node.value as UnknownRecord) : null
  if (!media) return ''
  const src = absoluteMediaUrl(media.url, baseUrl)
  if (!src) return ''
  const alt = escapeHtml(media.alt || media.filename || '')
  if (String(media.mimeType ?? '').startsWith('video/')) {
    return `<video src="${escapeHtml(src)}" controls playsinline preload="metadata"></video>`
  }
  const width = numericDimension(media.width)
  const height = numericDimension(media.height)
  const dimensions =
    width && height ? ` width="${width}" height="${height}"` : ''
  return `<img src="${escapeHtml(src)}" alt="${alt}"${dimensions} loading="lazy" decoding="async">`
}

function renderProductButton(node: LexicalNode): string {
  const fields = node.fields
  if (!fields || fields.blockType !== 'productButton') return ''
  const product =
    fields.product && typeof fields.product === 'object'
      ? (fields.product as UnknownRecord)
      : null
  const slug = product ? String(product.slug ?? '').trim() : ''
  if (!slug) return ''
  const label = escapeHtml(String(fields.label || '立即購買').trim() || '立即購買')
  const href = `https://www.chickimmiu.com/products/${encodeURIComponent(slug)}?ref=kim-blog`
  return `<p class="kim-blog-product-link"><a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a></p>`
}

function renderNode(node: LexicalNode, baseUrl: string): string {
  if (node.type === 'text') return renderText(node)
  const children = childrenOf(node, baseUrl)

  switch (node.type) {
    case 'root':
      return children
    case 'paragraph':
      return `<p${alignmentAttribute(node)}>${children || '&nbsp;'}</p>`
    case 'heading': {
      const tag = /^h[1-6]$/.test(String(node.tag)) ? String(node.tag) : 'h3'
      return `<${tag}${alignmentAttribute(node)}>${children}</${tag}>`
    }
    case 'list':
      return node.listType === 'number'
        ? `<ol>${children}</ol>`
        : `<ul>${children}</ul>`
    case 'listitem':
      return `<li>${children}</li>`
    case 'link':
    case 'autolink': {
      const href = safeLink(node.url ?? node.fields?.url)
      if (!href) return children
      const external = /^https?:\/\//.test(href)
      return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${children}</a>`
    }
    case 'linebreak':
      return '<br>'
    case 'quote':
      return `<blockquote>${children}</blockquote>`
    case 'horizontalrule':
      return '<hr>'
    case 'upload':
      return renderUpload(node, baseUrl)
    case 'block':
      return renderProductButton(node)
    case 'table':
      return `<div class="kim-blog-table-wrap"><table>${children}</table></div>`
    case 'tablerow':
      return `<tr>${children}</tr>`
    case 'tablecell': {
      const tag = node.headerState ? 'th' : 'td'
      return `<${tag}>${children}</${tag}>`
    }
    default:
      return children
  }
}

function lexicalRoot(content: unknown): LexicalNode | null {
  if (!content || typeof content !== 'object') return null
  const root = (content as { root?: unknown }).root
  return root && typeof root === 'object' ? (root as LexicalNode) : null
}

export function serializeLexicalForKimBlog(content: unknown, baseUrl: string): string {
  const root = lexicalRoot(content)
  return root ? renderNode(root, baseUrl) : ''
}

export function collectKimBlogImages(
  content: unknown,
  baseUrl: string,
): KimBlogFeedImage[] {
  const root = lexicalRoot(content)
  if (!root) return []
  const images: KimBlogFeedImage[] = []
  const seen = new Set<string>()

  const visit = (node: LexicalNode) => {
    if (node.type === 'upload' && node.value && typeof node.value === 'object') {
      const media = node.value as UnknownRecord
      const src = absoluteMediaUrl(media.url, baseUrl)
      if (
        src &&
        !seen.has(src) &&
        !String(media.mimeType ?? '').startsWith('video/')
      ) {
        seen.add(src)
        images.push({
          sourceUrl: src,
          alt: String(media.alt || media.filename || ''),
          src,
          mobileSrc: null,
          srcSet: src,
          width: numericDimension(media.width),
          height: numericDimension(media.height),
          bytes: numericDimension(media.filesize) ?? 0,
        })
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(root)
  return images
}

export function collectKimBlogGallery(
  value: unknown,
  baseUrl: string,
): KimBlogFeedImage[] {
  if (!Array.isArray(value)) return []
  const images: KimBlogFeedImage[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const media = item as UnknownRecord
    const src = absoluteMediaUrl(media.url, baseUrl)
    if (
      !src ||
      seen.has(src) ||
      String(media.mimeType ?? '').startsWith('video/')
    ) {
      continue
    }
    seen.add(src)
    images.push({
      sourceUrl: src,
      alt: String(media.alt || media.filename || ''),
      src,
      mobileSrc: null,
      srcSet: src,
      width: numericDimension(media.width),
      height: numericDimension(media.height),
      bytes: numericDimension(media.filesize) ?? 0,
    })
  }
  return images
}

export function kimBlogCategoryLabel(value: unknown): string {
  const category = String(value ?? '')
  return CATEGORY_LABELS[category] || category || '生活風格'
}

export function kimBlogTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) =>
      item && typeof item === 'object'
        ? String((item as UnknownRecord).tag ?? '').trim()
        : '',
    )
    .filter(Boolean)
}

export function kimBlogMediaUrl(value: unknown, baseUrl: string): string | null {
  if (!value || typeof value !== 'object') return null
  return absoluteMediaUrl((value as UnknownRecord).url, baseUrl)
}

export function kimBlogSourceUrl(
  value: unknown,
  slug: string,
): string {
  return (
    safeLink(value) ||
    `https://blog.kimlafayette.com/blog/${encodeURIComponent(slug)}/`
  )
}
