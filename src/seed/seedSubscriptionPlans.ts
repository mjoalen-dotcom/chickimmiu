/**
 * Seed SubscriptionPlans collection
 * ──────────────────────────────────────────
 *   讀 src/seed/data/subscriptionPlans.ts
 *   upsert 進 'subscription-plans' collection (以 slug 為 unique key)
 *
 * Usage:
 *   pnpm seed:plans        # 實際寫入 DB
 *   pnpm seed:plans:dry    # 只印 log，不動 DB
 *
 * Pattern 沿用 seedCore.ts — stderr diagnostics、keepAlive interval、
 * top-level await 避免 payload run 提早 exit(0)。
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { subscriptionPlans } from './data/subscriptionPlans'

function log(msg: string) {
  process.stderr.write('[seedPlans] ' + msg + '\n')
}

log('script loaded, argv=' + JSON.stringify(process.argv.slice(2)))

const DRY_RUN = process.argv.includes('--dry-run')

process.on('exit', (code) => {
  process.stderr.write('[seedPlans] >>> process exit code=' + code + '\n')
})
process.on('beforeExit', (code) => {
  process.stderr.write('[seedPlans] >>> beforeExit code=' + code + ' (event loop drained)\n')
})
process.on('unhandledRejection', (e: any) => {
  process.stderr.write('[seedPlans] UNHANDLED REJECTION: ' + (e?.stack || e) + '\n')
  process.exit(1)
})
process.on('uncaughtException', (e: any) => {
  process.stderr.write('[seedPlans] UNCAUGHT EXCEPTION: ' + (e?.stack || e) + '\n')
  process.exit(1)
})

// Keep the event loop alive — see seedCore.ts for rationale.
const keepAlive = setInterval(() => {}, 60_000)

async function seedPlans(payload: any) {
  log(`── SubscriptionPlans (${subscriptionPlans.length} 筆) ──`)
  let created = 0
  let updated = 0
  for (const plan of subscriptionPlans) {
    const found = await payload.find({
      collection: 'subscription-plans',
      where: { slug: { equals: plan.slug } },
      limit: 1,
    })
    const exists = found.docs[0]
    const tag = `${plan.slug.padEnd(8)} → ${plan.name} (月 $${plan.pricing.monthlyPrice}${
      plan.isFeatured ? ' ★' : ''
    })`

    if (DRY_RUN) {
      log(`  ${exists ? 'UPDATE' : 'CREATE'} [dry] ${tag}`)
      continue
    }

    if (exists) {
      await payload.update({
        collection: 'subscription-plans',
        id: exists.id,
        data: plan as any,
      })
      updated++
      log(`  UPDATE ${tag}`)
    } else {
      await payload.create({
        collection: 'subscription-plans',
        data: plan as any,
      })
      created++
      log(`  CREATE ${tag}`)
    }
  }
  if (!DRY_RUN) log(`  ↳ plans: ${created} created, ${updated} updated`)
}

async function main() {
  if (DRY_RUN) {
    log('=== DRY-RUN mode ===')
    log('不會寫入 DB，只印出會執行的動作')
  } else {
    log('=== seedPlans ===')
  }
  log('initializing payload...')
  let payload: any
  try {
    payload = await getPayload({ config })
  } catch (e: any) {
    process.stderr.write('[seedPlans] payload init FAILED: ' + (e?.stack || e) + '\n')
    process.exit(1)
  }
  log('payload ready')

  try {
    await seedPlans(payload)
    log('done ✓')
    clearInterval(keepAlive)
    process.exit(0)
  } catch (e: any) {
    process.stderr.write('[seedPlans] ERROR: ' + (e?.stack || e) + '\n')
    process.exit(1)
  }
}

// Top-level await — see seedCore.ts for rationale (payload run exits early otherwise).
await main().catch((e: any) => {
  process.stderr.write('[seedPlans] FATAL: ' + (e?.stack || e) + '\n')
  process.exit(1)
})
