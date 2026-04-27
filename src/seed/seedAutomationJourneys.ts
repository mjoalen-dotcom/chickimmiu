/**
 * Seed AutomationJourneys collection
 * ──────────────────────────────────────────
 *   讀 src/lib/crm/journeyDefinitions.ts 的 JOURNEY_TEMPLATES (14 種)
 *   upsert 進 'automation-journeys' collection (以 slug 為 unique key)
 *
 * Usage:
 *   pnpm seed:journeys        # 實際寫入 DB
 *   pnpm seed:journeys:dry    # 只印 log，不動 DB
 *
 * Pattern 沿用 seedSubscriptionPlans.ts — stderr diagnostics、keepAlive interval、
 * top-level await 避免 payload run 提早 exit(0)。
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { JOURNEY_TEMPLATES } from '../lib/crm/journeyDefinitions'

function log(msg: string) {
  process.stderr.write('[seedJourneys] ' + msg + '\n')
}

log('script loaded, argv=' + JSON.stringify(process.argv.slice(2)))

const DRY_RUN = process.argv.includes('--dry-run')

process.on('exit', (code) => {
  process.stderr.write('[seedJourneys] >>> process exit code=' + code + '\n')
})
process.on('beforeExit', (code) => {
  process.stderr.write('[seedJourneys] >>> beforeExit code=' + code + ' (event loop drained)\n')
})
process.on('unhandledRejection', (e: any) => {
  process.stderr.write('[seedJourneys] UNHANDLED REJECTION: ' + (e?.stack || e) + '\n')
  process.exit(1)
})
process.on('uncaughtException', (e: any) => {
  process.stderr.write('[seedJourneys] UNCAUGHT EXCEPTION: ' + (e?.stack || e) + '\n')
  process.exit(1)
})

const keepAlive = setInterval(() => {}, 60_000)

async function seedJourneys(payload: any) {
  log(`── AutomationJourneys (${JOURNEY_TEMPLATES.length} 筆) ──`)
  let created = 0
  let updated = 0
  for (const j of JOURNEY_TEMPLATES) {
    const found = await payload.find({
      collection: 'automation-journeys',
      where: { slug: { equals: j.slug } },
      limit: 1,
      depth: 0,
    })
    const exists = found.docs[0]
    const tag = `${j.slug.padEnd(28)} → ${j.name} (${j.triggerType}/${j.triggerEvent}, ${j.steps.length} 步)`

    if (DRY_RUN) {
      log(`  ${exists ? 'UPDATE' : 'CREATE'} [dry] ${tag}`)
      continue
    }

    if (exists) {
      await payload.update({
        collection: 'automation-journeys',
        id: exists.id,
        data: j as any,
      })
      updated++
      log(`  UPDATE ${tag}`)
    } else {
      await payload.create({
        collection: 'automation-journeys',
        data: j as any,
      })
      created++
      log(`  CREATE ${tag}`)
    }
  }
  if (!DRY_RUN) log(`  ↳ journeys: ${created} created, ${updated} updated`)
}

async function main() {
  if (DRY_RUN) {
    log('=== DRY-RUN mode ===')
    log('不會寫入 DB，只印出會執行的動作')
  } else {
    log('=== seedJourneys ===')
  }
  log('initializing payload...')
  let payload: any
  try {
    payload = await getPayload({ config })
  } catch (e: any) {
    process.stderr.write('[seedJourneys] payload init FAILED: ' + (e?.stack || e) + '\n')
    process.exit(1)
  }
  log('payload ready')

  try {
    await seedJourneys(payload)
    log('done ✓')
    clearInterval(keepAlive)
    process.exit(0)
  } catch (e: any) {
    process.stderr.write('[seedJourneys] ERROR: ' + (e?.stack || e) + '\n')
    process.exit(1)
  }
}

await main().catch((e: any) => {
  process.stderr.write('[seedJourneys] FATAL: ' + (e?.stack || e) + '\n')
  process.exit(1)
})
