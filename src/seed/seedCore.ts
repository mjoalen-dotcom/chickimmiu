/**
 * Seed core lookup data
 * ──────────────────────────────────────────
 *   - MembershipTiers  (6 層 T0-T5 會員等級)
 *   - ShippingMethods  (台灣常見 8 種運送方式)
 *
 * Usage:
 *   pnpm seed:core        # 實際寫入 DB (upsert by unique key)
 *   pnpm seed:core:dry    # 只印 log，不動 DB
 *
 * Upsert 邏輯：
 *   - MembershipTiers  以 slug 為 unique key
 *   - ShippingMethods  以 name  為 unique key
 *   已存在 → update；不存在 → create
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { membershipTiers } from './data/membershipTiers'
import { shippingMethods } from './data/shippingMethods'

// Use stderr for diagnostics — stdout is buffered when not connected to a TTY
// (cross-env / pnpm wrapping eats stdout if process is killed mid-flush).
function diag(msg: string) {
  process.stderr.write('[seedCore] ' + msg + '\n')
}
function log(msg: string) {
  process.stderr.write('[seedCore] ' + msg + '\n')
}

diag('script loaded, argv=' + JSON.stringify(process.argv.slice(2)))

const DRY_RUN = process.argv.includes('--dry-run')

process.on('exit', (code) => {
  process.stderr.write('[seedCore] >>> process exit code=' + code + '\n')
})
process.on('beforeExit', (code) => {
  process.stderr.write('[seedCore] >>> beforeExit code=' + code + ' (event loop drained!)\n')
})
process.on('unhandledRejection', (e: any) => {
  process.stderr.write('[seedCore] UNHANDLED REJECTION: ' + (e?.stack || e) + '\n')
  process.exit(1)
})
process.on('uncaughtException', (e: any) => {
  process.stderr.write('[seedCore] UNCAUGHT EXCEPTION: ' + (e?.stack || e) + '\n')
  process.exit(1)
})

// Keep event loop alive — if Payload's getPayload returns synchronously
// in some weird path and the loop drains, the process would die silently.
const keepAlive = setInterval(() => {}, 60_000)

async function seedTiers(payload: any) {
  log(`── MembershipTiers (${membershipTiers.length} 筆) ──`)
  let created = 0
  let updated = 0
  for (const tier of membershipTiers) {
    const found = await payload.find({
      collection: 'membership-tiers',
      where: { slug: { equals: tier.slug } },
      limit: 1,
    })
    const exists = found.docs[0]
    const tag = `${tier.slug.padEnd(9)} → ${tier.frontName} (L${tier.level})`

    if (DRY_RUN) {
      log(`  ${exists ? 'UPDATE' : 'CREATE'} [dry] ${tag}`)
      continue
    }

    if (exists) {
      await payload.update({
        collection: 'membership-tiers',
        id: exists.id,
        data: tier,
      })
      updated++
      log(`  UPDATE ${tag}`)
    } else {
      await payload.create({
        collection: 'membership-tiers',
        data: tier,
      })
      created++
      log(`  CREATE ${tag}`)
    }
  }
  if (!DRY_RUN) log(`  ↳ tiers: ${created} created, ${updated} updated`)
}

async function seedShipping(payload: any) {
  log(`── ShippingMethods (${shippingMethods.length} 筆) ──`)
  let created = 0
  let updated = 0
  for (const method of shippingMethods) {
    const found = await payload.find({
      collection: 'shipping-methods',
      where: { name: { equals: method.name } },
      limit: 1,
    })
    const exists = found.docs[0]
    const tag = `${method.carrier.padEnd(7)} → ${method.name} ($${method.baseFee}${method.isActive ? '' : ', 停用'})`

    if (DRY_RUN) {
      log(`  ${exists ? 'UPDATE' : 'CREATE'} [dry] ${tag}`)
      continue
    }

    if (exists) {
      await payload.update({
        collection: 'shipping-methods',
        id: exists.id,
        data: method,
      })
      updated++
      log(`  UPDATE ${tag}`)
    } else {
      await payload.create({
        collection: 'shipping-methods',
        data: method,
      })
      created++
      log(`  CREATE ${tag}`)
    }
  }
  if (!DRY_RUN) log(`  ↳ shipping: ${created} created, ${updated} updated`)
}

async function main() {
  if (DRY_RUN) {
    log('=== DRY-RUN mode ===')
    log('不會寫入 DB，只印出會執行的動作')
  } else {
    log('=== seedCore ===')
  }
  log('initializing payload...')
  let payload: any
  try {
    payload = await getPayload({ config })
  } catch (e: any) {
    process.stderr.write('[seedCore] payload init FAILED: ' + (e?.stack || e) + '\n')
    process.exit(1)
  }
  log('payload ready')

  try {
    await seedTiers(payload)
    await seedShipping(payload)
    log('done ✓')
    process.exit(0)
  } catch (e: any) {
    process.stderr.write('[seedCore] ERROR: ' + (e?.stack || e) + '\n')
    process.exit(1)
  }
}

// ⚠️ MUST be top-level await.
// `payload run` internally does `await import(scriptPath)` then `process.exit(0)`.
// A fire-and-forget `main().catch(...)` would return the import immediately,
// causing payload to exit(0) before getPayload() resolves (silent early death).
// Top-level await keeps the import promise pending until main() finishes.
await main().catch((e: any) => {
  process.stderr.write('[seedCore] FATAL: ' + (e?.stack || e) + '\n')
  process.exit(1)
})
