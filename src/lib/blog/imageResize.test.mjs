import assert from 'node:assert/strict'
import test from 'node:test'

const {
  clampImageWidth,
  dimensionsForWidth,
  resizeImageFromCorner,
} = await import('./imageResize.ts')

test('clamps image width to the editor limits', () => {
  assert.equal(clampImageWidth(12, 24, 800), 24)
  assert.equal(clampImageWidth(420, 24, 800), 420)
  assert.equal(clampImageWidth(1200, 24, 800), 800)
})

test('keeps the source aspect ratio when resizing by width', () => {
  assert.deepEqual(dimensionsForWidth(320, 4 / 3, 24, 800), {
    width: 320,
    height: 240,
  })
})

test('resizes from every corner and honors vertical pointer movement', () => {
  assert.deepEqual(
    resizeImageFromCorner({
      currentX: 180,
      currentY: 160,
      handle: 'se',
      maxWidth: 800,
      startHeight: 150,
      startWidth: 200,
      startX: 100,
      startY: 100,
    }),
    { width: 280, height: 210 },
  )

  assert.deepEqual(
    resizeImageFromCorner({
      currentX: 40,
      currentY: 40,
      handle: 'nw',
      maxWidth: 800,
      startHeight: 150,
      startWidth: 200,
      startX: 100,
      startY: 100,
    }),
    { width: 280, height: 210 },
  )
})
