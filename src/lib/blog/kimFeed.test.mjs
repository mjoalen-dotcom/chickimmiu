import assert from 'node:assert/strict'
import test from 'node:test'

const {
  collectKimBlogGallery,
  collectKimBlogImages,
  kimBlogSeo,
  kimBlogSourceUrl,
  serializeLexicalForKimBlog,
} = await import('./kimFeed.ts')

const content = {
  root: {
    type: 'root',
    children: [
      {
        type: 'heading',
        tag: 'h2',
        format: 'center',
        children: [{ type: 'text', text: '穿搭 <重點>', format: 1 }],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '查看 ' },
          {
            type: 'link',
            fields: { url: 'javascript:alert(1)' },
            children: [{ type: 'text', text: '不安全連結' }],
          },
        ],
      },
      {
        type: 'upload',
        value: {
          url: '/api/media/file/look.webp',
          alt: 'Look "A"',
          mimeType: 'image/webp',
          width: 1200,
          height: 1600,
          filesize: 12345,
        },
      },
    ],
  },
}

test('serializes supported Lexical nodes while preserving Payload media URLs', () => {
  const html = serializeLexicalForKimBlog(content, 'https://pre.chickimmiu.com')
  assert.match(
    html,
    /<h2 style="text-align:center"><strong>穿搭 &lt;重點&gt;<\/strong><\/h2>/,
  )
  assert.match(html, /查看 不安全連結/)
  assert.doesNotMatch(html, /javascript:/)
  assert.match(
    html,
    /src="https:\/\/pre\.chickimmiu\.com\/api\/media\/file\/look\.webp"/,
  )
})

test('collects normalized image metadata without duplicates', () => {
  const images = collectKimBlogImages(content, 'https://pre.chickimmiu.com')
  assert.equal(images.length, 1)
  assert.equal(images[0].width, 1200)
  assert.equal(images[0].bytes, 12345)
})

test('serializes resizable article images and emoticon blocks', () => {
  const resizableContent = {
    root: {
      type: 'root',
      children: [
        {
          type: 'upload',
          fields: {
            displayWidth: 320,
            displayAlignment: 'right',
          },
          value: {
            url: '/api/media/file/article-image.webp',
            alt: 'Article image',
            mimeType: 'image/webp',
            width: 1200,
            height: 800,
          },
        },
        {
          type: 'block',
          fields: {
            blockType: 'emoticon',
            displayWidth: 96,
            displayAlignment: 'center',
            image: {
              url: '/api/media/file/kim-emoticon-117824267-001.png',
              alt: '金老佛爺表情圖案 01',
              mimeType: 'image/png',
              width: 200,
              height: 133,
              filesize: 4321,
            },
          },
        },
      ],
    },
  }

  const html = serializeLexicalForKimBlog(
    resizableContent,
    'https://pre.chickimmiu.com',
  )
  assert.match(
    html,
    /class="kim-blog-media kim-blog-media--right" style="--kim-media-width:320px"/,
  )
  assert.match(
    html,
    /class="kim-blog-emoticon kim-blog-emoticon--center" style="--kim-media-width:96px"/,
  )

  const images = collectKimBlogImages(
    resizableContent,
    'https://pre.chickimmiu.com',
  )
  assert.equal(images.length, 2)
  assert.equal(
    images[1].src,
    'https://pre.chickimmiu.com/api/media/file/kim-emoticon-117824267-001.png',
  )
  assert.equal(images[1].bytes, 4321)
})

test('collects a PIXNET-style gallery and ignores videos', () => {
  const images = collectKimBlogGallery(
    [
      {
        url: '/media/gallery-1.jpg',
        alt: 'Gallery one',
        mimeType: 'image/jpeg',
        width: 1200,
        height: 800,
      },
      {
        url: '/media/gallery-1.jpg',
        alt: 'Duplicate',
        mimeType: 'image/jpeg',
      },
      {
        url: '/media/video.mp4',
        mimeType: 'video/mp4',
      },
    ],
    'https://pre.chickimmiu.com',
  )

  assert.deepEqual(images, [
    {
      sourceUrl: 'https://pre.chickimmiu.com/media/gallery-1.jpg',
      alt: 'Gallery one',
      src: 'https://pre.chickimmiu.com/media/gallery-1.jpg',
      mobileSrc: null,
      srcSet: 'https://pre.chickimmiu.com/media/gallery-1.jpg',
      width: 1200,
      height: 800,
      bytes: 0,
    },
  ])
})

test('rejects unsafe source URLs and falls back to the canonical blog URL', () => {
  assert.equal(
    kimBlogSourceUrl('javascript:alert(1)', 'article-1'),
    'https://blog.kimlafayette.com/blog/article-1/',
  )
})

test('serializes blog SEO and resolves the Payload OG image URL', () => {
  assert.deepEqual(
    kimBlogSeo(
      {
        metaTitle: 'ME30 珍珠選購指南｜金老佛爺',
        metaDescription: '整理珍珠尺寸、日常穿搭與選購方式。',
        metaImage: { url: '/api/media/file/me30-cover.webp' },
      },
      'https://pre.chickimmiu.com',
    ),
    {
      metaTitle: 'ME30 珍珠選購指南｜金老佛爺',
      metaDescription: '整理珍珠尺寸、日常穿搭與選購方式。',
      metaImage:
        'https://pre.chickimmiu.com/api/media/file/me30-cover.webp',
    },
  )
  assert.equal(kimBlogSeo({}, 'https://pre.chickimmiu.com'), null)
})

test('uses the forced 800/1000 blog variants and renders a source credit', () => {
  const responsiveContent = {
    root: {
      type: 'root',
      children: [
        {
          type: 'upload',
          fields: {
            displayWidth: 1000,
            displayAlignment: 'center',
          },
          value: {
            url: '/api/media/file/group-original.jpg',
            alt: 'KPOP group',
            mimeType: 'image/jpeg',
            width: 2000,
            height: 1333,
            sizes: {
              blog800: {
                url: '/api/media/file/group-800.webp',
                width: 800,
                height: 533,
                filesize: 80000,
              },
              blog1000: {
                url: '/api/media/file/group-1000.webp',
                width: 1000,
                height: 667,
                filesize: 110000,
              },
            },
            usageRights: {
              creator: 'Example Photographer',
              sourceLabel: 'Wikimedia Commons',
              sourceUrl: 'https://commons.wikimedia.org/wiki/File:Group.jpg',
              licenseKind: 'cc-by',
              licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
            },
          },
        },
      ],
    },
  }

  const html = serializeLexicalForKimBlog(
    responsiveContent,
    'https://pre.chickimmiu.com',
  )
  assert.match(
    html,
    /src="https:\/\/pre\.chickimmiu\.com\/api\/media\/file\/group-1000\.webp"/,
  )
  assert.match(html, /group-800\.webp 800w/)
  assert.match(html, /group-1000\.webp 1000w/)
  assert.match(html, /Example Photographer/)
  assert.match(html, /Wikimedia Commons/)
  assert.match(
    html,
    /href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/,
  )

  const images = collectKimBlogImages(
    responsiveContent,
    'https://pre.chickimmiu.com',
  )
  assert.equal(
    images[0].src,
    'https://pre.chickimmiu.com/api/media/file/group-1000.webp',
  )
  assert.equal(
    images[0].mobileSrc,
    'https://pre.chickimmiu.com/api/media/file/group-800.webp',
  )
  assert.match(images[0].srcSet, /800w/)
  assert.match(images[0].srcSet, /1000w/)
})
