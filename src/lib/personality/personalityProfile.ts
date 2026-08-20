import {
  MBTI_RESULTS,
  MBTI_TYPE_LIST,
  type MBTIType,
} from '@/lib/games/mbtiResults'
import {
  MBTI_SUB_RESULTS,
  OCCASION_LIST,
  OCCASION_META,
  type OccasionMode,
} from '@/lib/games/mbtiOccasions'
import {
  MBTI_TYPE_ORDER,
  OCCASION_ORDER,
  PERSONALITY_KEYS,
  getPersonalityIndex,
  getPersonalityKey,
  normalizeGenderVariant,
  normalizePersonalityIndex,
  resolvePersonalityAvatar,
} from './personalityAvatar.mjs'

export {
  MBTI_TYPE_ORDER,
  OCCASION_ORDER,
  PERSONALITY_KEYS,
  getPersonalityIndex,
  getPersonalityKey,
  normalizeGenderVariant,
  normalizePersonalityIndex,
  resolvePersonalityAvatar,
}

export type GenderVariant = ReturnType<typeof normalizeGenderVariant>

export interface PersonalityProfile {
  index: number
  key: string
  mbtiType: MBTIType
  occasion: OccasionMode
  name: string
  baseName: string
  occasionLabel: string
  tagline: string
}

function subtypeName(tagline: string, fallback: string): string {
  const [name] = tagline.split(/[：:]/, 1)
  return name?.trim() || fallback
}

/**
 * Canonical 1..64 mapping: MBTI_TYPE_LIST order × OCCASION_LIST order.
 * Both arrays are cross-checked against the asset resolver's plain-JS order so
 * storefront/admin cannot silently drift away from the generated filenames.
 */
export const PERSONALITY_PROFILES: readonly PersonalityProfile[] = Object.freeze(
  PERSONALITY_KEYS.map((key, offset) => {
    const [rawType, rawOccasion] = key.split('-')
    const mbtiType = rawType as MBTIType
    const occasion = rawOccasion as OccasionMode
    const base = MBTI_RESULTS[mbtiType]
    const sub = MBTI_SUB_RESULTS[key]
    if (!base || !sub || !OCCASION_META[occasion]) {
      throw new Error(`Invalid canonical MBTI64 mapping at ${offset + 1}: ${key}`)
    }
    return Object.freeze({
      index: offset + 1,
      key,
      mbtiType,
      occasion,
      name: subtypeName(sub.subTagline, `${OCCASION_META[occasion].label}${base.nickname}`),
      baseName: base.nickname,
      occasionLabel: OCCASION_META[occasion].label,
      tagline: sub.subTagline,
    })
  }),
)

if (
  MBTI_TYPE_LIST.join('|') !== MBTI_TYPE_ORDER.join('|') ||
  OCCASION_LIST.join('|') !== OCCASION_ORDER.join('|')
) {
  throw new Error('MBTI64 canonical order drifted from the personality avatar resolver')
}

export function isMBTIType(value: unknown): value is MBTIType {
  return typeof value === 'string' && MBTI_TYPE_LIST.includes(value as MBTIType)
}

export function isOccasionMode(value: unknown): value is OccasionMode {
  return typeof value === 'string' && OCCASION_LIST.includes(value as OccasionMode)
}

export function getPersonalityProfileByIndex(value: unknown): PersonalityProfile | null {
  const index = normalizePersonalityIndex(value)
  return index == null ? null : PERSONALITY_PROFILES[index - 1] ?? null
}

export function resolvePersonalityProfile(input: {
  personalityIndex?: unknown
  mbtiType?: unknown
  occasion?: unknown
}): PersonalityProfile | null {
  const directIndex = normalizePersonalityIndex(input.personalityIndex)
  const compositeIndex = getPersonalityIndex(input.mbtiType, input.occasion)
  return getPersonalityProfileByIndex(directIndex ?? compositeIndex)
}
