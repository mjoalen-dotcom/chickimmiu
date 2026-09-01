import { NextRequest } from 'next/server'

import { requireCustomer, ok, fail, CODES } from '@/lib/app-activities/common'

/**
 * POST /api/app/group-buy/upload   (multipart: file)
 * ─────────────────────────────────────────────────
 * 團購好物分享的照片上傳（工單 2026-08-25 活動二「照片存放：改存 Payload media」）。
 *
 * media 本身允許影片與 PDF，這裡刻意**收窄**成 image/jpeg、image/png、image/webp
 * （工單指定）。回 media id 與可顯示的 URL；建立分享時再驗證這些 id 屬於本站 media。
 */
export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOW_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(req: NextRequest) {
  try {
    const { payload, user } = await requireCustomer(req.headers)
    if (!user) return fail(401, CODES.UNAUTHORIZED, '請先登入')

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return fail(400, CODES.BAD_REQUEST, '請以 multipart/form-data 上傳')
    }

    const file = form.get('file')
    if (!(file instanceof File)) return fail(400, CODES.BAD_REQUEST, '缺少檔案')
    if (file.size > MAX_BYTES) {
      return fail(413, CODES.BAD_REQUEST, '檔案超過 8MB 上限')
    }
    if (!ALLOW_MIME.has(file.type)) {
      return fail(415, CODES.BAD_REQUEST, '僅支援 JPG / PNG / WebP')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const created = (await payload.create({
      collection: 'media',
      data: { alt: `團購好物分享照片 - 會員 ${user.id}` } as never,
      file: {
        name: file.name || 'share.jpg',
        data: buffer,
        mimetype: file.type,
        size: file.size,
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return ok({ mediaId: created.id, url: (created.url as string) ?? null })
  } catch (err) {
    console.error('[app/group-buy/upload] error', err)
    return fail(500, CODES.INTERNAL_ERROR, '伺服器錯誤')
  }
}
