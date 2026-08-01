import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

export const BLOG_POST_VISIBILITIES = ['public', 'unlisted', 'password'] as const
export type BlogPostVisibility = (typeof BLOG_POST_VISIBILITIES)[number]

const PASSWORD_DIGEST = 'sha256'
const PASSWORD_ITERATIONS = 210_000
const PASSWORD_KEY_LENGTH = 32
const PASSWORD_PREFIX = 'pbkdf2_sha256'

export function isBlogPostVisibility(value: unknown): value is BlogPostVisibility {
  return BLOG_POST_VISIBILITIES.includes(value as BlogPostVisibility)
}

export function isBlogPostPasswordHash(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^pbkdf2_sha256\$\d{6,7}\$[a-f0-9]{32}\$[a-f0-9]{64}$/i.test(value)
  ) {
    return false
  }
  const iterations = Number(value.split('$')[1])
  return iterations >= 100_000 && iterations <= 1_000_000
}

export function hashBlogPostPassword(password: string): string {
  if (password.length < 6 || password.length > 128) {
    throw new Error('文章密碼需為 6 至 128 個字元。')
  }
  const salt = randomBytes(16)
  const digest = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST,
  )
  return [
    PASSWORD_PREFIX,
    String(PASSWORD_ITERATIONS),
    salt.toString('hex'),
    digest.toString('hex'),
  ].join('$')
}

export function verifyBlogPostPassword(password: string, encoded: string): boolean {
  if (!isBlogPostPasswordHash(encoded)) return false
  const [, iterationsText, saltHex, digestHex] = encoded.split('$')
  const expected = Buffer.from(digestHex, 'hex')
  const actual = pbkdf2Sync(
    password,
    Buffer.from(saltHex, 'hex'),
    Number(iterationsText),
    expected.length,
    PASSWORD_DIGEST,
  )
  return timingSafeEqual(actual, expected)
}
