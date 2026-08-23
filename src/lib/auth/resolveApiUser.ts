import { headers as nextHeaders } from 'next/headers'
import { getPayload, type BasePayload, type TypedUser } from 'payload'
import config from '@payload-config'
import { auth as nextAuth } from '@/auth'

/**
 * Resolve authenticated user for API routes.
 *
 * Payload cookie is the primary source. If absent (OAuth user who never
 * visited /account to trigger the bridge), falls back to NextAuth session
 * and looks up the Payload user by email. Rejects unverified users.
 *
 * Only `customers` accounts are accepted as the API user: payload.auth()
 * authenticates every auth-enabled collection, so an admin logged into
 * /admin (users collection) would otherwise pass through and their users.id
 * would be written into customer relationships (player/user FKs → customers
 * after the 16-7 cutover), violating the FK. Admins with a same-email
 * customer account still resolve via the NextAuth fallback below.
 *
 * Returns { payload, user } or { payload, user: null }.
 */
export async function resolveApiUser(
  headers?: Headers,
): Promise<{ payload: BasePayload; user: TypedUser | null }> {
  const payload = await getPayload({ config })
  const hdrs = headers ?? (await nextHeaders())

  const { user } = await payload.auth({ headers: hdrs })
  if (user && user.collection === 'customers') return { payload, user }

  // Fallback: OAuth session without Payload cookie
  try {
    const session = await nextAuth()
    if (session?.user?.email) {
      const { docs } = await payload.find({
        collection: 'customers',
        where: { email: { equals: session.user.email.toLowerCase() } },
        limit: 1,
      })
      if (docs.length > 0) {
        const doc = docs[0] as unknown as { _verified?: boolean }
        if (doc._verified !== false) {
          // find() docs lack the `collection` discriminator payload.auth() adds;
          // attach it so downstream `user.collection === 'customers'` checks pass.
          return { payload, user: { ...docs[0], collection: 'customers' } as TypedUser }
        }
      }
    }
  } catch {
    // NextAuth unavailable or session invalid
  }

  return { payload, user: null }
}
