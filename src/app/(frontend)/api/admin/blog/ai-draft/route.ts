import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  generateBlogDraft,
  markdownToBasicLexical,
  type BlogAIDraftInput,
  type BlogAIDraftOutput,
} from '@/lib/blog/aiDraft'

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
}

type Body = GenerateBody | CreateBody

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

  // ── action: generate ──
  if (body.action === 'generate') {
    const input = body.input
    if (!input?.topic || typeof input.topic !== 'string' || input.topic.trim().length < 4) {
      return Response.json({ error: '請輸入至少 4 個字的文章主題' }, { status: 400 })
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

    const baseSlug = generateBaseSlug(draft.title)
    const slug = await reserveUniqueSlug(payload, baseSlug)
    const lexicalContent = markdownToBasicLexical(draft.contentMarkdown)

    try {
      const created = await payload.create({
        collection: 'blog-posts',
        data: {
          title: draft.title,
          slug,
          excerpt: draft.excerpt,
          content: lexicalContent as never,
          author: user.id,
          category: body.input.category || 'styling',
          tags: draft.suggestedTags.map((t) => ({ tag: t })),
          status: 'draft',
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
        { error: `建立草稿失敗（可能是 slug 衝突）：${message}` },
        { status: 500 },
      )
    }
  }

  return Response.json({ error: '不支援的 action（只接受 generate / create）' }, { status: 400 })
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
