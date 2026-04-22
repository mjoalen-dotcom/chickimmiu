import { NextResponse } from 'next/server'
import { getPayload, getFieldsToSign, jwtSign } from 'payload'
import config from '@payload-config'
import { auth as nextAuth } from '@/auth'

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

export async function GET(request: Request) {
  const base = resolveBaseUrl(request)
  const rawNext = new URL(request.url).searchParams.get('next') || '/account'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account'

  const session = await nextAuth()
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login?redirect=' + encodeURIComponent(next), base))
  }

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: session.user.email } },
    limit: 1,
  })
  if (docs.length === 0) {
    return NextResponse.redirect(new URL('/login?error=user_not_found', base))
  }
  const user = docs[0] as unknown as { id: string | number; email?: string } & Record<string, unknown>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersConfig = (payload as any).collections?.users?.config
  const authConfig = usersConfig?.auth
  if (!usersConfig || !authConfig) {
    return NextResponse.redirect(new URL('/login?error=auth_config_missing', base))
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: usersConfig,
    email: user.email || session.user.email,
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
  return response
}
