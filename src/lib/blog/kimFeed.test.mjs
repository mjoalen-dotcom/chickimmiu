import assert from 'node:assert/strict'
import test from 'node:test'

const {
  collectKimBlogGallery,
  collectKimBlogImages,
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
        children: [{ type: 'text', text: '穿搭 <重點>', format: 1 }],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: '查看 ' },
          {
            type: 'link',
            url: 'javascript:alert(1)',
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

test('serializes supported Lexical nodes while escaping text and unsafe URLs', () => {
  const html = serializeLexicalForKimBlog(content, 'https://pre.chickimmiu.com')
  assert.match(html, /<h2><strong>穿搭 &lt;重點&gt;<\/strong><\/h2>/)
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
