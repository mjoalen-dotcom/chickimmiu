import { createHash } from 'node:crypto'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import sharp from 'sharp'

import {
  generateBlogDraft,
  markdownToBasicLexical,
  validateBlogDraftTopic,
  type BlogAIDraftInput,
  type BlogAIDraftOutput,
} from '@/lib/blog/aiDraft'
import {
  articleImageWidth,
  buildImageCreditText,
  decorateLexicalWithStudioImages,
  getArticleStudioTemplate,
  validateArticleImageVariant,
  type ArticleImageRole,
  type ArticleStudioTemplateKey,
  type ImageLicenseKind,
  type StudioImageAssignment,
} from '@/lib/blog/articleStudio'
import {
  getCommonsImageCandidate,
  researchKpopTopic,
} from '@/lib/blog/wikimediaResearch'

/**
 * POST /api/admin/blog/ai-draft
 *
 * 兩段式：
 *   action: 'generate' → 呼叫 Groq 生草稿，回傳 BlogAIDraftOutput（不寫 DB）
 *   action: 'create'   → 把前次生成的 BlogAIDraftOutput 寫成 BlogPost row（status=draft）
 *
 * 需要 admin auth（從 Payload session 取 user）。Groq API key 從 env 讀；沒設回 503。
 *
 * generate 與 create 拆開讓使用者可以「重生成、看了滿意才落地」，避免每次點按鈕都生
 * 一份草稿垃圾在 BlogPosts。create 會回傳新建 BlogPost 的 id 給前端做 redirect。
 */

interface GenerateBody {
  action: 'generate'
  input: BlogAIDraftInput
}

interface CreateBody {
  action: 'create'
  input: BlogAIDraftInput
  draft: BlogAIDraftOutput
  /** 額外允許覆寫的欄位（例：人工編輯後的 title） */
  overrides?: Partial<BlogAIDraftOutput>
  images?: Array<{
    alt?: string
    mediaId: number | string
    personName?: string
    role: ArticleImageRole
  }>
  researchCheckedAt?: string
  researchSources?: Array<{
    label: string
    provider?: 'official' | 'wikipedia' | 'wikidata' | 'manual'
    url: string
  }>
  takedownEmail?: string
}

interface ResearchBody {
  action: 'research'
  query: string
}

interface ImportCommonsImageBody {
  action: 'import-commons-image'
  alt?: string
  pageTitle: string
  personName?: string
  role: ArticleImageRole
}

type Body =
  | GenerateBody
  | CreateBody
  | ResearchBody
  | ImportCommonsImageBody

const IMAGE_ROLES = new Set<ArticleImageRole>([
  'hero',
  'member',
  'story',
  'inline',
])
const SUPPORTED_REMOTE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return Response.json({ error: '權限不足，需 admin 角色' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: '無效的請求內容（JSON parse failed）' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || !('action' in body)) {
    return Response.json({ error: '缺少 action 欄位' }, { status: 400 })
  }

  if (body.action === 'research') {
    try {
      const research = await researchKpopTopic(body.query)
      return Response.json({ ok: true, research })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Response.json({ error: `研究資料取得失敗：${message}` }, { status: 502 })
    }
  }

  if (body.action === 'import-commons-image') {
    if (!IMAGE_ROLES.has(body.role)) {
      return Response.json({ error: '無效的圖片角色' }, { status: 400 })
    }
    try {
      const candidate = await getCommonsImageCandidate(body.pageTitle)
      if (!SUPPORTED_REMOTE_MIME.has(candidate.mimeType)) {
        return Response.json(
          { error: `不支援的 Wikimedia 圖片格式：${candidate.mimeType}` },
          { status: 415 },
        )
      }
      const targetWidth = articleImageWidth(body.role)
      if (candidate.width && candidate.width < targetWidth) {
        return Response.json(
          {
            error: `原圖只有 ${candidate.width}px，低於此位置要求的 ${targetWidth}px，請換一張較清楚的圖片。`,
          },
          { status: 422 },
        )
      }

      const remote = await fetch(candidate.downloadUrl, {
        headers: {
          Accept: 'image/jpeg,image/png,image/webp',
          'User-Agent':
            'KimLafayetteBlogStudio/1.0 (https://blog.kimlafayette.com)',
        },
        signal: AbortSignal.timeout(25_000),
      })
      if (!remote.ok) {
        throw new Error(`圖片下載回傳 HTTP ${remote.status}`)
      }
      const declaredLength = Number(remote.headers.get('content-length') || 0)
      if (declaredLength > MAX_REMOTE_IMAGE_BYTES) {
        throw new Error('圖片超過 8MB 上限')
      }
      const sourceBuffer = Buffer.from(await remote.arrayBuffer())
      if (
        sourceBuffer.length === 0 ||
        sourceBuffer.length > MAX_REMOTE_IMAGE_BYTES
      ) {
        throw new Error('圖片為空或超過 8MB 上限')
      }
      const processed = await sharp(sourceBuffer)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toBuffer({ resolveWithObject: true })
      if (processed.info.width !== targetWidth) {
        throw new Error(`圖片無法產生 ${targetWidth}px 版本`)
      }

      const hash = createHash('sha256')
        .update(candidate.sourceUrl)
        .digest('hex')
        .slice(0, 12)
      const rights = {
        creator: candidate.creator,
        licenseKind: candidate.licenseKind,
        licenseUrl: candidate.licenseUrl,
        promotionalUseAllowed: true,
        sourceLabel: candidate.sourceLabel,
        sourceUrl: candidate.sourceUrl,
        verifiedAt: new Date().toISOString(),
        verificationNote:
          '由自動文章工具向 Wikimedia Commons API 重新查核後匯入。',
      }
      const alt = String(body.alt || candidate.alt).trim().slice(0, 160)
      const media = await payload.create({
        collection: 'media',
        data: {
          alt,
          caption: buildImageCreditText(rights),
          folderName: 'Kim Blog KPOP 授權圖片',
          usageRights: rights,
        } as never,
        file: {
          data: processed.data,
          mimetype: 'image/webp',
          name: `kim-kpop-${hash}-${targetWidth}.webp`,
          size: processed.data.byteLength,
        },
      })

      return Response.json({
        ok: true,
        image: {
          alt,
          creator: candidate.creator,
          licenseKind: candidate.licenseKind,
          licenseUrl: candidate.licenseUrl,
          mediaId: media.id,
          personName: String(body.personName || '').trim(),
          promotionalUseAllowed: true,
          role: body.role,
          sourceLabel: candidate.sourceLabel,
          sourceUrl: candidate.sourceUrl,
          targetWidth,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Response.json({ error: `圖片匯入失敗：${message}` }, { status: 502 })
    }
  }

  // ── action: generate ──
  if (body.action === 'generate') {
    const input = body.input
    const topicValidation = input
      ? validateBlogDraftTopic(input)
      : { valid: false, minLength: 4 as const }
    if (!input || !topicValidation.valid) {
      return Response.json(
        {
          error: `請輸入至少 ${topicValidation.minLength} 個字的文章主題或團名`,
        },
        { status: 400 },
      )
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        {
          error: '伺服器未設定 GROQ_API_KEY；請聯絡工程師補上 env 後重試',
          hint: 'https://console.groq.com/keys 申請（免費），值寫進 prod .env 後 pm2 restart',
        },
        { status: 503 },
      )
    }

    try {
      const draft = await generateBlogDraft(input)
      return Response.json({ ok: true, draft })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Response.json(
        { error: `LLM 生成失敗：${message}` },
        { status: 502 },
      )
    }
  }

  // ── action: create ──
  if (body.action === 'create') {
    const draft = { ...body.draft, ...(body.overrides || {}) }
    if (!draft?.title || !draft?.contentMarkdown) {
      return Response.json({ error: '草稿缺少 title 或 contentMarkdown' }, { status: 400 })
    }

    try {
      const baseSlug = generateBaseSlug(draft.title)
      const slug = await reserveUniqueSlug(payload, baseSlug)
      const baseContent = markdownToBasicLexical(draft.contentMarkdown)
      const studioImages = await hydrateStudioImages(payload, body.images || [])
      const takedownEmail = normalizeTakedownEmail(body.takedownEmail)
      const lexicalContent = decorateLexicalWithStudioImages(
        baseContent as never,
        studioImages,
        { takedownEmail },
      )
      const templateKey = normalizeTemplateKey(body.input.templateKey)
      const template = getArticleStudioTemplate(templateKey)
      const sources = normalizeResearchSources(
        body.researchSources,
        body.input.sourceUrls,
      )
      const hero = studioImages.find((image) => image.role === 'hero')
      const created = await payload.create({
        collection: 'blog-posts',
        data: {
          title: draft.title,
          slug,
          excerpt: draft.excerpt,
          content: lexicalContent as never,
          author: user.id,
          category:
            templateKey === 'fashion'
              ? body.input.category || 'styling'
              : template.category,
          tags: draft.suggestedTags.map((t) => ({ tag: t })),
          featuredImage: hero?.mediaId,
          gallery: studioImages.map((image) => image.mediaId),
          publishToKimLafayette: true,
          status: 'draft',
          articleStudio: {
            generatedByStudio: true,
            templateKey,
            researchCheckedAt: normalizeResearchCheckedAt(
              body.researchCheckedAt,
            ),
            researchSources: sources,
            takedownEmail,
            rightsNotice:
              '本文圖片用於團體介紹與宣傳資訊整理，圖片權利歸原權利人所有。如您為權利人並認為使用不妥，請來信告知，我們將儘速確認並下架。',
          },
          seo: {
            metaTitle: draft.seoMetaTitle,
            metaDescription: draft.seoMetaDescription,
          },
        } as never,
      })

      return Response.json({
        ok: true,
        id: created.id,
        editUrl: `/admin/collections/blog-posts/${created.id}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Response.json(
        { error: `建立草稿失敗：${message}` },
        { status: 500 },
      )
    }
  }

  return Response.json(
    {
      error:
        '不支援的 action（只接受 generate / create / research / import-commons-image）',
    },
    { status: 400 },
  )
}

function normalizeTemplateKey(
  value: BlogAIDraftInput['templateKey'],
): ArticleStudioTemplateKey {
  return value === 'kpop-boy-group' || value === 'kpop-girl-group'
    ? value
    : 'fashion'
}

function normalizeTakedownEmail(value: unknown): string {
  const candidate = String(
    value ||
      process.env.KIM_BLOG_TAKEDOWN_EMAIL ||
      'service@chickimmiu.com',
  )
    .trim()
    .toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)
    ? candidate
    : 'service@chickimmiu.com'
}

function normalizeResearchCheckedAt(value: unknown): string {
  const candidate = String(value || '').trim()
  const timestamp = Date.parse(candidate)
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date().toISOString()
}

function normalizeResearchSources(
  values: CreateBody['researchSources'],
  sourceUrls: string[] | undefined,
) {
  const rows = [
    ...(values || []),
    ...(sourceUrls || []).map((url) => ({
      label: '人工補充來源',
      provider: 'manual' as const,
      url,
    })),
  ]
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    try {
      const url = new URL(String(row.url || '').trim())
      if (
        (url.protocol !== 'https:' && url.protocol !== 'http:') ||
        seen.has(url.href)
      ) {
        return []
      }
      seen.add(url.href)
      return [
        {
          label: String(row.label || url.hostname).trim().slice(0, 120),
          provider: row.provider || 'manual',
          url: url.href,
        },
      ]
    } catch {
      return []
    }
  }).slice(0, 12)
}

async function hydrateStudioImages(
  payload: Awaited<ReturnType<typeof getPayload>>,
  values: NonNullable<CreateBody['images']>,
): Promise<StudioImageAssignment[]> {
  const output: StudioImageAssignment[] = []
  const seen = new Set<string>()
  for (const value of values.slice(0, 30)) {
    if (!IMAGE_ROLES.has(value.role)) continue
    const id = String(value.mediaId || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const media = (await payload.findByID({
      collection: 'media',
      id,
      depth: 0,
    })) as unknown as Record<string, unknown>
    if (!String(media.mimeType || '').startsWith('image/')) continue
    const imageVariant = validateArticleImageVariant(value.role, media)
    if (!imageVariant.valid) {
      const actual =
        imageVariant.actualWidth == null
          ? '未產生'
          : `${imageVariant.actualWidth}px`
      throw new Error(
        `媒體 #${id} 的 ${imageVariant.expectedWidth}px 版本為 ${actual}；請重新上傳寬度足夠的圖片。`,
      )
    }
    const rights =
      media.usageRights && typeof media.usageRights === 'object'
        ? (media.usageRights as Record<string, unknown>)
        : {}
    output.push({
      alt: String(value.alt || media.alt || media.filename || '').slice(0, 160),
      creator:
        typeof rights.creator === 'string' ? rights.creator : undefined,
      evidenceUrl:
        typeof rights.evidenceUrl === 'string'
          ? rights.evidenceUrl
          : undefined,
      licenseKind: normalizeLicenseKind(rights.licenseKind),
      licenseUrl:
        typeof rights.licenseUrl === 'string'
          ? rights.licenseUrl
          : undefined,
      mediaId: media.id as number | string,
      personName: String(value.personName || '').trim().slice(0, 120),
      promotionalUseAllowed: rights.promotionalUseAllowed === true,
      role: value.role,
      sourceLabel:
        typeof rights.sourceLabel === 'string'
          ? rights.sourceLabel
          : undefined,
      sourceUrl:
        typeof rights.sourceUrl === 'string' ? rights.sourceUrl : undefined,
      verifiedAt:
        typeof rights.verifiedAt === 'string'
          ? rights.verifiedAt
          : undefined,
    })
  }
  return output
}

function normalizeLicenseKind(value: unknown): ImageLicenseKind {
  const allowed = new Set<ImageLicenseKind>([
    'owned',
    'explicit-permission',
    'official-promo',
    'public-domain',
    'cc0',
    'cc-by',
    'cc-by-sa',
    'cc-by-nc',
    'unknown',
  ])
  const candidate = String(value || '') as ImageLicenseKind
  return allowed.has(candidate) ? candidate : 'unknown'
}

/**
 * 從中文標題產生 base slug：
 *   - 取前 50 char 的中文字 + 數字 + 英文 + 連字號
 *   - 不附加 timestamp 後綴，讓 slug 乾淨可讀
 *
 * 不嘗試做完美的中文 → 拼音，因為 BlogPosts.slug 是給 URL 用，admin 可後製改成英文/拼音。
 */
function generateBaseSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^一-鿿\w぀-ゟ゠-ヿ-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'ai-draft'
  )
}

/**
 * 確保 slug unique：先試 base，撞名就 -2 / -3 / ... 最多 10 次；都撞就 fallback 加 timestamp。
 * 用 Payload local API 預先查 collection，避免 create 時撞 unique constraint。
 */
async function reserveUniqueSlug(
  payload: Awaited<ReturnType<typeof getPayload>>,
  baseSlug: string,
): Promise<string> {
  const candidates = [baseSlug, ...Array.from({ length: 9 }, (_, i) => `${baseSlug}-${i + 2}`)]
  for (const candidate of candidates) {
    const { totalDocs } = await payload.find({
      collection: 'blog-posts',
      where: { slug: { equals: candidate } },
      limit: 0,
      depth: 0,
    })
    if (totalDocs === 0) return candidate
  }
  return `${baseSlug}-${Date.now().toString(36)}`
}
