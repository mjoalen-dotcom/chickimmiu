import type { Endpoint, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

/**
 * POST /api/users/register
 * ------------------------
 * 客戶自助註冊端點（對外公開）。
 *
 * 為什麼不用 POST /api/users？
 *   Users collection 的 access.create = isAdmin，公開註冊會 403。
 *   客製一條 endpoint 走 overrideAccess 比放寬整個 collection 的 create
 *   access 安全（後者會讓任何人都能建 role='admin'）。
 *
 * 行為：
 *   1. 驗證 email / password / name；密碼最少 8 字
 *   2. 檢查 email 是否已存在
 *   3. referralCode（選填）→ 查出 referrer 寫入 referredBy
 *   4. 固定 role='customer' 建帳
 *   5. 立刻 login（set Payload cookie `payload-token`）
 *   6. 回傳 user + token
 *
 * 不做：
 *   - 不自動產生 referralCode（自己的）—— 另案
 *   - 不觸發推薦獎勵 points-transaction —— 另案
 *   - 不寄註冊確認信 —— 需 email adapter，另案
 */
export const customerRegisterEndpoint: Endpoint = {
  path: '/register',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      const raw = (await req.json?.()) as
        | { email?: string; password?: string; name?: string; referralCode?: string; acceptTerms?: boolean }
        | undefined
      const email = (raw?.email || '').trim().toLowerCase()
      const password = raw?.password || ''
      const name = (raw?.name || '').trim()
      const referralCodeInput = (raw?.referralCode || '').trim()
      const acceptTerms = Boolean(raw?.acceptTerms)

      if (!email || !/.+@.+\..+/.test(email)) {
        return Response.json({ error: 'invalid_email', message: 'Email 格式不正確' }, { status: 400 })
      }
      if (!password || password.length < 8) {
        return Response.json({ error: 'weak_password', message: '密碼至少 8 個字元' }, { status: 400 })
      }
      if (!name) {
        return Response.json({ error: 'missing_name', message: '請填寫姓名' }, { status: 400 })
      }
      if (!acceptTerms) {
        return Response.json({ error: 'terms_required', message: '請勾選同意服務條款' }, { status: 400 })
      }

      // 檢查 email 是否已被註冊
      const existing = await req.payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        pagination: false,
        depth: 0,
      })
      if (existing.docs.length > 0) {
        return Response.json(
          { error: 'email_taken', message: '此 email 已註冊，請直接登入或使用「忘記密碼」' },
          { status: 409 },
        )
      }

      // referralCode（referrer 的 code）→ 查出 referrer 寫入 referredBy
      let referredById: string | number | undefined
      if (referralCodeInput) {
        const refRes = await req.payload.find({
          collection: 'users',
          where: { referralCode: { equals: referralCodeInput } },
          limit: 1,
          pagination: false,
          depth: 0,
        })
        if (refRes.docs.length > 0) {
          referredById = refRes.docs[0].id as string | number
        }
        // 推薦碼找不到不擋註冊；只是不連推薦關係
      }

      // 建帳（overrideAccess 繞過 isAdmin create 限制）
      await req.payload.create({
        collection: 'users',
        data: {
          email,
          password,
          name,
          role: 'customer',
          ...(referredById !== undefined ? { referredBy: referredById } : {}),
        } as unknown as RequiredDataFromCollectionSlug<'users'>,
        overrideAccess: true,
      })

      // 立刻 login 取 token + 設 cookie
      const loginResult = await req.payload.login({
        collection: 'users',
        data: { email, password },
        req,
      })
      const loggedUser = loginResult.user as { id?: string | number; email?: string } | undefined

      return Response.json(
        {
          user: { id: loggedUser?.id, email: loggedUser?.email, name },
          token: loginResult.token,
        },
        { status: 201 },
      )
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown'
      return Response.json({ error: 'server_error', message: msg }, { status: 500 })
    }
  },
}
