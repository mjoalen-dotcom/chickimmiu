import { NextResponse } from 'next/server'
import { getPayload, getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser } from 'payload/shared'
import config from '@payload-config'
import { auth as nextAuth } from '@/auth'
import { PROVIDER_SOCIAL_FIELD } from '@/lib/auth/social'
import { safeInternalRedirect } from '@/lib/auth/safeRedirect'
import { facebookIdentityWhere } from '@/lib/auth/facebook'

// Setting `payload-token` from inside the NextAuth `signIn` callback doesn't
// work — Auth.js v5 builds its own redirect Response and `cookies().set()`
// from a callback is silently dropped from the final headers. A standalone
// route handler that we own does pick up cookie writes, so /account redirects
// here when it sees a NextAuth session but no Payload session.
//
// Set the cookie via `response.cookies.set()` instead of `cookies().set()` —
// when this handler returns its own NextResponse.redirect(), Next 15 does not
// reliably propagate `cookies()` mutations onto the custom response (see
// vercel/next.js discussions), which would cause Set-Cookie to be silently
// dropped and /account to loop forever: layout sees no payload-token → send
// back to bridge → bridge sets cookie (dropped) → redirect → layout sees no
// cookie again. Mutating the redirect response directly avoids that drop.
//
// Next.js 15 constructs `request.url` from the internal bind address (e.g.
// `http://localhost:3000/...`), not the incoming Host header, so redirects
// built with `new URL(path, request.url)` leak the upstream host. Resolve
// the public base from Host + X-Forwarded-Proto (which nginx sets correctly)
// and fall back to NEXT_PUBLIC_SITE_URL / request.url as a last resort.
function resolveBaseUrl(request: Request): string {
  const host = request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return new URL(request.url).origin
}

const LOOP_GUARD_COOKIE = '_ckmu_bridge_attempt'
const LOOP_GUARD_MAX_AGE = 30 // 秒；> bridge → layout 來回時間，< 使用者重新嘗試的耐心

// 把 NextAuth 寫過的 session cookie 全清掉。Auth.js v5 會把大 session 切 chunk
// 寫成 `authjs.session-token.0` / `.1` 等；secure cookie 變體叫 `__Secure-authjs.session-token`。
// 任一個損毀都會讓整個 session 解不開，所以全清，下次 OAuth 才能拿到乾淨的一份。
function clearStaleAuthCookies(response: NextResponse, cookieHeader: string): NextResponse {
  const candidates = new Set<string>()
  for (const piece of cookieHeader.split(/;\s*/)) {
    const eq = piece.indexOf('=')
    if (eq <= 0) continue
    const name = piece.slice(0, eq)
    if (/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(name)) {
      candidates.add(name)
    }
  }
  for (const name of candidates) {
    response.cookies.set({ name, value: '', path: '/', maxAge: 0 })
  }
  return response
}

export async function GET(request: Request) {
  const base = resolveBaseUrl(request)
  const url = new URL(request.url)
  // `next` 一律走 safeInternalRedirect：只擋 `//` 是不夠的 —— WHATWG URL parser 對
  // special scheme 會把反斜線當斜線，`/\evil.com` 經 `new URL(next, base)` 會解析成
  // `https://evil.com/`（實測），變成掛在自家 OAuth 流程尾端的開放轉址（釣魚跳板）。
  // safeInternalRedirect 同時擋 `//`、`\`、CR/LF。
  const next = safeInternalRedirect(url.searchParams.get('next'), '/account')

  // Loop guard：用 short-lived cookie 計次。bridge 設好 Payload session cookie 後，
  // 如果 layout 又把使用者推回 bridge（代表 Payload 仍拒絕該 cookie），第二次踏進來
  // 就停損 — 重導去 /login 顯示明確錯誤，而不是無限循環。
  const cookieHeader = request.headers.get('cookie') || ''
  const guardMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LOOP_GUARD_COOKIE}=(\\d+)`))
  const previousAttempts = guardMatch ? parseInt(guardMatch[1], 10) || 0 : 0
  if (previousAttempts >= 1) {
    const failResponse = NextResponse.redirect(
      new URL('/login?error=session_bridge_failed&redirect=' + encodeURIComponent(next), base),
    )
    // 清掉 guard cookie，讓使用者下次重試時能正常走流程
    failResponse.cookies.set({
      name: LOOP_GUARD_COOKIE,
      value: '',
      path: '/',
      maxAge: 0,
    })
    return failResponse
  }

  // `nextAuth()` 會在 session cookie 損毀（例如 AUTH_SECRET 換過、舊 chunk 殘留、跨部署遺留）
  // 時拋出 JWTSessionError: Invalid Compact JWE。原本沒包 try/catch 會讓 bridge 直接 500 →
  // 使用者看到的是中性的「跳回登入」沒有原因。捕捉後主動清掉所有 NextAuth 相關 cookie
  // （含 chunk 變體 `.0` `.1`），導去 /login?error=session_invalid 並把原 redirect 帶回，
  // 使用者重新點 OAuth 即可拿到全新乾淨的 session。
  type BridgeSession = {
    user?: {
      email?: string | null
      provider?: string
      providerAccountId?: string
      providerAppId?: string
      /** provider 是否驗證過該 email（auth.ts jwt callback 寫入） */
      providerEmailVerified?: boolean
    }
  } | null
  let session: BridgeSession = null
  try {
    session = (await nextAuth()) as BridgeSession
  } catch (err) {
    console.error('[auth/bridge] nextAuth() threw — clearing stale cookies', err)
    return clearStaleAuthCookies(
      NextResponse.redirect(new URL('/login?error=session_invalid&redirect=' + encodeURIComponent(next), base)),
      cookieHeader,
    )
  }
  // 統一 lowercase 找 user：OAuth provider 偶爾回 mixed-case email，Payload 內部存 lowercase。
  // 無 email 的社群帳號（LINE 常見）改用 session 上的 provider + providerAccountId
  // 對 socialLogins.{field} 找人（auth.ts jwt/session callback 帶過來的）。
  // 未經 provider 驗證的 email 不得用來找 Payload user —— 否則攻擊者在 provider 端
  // 掛一個受害者 email 的帳號，即使 signIn callback 已拒絕綁定，bridge 這關仍會
  // 用同一個 email 找到受害者會員並簽出 session（帳號接管）。
  const emailTrusted = session?.user?.provider !== 'facebook' && session?.user?.providerEmailVerified === true
  const sessionEmail = emailTrusted ? session?.user?.email?.toLowerCase() || null : null
  const provider = session?.user?.provider
  const providerAccountId = session?.user?.providerAccountId
  const providerAppId = session?.user?.providerAppId
  const socialField = provider ? PROVIDER_SOCIAL_FIELD[provider] : undefined
  if (!sessionEmail && !(socialField && providerAccountId)) {
    return NextResponse.redirect(new URL('/login?redirect=' + encodeURIComponent(next), base))
  }

  const payload = await getPayload({ config })
  // socialId-first（與 auth.ts signIn callback 同序）：email 在 LINE 端換過或不存在
  // 也能對回同一個會員；找不到再 fallback email 匹配
  let docs: Array<{ id: string | number }> = []
  if (socialField && providerAccountId) {
    let where
    try {
      where = provider === 'facebook'
        ? facebookIdentityWhere(providerAccountId, providerAppId || '')
        : { [`socialLogins.${socialField}`]: { equals: providerAccountId } }
    } catch {
      return clearStaleAuthCookies(NextResponse.redirect(new URL('/login?error=session_invalid', base)), cookieHeader)
    }
    const bySocial = await payload.find({
      collection: 'customers',
      where,
      limit: 2,
      depth: 0,
    })
    if (bySocial.docs.length > 1) return NextResponse.redirect(new URL('/login?error=AccessDenied', base))
    docs = bySocial.docs
  }
  if (docs.length === 0 && sessionEmail) {
    const byEmail = await payload.find({
      collection: 'customers',
      where: { email: { equals: sessionEmail } },
      limit: 1,
    })
    docs = byEmail.docs
  }
  if (docs.length === 0) {
    return NextResponse.redirect(new URL('/login?error=user_not_found', base))
  }
  const user = docs[0] as unknown as { id: string | number; email?: string; _verified?: boolean } & Record<string, unknown>

  // 自我修復：之前透過舊版 signIn callback 建立的 OAuth 帳號 _verified=false，
  // 會讓 payload.auth() 拒絕該 cookie → 永遠回到 bridge → 循環。OAuth 流程本來就視為
  // email 已驗，找到未驗證帳號就 backfill 成已驗證。
  if (user._verified !== true) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payload.update as any)({
        collection: 'customers',
        id: user.id,
        data: { _verified: true },
      })
      user._verified = true
    } catch (err) {
      console.error('[auth/bridge] failed to backfill _verified for user', user.id, err)
    }
  }

  // 顧客 OAuth bridge 只服務 customers collection——staff/admin 走 /admin 原生
  // 登入表單，從不經過這條路徑，所以不用兼顧 users collection。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersConfig = (payload as any).collections?.customers?.config
  const authConfig = usersConfig?.auth
  if (!usersConfig || !authConfig) {
    return NextResponse.redirect(new URL('/login?error=auth_config_missing', base))
  }

  // Payload v3.x 預設 `auth.useSessions: true`，JWT strategy 在 verify 階段會檢查
  // `decodedPayload.sid` 是否對得上 `user.sessions[]` 內任一 record；缺任一個就回 null user，
  // 接著 /account layout 又把人推回 bridge → 第二次踩 loop guard → `session_bridge_failed`。
  // 所以簽 JWT 之前必須先把 session 寫進 user.sessions（同 Payload 內建 login operation 走的路）。
  // `sessions` 欄位的 access.update:false 阻擋一般 payload.update，要走 db 層；
  // `addSessionToUser` 內部呼叫 `payload.db.updateOne({...,req})`，drizzle 那層只在
  // `req.transactionID` 存在時才用 req，傳空物件即可。
  let sid: string | undefined
  try {
    const result = await addSessionToUser({
      collectionConfig: usersConfig,
      payload,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req: {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: user as any,
    })
    sid = result.sid
  } catch (err) {
    console.error('[auth/bridge] addSessionToUser failed for user', user.id, err)
    return NextResponse.redirect(
      new URL('/login?error=session_bridge_failed&redirect=' + encodeURIComponent(next), base),
    )
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: usersConfig,
    email: user.email || sessionEmail || '',
    sid,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: user as any,
  })
  const { token } = await jwtSign({
    fieldsToSign,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    secret: (payload as any).secret as string,
    tokenExpiration: authConfig.tokenExpiration,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookiePrefix = ((payload as any).config?.cookiePrefix as string | undefined) || 'payload'
  const rawSameSite = authConfig.cookies?.sameSite
  const sameSite: 'strict' | 'lax' | 'none' =
    typeof rawSameSite === 'string'
      ? (rawSameSite.toLowerCase() as 'strict' | 'lax' | 'none')
      : rawSameSite
        ? 'strict'
        : 'lax'
  const secure = Boolean(authConfig.cookies?.secure) || sameSite === 'none'

  const response = NextResponse.redirect(new URL(next, base))
  response.cookies.set({
    name: `${cookiePrefix}-token`,
    value: token,
    httpOnly: true,
    path: '/',
    secure,
    sameSite,
    domain: authConfig.cookies?.domain || undefined,
    maxAge: authConfig.tokenExpiration,
  })
  // Loop guard 記次：30 秒內如果 layout 又把人推回來就停損
  response.cookies.set({
    name: LOOP_GUARD_COOKIE,
    value: String(previousAttempts + 1),
    httpOnly: true,
    path: '/',
    secure,
    sameSite: 'lax',
    maxAge: LOOP_GUARD_MAX_AGE,
  })
  return response
}
