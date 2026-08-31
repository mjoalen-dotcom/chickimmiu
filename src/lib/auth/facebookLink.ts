import type { BasePayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { requireFacebookId } from './facebook'
import { FACEBOOK_LINK_COOKIE, readCookie, verifyFacebookLinkIntent } from './facebookLinkIntent'

/**
 * One conditional SQL statement prevents two concurrent callbacks overwriting
 * the same customer's identity. The compound unique index prevents two
 * customers claiming the same Facebook app/user pair. No balance/order writes.
 */
export async function linkFacebookToCustomer(
  payload: BasePayload,
  customerId: string | number,
  appId: string,
  accountId: string,
): Promise<void> {
  requireFacebookId(appId)
  requireFacebookId(accountId)
  const query = sql`
    UPDATE "customers"
    SET "social_logins_facebook_id" = ${accountId},
        "social_logins_facebook_app_id" = ${appId},
        "updated_at" = ${new Date().toISOString()}
    WHERE "id" = ${customerId} AND "deleted_at" IS NULL
      AND COALESCE("is_guest", false) = false AND "_verified" = true
      AND ("social_logins_facebook_id" IS NULL OR "social_logins_facebook_id" = ''
        OR ("social_logins_facebook_id" = ${accountId} AND "social_logins_facebook_app_id" = ${appId}))
    RETURNING "id"`
  // Both supported adapters expose Drizzle; the SQLite migration chain is frozen
  // and local schema sync creates the same columns and index for verification.
  const db = payload.db as unknown as {
    name: string
    drizzle: { execute: (q: typeof query) => Promise<unknown>; run: (q: typeof query) => Promise<unknown> }
  }
  const result = await (db.name === 'postgres' ? db.drizzle.execute(query) : db.drizzle.run(query))
  const rows = (Array.isArray(result) ? result : (result as { rows?: Array<{ id: unknown }> })?.rows) || []
  if (rows.length !== 1 || String(rows[0].id) !== String(customerId)) {
    throw new Error('Facebook account cannot be linked')
  }
}

/** Called only after Auth.js validates the Facebook OAuth code and state. */
export async function completeFacebookLink(payload: BasePayload, headers: Headers, appId: string, accountId: string) {
  const { user } = await payload.auth({ headers })
  if (!user || user.collection !== 'customers' || user.isGuest || user._verified !== true) {
    throw new Error('Customer session required')
  }
  const sessionToken = readCookie(headers, `${payload.config.cookiePrefix || 'payload'}-token`)
  const valid = verifyFacebookLinkIntent(readCookie(headers, FACEBOOK_LINK_COOKIE), {
    customerId: String(user.id), appId, sessionToken,
  }, payload.secret)
  if (!valid) throw new Error('Facebook link request expired or invalid')
  await linkFacebookToCustomer(payload, user.id, appId, accountId)
}
