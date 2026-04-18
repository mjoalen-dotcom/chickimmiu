import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_CATEGORIES = [
  'order_inquiry',
  'shipping_status',
  'return_exchange',
  'size_advice',
  'product_recommendation',
  'points_inquiry',
  'complaint',
  'other',
] as const

type ContactCategory = (typeof ALLOWED_CATEGORIES)[number]

function isAllowedCategory(v: string): v is ContactCategory {
  return (ALLOWED_CATEGORIES as readonly string[]).includes(v)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const rateWindow = new Map<string, number[]>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 10

function hit(ip: string): boolean {
  const now = Date.now()
  const hits = (rateWindow.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) {
    rateWindow.set(ip, hits)
    return false
  }
  hits.push(now)
  rateWindow.set(ip, hits)
  if (rateWindow.size > 5000) {
    for (const [k, arr] of rateWindow) {
      if (!arr.some((t) => now - t < WINDOW_MS)) rateWindow.delete(k)
    }
  }
  return true
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri.trim()
  return 'unknown'
}

function rand(n = 6): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return s
}

function ticketNumber(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `WEB-${y}${m}${day}-${rand(6)}`
}

type Body = {
  name?: unknown
  email?: unknown
  phone?: unknown
  category?: unknown
  subject?: unknown
  message?: unknown
  subscribe?: unknown
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (!hit(ip)) {
    return NextResponse.json(
      { success: false, error: '提交次數過多，請稍後再試' },
      { status: 429 },
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const category = typeof body.category === 'string' ? body.category : 'other'
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const subscribe = body.subscribe === true

  if (!name || name.length > 100) {
    return NextResponse.json({ success: false, error: '姓名必填（1-100 字）' }, { status: 400 })
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ success: false, error: 'Email 格式不正確' }, { status: 400 })
  }
  if (phone && (phone.length < 6 || phone.length > 30)) {
    return NextResponse.json({ success: false, error: '電話格式不正確' }, { status: 400 })
  }
  if (!subject || subject.length > 200) {
    return NextResponse.json({ success: false, error: '主題必填（1-200 字）' }, { status: 400 })
  }
  if (!message || message.length > 5000) {
    return NextResponse.json({ success: false, error: '訊息必填（1-5000 字）' }, { status: 400 })
  }
  if (!isAllowedCategory(category)) {
    return NextResponse.json({ success: false, error: '分類不正確' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    const ticket = await payload.create({
      collection: 'customer-service-tickets',
      data: {
        ticketNumber: ticketNumber(),
        channel: 'web_form',
        status: 'open',
        priority: category === 'complaint' ? 'high' : 'normal',
        category,
        subject,
        messages: [
          {
            sender: 'customer',
            content: message,
            timestamp: new Date().toISOString(),
            metadata: {
              guestName: name,
              guestEmail: email,
              guestPhone: phone || null,
              subscribe,
              source: 'web_form',
              ip,
              userAgent: req.headers.get('user-agent') || null,
            },
          },
        ],
      },
      overrideAccess: true,
    })

    return NextResponse.json({
      success: true,
      ticketNumber: (ticket as { ticketNumber?: string }).ticketNumber,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[contact] create ticket failed:', err)
    return NextResponse.json(
      { success: false, error: '系統繁忙，請稍後再試' },
      { status: 500 },
    )
  }
}
