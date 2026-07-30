import { spawn } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const options = {
    sourceDir: '',
    mediaRoot: '',
    validateOnly: false,
    dryRun: false,
    skipExisting: false,
    continueOnError: false,
    slug: '',
    maxPosts: Number.POSITIVE_INFINITY,
    retries: 0,
    retryDelayMs: 3000,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source-dir') {
      options.sourceDir = path.resolve(argv[++index] || '')
    } else if (value === '--media-root') {
      options.mediaRoot = path.resolve(argv[++index] || '')
    } else if (value === '--validate-only') options.validateOnly = true
    else if (value === '--dry-run') options.dryRun = true
    else if (value === '--skip-existing') options.skipExisting = true
    else if (value === '--continue-on-error') options.continueOnError = true
    else if (value === '--slug') options.slug = argv[++index] || ''
    else if (value === '--max-posts') options.maxPosts = Number(argv[++index])
    else if (value === '--retries') options.retries = Number(argv[++index])
    else if (value === '--retry-delay-ms') {
      options.retryDelayMs = Number(argv[++index])
    } else if (value !== '--') throw new Error(`Unknown argument: ${value}`)
  }
  if (!options.sourceDir) throw new Error('--source-dir is required')
  if (!options.mediaRoot) throw new Error('--media-root is required')
  if (options.slug && !/^\d+$/.test(options.slug)) {
    throw new Error('--slug must be a numeric PIXNET post id')
  }
  if (
    options.maxPosts !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(options.maxPosts) || options.maxPosts < 1)
  ) {
    throw new Error('--max-posts must be a positive integer')
  }
  if (!Number.isInteger(options.retries) || options.retries < 0) {
    throw new Error('--retries must be a non-negative integer')
  }
  if (!Number.isInteger(options.retryDelayMs) || options.retryDelayMs < 0) {
    throw new Error('--retry-delay-ms must be a non-negative integer')
  }
  return options
}

async function collectPosts(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true })
  const posts = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const source = path.join(sourceDir, entry.name)
    const post = JSON.parse(await readFile(source, 'utf8'))
    if (!/^\d+$/.test(String(post.slug || ''))) {
      throw new Error(`Invalid PIXNET slug in ${source}`)
    }
    posts.push({
      source,
      slug: String(post.slug),
      title: String(post.title || ''),
      publishedAt: String(post.publishedAt || ''),
    })
  }
  return posts.sort((left, right) =>
    right.publishedAt.localeCompare(left.publishedAt),
  )
}

async function assertMediaDirectory(mediaRoot, slug) {
  const mediaDir = path.resolve(mediaRoot, slug)
  const relative = path.relative(mediaRoot, mediaDir)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe media directory for ${slug}`)
  }
  const details = await stat(mediaDir)
  if (!details.isDirectory()) throw new Error(`Missing media directory: ${mediaDir}`)
  return mediaDir
}

async function resolveTsxCli() {
  const pnpmRoot = path.join(process.cwd(), 'node_modules', '.pnpm')
  const packages = await readdir(pnpmRoot, { withFileTypes: true })
  const tsxPackage = packages
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('tsx@'))
    .sort((left, right) => right.name.localeCompare(left.name))[0]
  if (!tsxPackage) throw new Error('tsx is not installed in node_modules/.pnpm')
  return path.join(
    pnpmRoot,
    tsxPackage.name,
    'node_modules',
    'tsx',
    'dist',
    'cli.mjs',
  )
}

async function runImporter(options, post, mediaDir) {
  const tsxCli = await resolveTsxCli()
  const command = process.execPath
  const args = [
    tsxCli,
    'scripts/import-kim-pixnet-post.ts',
    '--',
    '--source',
    post.source,
    '--media-dir',
    mediaDir,
  ]
  if (options.validateOnly) args.push('--validate-only')
  if (options.dryRun) args.push('--dry-run')
  if (options.skipExisting) args.push('--skip-existing')

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.on('error', (error) =>
      finish({ code: 1, stdout, stderr: `${stderr}${error.message}` }),
    )
    child.on('close', (code) => finish({ code: code ?? 1, stdout, stderr }))
  })
}

const options = parseArgs(process.argv.slice(2))
const allPosts = await collectPosts(options.sourceDir)
const posts = allPosts
  .filter((post) => !options.slug || post.slug === options.slug)
  .slice(0, options.maxPosts)
if (posts.length === 0) throw new Error('No matching PIXNET post files were found')
const results = []

for (let index = 0; index < posts.length; index += 1) {
  const post = posts[index]
  process.stdout.write(
    `\n[${index + 1}/${posts.length}] ${post.slug} ${post.title}\n`,
  )
  try {
    const mediaDir = await assertMediaDirectory(options.mediaRoot, post.slug)
    let result
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      result = await runImporter(options, post, mediaDir)
      if (result.code === 0 || attempt === options.retries) break
      const delay = options.retryDelayMs * (attempt + 1)
      process.stderr.write(
        `[${post.slug}] attempt ${attempt + 1} failed; retrying in ${delay}ms\n`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    results.push({
      slug: post.slug,
      success: result.code === 0,
      exitCode: result.code,
    })
    if (result.code !== 0 && !options.continueOnError) break
  } catch (error) {
    results.push({
      slug: post.slug,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
    process.stderr.write(`${results.at(-1).error}\n`)
    if (!options.continueOnError) break
  }
}

const failed = results.filter((result) => !result.success)
process.stdout.write(
  `${JSON.stringify(
    {
      total: posts.length,
      processed: results.length,
      succeeded: results.length - failed.length,
      failed,
    },
    null,
    2,
  )}\n`,
)
if (failed.length > 0) process.exitCode = 1
