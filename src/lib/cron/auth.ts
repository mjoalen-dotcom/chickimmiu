import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

/**
 * 驗證 Bearer CRON_SECRET。
 * 成功回傳 null，失敗回傳 401 Response（routes 可直接 return）。
 * 使用 timingSafeEqual 避免 timing-attack 推測 secret 長度/內容。
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'cron_secret_not_configured' },
      { status: 503 },
    )
  }

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return null
}
