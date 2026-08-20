/** @typedef {'neutral' | 'male' | 'female'} GenderVariant */

export const MBTI_TYPE_ORDER = Object.freeze([
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
])

export const OCCASION_ORDER = Object.freeze(['urban', 'vacation', 'party', 'cozy'])

/** The only 1..64 ordering used by storefront, admin, tests and asset filenames. */
export const PERSONALITY_KEYS = Object.freeze(
  MBTI_TYPE_ORDER.flatMap((mbtiType) =>
    OCCASION_ORDER.map((occasion) => `${mbtiType}-${occasion}`),
  ),
)

const femaleAliases = new Set(['female', 'woman', 'f', '女', '女性', '女生'])
const maleAliases = new Set(['male', 'man', 'm', '男', '男性', '男生'])
const assetFilenamePrefixByVariant = Object.freeze({
  neutral: '',
  male: '03440916-',
  female: '',
})

/**
 * Never infer gender. Only explicit male/female values choose a gendered atlas.
 * Everything else, including other/nonbinary/blank, uses the neutral atlas.
 * @param {unknown} raw
 * @returns {GenderVariant}
 */
export function normalizeGenderVariant(raw) {
  if (typeof raw !== 'string') return 'neutral'
  const normalized = raw.normalize('NFKC').trim().toLowerCase()
  if (femaleAliases.has(normalized)) return 'female'
  if (maleAliases.has(normalized)) return 'male'
  return 'neutral'
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function normalizePersonalityIndex(raw) {
  if (typeof raw === 'string' && raw.trim() !== '') raw = Number(raw.trim())
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 64) {
    return null
  }
  return raw
}

/**
 * @param {unknown} mbtiType
 * @param {unknown} occasion
 * @returns {number | null}
 */
export function getPersonalityIndex(mbtiType, occasion) {
  if (typeof mbtiType !== 'string' || typeof occasion !== 'string') return null
  const normalizedType = mbtiType.normalize('NFKC').trim().toUpperCase()
  const normalizedOccasion = occasion.normalize('NFKC').trim().toLowerCase()
  const typeIndex = MBTI_TYPE_ORDER.indexOf(normalizedType)
  const occasionIndex = OCCASION_ORDER.indexOf(normalizedOccasion)
  if (typeIndex < 0 || occasionIndex < 0) return null
  return typeIndex * OCCASION_ORDER.length + occasionIndex + 1
}

/**
 * @param {unknown} rawIndex
 * @returns {string | null}
 */
export function getPersonalityKey(rawIndex) {
  const index = normalizePersonalityIndex(rawIndex)
  return index == null ? null : PERSONALITY_KEYS[index - 1] ?? null
}

/**
 * @param {{ gender?: unknown, personalityIndex?: unknown, mbtiType?: unknown, occasion?: unknown }} input
 * @returns {{
 *   variant: GenderVariant,
 *   personalityIndex: number | null,
 *   personalityKey: string | null,
 *   src: string,
 *   isFallback: boolean,
 * }}
 */
export function resolvePersonalityAvatar(input = {}) {
  const directIndex = normalizePersonalityIndex(input.personalityIndex)
  const compositeIndex = getPersonalityIndex(input.mbtiType, input.occasion)
  const personalityIndex = directIndex ?? compositeIndex

  if (personalityIndex == null) {
    return {
      variant: 'neutral',
      personalityIndex: null,
      personalityKey: null,
      src: '/images/personality-avatars/neutral/default.webp',
      isFallback: true,
    }
  }

  const variant = normalizeGenderVariant(input.gender)
  const filenamePrefix = assetFilenamePrefixByVariant[variant]
  return {
    variant,
    personalityIndex,
    personalityKey: PERSONALITY_KEYS[personalityIndex - 1] ?? null,
    src: `/images/personality-avatars/${variant}/${filenamePrefix}${String(personalityIndex).padStart(2, '0')}.webp`,
    isFallback: false,
  }
}
