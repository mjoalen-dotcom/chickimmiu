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
 * Returns { payload, user } or { payload, user: null }.
 */
export async function resolveApiUser(
  headers?: Headers,
): Promise<{ payload: BasePayload; user: TypedUser | null }> {
  const payload = await getPayload({ config })
  const hdrs = headers ?? (await nextHeaders())

  const { user } = await payload.auth({ headers: hdrs })
  if (user) return { payload, user }

  // Fallback: OAuth session without Payload cookie
  try {
    const session = await nextAuth()
    if (session?.user?.email) {
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: session.user.email.toLowerCase() } },
        limit: 1,
      })
      if (docs.length > 0) {
        const doc = docs[0] as unknown as { _verified?: boolean }
        if (doc._verified !== false) {
          return { payload, user: docs[0] as TypedUser }
        }
      }
    }
  } catch {
    // NextAuth unavailable or session invalid
  }

  return { payload, user: null }
}
