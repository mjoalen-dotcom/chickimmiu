import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })

  // Create admin user
  const admin = await (payload.create as Function)({
    collection: 'users',
    data: {
      email: 'admin@chickimmiu.com',
      password:
        process.env.ADMIN_RESET_PASSWORD ??
        (() => {
          throw new Error('ADMIN_RESET_PASSWORD env required')
        })(),
      name: 'Admin',
      role: 'admin',
    },
  })
  console.log('ADMIN CREATED: ID=' + admin.id + ' Email=' + admin.email)
  process.exit(0)
}
main().catch(e => { console.log('ERR:' + e.message); process.exit(1) })
