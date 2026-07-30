import assert from 'node:assert/strict'
import test from 'node:test'

const {
  articleImageWidth,
  buildImageCreditText,
  decorateLexicalWithStudioImages,
  evaluateImageRights,
  getArticleStudioTemplate,
  validateArticleImageVariant,
  validateStudioPublishability,
} = await import('./articleStudio.ts')

test('maps article image roles to the only two public widths', () => {
  assert.equal(articleImageWidth('hero'), 1000)
  assert.equal(articleImageWidth('story'), 1000)
  assert.equal(articleImageWidth('member'), 800)
  assert.equal(articleImageWidth('inline'), 800)
})

test('requires the actual generated media variant to match its forced width', () => {
  assert.deepEqual(
    validateArticleImageVariant('hero', {
      sizes: { blog1000: { width: 1000 } },
    }),
    { valid: true, expectedWidth: 1000 },
  )
  assert.deepEqual(
    validateArticleImageVariant('member', {
      sizes: { blog800: { width: 800 } },
    }),
    { valid: true, expectedWidth: 800 },
  )

  const tooSmall = validateArticleImageVariant('story', {
    sizes: { blog1000: { width: 760 } },
  })
  assert.equal(tooSmall.valid, false)
  assert.equal(tooSmall.expectedWidth, 1000)
  assert.equal(tooSmall.actualWidth, 760)

  assert.equal(validateArticleImageVariant('inline', {}).valid, false)
})

test('only auto-approves rights that explicitly permit this use', () => {
  assert.deepEqual(
    evaluateImageRights({
      licenseKind: 'cc-by',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    }),
    {
      allowed: true,
      requiresReview: false,
      reason: '授權條件完整，可用於文章。',
    },
  )

  assert.equal(
    evaluateImageRights({
      licenseKind: 'official-promo',
      evidenceUrl: 'https://agency.example/press/terms',
      promotionalUseAllowed: true,
      sourceUrl: 'https://agency.example/press/photo',
    }).allowed,
    true,
  )

  const nonCommercial = evaluateImageRights({
    licenseKind: 'cc-by-nc',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
  })
  assert.equal(nonCommercial.allowed, false)
  assert.equal(nonCommercial.requiresReview, true)

  const unknown = evaluateImageRights({
    licenseKind: 'unknown',
    sourceUrl: 'https://images.example/photo.jpg',
  })
  assert.equal(unknown.allowed, false)
  assert.equal(unknown.requiresReview, true)
})

test('builds a visible credit with creator, source and license', () => {
  const credit = buildImageCreditText({
    creator: 'Example Photographer',
    licenseKind: 'cc-by-sa',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceLabel: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
  })

  assert.match(credit, /Example Photographer/)
  assert.match(credit, /Wikimedia Commons/)
  assert.match(credit, /CC BY-SA/)
})

test('decorates a KPOP draft with a 1000px hero and 800px member image', () => {
  const lexical = {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: '寶貝們，今天認識這個團體。' }],
        },
        {
          type: 'heading',
          version: 1,
          tag: 'h3',
          children: [{ type: 'text', version: 1, text: '張員瑛 Wonyoung' }],
        },
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: '成員成長背景。' }],
        },
        {
          type: 'heading',
          version: 1,
          tag: 'h2',
          children: [{ type: 'text', version: 1, text: '成長歷程' }],
        },
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: '團體重要里程碑。' }],
        },
      ],
    },
  }
  const images = [
    {
      mediaId: 101,
      role: 'hero',
      alt: 'IVE 團體照',
      creator: 'Agency',
      licenseKind: 'official-promo',
      promotionalUseAllowed: true,
      evidenceUrl: 'https://agency.example/press/terms',
      sourceLabel: 'Official press kit',
      sourceUrl: 'https://agency.example/press/ive',
    },
    {
      mediaId: 102,
      role: 'member',
      personName: '張員瑛',
      alt: '張員瑛成員照',
      creator: 'Example Photographer',
      licenseKind: 'cc-by',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceLabel: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wonyoung.jpg',
    },
    {
      mediaId: 103,
      role: 'story',
      alt: 'IVE 成長歷程',
      licenseKind: 'cc0',
      sourceLabel: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:IVE-story.jpg',
    },
  ]

  const decorated = decorateLexicalWithStudioImages(lexical, images, {
    takedownEmail: 'service@chickimmiu.com',
  })
  const children = decorated.root.children
  const uploads = children.filter((node) => node.type === 'upload')

  assert.equal(uploads.length, 3)
  assert.equal(uploads[0].value, 101)
  assert.equal(uploads[0].fields.displayWidth, 1000)
  assert.equal(uploads[1].value, 102)
  assert.equal(uploads[1].fields.displayWidth, 800)
  assert.equal(uploads[2].value, 103)
  assert.equal(uploads[2].fields.displayWidth, 1000)

  const memberHeadingIndex = children.findIndex(
    (node) => node.type === 'heading' && node.children?.[0]?.text.includes('張員瑛'),
  )
  assert.equal(children[memberHeadingIndex + 1].type, 'upload')
  const storyHeadingIndex = children.findIndex(
    (node) => node.type === 'heading' && node.children?.[0]?.text === '成長歷程',
  )
  assert.equal(children[storyHeadingIndex + 1].type, 'upload')
  assert.equal(children[storyHeadingIndex + 1].value, 103)

  const allText = JSON.stringify(decorated)
  assert.match(allText, /service@chickimmiu\.com/)
  assert.match(allText, /圖片來源/)
})

test('provides category-bound KPOP templates', () => {
  const boyGroup = getArticleStudioTemplate('kpop-boy-group')
  const girlGroup = getArticleStudioTemplate('kpop-girl-group')

  assert.equal(boyGroup.category, 'kpop-boy-groups')
  assert.equal(girlGroup.category, 'kpop-girl-groups')
  assert.ok(boyGroup.requiredSections.includes('成員介紹'))
  assert.ok(girlGroup.requiredSections.includes('成長歷程'))
  assert.match(girlGroup.voiceGuide, /寶貝們/)
})

test('allows unknown-rights images in drafts but blocks publish readiness', () => {
  const images = [
    {
      mediaId: 101,
      role: 'hero',
      licenseKind: 'unknown',
      sourceUrl: 'https://images.example/photo.jpg',
    },
  ]

  assert.equal(validateStudioPublishability(images, { forPublish: false }).valid, true)
  const publish = validateStudioPublishability(images, { forPublish: true })
  assert.equal(publish.valid, false)
  assert.match(publish.errors[0], /授權/)
})
