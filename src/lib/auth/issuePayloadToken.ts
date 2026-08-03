import { getFieldsToSign, jwtSign, type Payload } from 'payload'
import { addSessionToUser } from 'payload/shared'

/**
 * 不經密碼簽發 Payload 會員 token（server-only）
 * --------------------------------------------
 * 社群登入的使用者根本沒有可用的密碼（建檔時塞的是隨機字串），所以無法走
 * `payload.login()`。這裡走 Payload login operation 內部同一條路手動簽：
 *
 *   addSessionToUser() → getFieldsToSign() → jwtSign()
 *
 * ⚠️ addSessionToUser 不能省。Payload v3.x 預設 `auth.useSessions: true`，
 * JWT verify 階段會檢查 `decodedPayload.sid` 對不對得上 `user.sessions[]`，
 * 缺 sid 的 token 一律被當成未登入。（web 端 /api/auth/bridge 踩過這個坑）
 *
 * 回傳的 token 同時適用兩種用法：
 *   - APP：`Authorization: Bearer <token>`
 *   - Web：寫成 `payload-token` cookie
 */
export async function issuePayloadToken(
  payload: Payload,
  user: { id: string | number; email?: string } & Record<string, unknown>,
): Promise<{ token: string; expiresIn: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersConfig = (payload as any).collections?.users?.config
  const authConfig = usersConfig?.auth
  if (!usersConfig || !authConfig) {
    throw new Error('users collection auth config 不存在')
  }

  const { sid } = await addSessionToUser({
    collectionConfig: usersConfig,
    payload,
    // drizzle 那層只在 req.transactionID 存在時才用 req，傳空物件即可
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: user as any,
  })

  const fieldsToSign = getFieldsToSign({
    collectionConfig: usersConfig,
    email: user.email || '',
    sid,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: user as any,
  })

  const tokenExpiration: number = authConfig.tokenExpiration || 7 * 24 * 60 * 60
  const { token } = await jwtSign({
    fieldsToSign,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    secret: (payload as any).secret as string,
    tokenExpiration,
  })

  return { token, expiresIn: tokenExpiration }
}
