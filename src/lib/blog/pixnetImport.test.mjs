import assert from 'node:assert/strict'
import test from 'node:test'

const { convertPixnetHtmlToLexical } = await import('./pixnetImport.ts')
const { serializeLexicalForKimBlog } = await import('./kimFeed.ts')

test('converts PIXNET HTML into editable Lexical content with linked media', () => {
  const converted = convertPixnetHtmlToLexical(
    `
      <h2 style="text-align:center">穿搭 <strong>重點</strong></h2>
      <p>前往 <a href="https://example.com/" target="_blank">活動頁</a></p>
      <p><span><picture><source srcset="/media/look-480.webp"><img src="/media/look.webp" alt="Look"></picture></span></p>
      <p><a href="javascript:alert(1)">不安全</a></p>
    `,
    new Map([['/media/look.webp', 42]]),
  )

  assert.equal(converted.missingImageSources.length, 0)
  assert.deepEqual(converted.embeddedMediaIds, [42])
  assert.equal(converted.nodeCounts.upload, 1)
  assert.equal(converted.nodeCounts.heading, 1)
  assert.equal(converted.nodeCounts.link, 1)

  const html = serializeLexicalForKimBlog(
    converted.content,
    'https://pre.chickimmiu.com',
  )
  assert.match(html, /<h2 style="text-align:center">/)
  assert.match(html, /href="https:\/\/example\.com\/"/)
  assert.doesNotMatch(html, /javascript:/)
})

test('reports images that are absent from the media map', () => {
  const converted = convertPixnetHtmlToLexical(
    '<p><img src="/media/missing.webp"></p>',
    new Map(),
  )
  assert.deepEqual(converted.missingImageSources, ['/media/missing.webp'])
  assert.equal(converted.nodeCounts.upload, undefined)
})
