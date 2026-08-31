/** Facebook IDs are scoped to an app. They are not Meta Horizon identities. */
export const DEFAULT_FACEBOOK_GRAPH_VERSION = 'v25.0'

export function facebookGraphVersion(value?: string): string {
  const version = value?.trim() || DEFAULT_FACEBOOK_GRAPH_VERSION
  if (!/^v\d{1,2}\.\d{1,2}$/.test(version)) throw new Error('Invalid Facebook API version')
  return version
}

export function requireFacebookId(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{5,40}$/.test(value)) {
    throw new Error('Invalid Facebook identity')
  }
  return value
}

export function facebookIdentityWhere(accountId: string, appId: string): { and: Array<Record<string, { equals: string }>> } {
  return {
    and: [
      { 'socialLogins.facebookId': { equals: requireFacebookId(accountId) } },
      { 'socialLogins.facebookAppId': { equals: requireFacebookId(appId) } },
    ],
  }
}

export function facebookProfile(profile: unknown) {
  const data = profile as { id?: unknown; name?: unknown } | null
  const id = requireFacebookId(data?.id)
  const name = typeof data?.name === 'string' ? data.name.trim().slice(0, 120) : ''
  // Facebook does not provide a trusted email-verification claim. Do not request
  // email, put it in the session, or use it to merge an existing customer.
  return { id, name: name || 'Facebook 會員', email: null, image: null }
}

/** Never combine an App ID from the CMS with a secret from a different env app. */
export function facebookCredentials(
  dbId: unknown,
  dbSecret: unknown,
  envId?: string,
  envSecret?: string,
): { clientId: string; clientSecret: string } | null {
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const fromDb = Boolean(clean(dbId) || clean(dbSecret))
  const clientId = clean(fromDb ? dbId : envId)
  const clientSecret = clean(fromDb ? dbSecret : envSecret)
  if (!/^\d{5,40}$/.test(clientId) || !/^[a-f0-9]{32}$/i.test(clientSecret)) return null
  return { clientId, clientSecret }
}
