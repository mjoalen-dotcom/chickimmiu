import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  createAuthorizationCode,
  getSsoClient,
  isAllowedRedirect,
} from '@/lib/sso/authorizationCode'

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const clientId = params.get('client_id') || ''
  const redirectUri = params.get('redirect_uri') || ''
  const responseType = params.get('response_type')
  const state = params.get('state') || ''
  const codeChallenge = params.get('code_challenge') || ''
  const codeChallengeMethod = params.get('code_challenge_method')

  let client
  try {
    client = getSsoClient(clientId)
  } catch (error) {
    console.error('[sso/authorize] configuration error:', error)
    return errorResponse('SSO is not configured', 503)
  }

  if (!client || !isAllowedRedirect(client, redirectUri)) {
    return errorResponse('Invalid client or redirect URI', 400)
  }
  if (responseType !== 'code') {
    return errorResponse('Unsupported response type', 400)
  }
  if (
    codeChallengeMethod !== 'S256' ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)
  ) {
    return errorResponse('PKCE S256 is required', 400)
  }
  if (!/^[A-Za-z0-9_-]{32,512}$/.test(state)) {
    return errorResponse('Invalid state', 400)
  }

  const issuer =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    const continuePath = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', issuer)
    loginUrl.searchParams.set('redirect', continuePath)
    return NextResponse.redirect(loginUrl, 302)
  }

  let code: string
  try {
    code = createAuthorizationCode({
      issuer,
      clientId,
      userId: String(user.id),
      redirectUri,
      codeChallenge,
    })
  } catch (error) {
    console.error('[sso/authorize] code creation error:', error)
    return errorResponse('SSO is not configured', 503)
  }

  const callback = new URL(redirectUri)
  callback.searchParams.set('code', code)
  callback.searchParams.set('state', state)
  const response = NextResponse.redirect(callback, 302)
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Pragma', 'no-cache')
  return response
}
