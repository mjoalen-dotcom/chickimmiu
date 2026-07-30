import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  getSsoClient,
  isAllowedRedirect,
  verifyAuthorizationCode,
  verifyClientSecret,
  verifyPkce,
} from '@/lib/sso/authorizationCode'

interface TokenRequest {
  grant_type?: string
  client_id?: string
  client_secret?: string
  redirect_uri?: string
  code?: string
  code_verifier?: string
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}

export async function POST(request: NextRequest) {
  let body: TokenRequest
  try {
    body = (await request.json()) as TokenRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (body.grant_type !== 'authorization_code') {
    return json({ error: 'Unsupported grant type' }, 400)
  }

  let client
  try {
    client = getSsoClient(body.client_id || '')
  } catch (error) {
    console.error('[sso/token] configuration error:', error)
    return json({ error: 'SSO is not configured' }, 503)
  }
  if (
    !client ||
    !body.client_secret ||
    !verifyClientSecret(body.client_secret, client) ||
    !body.redirect_uri ||
    !isAllowedRedirect(client, body.redirect_uri)
  ) {
    return json({ error: 'Invalid client authentication' }, 401)
  }

  const issuer =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin
  let grant
  try {
    grant = verifyAuthorizationCode(body.code || '', {
      issuer,
      clientId: client.id,
      redirectUri: body.redirect_uri,
    })
  } catch (error) {
    console.error('[sso/token] code verification error:', error)
    return json({ error: 'SSO is not configured' }, 503)
  }
  if (
    !grant ||
    !body.code_verifier ||
    !verifyPkce(body.code_verifier, grant.codeChallenge)
  ) {
    return json({ error: 'Invalid or expired authorization code' }, 400)
  }

  const payload = await getPayload({ config })
  let user
  try {
    user = await payload.findByID({
      collection: 'users',
      id: grant.sub,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    return json({ error: 'Member no longer exists' }, 404)
  }

  if ('_verified' in user && user._verified === false) {
    return json({ error: 'Email verification is required' }, 403)
  }

  return json(
    {
      token_type: 'KimMemberSession',
      expires_in: 60 * 60 * 12,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        memberTier: user.memberTier,
      },
    },
    200,
  )
}
