/**
 * Smoke: 模擬 /account/personality server component 的 data prep
 *
 * 跑法：pnpm payload run src/seed/smokePersonalityPage.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import type { Where } from 'payload'

import { MBTI_RESULTS, type MBTIType } from '../lib/games/mbtiResults'
import {
  MBTI_SUB_RESULTS,
  OCCASION_LIST,
  OCCASION_META,
  oppositeOccasion,
  LUCKY_DAILY_OCCASIONS,
  type OccasionMode,
} from '../lib/games/mbtiOccasions'

type LooseRecord = Record<string, unknown>

async function main() {
  const payload = await getPayload({ config })

  // 找 mbti_profile_mbti_type 設好的那個 user
  const found = await payload.find({
    collection: 'users',
    where: { 'mbtiProfile.mbtiType': { exists: true } } as Where,
    limit: 1,
    overrideAccess: true,
  })
  if (found.docs.length === 0) {
    console.error('找不到 mbtiProfile.mbtiType 已設定的使用者')
    process.exit(1)
  }
  const user = found.docs[0] as unknown as LooseRecord
  const mbtiProfile = (user.mbtiProfile as LooseRecord | null | undefined) ?? null
  const mbtiType = mbtiProfile?.mbtiType as MBTIType
  const primaryOccasion = (mbtiProfile?.primaryOccasion as OccasionMode | null) ?? null

  console.log(`user: ${user.email}, mbtiType: ${mbtiType}, primaryOccasion: ${primaryOccasion}`)

  // 模擬 server component 的資料準備
  const baseResult = MBTI_RESULTS[mbtiType]
  const userOcc: OccasionMode = primaryOccasion ?? 'urban'
  const subKey = `${mbtiType}-${userOcc}`
  const subResult = MBTI_SUB_RESULTS[subKey]

  console.log(`\nbase 結果：${baseResult.nickname} - ${baseResult.tagline}`)
  console.log(`sub 結果（${subKey}）：${subResult.subTagline}`)

  console.log('\n4 場合 sub-personality：')
  for (const occ of OCCASION_LIST) {
    const k = `${mbtiType}-${occ}`
    const s = MBTI_SUB_RESULTS[k]
    console.log(`  ${OCCASION_META[occ].icon} ${OCCASION_META[occ].label}場合：${s.subTagline}`)
  }

  // 推薦商品 — per-personality
  const personalityList = await payload.find({
    collection: 'products',
    where: {
      and: [
        { status: { equals: 'published' } },
        { personalityTypes: { contains: mbtiType } },
      ],
    } as Where,
    limit: 12,
    depth: 1,
    sort: '-createdAt',
  })
  console.log(`\n按個性推薦：${personalityList.docs.length} 筆`)

  // 推薦商品 — 按 sub-result.collectionTags
  const subList =
    subResult.collectionTags.length > 0
      ? await payload.find({
          collection: 'products',
          where: {
            and: [
              { status: { equals: 'published' } },
              { collectionTags: { in: subResult.collectionTags } },
            ],
          } as Where,
          limit: 12,
          depth: 1,
        })
      : { docs: [] }
  console.log(`按 sub collectionTags 推薦：${subList.docs.length} 筆`)

  // 平日好運：cozy + urban
  const luckyTags = LUCKY_DAILY_OCCASIONS.flatMap(
    (o) => MBTI_SUB_RESULTS[`${mbtiType}-${o}`]?.collectionTags ?? [],
  )
  const luckyList =
    luckyTags.length > 0
      ? await payload.find({
          collection: 'products',
          where: {
            and: [
              { status: { equals: 'published' } },
              { collectionTags: { in: luckyTags } },
            ],
          } as Where,
          limit: 12,
        })
      : { docs: [] }
  console.log(`平日好運推薦：${luckyList.docs.length} 筆，使用 tags=[${luckyTags.join(', ')}]`)

  // 突破自己：對立場合
  const opp = oppositeOccasion(userOcc)
  const breakSub = MBTI_SUB_RESULTS[`${mbtiType}-${opp}`]
  const breakList =
    breakSub.collectionTags.length > 0
      ? await payload.find({
          collection: 'products',
          where: {
            and: [
              { status: { equals: 'published' } },
              { collectionTags: { in: breakSub.collectionTags } },
            ],
          } as Where,
          limit: 12,
        })
      : { docs: [] }
  console.log(`突破自己（${OCCASION_META[opp].label}）推薦：${breakList.docs.length} 筆`)

  console.log('\n──────── PASS ────────')
  process.exit(0)
}

await main()
