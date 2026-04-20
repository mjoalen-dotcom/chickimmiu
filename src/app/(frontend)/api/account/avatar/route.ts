import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/account/avatar  (multipart: file)
 * DELETE /api/account/avatar
 *
 * 會員更換 / 清除大頭貼。自己的頭像，不過 Users.access.update 預設是 isAdmin |
 * isSelf；為了避免前端走 PATCH /api/users/{id}（要先送 PUT 驗 session + 另一趟
 * POST /api/media），這裡合併成一次 call + overrideAccess。
 *
 * 驗證：
 *   - 必須登入（Payload session cookie）
 *   - MIME 白名單（jpeg / png / webp / gif）— 和 Media.ts beforeChange 一致
 *   - 檔案大小 ≤ 8MB — 和 Media.ts MAX_IMAGE 一致
 */

const MAX_BYTES = 8 * 1024 * 1024
const ALLOW_MIME = /^image\/(jpeg|png|webp|gif)$/

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', message: '檔案超過 8MB 上限' },
      { status: 413 },
    )
  }
  if (!ALLOW_MIME.test(file.type)) {
    return NextResponse.json(
      { error: 'unsupported_type', message: '僅支援 JPG / PNG / WebP / GIF' },
      { status: 415 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const created = (await payload.create({
    collection: 'media',
    data: { alt: `會員頭像 - ${user.email ?? user.id}` },
    file: {
      name: file.name || 'avatar',
      data: buffer,
      mimetype: file.type,
      size: file.size,
    },
    overrideAccess: true,
  })) as { id: number }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { avatar: created.id },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, mediaId: created.id })
}

export async function DELETE(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { avatar: null },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
