import type { Endpoint, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

import { isPlaceholderEmail } from '../lib/auth/social'

/**
 * POST /api/users/bind-email
 * --------------------------
 * 無 email 社群帳號（LINE 常見）建檔時 email 是 placeholder（@noemail.invalid），
 * 收不到訂單通知信。這條讓已登入的 placeholder 帳號補綁真 email。
 *
 * 限制：
 *   - 只有 placeholder email 帳號可呼叫 — 一般帳號 email 維持不可改（前台顯示「不可修改」）
 *   - email 已被其他會員使用 → 409，提示改用該帳號登入或聯繫客服人工合併
 *     （自動合併兩個帳號的訂單/點數/錢包風險太高，不做）
 *
 * 安全注意：閉環版不寄驗證信直接綁定（使用者可能填錯/填別人的 email，頂多
 * 通知信寄錯人；該 email 註冊新帳號不受影響，因為這裡先查重）。正式營運若要
 * 嚴格驗證，改走 Payload verify 流程再綁。
 */
export const bindEmailEndpoint: Endpoint = {
  path: '/bind-email',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      const user = req.user as ({ id: string | number; email?: string } & Record<string, unknown>) | null
      if (!user) {
        return Response.json({ error: 'unauthorized', message: '請先登入' }, { status: 401 })
      }
      if (!isPlaceholderEmail(user.email)) {
        return Response.json(
          { error: 'email_already_bound', message: '此帳號已有 email，無法變更' },
          { status: 400 },
        )
      }

      const raw = (await req.json?.()) as { email?: string } | undefined
      const email = (raw?.email || '').trim().toLowerCase()
      if (!email || !/.+@.+\..+/.test(email) || isPlaceholderEmail(email)) {
        return Response.json({ error: 'invalid_email', message: 'Email 格式不正確' }, { status: 400 })
      }

      const existing = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        pagination: false,
        depth: 0,
      })
      if (existing.docs.length > 0) {
        return Response.json(
          {
            error: 'email_taken',
            message: '此 email 已屬於其他會員。若那是您的帳號，請改用它登入；需要合併帳號請聯繫客服。',
          },
          { status: 409 },
        )
      }

      await req.payload.update({
        collection: 'users',
        id: user.id,
        data: { email } as unknown as RequiredDataFromCollectionSlug<'users'>,
        overrideAccess: true,
      })

      return Response.json({ ok: true, email })
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown'
      return Response.json({ error: 'server_error', message: msg }, { status: 500 })
    }
  },
}
