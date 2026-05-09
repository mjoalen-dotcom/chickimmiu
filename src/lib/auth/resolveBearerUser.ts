import { getPayload, type BasePayload, type TypedUser } from 'payload'
import config from '@payload-config'

/**
 * v1 API 用 Bearer / JWT token 認證 helper
 *
 * 接受兩種 Authorization header 前綴：
 *   - `Authorization: Bearer <token>`  ← APP 慣用標準
 *   - `Authorization: JWT <token>`     ← Payload 內建格式
 *
 * APP 流程：
 *   1. POST /api/v1/auth/login {email, password} → { token, user, expiresIn }
 *   2. 後續 request 帶 `Authorization: Bearer <token>`
 *   3. Token 有效期 = users.auth.tokenExpiration（預設 7 天，登入回 expiresIn）
 *
 * Payload v3 `payload.auth({ headers })` 原生支援 `JWT` 前綴；
 * 我們把 `Bearer` 轉成 `JWT` 餵給它，達成相容。
 */
export async function resolveBearerUser(
  req: Request | { headers: Headers },
): Promise<{
  payload: BasePayload
  user: TypedUser | null
  token: string | null
}> {
  const payload = await getPayload({ config })
  const authHeader = (req.headers as Headers).get?.('authorization') || ''
  const match = authHeader.match(/^(Bearer|JWT)\s+(.+)$/i)
  const token = match?.[2] || null
  if (!token) return { payload, user: null, token: null }

  const fakeHeaders = new Headers({ authorization: `JWT ${token}` })
  try {
    const { user } = await payload.auth({ headers: fakeHeaders })
    return { payload, user: user || null, token }
  } catch {
    return { payload, user: null, token }
  }
}

/** 統一 v1 API 401 回應 shape */
export const UNAUTHORIZED_RESPONSE = {
  success: false,
  error: 'Unauthorized — 請於 Authorization header 帶 Bearer token',
  code: 'UNAUTHORIZED',
} as const
