/**
 * setActiveTheme — quick CLI to flip the active SiteThemes row
 * usage: pnpm exec cross-env NODE_OPTIONS=--no-deprecation payload run src/seed/setActiveTheme.ts -- "春櫻 2026"
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const targetName = process.argv.slice(2).find((a) => !a.startsWith('-')) || 'CKMU 經典'

const payload = await getPayload({ config })

const target = await payload.find({
  collection: 'site-themes',
  where: { name: { equals: targetName } },
  limit: 1,
})

if (target.docs.length === 0) {
  // eslint-disable-next-line no-console
  console.error(`✗ Theme not found: ${targetName}`)
  process.exit(1)
}

// Deactivate everything else
await payload.update({
  collection: 'site-themes',
  where: { id: { not_equals: target.docs[0].id } },
  data: { isActive: false },
})

// Activate target
await payload.update({
  collection: 'site-themes',
  id: target.docs[0].id,
  data: { isActive: true },
})

// eslint-disable-next-line no-console
console.log(`✓ Active theme → "${targetName}" (heroLayout: ${(target.docs[0] as { heroLayout?: string }).heroLayout})`)
process.exit(0)
