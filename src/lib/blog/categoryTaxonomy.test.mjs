import assert from 'node:assert/strict'
import test from 'node:test'

const {
  blogCategoryLabel,
  blogCategoryOptionsForSite,
  blogSiteFromPost,
  isBlogCategoryForSite,
} = await import('./categoryTaxonomy.ts')

test('keeps store and Kim category catalogs independently scoped', () => {
  const store = blogCategoryOptionsForSite('store')
  const kim = blogCategoryOptionsForSite('kim')

  assert.equal(store.length, 5)
  assert.equal(kim.length, 14)
  assert.equal(store.some((option) => option.value === 'beauty'), false)
  assert.equal(kim.some((option) => option.value === 'beauty'), true)
  assert.equal(kim.some((option) => option.value === 'styling'), true)
})

test('maps existing site and category values without changing stored values', () => {
  assert.equal(blogSiteFromPost({ publishToKimLafayette: true }), 'kim')
  assert.equal(blogSiteFromPost({ publishToKimLafayette: false }), 'store')
  assert.equal(blogSiteFromPost({}), 'store')
  assert.equal(isBlogCategoryForSite('kim', 'shopping'), true)
  assert.equal(isBlogCategoryForSite('store', 'shopping'), false)
  assert.equal(blogCategoryLabel('parenting'), '親子育兒')
  assert.equal(blogCategoryLabel('legacy-value'), 'legacy-value')
})
