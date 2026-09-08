import { NextResponse } from 'next/server'

/**
 * 會員登出（cookie 分家版，2026-09-08）
 * ─────────────────────────────────────
 * 清除專屬會員 cookie `ckmu-member-token`。
 * 另外：cookie 分家「前」登入的舊會員 session 存在 `payload-token`
 * （collection=customers）— 這種 legacy cookie 也要清，否則登出無效。
 * 但**不能**無條件清 payload-token：管理員在前台逛（後台分頁同時開著）
 * 按登出時，他的 payload-token 是 users 的後台憑證，清掉等於把後台踢下線
 * （正是這次要根治的互踢問題反向重演）。做法：解 JWT payload（不驗簽，
 * 只讀 collection 欄位；清自己瀏覽器的 cookie 無安全含意）→ 只有
 * collection === 'customers' 才一併清除。
 */
function jwtCollection(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const parsed = JSON.parse(json) as { collection?: unknown }
    return typeof parsed.collection === 'string' ? parsed.collection : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const response = NextResponse.json({ message: 'Logged out successfully.' })
  response.cookies.set({ name: 'ckmu-member-token', value: '', path: '/', maxAge: 0 })

  const raw = request.headers.get('cookie') || ''
  const legacy = raw
    .split(/;\s*/)
    .find((c) => c.startsWith('payload-token='))
    ?.slice('payload-token='.length)
  if (legacy && jwtCollection(decodeURIComponent(legacy)) === 'customers') {
    response.cookies.set({ name: 'payload-token', value: '', path: '/', maxAge: 0 })
  }
  return response
}
