import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })

  // Create admin user
  const admin = await (payload.create as Function)({
    collection: 'users',
    data: {
      email: 'admin@chickimmiu.com',
      password: 'CKMU2026!admin',
      name: 'Admin',
      role: 'admin',
    },
  })
  console.log('ADMIN CREATED: ID=' + admin.id + ' Email=' + admin.email)
  process.exit(0)
}
main().catch(e => { console.log('ERR:' + e.message); process.exit(1) })
