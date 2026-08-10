import fs from 'node:fs/promises'
import path from 'node:path'
import { DomUtils, parseDocument } from 'htmlparser2'

function parseArgs(argv) {
  const options = {
    sourceDir: '',
    mediaRoot: '',
    removals: '',
    report: '',
    apply: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--source-dir') options.sourceDir = path.resolve(argv[++index] || '')
    else if (value === '--media-root') options.mediaRoot = path.resolve(argv[++index] || '')
    else if (value === '--removals') options.removals = path.resolve(argv[++index] || '')
    else if (value === '--report') options.report = path.resolve(argv[++index] || '')
    else if (value === '--apply') options.apply = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  if (!options.sourceDir) throw new Error('--source-dir is required')
  if (!options.mediaRoot) throw new Error('--media-root is required')
  if (!options.report) throw new Error('--report is required')
  return options
}

function normalizeSource(source) {
  return new URL(source, 'https://panel.pixnet.tw').href
}

function mediaPath(mediaRoot, slug, source) {
  const filename = path.basename(new URL(source).pathname)
  return path.resolve(mediaRoot, slug, filename)
}

async function isReady(filename) {
  try {
    const stats = await fs.stat(filename)
    return stats.isFile() && stats.size > 0
  } catch {
    return false
  }
}

function escapedAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function markerNode(source, isVideo) {
  const label = isVideo ? '查看原始影片' : '原始外部圖片已失效（待補圖）'
  const fragment = parseDocument(
    `<span data-pixnet-migration-note="missing-media">[<a href="${escapedAttribute(source)}" target="_blank">${label}</a>]</span>`,
  )
  return fragment.children[0]
}

function imageNodes(document) {
  return DomUtils.findAll(
    (node) => node.type === 'tag' && String(node.name || '').toLowerCase() === 'img',
    document.children,
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const removalSources = options.removals
    ? JSON.parse(await fs.readFile(options.removals, 'utf8'))
    : []
  if (!Array.isArray(removalSources)) throw new Error('The removals file must contain a JSON array')
  const removals = new Set(removalSources.map(normalizeSource))
  const entries = (await fs.readdir(options.sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name))
  const report = { applied: options.apply, posts: [] }

  for (const entry of entries) {
    const filename = path.join(options.sourceDir, entry.name)
    const post = JSON.parse(await fs.readFile(filename, 'utf8'))
    const slug = String(post.slug || '')
    const decisions = new Map()
    const retainedImages = []

    for (const image of post.images || []) {
      const source = normalizeSource(image.src)
      if (removals.has(source)) {
        decisions.set(source, { action: 'remove', reason: 'duplicate-source', source })
        continue
      }
      const isVideo = /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/i.test(source)
      if (isVideo) {
        decisions.set(source, {
          action: 'mark',
          reason: 'invalid-image-video',
          source,
        })
        continue
      }
      if (image.mediaId || (await isReady(mediaPath(options.mediaRoot, slug, source)))) {
        decisions.set(source, { action: 'keep', source })
        retainedImages.push(image)
        continue
      }
      decisions.set(source, {
        action: 'mark',
        reason: 'unavailable-source',
        source,
      })
    }

    const document = parseDocument(post.html || '<p></p>')
    for (const node of imageNodes(document)) {
      const rawSource = node.attribs?.src || ''
      if (!rawSource) continue
      const source = normalizeSource(rawSource)
      const decision = decisions.get(source)
      if (!decision || decision.action === 'keep') continue
      if (decision.action === 'remove') DomUtils.removeElement(node)
      else DomUtils.replaceElement(node, markerNode(source, decision.reason === 'invalid-image-video'))
    }

    const changes = [...decisions.values()].filter((decision) => decision.action !== 'keep')
    report.posts.push({
      slug,
      title: post.title,
      retainedImages: retainedImages.length,
      changes,
    })
    if (options.apply && changes.length > 0) {
      post.images = retainedImages
      post.html = DomUtils.getInnerHTML(document)
      await fs.writeFile(filename, `${JSON.stringify(post, null, 2)}\n`, 'utf8')
    }
  }

  await fs.writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const changedPosts = report.posts.filter((post) => post.changes.length > 0)
  console.log(
    JSON.stringify(
      {
        applied: options.apply,
        posts: report.posts.length,
        changedPosts: changedPosts.length,
        changes: changedPosts.reduce((total, post) => total + post.changes.length, 0),
        report: options.report,
      },
      null,
      2,
    ),
  )
}

await main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
