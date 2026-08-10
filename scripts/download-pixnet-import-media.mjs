import { createWriteStream } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

function parseArgs(argv) {
  const options = {
    sourceDir: '',
    mediaRoot: '',
    concurrency: 6,
    retries: 3,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source-dir') options.sourceDir = path.resolve(argv[++index] || '')
    else if (value === '--media-root') options.mediaRoot = path.resolve(argv[++index] || '')
    else if (value === '--concurrency') options.concurrency = Number(argv[++index])
    else if (value === '--retries') options.retries = Number(argv[++index])
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!options.sourceDir) throw new Error('--source-dir is required')
  if (!options.mediaRoot) throw new Error('--media-root is required')
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 20) {
    throw new Error('--concurrency must be an integer from 1 to 20')
  }
  if (!Number.isInteger(options.retries) || options.retries < 0 || options.retries > 10) {
    throw new Error('--retries must be an integer from 0 to 10')
  }
  return options
}

function safeDestination(mediaRoot, slug, source) {
  const mediaDir = path.resolve(mediaRoot, slug)
  const relativeDir = path.relative(mediaRoot, mediaDir)
  if (relativeDir.startsWith('..') || path.isAbsolute(relativeDir)) {
    throw new Error(`Unsafe media directory for ${slug}`)
  }
  const sourceUrl = new URL(source, 'https://panel.pixnet.tw').href
  const filename = path.basename(new URL(sourceUrl).pathname)
  if (!filename) throw new Error(`Image URL has no filename: ${source}`)
  const destination = path.resolve(mediaDir, filename)
  const relativeFile = path.relative(mediaDir, destination)
  if (relativeFile.startsWith('..') || path.isAbsolute(relativeFile)) {
    throw new Error(`Unsafe image filename: ${source}`)
  }
  return { destination, mediaDir, source: sourceUrl }
}

function resolveDownloadSource(source) {
  const url = new URL(source)
  if (url.hostname === 's.pixfs.net') {
    url.protocol = 'https:'
    url.hostname = 'pixfs.1px.tw'
  }
  return url.href
}

async function isCompleteFile(filename) {
  try {
    return (await stat(filename)).size > 0
  } catch {
    return false
  }
}

async function download(task, retries) {
  if (await isCompleteFile(task.destination)) return 'cached'
  await mkdir(task.mediaDir, { recursive: true })
  const partial = `${task.destination}.part`
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(resolveDownloadSource(task.source), {
        headers: { 'user-agent': 'KimLafayetteBlogMigration/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      })
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
      if (!(await isCompleteFile(partial))) throw new Error('empty response')
      await rename(partial, task.destination)
      return 'downloaded'
    } catch (error) {
      await unlink(partial).catch(() => {})
      if (attempt === retries) {
        throw new Error(
          `${task.source}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)))
    }
  }
  throw new Error(`Download failed: ${task.source}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const entries = await readdir(options.sourceDir, { withFileTypes: true })
  const tasks = []
  const seenDestinations = new Set()
  let reused = 0

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const post = JSON.parse(await readFile(path.join(options.sourceDir, entry.name), 'utf8'))
    const slug = String(post.slug || '')
    if (!/^\d+$/.test(slug)) throw new Error(`Invalid PIXNET slug in ${entry.name}`)
    for (const image of post.images || []) {
      if (image.mediaId) {
        reused += 1
        continue
      }
      const target = safeDestination(options.mediaRoot, slug, image.src)
      if (seenDestinations.has(target.destination)) continue
      seenDestinations.add(target.destination)
      tasks.push(target)
    }
  }

  let cursor = 0
  let downloaded = 0
  let cached = 0
  const failures = []
  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++
      const task = tasks[index]
      try {
        const result = await download(task, options.retries)
        if (result === 'cached') cached += 1
        else downloaded += 1
        if ((downloaded + cached) % 50 === 0 || index === tasks.length - 1) {
          console.log(`[${downloaded + cached}/${tasks.length}] media ready`)
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()))
  console.log(
    JSON.stringify(
      { total: tasks.length, downloaded, cached, reused, failures },
      null,
      2,
    ),
  )
  if (failures.length > 0) process.exitCode = 1
}

await main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
