import { createHmac } from 'node:crypto'
import Facebook from 'next-auth/providers/facebook'
import { facebookGraphVersion, facebookProfile, requireFacebookId } from './facebook'

export function createFacebookProvider(creds: { clientId: string; clientSecret: string }) {
  requireFacebookId(creds.clientId)
  const version = facebookGraphVersion(process.env.AUTH_FACEBOOK_GRAPH_VERSION)
  const graph = `https://graph.facebook.com/${version}`
  return Facebook({
    ...creds,
    checks: ['state'],
    client: { token_endpoint_auth_method: 'client_secret_post' },
    authorization: {
      url: `https://www.facebook.com/${version}/dialog/oauth`,
      params: { scope: 'public_profile' },
    },
    token: `${graph}/oauth/access_token`,
    userinfo: {
      url: `${graph}/me?fields=id,name`,
      async request({ tokens }: { tokens: { access_token?: string } }) {
        if (!tokens.access_token) throw new Error('Facebook access token missing')
        const url = new URL(`${graph}/me`)
        url.searchParams.set('fields', 'id,name')
        url.searchParams.set(
          'appsecret_proof',
          createHmac('sha256', creds.clientSecret).update(tokens.access_token).digest('hex'),
        )
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) throw new Error('Facebook profile lookup failed')
        const profile: unknown = await response.json()
        facebookProfile(profile) // reject errors / missing IDs before creating any member
        return profile as Record<string, unknown>
      },
    },
    profile: facebookProfile,
  })
}
