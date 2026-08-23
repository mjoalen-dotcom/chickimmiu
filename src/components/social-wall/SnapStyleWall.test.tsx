import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { SnapStyleWall } from './SnapStyleWall'

const feed = {
  source: 'kim-blog' as const,
  sourceLabel: 'Kim 部落格同步 · Meta 授權待完成',
  handle: 'kimlafayette',
  profileUrl: 'https://www.instagram.com/kimlafayette/',
  items: [
    {
      id: 'one',
      caption: '貼文一',
      mediaType: 'IMAGE' as const,
      mediaUrl: 'https://pre.chickimmiu.com/one.webp',
      permalink: 'https://blog.kimlafayette.com/blog/one/',
    },
    {
      id: 'two',
      caption: '貼文二',
      mediaType: 'VIDEO' as const,
      mediaUrl: 'https://pre.chickimmiu.com/two.webp',
      permalink: 'https://blog.kimlafayette.com/blog/two/',
    },
  ],
}

test('輸出可點擊貼文、hover 社群分享、資料來源與左右切換控制', () => {
  const html = renderToStaticMarkup(createElement(SnapStyleWall, { feed }))

  assert.match(html, /data-wall-layout="snap-compact"/)
  assert.match(html, /data-wall-source="kim-blog"/)
  assert.match(html, /Kim 部落格同步 · Meta 授權待完成/)
  assert.match(html, /href="https:\/\/www\.instagram\.com\/kimlafayette\/"/)
  assert.match(html, /href="https:\/\/blog\.kimlafayette\.com\/blog\/one\/"/)
  assert.match(html, /href="https:\/\/blog\.kimlafayette\.com\/blog\/two\/"/)
  assert.match(html, /aria-label="上一組貼文"/)
  assert.match(html, /aria-label="下一組貼文"/)
  assert.match(html, /aria-label="影片"/)
  assert.match(html, /aria-label="分享到 Facebook"/)
  assert.match(html, /aria-label="分享到 LINE"/)
  assert.match(html, /aria-label="分享到 X"/)
  assert.match(html, /aria-label="複製貼文連結"/)
  assert.doesNotMatch(html, /<button[^>]*>追蹤<\/button>/)
})

test('沒有資料時明確顯示狀態且不產生假貼文', () => {
  const html = renderToStaticMarkup(
    createElement(SnapStyleWall, {
      feed: { ...feed, source: 'unavailable', sourceLabel: '社群內容暫時無法載入', items: [] },
    }),
  )

  assert.match(html, /社群內容暫時無法載入/)
  assert.match(html, /data-wall-empty="true"/)
  assert.doesNotMatch(html, /sw-snap-wall__item/)
})

test('桌機與手機都維持緊湊八欄雙列比例並提供鍵盤分享狀態', async () => {
  const css = await readFile(
    path.join(process.cwd(), 'src/app/(social-wall)/social-wall.css'),
    'utf8',
  )

  assert.match(css, /--sw-snap-tile:\s*calc\(\(100vw - 7px\) \/ 8\)/)
  assert.match(css, /\.sw-snap-wall__track\s*\{[\s\S]*?gap:\s*1px;/)
  assert.match(css, /\.sw-snap-wall__footer\s*\{[\s\S]*?min-height:\s*41px;/)
  assert.match(css, /\.sw-snap-wall__item:focus-within \.sw-snap-wall__share/)
})
