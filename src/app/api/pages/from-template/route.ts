import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getTemplateById, hydrateTemplateLayout } from '@/lib/pageTemplates'

/**
 * POST /api/pages/from-template
 * ─────────────────────────────
 * 從 5 個快速樣板之一建立新 Page。Admin only。
 *
 * Body: { templateId: 'fashion-magazine' | 'vogue' | 'luxury' | 'kol-personal' | 'cosmopolitan' }
 * Returns: { id, slug, message }
 *
 * 流程：
 *   1. Payload session 驗證 admin 權限
 *   2. 取樣板定義（layout / seo / 預設標題）
 *   3. 補位邏輯（hydrateTemplateLayout）：
 *      - countdown.endDate 預設為 +30d / +14d
 *      - image-gallery 若庫中無 Media，整段略過；有則用第一張補位
 *   4. 產生唯一 slug（{prefix}-{base36 timestamp}）
 *   5. payload.create({ collection: 'pages', overrideAccess: false }) — 走 isAdmin 驗證
 *   6. 回傳 id 與 slug，由前端 router.push 跳到 /admin/collections/pages/{id}
 */

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // 1. Auth — admin only
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    // 2. 取樣板
    const body = await req.json().catch(() => ({}))
    const templateId = body?.templateId as string | undefined
    if (!templateId) {
      return NextResponse.json({ error: 'Missing templateId' }, { status: 400 })
    }
    const template = getTemplateById(templateId)
    if (!template) {
      return NextResponse.json({ error: `Unknown templateId: ${templateId}` }, { status: 404 })
    }

    // 3. 取第一張 Media 作為 image-gallery 佔位（避免 required upload 驗證失敗）
    let placeholderImageId: string | number | null = null
    try {
      const mediaResult = await payload.find({
        collection: 'media',
        sort: 'createdAt',
        limit: 1,
        depth: 0,
      })
      const firstMedia = mediaResult.docs[0] as { id?: string | number } | undefined
      if (firstMedia?.id) placeholderImageId = firstMedia.id
    } catch {
      /* best-effort; image-gallery 區塊會被 hydrateTemplateLayout 略過 */
    }

    // 4. Hydrate layout（解析佔位字串、補圖片）
    const layout = hydrateTemplateLayout(template.layout, {
      now: new Date(),
      placeholderImageId,
    })

    // 5. 產生唯一 slug
    const ts = Date.now().toString(36)
    const slug = `${template.slugPrefix}-${ts}`

    // 6. 建立 Page（draft，admin 進去後手動發佈）
    const created = await payload.create({
      collection: 'pages',
      data: {
        title: template.defaultTitle,
        slug,
        status: 'draft',
        layout,
        seo: template.seo,
      } as never,
      user,
    })

    const createdId = (created as { id?: string | number }).id
    const createdSlug = (created as { slug?: string }).slug ?? slug

    return NextResponse.json({
      id: createdId,
      slug: createdSlug,
      templateId: template.id,
      templateName: template.name,
      hadPlaceholderImage: Boolean(placeholderImageId),
      message: placeholderImageId
        ? `已建立「${template.name}」樣板頁面`
        : `已建立「${template.name}」樣板頁面（媒體庫無圖片，圖片展示區塊已略過 — 上傳後請手動加回）`,
    })
  } catch (err) {
    console.error('[from-template] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    error: 'Method not allowed — use POST',
  }, { status: 405 })
}
