import { getPayload } from 'payload'

import config from '@payload-config'

type JsonObject = Record<string, unknown>

const slug = '923151569307236622'
const dryRun = process.env.KIM_PIXNET_COPY_FIX_DRY_RUN === '1'
const textReplacements = new Map([
  ['團購日期 : 11/7~11/14', '團購日期：7/29～8/12'],
  ['聖誕節前可以收到貨唷', '實際到貨時間依結帳頁與物流進度為準'],
  [
    '週一到週五 上午9:00 - 18:00 (國定及例假日休息)',
    '週一到週五 上午9:30 - 18:00 (國定及例假日休息)',
  ],
])
const linkReplacements = new Map([
  [
    'http://youwin721.pixnet.net/blog/post/62870594',
    'https://youwin721.pixnet.net/blog/posts/5062870594',
  ],
])

function visit(value: unknown, counts: Map<string, number>) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, counts)
    return
  }
  if (!value || typeof value !== 'object') return

  const node = value as JsonObject
  if (node.type === 'text' && typeof node.text === 'string') {
    const replacement = textReplacements.get(node.text)
    if (replacement) {
      counts.set(node.text, (counts.get(node.text) || 0) + 1)
      node.text = replacement
    }
  }
  if (node.type === 'link' && node.fields && typeof node.fields === 'object') {
    const fields = node.fields as JsonObject
    if (typeof fields.url === 'string') {
      const replacement = linkReplacements.get(fields.url)
      if (replacement) {
        counts.set(fields.url, (counts.get(fields.url) || 0) + 1)
        fields.url = replacement
      }
    }
  }

  for (const child of Object.values(node)) visit(child, counts)
}

async function main() {
  process.env.KIM_BLOG_DEPLOY_HOOK_URL = ''
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'blog-posts',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  const post = result.docs[0]
  if (!post) throw new Error(`Blog post not found: ${slug}`)

  const content = structuredClone(post.content)
  const counts = new Map<string, number>()
  visit(content, counts)

  for (const source of [...textReplacements.keys(), ...linkReplacements.keys()]) {
    const count = counts.get(source) || 0
    if (count !== 1) {
      throw new Error(`Expected one match for ${JSON.stringify(source)}, found ${count}`)
    }
  }

  const summary = {
    slug,
    articleId: post.id,
    dryRun,
    replacements: Object.fromEntries(counts),
  }
  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  await payload.update({
    collection: 'blog-posts',
    id: post.id,
    data: { content } as never,
  })
  console.log(JSON.stringify({ ...summary, updated: true }, null, 2))
}

await main().catch((error) => {
  process.stderr.write(
    `[repair-kim-pixnet-post-copy] FATAL: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  )
  process.exit(1)
})
