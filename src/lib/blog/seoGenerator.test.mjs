import assert from 'node:assert/strict'
import test from 'node:test'

const {
  buildBlogSeoRequest,
  createBlogSeoFallback,
  normalizeBlogSeoInput,
  normalizeBlogSeoOutput,
} = await import('./seoGenerator.ts')

const article = {
  title: '[ME30珍珠] 金老佛爺實戴分享｜14款地中海輕珠寶選購指南',
  excerpt:
    'ME30團購資訊 https://bit.ly/3RkiqPX，整理珍珠尺寸、日常穿搭與選購方式。',
  contentText: '從 4mm、6mm 到 8mm，依照日常場合與造型份量選擇適合的珍珠。',
  category: '購物情報',
  tags: ['ME30', '珍珠', 'ME30', '金老佛爺團購'],
}

test('normalizes SEO input and removes duplicate tags', () => {
  const normalized = normalizeBlogSeoInput(article)
  assert.deepEqual(normalized.tags, ['ME30', '珍珠', '金老佛爺團購'])
  assert.equal(normalized.title, article.title)
  assert.equal(normalizeBlogSeoInput(null).title, '')
})

test('creates a bounded fallback without exposing raw URLs', () => {
  const seo = createBlogSeoFallback(article)
  assert.equal(seo.source, 'fallback')
  assert.match(seo.metaTitle, /金老佛爺/)
  assert.ok(Array.from(seo.metaTitle).length <= 60)
  assert.ok(Array.from(seo.metaDescription).length <= 155)
  assert.doesNotMatch(seo.metaDescription, /https?:\/\//)
  assert.equal(seo.focusKeyword, 'ME30')
})

test('builds a source-only Traditional Chinese SEO prompt', () => {
  const request = buildBlogSeoRequest(article)
  assert.match(request.systemPrompt, /台灣繁體中文/)
  assert.match(request.systemPrompt, /不得捏造價格、日期、折扣/)
  assert.match(request.systemPrompt, /supportingKeywords/)
  assert.match(request.userPrompt, /ME30/)
})

test('normalizes AI output and falls back on incomplete output', () => {
  const fallback = createBlogSeoFallback(article)
  const output = normalizeBlogSeoOutput(
    {
      metaTitle: 'ME30 珍珠尺寸與日常穿搭選購指南｜金老佛爺',
      metaDescription:
        '從 4mm、6mm 到 8mm 珍珠，整理不同份量、日常場合與疊戴方式，幫你找到真正適合生活與衣櫃的珍珠飾品。',
      focusKeyword: 'ME30 珍珠',
      supportingKeywords: ['珍珠尺寸', '珍珠穿搭', 'ME30 珍珠'],
    },
    fallback,
  )
  assert.equal(output.source, 'ai')
  assert.deepEqual(output.supportingKeywords, ['珍珠尺寸', '珍珠穿搭'])
  assert.deepEqual(normalizeBlogSeoOutput({ metaTitle: '' }, fallback), fallback)
})
