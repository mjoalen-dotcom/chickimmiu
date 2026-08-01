import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

type QuickState = 'draft' | 'public' | 'unlisted' | 'password'

const QUICK_STATES = new Set<QuickState>(['draft', 'public', 'unlisted', 'password'])

export async function PATCH(request: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || (user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: '權限不足，請重新登入後台。' }, { status: 403 })
  }

  let body: { id?: number | string; password?: string; state?: QuickState }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: '請求格式錯誤。' }, { status: 400 })
  }

  if ((typeof body.id !== 'number' && typeof body.id !== 'string') || !body.id) {
    return NextResponse.json({ error: '缺少文章編號。' }, { status: 400 })
  }
  if (!body.state || !QUICK_STATES.has(body.state)) {
    return NextResponse.json({ error: '不支援的文章狀態。' }, { status: 400 })
  }

  if (
    body.password !== undefined &&
    (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 128)
  ) {
    return NextResponse.json({ error: '文章密碼需為 6 至 128 個字元。' }, { status: 400 })
  }

  let existing: Record<string, unknown>
  try {
    existing = (await payload.findByID({
      collection: 'blog-posts',
      id: body.id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '找不到這篇文章。' }, { status: 404 })
  }

  if (
    body.state === 'password' &&
    !body.password &&
    typeof existing.accessPasswordHash !== 'string'
  ) {
    return NextResponse.json({ error: '請先設定文章密碼。' }, { status: 400 })
  }

  const data: Record<string, unknown> =
    body.state === 'draft'
      ? { status: 'draft' }
      : {
          status: 'published',
          visibility: body.state,
          ...(body.password ? { accessPassword: body.password } : {}),
        }

  let updated: Record<string, unknown>
  try {
    updated = (await payload.update({
      collection: 'blog-posts',
      id: body.id,
      data,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '文章狀態更新失敗。' },
      { status: 400 },
    )
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    visibility: updated.visibility || 'public',
  })
}
