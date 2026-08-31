export const MEMBER_IDENTITY_VERSION = '1' as const

export function canonicalCustomerSubject(id: unknown): string {
  const value = String(id ?? '')
  if (!/^\d{1,20}$/.test(value)) throw new Error('Invalid customer ID')
  return `ckmu:customer:${value}`
}

export function memberIdentitySummary(user: Record<string, unknown>) {
  const social = (user.socialLogins || {}) as Record<string, unknown>
  return {
    version: MEMBER_IDENTITY_VERSION,
    subject: canonicalCustomerSubject(user.id),
    loginMethods: {
      facebook: Boolean(social.facebookId && social.facebookAppId),
      google: Boolean(social.googleId),
      line: Boolean(social.lineId),
      apple: Boolean(social.appleId),
    },
  }
}
