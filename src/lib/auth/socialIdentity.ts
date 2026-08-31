import { getPayload } from 'payload'
import config from '@payload-config'
import { PROVIDER_SOCIAL_FIELD, placeholderEmailFor, isPlaceholderEmail } from '@/lib/auth/social'
import { facebookIdentityWhere, requireFacebookId } from '@/lib/auth/facebook'

/**
 * 社群身分 → Payload Customers 的唯一入口（server-only）
 * ------------------------------------------------
 * Web（NextAuth signIn callback）與 APP（POST /api/v1/auth/social 原生 id_token 交換）
 * 共用這一份匹配/建檔邏輯 —— 兩條路徑必須產生同一個會員，否則同一個人用手機 App 登入
 * 會多開一個帳號，點數/訂單/會員等級全部分家。
 *
 * 匹配順序（socialId-first，勿改）：
 *   1. socialLogins.{field} == providerAccountId  → 同一個社群帳號回訪
 *   2. email == 經驗證的 provider email          → 既有會員第一次用社群登入 → 綁定 social id（Facebook 不適用）
 *   3. 都沒有                                     → 建新會員（無 email 者用 placeholder）
 *
 * email 排在 socialId 後面，是因為使用者可能在 LINE/Apple 端換過 email、或根本沒 email。
 */

export type PayloadUserDoc = { id: string | number; email?: string } & Record<string, unknown>

export type SocialIdentityInput = {
  /** 'google' | 'facebook' | 'line' | 'apple' */
  provider: string
  /** OAuth provider 的使用者唯一識別（id_token 的 sub） */
  providerAccountId: string
  /** Facebook App ID, resolved on the server (never from an API request body). */
  providerAppId?: string
  /** provider 回傳的 email，可能沒有（LINE 常見、Apple 隱藏信箱後續登入也不再回傳） */
  email?: string | null
  /** 顯示名稱，只在「建新會員」時使用 */
  name?: string | null
}

/**
 * 找出（或建立）對應的 Payload 會員，並把社群 ID 綁上去。
 * 回傳 null = 無從辨識（不認得的 provider 又沒 email）。
 * 丟出例外 = DB 或身分解析出錯；Web 與 App 均拒絕登入。
 */
export async function linkOrCreateSocialUser(
  input: SocialIdentityInput,
): Promise<PayloadUserDoc | null> {
  const socialField = PROVIDER_SOCIAL_FIELD[input.provider]
  if (!Object.hasOwn(PROVIDER_SOCIAL_FIELD, input.provider) || !input.providerAccountId || input.providerAccountId.length > 255) return null
  const facebookAppId = input.provider === 'facebook' ? requireFacebookId(input.providerAppId) : null
  const socialWhere = facebookAppId
    ? facebookIdentityWhere(input.providerAccountId, facebookAppId)
    : { [`socialLogins.${socialField}`]: { equals: input.providerAccountId } }
  // OAuth provider 回 mixed-case email 也要對得上 Payload 已 lowercase 的紀錄。
  const email = input.provider === 'facebook' ? null : input.email?.toLowerCase() || null
  if (!email && !socialField) return null

  const payload = await getPayload({ config })

  // 1) socialId-first
  let existing: PayloadUserDoc | null = null
  if (socialField) {
    const bySocial = await payload.find({
      collection: 'customers',
      where: socialWhere,
      limit: 2,
      depth: 0,
    })
    if (bySocial.docs.length > 1) throw new Error('Ambiguous social identity')
    if (bySocial.docs.length > 0) {
      existing = bySocial.docs[0] as unknown as PayloadUserDoc
    }
  }

  // 2) email 匹配
  if (!existing && email) {
    const byEmail = await payload.find({
      collection: 'customers',
      where: { email: { equals: email } },
      limit: 1,
    })
    if (byEmail.docs.length > 0) {
      existing = byEmail.docs[0] as unknown as PayloadUserDoc
    }
  }

  if (!existing) {
    // 3) 全新社群使用者 → 建立 Users 紀錄。
    //    無 email（LINE 常見）→ 合成 placeholder email（noemail.invalid）過 Payload
    //    auth 必填檢查，之後可在 /account/settings 補綁真 email。
    //    隨機密碼只是為了過必填檢查，社群使用者不會走 email/pw 流程。
    //
    // _verified:true + disableVerificationEmail:true：OAuth provider 已替我們做完
    // email 驗證（placeholder 則本來就不可投遞），Payload 不必再寄信。沒帶這兩個
    // 欄位會讓新帳號 _verified=false → /api/auth/bridge 雖能簽 JWT，但 payload.auth()
    // 在 verify 開啟時會拒絕未驗證 user，造成 /account → bridge → /account 無限循環。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (payload as any).create({
      collection: 'customers',
      data: {
        email: email || placeholderEmailFor(input.provider, facebookAppId ? `${facebookAppId}_${input.providerAccountId}` : input.providerAccountId),
        password: `social_${crypto.randomUUID()}_${Date.now()}`,
        name: input.name || (email ? email.split('@')[0] : `${input.provider === 'facebook' ? 'Facebook' : input.provider.toUpperCase()} 會員`),
        _verified: true,
        ...(socialField ? { socialLogins: { [socialField]: input.providerAccountId, ...(facebookAppId ? { facebookAppId } : {}) } } : {}),
      },
      disableVerificationEmail: true,
    }).catch(async (error: unknown) => {
      // A simultaneous first sign-in may have won the unique app/user or email
      // constraint. Re-read exactly that identity; never fall back to email.
      if (facebookAppId) {
        const concurrent = await payload.find({ collection: 'customers', where: socialWhere, limit: 2, depth: 0 })
        if (concurrent.docs.length === 1) return concurrent.docs[0]
      }
      throw error
    })
    return created as PayloadUserDoc
  }

  const currentSocial = (existing.socialLogins || {}) as Record<string, unknown>
  const alreadyVerified = (existing as { _verified?: boolean })._verified === true
  const updateData: Record<string, unknown> = {}
  if (socialField && currentSocial[socialField] !== input.providerAccountId) {
    updateData.socialLogins = {
      ...currentSocial,
      [socialField]: input.providerAccountId,
    }
  }
  // 救援先前 OAuth 建立的未驗證帳號（無此 backfill 會永遠卡 bridge loop）
  if (!alreadyVerified) updateData._verified = true
  // 舊帳號掛著 placeholder email、這次 OAuth 給了真 email → 升級（先查重，
  // 該 email 已屬於別的會員時保留 placeholder，留給客服做人工合併）
  if (email && isPlaceholderEmail(existing.email)) {
    const emailTaken = await payload.find({
      collection: 'customers',
      where: { email: { equals: email } },
      limit: 1,
    })
    if (emailTaken.docs.length === 0) {
      updateData.email = email
    } else {
      console.warn(
        `[socialIdentity] user ${existing.id} 的 OAuth email ${email} 已屬於 user ${emailTaken.docs[0].id}，保留 placeholder`,
      )
    }
  }

  if (Object.keys(updateData).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (payload.update as any)({
      collection: 'customers',
      id: existing.id,
      data: updateData,
    })
    return (updated || existing) as PayloadUserDoc
  }

  return existing
}
