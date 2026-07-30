import assert from 'node:assert/strict'
import test from 'node:test'

const {
  buildBlogDraftRequest,
  validateBlogDraftTopic,
} = await import('./aiDraft.ts')

test('accepts short KPOP group names while keeping the fashion topic minimum', () => {
  assert.deepEqual(
    validateBlogDraftTopic({
      topic: 'IVE',
      templateKey: 'kpop-girl-group',
    }),
    { valid: true, minLength: 2 },
  )
  assert.equal(
    validateBlogDraftTopic({
      topic: 'XG',
      templateKey: 'kpop-girl-group',
    }).valid,
    true,
  )
  assert.deepEqual(
    validateBlogDraftTopic({ topic: '秋冬', templateKey: 'fashion' }),
    { valid: false, minLength: 4 },
  )
})

test('builds a source-grounded girl-group prompt without the celebrity-name ban', () => {
  const request = buildBlogDraftRequest({
    topic: 'IVE 完整介紹',
    templateKey: 'kpop-girl-group',
    category: 'kpop-girl-groups',
    wordCountTarget: 1400,
    sourceUrls: ['https://zh.wikipedia.org/wiki/IVE'],
    researchContext: 'IVE 是韓國女子音樂團體。成員資料以來源頁為準。',
  })

  assert.match(request.systemPrompt, /KPOP 女團介紹/)
  assert.match(request.systemPrompt, /成員介紹/)
  assert.match(request.systemPrompt, /成長歷程/)
  assert.match(request.systemPrompt, /寶貝們/)
  assert.doesNotMatch(request.systemPrompt, /絕不寫具體藝人\s*\/\s*名人姓名/)
  assert.match(request.userPrompt, /https:\/\/zh\.wikipedia\.org\/wiki\/IVE/)
  assert.match(request.userPrompt, /IVE 是韓國女子音樂團體/)
  assert.match(request.userPrompt, /無法由來源確認/)
})

test('builds the matching boy-group category prompt', () => {
  const request = buildBlogDraftRequest({
    topic: 'SEVENTEEN 成員與成長故事',
    templateKey: 'kpop-boy-group',
    category: 'kpop-boy-groups',
  })

  assert.match(request.systemPrompt, /KPOP 男團介紹/)
  assert.match(request.userPrompt, /SEVENTEEN/)
})

test('keeps the original CKMU fashion writing mode', () => {
  const request = buildBlogDraftRequest({
    topic: '秋季針織疊穿',
    templateKey: 'fashion',
    category: 'styling',
    season: 'autumn',
  })

  assert.match(request.systemPrompt, /CHIC KIM & MIU/)
  assert.match(request.userPrompt, /秋季/)
})
