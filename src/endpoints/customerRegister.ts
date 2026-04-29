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
 *   5. 讀 GlobalSettings.emailAuth.requireEmailVerification 決定分支：
 *      - 開 → 預設 `_verified:false` → Payload 自動寄驗證信 → 回 `{ requiresVerification: true }`
 *             前端導去 /login?registered=1&verify=1 顯示「請到信箱點連結」
 *      - 關 → `_verified:true` + `disableVerificationEmail:true` → 立即 auto-login 下 cookie
 *             前端導去 /account
 *   6. 不觸發推薦獎勵 points-transaction —— 另案
 *   7. 不自動產生使用者本人的 referralCode —— 另案
 */
export const customerRegisterEndpoint: Endpoint = {
  path: '/register',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    try {
      const raw = (await req.json?.()) as
        | {
            email?: string
            password?: string
            name?: string
            birthday?: string
            birthTime?: string
            referralCode?: string
            acceptTerms?: boolean
            firstTouchAttribution?: {
              utmSource?: string
              utmMedium?: string
              utmCampaign?: string
              utmTerm?: string
              utmContent?: string
              referrer?: string
              landingPath?: string
              capturedAt?: string
            }
          }
        | undefined
      const email = (raw?.email || '').trim().toLowerCase()
      const password = raw?.password || ''
      const name = (raw?.name || '').trim()
      const referralCodeInput = (raw?.referralCode || '').trim()
      const acceptTerms = Boolean(raw?.acceptTerms)

      // PR-B: first-touch UTM（client 從 90 天 cookie 抓的）
      // 不檢驗來源真實性 — 攻擊者頂多灌假 UTM 影響行銷報表，無安全風險
      const clipUtm = (v: unknown) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : undefined
      const ftIn = raw?.firstTouchAttribution
      const firstTouchAttribution = ftIn
        ? {
            utmSource: clipUtm(ftIn.utmSource),
            utmMedium: clipUtm(ftIn.utmMedium),
            utmCampaign: clipUtm(ftIn.utmCampaign),
            utmTerm: clipUtm(ftIn.utmTerm),
            utmContent: clipUtm(ftIn.utmContent),
            referrer: clipUtm(ftIn.referrer),
            landingPath: clipUtm(ftIn.landingPath),
            capturedAt: clipUtm(ftIn.capturedAt),
          }
        : undefined

      // 生日（選填）— 接受 ISO 字串 / yyyy-mm-dd；不合法或未來日期就略過（不擋註冊）
      let birthdayISO: string | undefined
      const birthdayRaw = (raw?.birthday || '').trim()
      if (birthdayRaw) {
        const t = new Date(birthdayRaw).getTime()
        if (Number.isFinite(t) && t <= Date.now()) {
          birthdayISO = new Date(t).toISOString()
        }
      }

      // 出生時間（選填）— 必須是 24h HH:mm；不合法就略過（不擋註冊）。
      // 沿用 Users.ts 同一條 regex，後台 validate 也吃同一規則。
      let birthTime: string | undefined
      const birthTimeRaw = (raw?.birthTime || '').trim()
      if (birthTimeRaw && /^([01]\d|2[0-3]):[0-5]\d$/.test(birthTimeRaw)) {
        birthTime = birthTimeRaw
      }

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

      // 讀後台開關決定要不要強制 email 驗證
      let requireVerification = false
      try {
        const settings = (await req.payload.findGlobal({
          slug: 'global-settings',
          depth: 0,
        })) as { emailAuth?: { requireEmailVerification?: boolean } } | undefined
        requireVerification = Boolean(settings?.emailAuth?.requireEmailVerification)
      } catch {
        // global 讀失敗視為未開（保守不擋註冊）
      }

      // 建帳（overrideAccess 繞過 isAdmin create 限制）
      // 關閉驗證：寫入 _verified:true + disableVerificationEmail（不寄信）
      // 開啟驗證：不帶 _verified → Payload 預設 false → 依 verify block 寄信
      const baseData = {
        email,
        password,
        name,
        role: 'customer',
        ...(birthdayISO ? { birthday: birthdayISO } : {}),
        ...(birthTime ? { birthTime } : {}),
        ...(referredById !== undefined ? { referredBy: referredById } : {}),
        ...(firstTouchAttribution ? { firstTouchAttribution } : {}),
      } as Record<string, unknown>

      const createData = requireVerification
        ? baseData
        : { ...baseData, _verified: true }

      await req.payload.create({
        collection: 'users',
        data: createData as unknown as RequiredDataFromCollectionSlug<'users'>,
        overrideAccess: true,
        ...(requireVerification ? {} : { disableVerificationEmail: true }),
      })

      if (requireVerification) {
        // 不 auto-login（Payload 會因 _verified=false 擋 login）
        return Response.json(
          {
            requiresVerification: true,
            email,
            message: '註冊成功！請至您的信箱點擊驗證連結完成啟用。',
          },
          { status: 201 },
        )
      }

      // 驗證關閉 → 立刻 login 取 token + 設 cookie（舊流程）
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
          requiresVerification: false,
        },
        { status: 201 },
      )
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown'
      return Response.json({ error: 'server_error', message: msg }, { status: 500 })
    }
  },
}
