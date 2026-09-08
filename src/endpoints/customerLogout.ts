import type { Endpoint, PayloadRequest } from 'payload'

/**
 * POST /api/users/logout
 * ----------------------
 * 客戶登出端點（冪等）。
 *
 * 為什麼自己寫一個（不用 Payload 內建 /logout）？
 *   Payload v3 內建 logout 對 collection-auth 仍要求合法 session 才能 200，
 *   stale token 會 401 卡住。我們要的是冪等：管它有沒有 session、按下去就把
 *   cookie 抹掉。Cookie 屬性對齊 Users.ts auth.cookies（sameSite=Lax、prod=Secure）。
 *
 * 2026-09-08 cookie 分家後：會員憑證在 `ckmu-member-token`（一律清）；
 * `payload-token` 只有在它是 customers 的 legacy 會員 session 時才清 —
 * 無條件清會把同瀏覽器後台管理員（users）踢下線，正是分家要根治的互踢。
 * 解 JWT 只讀 collection 欄位、不驗簽：清自己瀏覽器的 cookie 無安全含意。
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

export const customerLogoutEndpoint: Endpoint = {
  path: '/logout',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const isProd = process.env.NODE_ENV === 'production'
    const attrs = '; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' + (isProd ? '; Secure' : '')
    const res = Response.json({ ok: true })
    res.headers.append('Set-Cookie', 'ckmu-member-token=' + attrs)

    const raw = req.headers.get('cookie') || ''
    const legacy = raw
      .split(/;\s*/)
      .find((c) => c.startsWith('payload-token='))
      ?.slice('payload-token='.length)
    if (legacy && jwtCollection(decodeURIComponent(legacy)) === 'customers') {
      res.headers.append('Set-Cookie', 'payload-token=' + attrs)
    }
    return res
  },
}
