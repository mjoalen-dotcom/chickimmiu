import fs from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@payload-config'

interface SourcePost {
  slug?: unknown
  viewCount?: unknown
}

function parseArgs(argv: string[]) {
  let sourceDir = ''
  let dryRun = false
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source-dir') sourceDir = path.resolve(argv[++index] || '')
    else if (value === '--dry-run') dryRun = true
    else if (value !== '--') throw new Error(`Unknown argument: ${value}`)
  }
  if (!sourceDir) throw new Error('--source-dir is required')
  return { sourceDir, dryRun }
}

function normalizedViewCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0
}

async function collectViewCounts(sourceDir: string) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  const rows = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const post = JSON.parse(
      await fs.readFile(path.join(sourceDir, entry.name), 'utf8'),
    ) as SourcePost
    const slug = String(post.slug || '')
    if (!/^\d+$/.test(slug)) throw new Error(`Invalid PIXNET slug: ${entry.name}`)
    rows.push({ slug, viewCount: normalizedViewCount(post.viewCount) })
  }
  return rows.sort((left, right) => left.slug.localeCompare(right.slug))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const rows = await collectViewCounts(options.sourceDir)
  process.env.KIM_BLOG_DEPLOY_HOOK_URL = ''
  const payload = await getPayload({ config })
  const result = {
    total: rows.length,
    updated: 0,
    unchanged: 0,
    missing: [] as string[],
    dryRun: options.dryRun,
  }

  for (const row of rows) {
    const found = await payload.find({
      collection: 'blog-posts',
      where: { slug: { equals: row.slug } },
      limit: 1,
      depth: 0,
    })
    const post = found.docs[0]
    if (!post) {
      result.missing.push(row.slug)
      continue
    }
    if (normalizedViewCount(post.viewCount) === row.viewCount) {
      result.unchanged += 1
      continue
    }
    if (!options.dryRun) {
      await payload.update({
        collection: 'blog-posts',
        id: post.id,
        data: { viewCount: row.viewCount },
      })
    }
    result.updated += 1
  }

  console.log(JSON.stringify(result, null, 2))
}

let exitCode = 0
await main().catch((error) => {
  process.stderr.write(
    `[sync-kim-pixnet-view-counts] FATAL: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  )
  exitCode = 1
})
process.exit(exitCode)
