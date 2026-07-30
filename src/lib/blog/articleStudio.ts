export type ArticleStudioTemplateKey =
  | 'fashion'
  | 'kpop-boy-group'
  | 'kpop-girl-group'

export type ArticleImageRole = 'hero' | 'member' | 'story' | 'inline'

export type ImageLicenseKind =
  | 'owned'
  | 'explicit-permission'
  | 'official-promo'
  | 'public-domain'
  | 'cc0'
  | 'cc-by'
  | 'cc-by-sa'
  | 'cc-by-nc'
  | 'unknown'

export interface ImageRightsMetadata {
  creator?: string
  evidenceUrl?: string
  licenseKind: ImageLicenseKind
  licenseUrl?: string
  promotionalUseAllowed?: boolean
  sourceLabel?: string
  sourceUrl?: string
  verifiedAt?: string
}

export interface StudioImageAssignment extends ImageRightsMetadata {
  alt?: string
  mediaId: number | string
  personName?: string
  role: ArticleImageRole
}

export interface ArticleStudioTemplate {
  category: 'styling' | 'kpop-boy-groups' | 'kpop-girl-groups'
  key: ArticleStudioTemplateKey
  label: string
  requiredSections: readonly string[]
  voiceGuide: string
}

const ARTICLE_STUDIO_TEMPLATES: Record<
  ArticleStudioTemplateKey,
  ArticleStudioTemplate
> = {
  fashion: {
    key: 'fashion',
    label: '金老佛爺時尚文章',
    category: 'styling',
    requiredSections: ['穿搭觀察', '實用建議', '結語'],
    voiceGuide: '優雅、溫柔、具體，保留金老佛爺與讀者聊天的節奏。',
  },
  'kpop-boy-group': {
    key: 'kpop-boy-group',
    label: 'KPOP 男團介紹',
    category: 'kpop-boy-groups',
    requiredSections: [
      '團體快速資料',
      '出道背景',
      '成員介紹',
      '成長歷程',
      '代表作品',
      '新粉入坑指南',
      '資料來源',
    ],
    voiceGuide:
      '用繁體中文與台灣用語，稱呼讀者為「寶貝們」，短句、親切、有人味；事實與個人感想必須清楚分開。',
  },
  'kpop-girl-group': {
    key: 'kpop-girl-group',
    label: 'KPOP 女團介紹',
    category: 'kpop-girl-groups',
    requiredSections: [
      '團體快速資料',
      '出道背景',
      '成員介紹',
      '成長歷程',
      '代表作品',
      '新粉入坑指南',
      '資料來源',
    ],
    voiceGuide:
      '用繁體中文與台灣用語，稱呼讀者為「寶貝們」，短句、親切、有人味；不捏造親身接觸或藝人背書。',
  },
}

const LICENSE_LABELS: Record<ImageLicenseKind, string> = {
  owned: '自有圖片',
  'explicit-permission': '權利人明確授權',
  'official-promo': '官方宣傳素材',
  'public-domain': '公有領域',
  cc0: 'CC0',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nc': 'CC BY-NC（須人工確認）',
  unknown: '授權待確認',
}

type LexicalNode = Record<string, unknown> & {
  children?: LexicalNode[]
  tag?: string
  text?: string
  type?: string
}

interface LexicalDocument {
  root: LexicalNode & { children: LexicalNode[] }
}

function safeHttpUrl(value: unknown) {
  const source = String(value ?? '').trim()
  if (!source) return null
  try {
    const url = new URL(source)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function cloneLexical(value: LexicalDocument): LexicalDocument {
  return JSON.parse(JSON.stringify(value)) as LexicalDocument
}

function nodeText(node: LexicalNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.children || []).map(nodeText).join('')
}

function textNode(text: string): LexicalNode {
  return {
    type: 'text',
    version: 1,
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
  }
}

function paragraphNode(text: string, format: string = ''): LexicalNode {
  return {
    type: 'paragraph',
    version: 1,
    direction: 'ltr',
    format,
    indent: 0,
    children: [textNode(text)],
  }
}

function headingNode(text: string, tag: 'h2' | 'h3' = 'h2'): LexicalNode {
  return {
    type: 'heading',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    tag,
    children: [textNode(text)],
  }
}

function uploadNode(image: StudioImageAssignment, index: number): LexicalNode {
  return {
    type: 'upload',
    version: 3,
    format: '',
    id: `article-studio-${String(image.mediaId)}-${index}`,
    fields: {
      displayWidth: articleImageWidth(image.role),
      displayAlignment: 'center',
    },
    relationTo: 'media',
    value: image.mediaId,
  }
}

function imageNodes(image: StudioImageAssignment, index: number): LexicalNode[] {
  const nodes = [uploadNode(image, index)]
  const credit = buildImageCreditText(image)
  if (credit) nodes.push(paragraphNode(credit, 'center'))
  return nodes
}

export function getArticleStudioTemplate(
  key: ArticleStudioTemplateKey,
): ArticleStudioTemplate {
  return ARTICLE_STUDIO_TEMPLATES[key]
}

export function listArticleStudioTemplates(): ArticleStudioTemplate[] {
  return Object.values(ARTICLE_STUDIO_TEMPLATES)
}

export function articleImageWidth(role: ArticleImageRole): 800 | 1000 {
  return role === 'hero' || role === 'story' ? 1000 : 800
}

export function validateArticleImageVariant(
  role: ArticleImageRole,
  media: unknown,
):
  | { valid: true; expectedWidth: 800 | 1000 }
  | {
      valid: false
      expectedWidth: 800 | 1000
      actualWidth: number | null
    } {
  const expectedWidth = articleImageWidth(role)
  const mediaRecord =
    media && typeof media === 'object'
      ? (media as Record<string, unknown>)
      : {}
  const sizes =
    mediaRecord.sizes && typeof mediaRecord.sizes === 'object'
      ? (mediaRecord.sizes as Record<string, unknown>)
      : {}
  const variantName = expectedWidth === 1000 ? 'blog1000' : 'blog800'
  const variant =
    sizes[variantName] && typeof sizes[variantName] === 'object'
      ? (sizes[variantName] as Record<string, unknown>)
      : {}
  const parsedWidth = Number(variant.width)
  const actualWidth = Number.isFinite(parsedWidth) ? parsedWidth : null
  return actualWidth === expectedWidth
    ? { valid: true, expectedWidth }
    : { valid: false, expectedWidth, actualWidth }
}

export function evaluateImageRights(metadata: ImageRightsMetadata): {
  allowed: boolean
  reason: string
  requiresReview: boolean
} {
  const sourceUrl = safeHttpUrl(metadata.sourceUrl)
  const evidenceUrl = safeHttpUrl(metadata.evidenceUrl)
  const licenseUrl = safeHttpUrl(metadata.licenseUrl)

  if (metadata.licenseKind === 'owned') {
    return {
      allowed: true,
      requiresReview: false,
      reason: '自有圖片，可用於文章。',
    }
  }

  if (metadata.licenseKind === 'explicit-permission') {
    return evidenceUrl
      ? {
          allowed: true,
          requiresReview: false,
          reason: '已記錄權利人明確授權。',
        }
      : {
          allowed: false,
          requiresReview: true,
          reason: '缺少書面授權或授權頁。',
        }
  }

  if (metadata.licenseKind === 'official-promo') {
    return sourceUrl && evidenceUrl && metadata.promotionalUseAllowed === true
      ? {
          allowed: true,
          requiresReview: false,
          reason: '官方條款明確允許宣傳使用。',
        }
      : {
          allowed: false,
          requiresReview: true,
          reason: '官方宣傳素材缺少可用範圍證明。',
        }
  }

  if (
    metadata.licenseKind === 'public-domain' ||
    metadata.licenseKind === 'cc0'
  ) {
    return sourceUrl
      ? {
          allowed: true,
          requiresReview: false,
          reason: '授權條件完整，可用於文章。',
        }
      : {
          allowed: false,
          requiresReview: true,
          reason: '缺少圖片來源。',
        }
  }

  if (
    metadata.licenseKind === 'cc-by' ||
    metadata.licenseKind === 'cc-by-sa'
  ) {
    return sourceUrl && licenseUrl
      ? {
          allowed: true,
          requiresReview: false,
          reason: '授權條件完整，可用於文章。',
        }
      : {
          allowed: false,
          requiresReview: true,
          reason: 'Creative Commons 圖片缺少來源或授權連結。',
        }
  }

  if (metadata.licenseKind === 'cc-by-nc') {
    return {
      allowed: false,
      requiresReview: true,
      reason: '品牌部落格可能具有間接商業利益，CC BY-NC 須另取得確認。',
    }
  }

  return {
    allowed: false,
    requiresReview: true,
    reason: '圖片授權待確認。',
  }
}

export function buildImageCreditText(metadata: ImageRightsMetadata): string {
  const parts: string[] = []
  if (metadata.sourceLabel || metadata.sourceUrl) {
    parts.push(`圖片來源：${metadata.sourceLabel || metadata.sourceUrl}`)
  }
  if (metadata.creator) parts.push(`攝影／權利人：${metadata.creator}`)
  parts.push(`授權：${LICENSE_LABELS[metadata.licenseKind]}`)
  return parts.join('｜')
}

export function validateStudioPublishability(
  images: StudioImageAssignment[],
  options: { forPublish: boolean },
): { valid: boolean; errors: string[] } {
  if (!options.forPublish) return { valid: true, errors: [] }

  const errors = images.flatMap((image, index) => {
    const decision = evaluateImageRights(image)
    return decision.allowed
      ? []
      : [`第 ${index + 1} 張圖片授權未完成：${decision.reason}`]
  })
  if (!images.some((image) => image.role === 'hero')) {
    errors.push('缺少團體封面圖片。')
  }
  return { valid: errors.length === 0, errors }
}

export function decorateLexicalWithStudioImages(
  lexical: LexicalDocument,
  images: StudioImageAssignment[],
  options: { takedownEmail?: string } = {},
): LexicalDocument {
  const output = cloneLexical(lexical)
  const children = output.root.children
  let imageIndex = 0

  const heroImages = images.filter((image) => image.role === 'hero')
  for (const image of [...heroImages].reverse()) {
    children.unshift(...imageNodes(image, imageIndex++))
  }

  for (const image of images.filter((candidate) => candidate.role === 'member')) {
    const person = String(image.personName || '').trim().toLocaleLowerCase('zh-TW')
    const headingIndex = person
      ? children.findIndex(
          (node) =>
            node.type === 'heading' &&
            nodeText(node).toLocaleLowerCase('zh-TW').includes(person),
        )
      : -1
    const nodes = imageNodes(image, imageIndex++)
    if (headingIndex >= 0) children.splice(headingIndex + 1, 0, ...nodes)
    else children.push(...nodes)
  }

  const storyImages = images.filter((image) => image.role === 'story')
  if (storyImages.length > 0) {
    const storyHeadingIndex = children.findIndex((node) => {
      if (node.type !== 'heading') return false
      const text = nodeText(node)
      return text.includes('成長歷程') || text.includes('出道背景')
    })
    const storyNodes = storyImages.flatMap((image) =>
      imageNodes(image, imageIndex++),
    )
    if (storyHeadingIndex >= 0) {
      children.splice(storyHeadingIndex + 1, 0, ...storyNodes)
    } else {
      children.push(...storyNodes)
    }
  }

  for (const image of images.filter((candidate) => candidate.role === 'inline')) {
    children.push(...imageNodes(image, imageIndex++))
  }

  const sourceUrls = [
    ...new Set(
      images
        .map((image) => safeHttpUrl(image.sourceUrl))
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  if (sourceUrls.length > 0) {
    children.push(headingNode('圖片來源與授權紀錄'))
    for (const sourceUrl of sourceUrls) {
      children.push(paragraphNode(sourceUrl))
    }
  }

  const email = String(options.takedownEmail || '').trim()
  const notice =
    '本文圖片用於團體介紹與宣傳資訊整理，圖片權利歸原權利人所有。' +
    (email
      ? `如您為權利人並認為使用不妥，請來信 ${email}，我們將儘速確認並下架。`
      : '如權利人認為使用不妥，請透過網站客服聯絡，我們將儘速確認並下架。')
  children.push({
    type: 'quote',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: [textNode(notice)],
  })

  return output
}
