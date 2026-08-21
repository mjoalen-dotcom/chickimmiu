import assert from 'node:assert/strict'
import test from 'node:test'

import { getMediaUrl, getVersionedMediaUrl } from './media-url.ts'

test('normalises Payload media URLs to the static media route', () => {
  assert.equal(
    getMediaUrl({ url: '/api/media/file/favicon.png' }),
    '/media/favicon.png',
  )
})

test('adds an encoded updatedAt version to mutable media relationships', () => {
  assert.equal(
    getVersionedMediaUrl({
      url: '/api/media/file/favicon.png',
      updatedAt: '2026-08-21T09:45:00.000Z',
    }),
    '/media/favicon.png?v=2026-08-21T09%3A45%3A00.000Z',
  )
})

test('uses the media id when timestamps are unavailable', () => {
  assert.equal(
    getVersionedMediaUrl({ id: 42, url: '/api/media/file/favicon.png' }),
    '/media/favicon.png?v=42',
  )
})

test('preserves existing query strings and fragments', () => {
  assert.equal(
    getVersionedMediaUrl({
      url: '/media/favicon.png?download=1#icon',
      updatedAt: 'v2',
    }),
    '/media/favicon.png?download=1&v=v2#icon',
  )
})

test('keeps plain string URLs unchanged when no media version exists', () => {
  assert.equal(getVersionedMediaUrl('/favicon.ico'), '/favicon.ico')
})
