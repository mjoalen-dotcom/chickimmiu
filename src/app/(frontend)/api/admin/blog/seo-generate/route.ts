import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'
import {
  generateBlogSeo,
  normalizeBlogSeoInput,
  type BlogSeoInput,
} from '@/lib/blog/seoGenerator'

export const runtime = 'nodejs'

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > 100_000) {
    return noStoreJson({ success: false, error: '文章資料過大' }, 413)
  }

  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user || (user as unknown as { role?: string }).role !== 'admin') {
    return noStoreJson({ success: false, error: '權限不足，需 admin 角色' }, 403)
  }

  let body: BlogSeoInput | null
  try {
    body = (await req.json()) as BlogSeoInput
  } catch {
    return noStoreJson({ success: false, error: '無效的請求內容' }, 400)
  }

  if (!body || typeof body !== 'object') {
    return noStoreJson({ success: false, error: '無效的請求內容' }, 400)
  }

  const input = normalizeBlogSeoInput(body)
  if (input.title.length < 2) {
    return noStoreJson({ success: false, error: '請先填寫文章標題' }, 400)
  }
  if (!input.excerpt && !input.contentText) {
    return noStoreJson({ success: false, error: '請先填寫文章摘要或內容' }, 400)
  }

  const seo = await generateBlogSeo(input)
  return noStoreJson({ success: true, seo })
}
