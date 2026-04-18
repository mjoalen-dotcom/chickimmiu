/**
 * Reset admin password to a known value.
 * Run with: pnpm payload run src/seed/resetAdmin.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

process.stdout.write('[resetAdmin] starting\n')

async function main() {
  process.stdout.write('[resetAdmin] initializing payload\n')
  const payload = await getPayload({ config })
  process.stdout.write('[resetAdmin] payload ready, querying admin\n')

  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: 'admin@chickimmiu.com' } },
    limit: 1,
  })
  process.stdout.write('[resetAdmin] found ' + found.docs.length + ' user(s)\n')
  if (!found.docs[0]) {
    process.stdout.write('[resetAdmin] admin not found — aborting\n')
    process.exit(1)
  }

  const adminId = found.docs[0].id
  process.stdout.write('[resetAdmin] updating id=' + adminId + '\n')
  const updated = await (payload.update as Function)({
    collection: 'users',
    id: adminId,
    data: {
      password:
        process.env.ADMIN_RESET_PASSWORD ??
        (() => {
          throw new Error('ADMIN_RESET_PASSWORD env required')
        })(),
    },
  })
  process.stdout.write('[resetAdmin] updated email=' + updated.email + ' role=' + updated.role + '\n')
  process.stdout.write('[resetAdmin] done\n')
  process.exit(0)
}
main().catch((e) => {
  process.stderr.write('[resetAdmin] ERROR: ' + (e && e.stack || e) + '\n')
  process.exit(1)
})
