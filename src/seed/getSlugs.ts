import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const p = await getPayload({ config })
  const all = await p.find({ collection: 'products', limit: 200, depth: 0 })
  for (const d of all.docs) {
    const slug = (d as unknown as Record<string, unknown>).slug as string
    if (slug) console.log(slug)
  }
  process.exit(0)
}
main()
