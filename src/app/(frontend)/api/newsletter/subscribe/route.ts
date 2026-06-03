import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/newsletter/subscribe  { email, name?, source?, locale? }
 * ──────────────────────────────────────────────────────────────────
 * 前台「訂閱最新消息」表單。任何訪客皆可（不需登入）。
 *
 * 行為：以 email upsert
 *   - 不存在 → 建立（status=subscribed）
 *   - 已存在且 subscribed → 冪等成功（alreadySubscribed）
 *   - 已存在但 unsubscribed → 重新啟用（resubscribed）
 * 若為登入會員訂閱，回連 user 並帶入姓名。
 *
 * 安全：newsletter-subscribers collection create access 是 isAdmin，故走此 server
 * route 以 local API 寫入（overrideAccess 預設 true），避免開放公開 create。
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_SOURCES = new Set(['homepage', 'footer', 'checkout', 'popup', 'import', 'other'])

function clientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') || undefined
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })

    const body = (await req.json().catch(() => ({}))) as {
      email?: string
      name?: string
      source?: string
      locale?: string
    }

    const email = String(body.email || '').trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: '請輸入正確的 Email' },
        { status: 400 },
      )
    }

    const source = VALID_SOURCES.has(String(body.source)) ? String(body.source) : 'homepage'
    const name = body.name ? String(body.name).trim().slice(0, 120) : undefined
    const locale = body.locale ? String(body.locale).trim().slice(0, 12) : undefined
    const ipAddress = clientIp(req)
    const now = new Date().toISOString()

    // 若為登入會員，回連 user（best-effort，未登入則跳過）
    let userId: string | number | undefined
    try {
      const { user } = await payload.auth({ headers: req.headers })
      if (user) userId = user.id
    } catch {
      /* 未登入 — 匿名訂閱 */
    }

    const existingRes = await payload.find({
      collection: 'newsletter-subscribers',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
    })

    if (existingRes.totalDocs > 0) {
      const doc = existingRes.docs[0]!
      if (doc.status === 'unsubscribed') {
        await payload.update({
          collection: 'newsletter-subscribers',
          id: String(doc.id),
          data: {
            status: 'subscribed',
            unsubscribedAt: null,
            confirmedAt: now,
            ...(userId && !doc.user ? { user: userId } : {}),
            ...(name && !doc.name ? { name } : {}),
          } as never,
        })
        return NextResponse.json({ success: true, resubscribed: true })
      }
      // 已訂閱 → 冪等成功
      return NextResponse.json({ success: true, alreadySubscribed: true })
    }

    await payload.create({
      collection: 'newsletter-subscribers',
      data: {
        email,
        status: 'subscribed',
        source,
        name,
        locale,
        ipAddress,
        confirmedAt: now,
        ...(userId ? { user: userId } : {}),
      } as never,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[newsletter/subscribe POST] error:', error)
    return NextResponse.json(
      { success: false, error: '訂閱失敗，請稍後再試' },
      { status: 500 },
    )
  }
}
