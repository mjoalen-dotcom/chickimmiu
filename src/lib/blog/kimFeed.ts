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

interface MediaSize extends UnknownRecord {
  filesize?: number
  height?: number
  url?: string
  width?: number
}

export interface KimBlogFeedImage {
  sourceUrl: string
  alt: string
  src: string
  mobileSrc: string | null
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
  'kpop-boy-groups': 'KPOP 男團介紹',
  'kpop-girl-groups': 'KPOP 女團介紹',
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
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    // Preserve Payload media URLs; that endpoint abstracts local and R2 storage.
    return parsed.href
  } catch {
    return null
  }
}

function mediaSize(
  media: UnknownRecord,
  name: 'blog800' | 'blog1000',
): MediaSize | null {
  const sizes =
    media.sizes && typeof media.sizes === 'object'
      ? (media.sizes as UnknownRecord)
      : null
  const value = sizes?.[name]
  return value && typeof value === 'object' ? (value as MediaSize) : null
}

function responsiveMedia(media: UnknownRecord, baseUrl: string) {
  const original = absoluteMediaUrl(media.url, baseUrl)
  const blog800 = mediaSize(media, 'blog800')
  const blog1000 = mediaSize(media, 'blog1000')
  const src800 = absoluteMediaUrl(blog800?.url, baseUrl)
  const src1000 = absoluteMediaUrl(blog1000?.url, baseUrl)
  const srcSet = [
    src800 ? `${src800} 800w` : '',
    src1000 ? `${src1000} 1000w` : '',
  ]
    .filter(Boolean)
    .join(', ')
  return {
    original,
    src800,
    src1000,
    srcSet,
    blog800,
    blog1000,
  }
}

function numericDimension(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function displayWidth(value: unknown, fallback?: number): number | null {
  const parsed = numericDimension(value) ?? fallback ?? null
  return parsed == null ? null : Math.min(1200, Math.max(24, parsed))
}

function displayAlignment(value: unknown): 'center' | 'left' | 'right' {
  const alignment = String(value ?? '')
  return alignment === 'left' || alignment === 'right' ? alignment : 'center'
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
  const responsive = responsiveMedia(media, baseUrl)
  const requestedWidth = displayWidth(node.fields?.displayWidth)
  const src =
    requestedWidth && requestedWidth <= 800
      ? responsive.src800 || responsive.src1000 || responsive.original
      : responsive.src1000 || responsive.src800 || responsive.original
  if (!src) return ''
  const alt = escapeHtml(media.alt || media.filename || '')
  if (String(media.mimeType ?? '').startsWith('video/')) {
    return `<video src="${escapeHtml(src)}" controls playsinline preload="metadata"></video>`
  }
  const selectedSize =
    src === responsive.src800
      ? responsive.blog800
      : src === responsive.src1000
        ? responsive.blog1000
        : media
  const width = numericDimension(selectedSize?.width)
  const height = numericDimension(selectedSize?.height)
  const dimensions =
    width && height ? ` width="${width}" height="${height}"` : ''
  const responsiveAttributes = responsive.srcSet
    ? ` srcset="${escapeHtml(responsive.srcSet)}" sizes="(max-width: 840px) 100vw, ${requestedWidth || 1000}px"`
    : ''
  const image = `<img src="${escapeHtml(src)}" alt="${alt}"${dimensions}${responsiveAttributes} loading="lazy" decoding="async">`
  const renderedWidth = requestedWidth
  const rights =
    media.usageRights && typeof media.usageRights === 'object'
      ? (media.usageRights as UnknownRecord)
      : null
  const credit = rights ? renderImageCredit(rights) : ''
  if (!renderedWidth && !credit) return image
  const alignment = displayAlignment(node.fields?.displayAlignment)
  const widthStyle = renderedWidth
    ? ` style="--kim-media-width:${renderedWidth}px"`
    : ''
  return `<figure class="kim-blog-media kim-blog-media--${alignment}"${widthStyle}>${image}${credit}</figure>`
}

function renderImageCredit(rights: UnknownRecord): string {
  const sourceLabel = String(rights.sourceLabel || '').trim()
  const sourceUrl = safeLink(rights.sourceUrl)
  const creator = String(rights.creator || '').trim()
  const licenseKind = String(rights.licenseKind || '').trim()
  const licenseUrl = safeLink(rights.licenseUrl)
  const licenseLabels: Record<string, string> = {
    owned: '自有圖片',
    'explicit-permission': '權利人明確授權',
    'official-promo': '官方宣傳素材',
    'public-domain': '公有領域',
    cc0: 'CC0',
    'cc-by': 'CC BY',
    'cc-by-sa': 'CC BY-SA',
    'cc-by-nc': 'CC BY-NC',
    unknown: '授權待確認',
  }
  const parts: string[] = []
  if (sourceLabel || sourceUrl) {
    const label = escapeHtml(sourceLabel || sourceUrl || '')
    parts.push(
      sourceUrl
        ? `圖片來源：<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : `圖片來源：${label}`,
    )
  }
  if (creator) parts.push(`攝影／權利人：${escapeHtml(creator)}`)
  if (licenseLabels[licenseKind]) {
    const licenseLabel = escapeHtml(licenseLabels[licenseKind])
    parts.push(
      licenseUrl
        ? `授權：<a href="${escapeHtml(licenseUrl)}" target="_blank" rel="noopener noreferrer">${licenseLabel}</a>`
        : `授權：${licenseLabel}`,
    )
  }
  return parts.length > 0
    ? `<figcaption class="kim-blog-image-credit">${parts.join('｜')}</figcaption>`
    : ''
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

function renderEmoticon(node: LexicalNode, baseUrl: string): string {
  const fields = node.fields
  if (!fields || fields.blockType !== 'emoticon') return ''
  const media =
    fields.image && typeof fields.image === 'object'
      ? (fields.image as UnknownRecord)
      : null
  if (!media) return ''
  const src = absoluteMediaUrl(media.url, baseUrl)
  if (!src || String(media.mimeType ?? '').startsWith('video/')) return ''
  const alt = escapeHtml(media.alt || media.filename || '表情圖案')
  const width = numericDimension(media.width)
  const height = numericDimension(media.height)
  const dimensions =
    width && height ? ` width="${width}" height="${height}"` : ''
  const renderedWidth = displayWidth(fields.displayWidth, 96)
  const alignment = displayAlignment(fields.displayAlignment)
  return `<figure class="kim-blog-emoticon kim-blog-emoticon--${alignment}" style="--kim-media-width:${renderedWidth}px"><img src="${escapeHtml(src)}" alt="${alt}"${dimensions} loading="lazy" decoding="async"></figure>`
}

function renderBlock(node: LexicalNode, baseUrl: string): string {
  if (node.fields?.blockType === 'productButton') {
    return renderProductButton(node)
  }
  if (node.fields?.blockType === 'emoticon') {
    return renderEmoticon(node, baseUrl)
  }
  return ''
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
      return renderBlock(node, baseUrl)
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

  const addImage = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const media = value as UnknownRecord
    const responsive = responsiveMedia(media, baseUrl)
    const src =
      responsive.src1000 || responsive.src800 || responsive.original
    if (
      !src ||
      seen.has(src) ||
      String(media.mimeType ?? '').startsWith('video/')
    ) {
      return
    }
    seen.add(src)
    const selectedSize =
      src === responsive.src1000
        ? responsive.blog1000
        : src === responsive.src800
          ? responsive.blog800
          : media
    images.push({
      sourceUrl: responsive.original || src,
      alt: String(media.alt || media.filename || ''),
      src,
      mobileSrc: responsive.src800,
      srcSet: responsive.srcSet || src,
      width: numericDimension(selectedSize?.width),
      height: numericDimension(selectedSize?.height),
      bytes: numericDimension(selectedSize?.filesize) ?? 0,
    })
  }

  const visit = (node: LexicalNode) => {
    if (node.type === 'upload') {
      addImage(node.value)
    } else if (
      node.type === 'block' &&
      node.fields?.blockType === 'emoticon'
    ) {
      addImage(node.fields.image)
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
    const responsive = responsiveMedia(media, baseUrl)
    const src =
      responsive.src1000 || responsive.src800 || responsive.original
    if (
      !src ||
      seen.has(src) ||
      String(media.mimeType ?? '').startsWith('video/')
    ) {
      continue
    }
    seen.add(src)
    const selectedSize =
      src === responsive.src1000
        ? responsive.blog1000
        : src === responsive.src800
          ? responsive.blog800
          : media
    images.push({
      sourceUrl: responsive.original || src,
      alt: String(media.alt || media.filename || ''),
      src,
      mobileSrc: responsive.src800,
      srcSet: responsive.srcSet || src,
      width: numericDimension(selectedSize?.width),
      height: numericDimension(selectedSize?.height),
      bytes: numericDimension(selectedSize?.filesize) ?? 0,
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
  const media = value as UnknownRecord
  const responsive = responsiveMedia(media, baseUrl)
  return responsive.src1000 || responsive.src800 || responsive.original
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
