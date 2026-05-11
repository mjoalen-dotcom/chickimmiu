/**
 * Create the test admin user for V4 smoke tests.
 * Run with: pnpm payload run scripts/create-test-admin.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  const payload = await getPayload({ config })
  const email = 'admin@chickimmiu.com'
  const password = 'AdminTest2026!'

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (existing.docs[0]) {
    process.stdout.write(`[admin] exists (id=${existing.docs[0].id}) — skipping create\n`)
    process.exit(0)
  }

  const created = await payload.create({
    collection: 'users',
    data: {
      email,
      password,
      role: 'admin',
      name: 'CKMU Admin',
      _verified: true,
    } as never,
    disableVerificationEmail: true,
  })
  process.stdout.write(`[admin] created id=${created.id} email=${created.email}\n`)
  process.stdout.write(`[admin] password=${password}\n`)
  process.exit(0)
}

await main()
