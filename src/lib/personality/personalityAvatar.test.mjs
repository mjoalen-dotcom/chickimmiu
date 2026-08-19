import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import {
  PERSONALITY_KEYS,
  getPersonalityIndex,
  getPersonalityKey,
  normalizeGenderVariant,
  normalizePersonalityIndex,
  resolvePersonalityAvatar,
} from './personalityAvatar.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const assetRoot = path.join(projectRoot, 'public', 'images', 'personality-avatars')
const atlasRoot = path.join(projectRoot, 'assets', 'personality-atlases')

test('canonical MBTI64 mapping is unique and has stable 1/64 boundaries', () => {
  assert.equal(PERSONALITY_KEYS.length, 64)
  assert.equal(new Set(PERSONALITY_KEYS).size, 64)
  assert.equal(PERSONALITY_KEYS[0], 'INTJ-urban')
  assert.equal(PERSONALITY_KEYS[63], 'ESFP-cozy')
  assert.equal(getPersonalityIndex('INTJ', 'urban'), 1)
  assert.equal(getPersonalityIndex('esfp', 'COZY'), 64)
  assert.equal(getPersonalityKey(1), 'INTJ-urban')
  assert.equal(getPersonalityKey('64'), 'ESFP-cozy')
  assert.equal(getPersonalityKey(0), null)
  assert.equal(getPersonalityKey(65), null)
})

test('gender normalization only chooses explicit female or male values', () => {
  for (const value of ['female', 'woman', 'F', '女', '女性', '女生']) {
    assert.equal(normalizeGenderVariant(value), 'female')
  }
  for (const value of ['male', 'man', 'M', '男', '男性', '男生']) {
    assert.equal(normalizeGenderVariant(value), 'male')
  }
  for (const value of [null, undefined, '', 'other', 'nonbinary', '未設定', 'unspecified']) {
    assert.equal(normalizeGenderVariant(value), 'neutral')
  }
})

test('asset resolver handles valid boundaries and invalid fallback without throwing', () => {
  assert.deepEqual(
    resolvePersonalityAvatar({ gender: 'female', personalityIndex: 1 }),
    {
      variant: 'female',
      personalityIndex: 1,
      personalityKey: 'INTJ-urban',
      src: '/images/personality-avatars/female/01.webp',
      isFallback: false,
    },
  )
  assert.equal(
    resolvePersonalityAvatar({ gender: 'male', personalityIndex: 64 }).src,
    '/images/personality-avatars/male/03440916-64.webp',
  )
  assert.equal(
    resolvePersonalityAvatar({ gender: 'other', mbtiType: 'INTJ', occasion: 'vacation' }).src,
    '/images/personality-avatars/neutral/02.webp',
  )

  for (const invalid of [null, undefined, '', 0, 65, -1, 1.5, 'oops']) {
    assert.equal(normalizePersonalityIndex(invalid), null)
    assert.deepEqual(resolvePersonalityAvatar({ gender: 'female', personalityIndex: invalid }), {
      variant: 'neutral',
      personalityIndex: null,
      personalityKey: null,
      src: '/images/personality-avatars/neutral/default.webp',
      isFallback: true,
    })
  }
})

test('male assets come from the dedicated male fashion atlas', async () => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(atlasRoot, 'manifest.json'), 'utf8'),
  )
  assert.equal(manifest.variants.male.source, 'male-fashion.png')
  assert.equal(
    manifest.variants.male.sourceSha256,
    '034409162066413E822F43C67C06AA98D3AA03ABEA6793A1240655BCF1E5BD60',
  )
  assert.equal(manifest.variants.male.sourceRisk, null)
})

test('all 192 generated avatars and the default are valid 384px WebP files', async () => {
  for (const variant of ['neutral', 'male', 'female']) {
    for (let index = 1; index <= 64; index += 1) {
      const filename = `${variant === 'male' ? '03440916-' : ''}${String(index).padStart(2, '0')}.webp`
      const fullPath = path.join(assetRoot, variant, filename)
      const stat = await fs.stat(fullPath)
      assert.ok(stat.size > 1_000, `${variant}/${filename} is unexpectedly small`)
      const metadata = await sharp(fullPath).metadata()
      assert.equal(metadata.format, 'webp')
      assert.equal(metadata.width, 384)
      assert.equal(metadata.height, 384)
    }
  }

  const fallback = path.join(assetRoot, 'neutral', 'default.webp')
  const fallbackMetadata = await sharp(fallback).metadata()
  assert.equal(fallbackMetadata.format, 'webp')
  assert.equal(fallbackMetadata.width, 384)
  assert.equal(fallbackMetadata.height, 384)
})
