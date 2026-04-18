import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPayload, getFieldsToSign, jwtSign } from 'payload'
import config from '@payload-config'
import { auth as nextAuth } from '@/auth'

// Setting `payload-token` from inside the NextAuth `signIn` callback doesn't
// work — Auth.js v5 builds its own redirect Response and `cookies().set()`
// from a callback is silently dropped from the final headers. A standalone
// route handler that we own does pick up cookie writes, so /account redirects
// here when it sees a NextAuth session but no Payload session.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawNext = url.searchParams.get('next') || '/account'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account'

  const session = await nextAuth()
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL('/login?redirect=' + encodeURIComponent(next), request.url))
  }

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: session.user.email } },
    limit: 1,
  })
  if (docs.length === 0) {
    return NextResponse.redirect(new URL('/login?error=user_not_found', request.url))
  }
  const user = docs[0] as unknown as { id: string | number; email?: string } & Record<string, unknown>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usersConfig = (payload as any).collections?.users?.config
  const authConfig = usersConfig?.auth
  if (!usersConfig || !authConfig) {
    return NextResponse.redirect(new URL('/login?error=auth_config_missing', request.url))
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

  const store = await cookies()
  store.set({
    name: `${cookiePrefix}-token`,
    value: token,
    httpOnly: true,
    path: '/',
    secure,
    sameSite,
    domain: authConfig.cookies?.domain || undefined,
    maxAge: authConfig.tokenExpiration,
  })

  return NextResponse.redirect(new URL(next, request.url))
}
