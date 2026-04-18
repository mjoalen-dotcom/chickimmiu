import type { Endpoint, PayloadRequest } from 'payload'

/**
 * POST /api/users/logout
 * ----------------------
 * 客戶登出端點。清掉 `payload-token` cookie。
 *
 * 為什麼自己寫一個（不用 Payload 內建 /logout）？
 *   Payload v3 內建 logout 對 collection-auth 仍要求合法 session 才能 200，
 *   stale token 會 401 卡住。我們要的是冪等：管它有沒有 session、按下去就把
 *   cookie 抹掉。Cookie 屬性對齊 Users.ts auth.cookies（sameSite=Lax、prod=Secure）。
 */
export const customerLogoutEndpoint: Endpoint = {
  path: '/logout',
  method: 'post',
  handler: async (_req: PayloadRequest) => {
    const isProd = process.env.NODE_ENV === 'production'
    const cookie =
      'payload-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' + (isProd ? '; Secure' : '')
    const res = Response.json({ ok: true })
    res.headers.set('Set-Cookie', cookie)
    return res
  },
}
