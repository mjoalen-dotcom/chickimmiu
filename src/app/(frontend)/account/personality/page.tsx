/**
 * /account/personality — 個人專屬 MBTI64 分析頁（PR-Y）
 *
 * 顯示：
 *   1. 4 letter MBTI base type + 64 sub-personality（user 主要場合）
 *   2. 4 種場合 sub-personality 卡片（urban / vacation / party / cozy）
 *   3. 3 種模式切換（client tabs）：
 *      - 按我個性推薦：依 user.mbtiType + primaryOccasion 推商品
 *      - 平日好運穿搭：依 cozy + urban 場合（保守日常）推商品
 *      - 今天想突破自己：依「對立場合」推商品（vacation↔urban、party↔cozy）
 *
 * 未測會員：CTA 引導去 /games/mbti-style 測驗
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { MBTI_RESULTS, type MBTIType } from '@/lib/games/mbtiResults'
import {
  MBTI_SUB_RESULTS,
  OCCASION_LIST,
  OCCASION_META,
  oppositeOccasion,
  LUCKY_DAILY_OCCASIONS,
  type OccasionMode,
} from '@/lib/games/mbtiOccasions'
import PersonalityClient, {
  type ModeTabKey,
  type ProductLite,
} from './PersonalityClient'

export const metadata: Metadata = {
  title: '我的個性穿搭 | MBTI64',
  robots: { index: false, follow: false },
}

type LooseRecord = Record<string, unknown>

async function fetchProductsByCollectionTags(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collectionTags: string[],
  limit: number,
): Promise<ProductLite[]> {
  if (collectionTags.length === 0) return []
  try {
    const res = await payload.find({
      collection: 'products',
      where: {
        and: [
          { status: { equals: 'published' } },
          { collectionTags: { in: collectionTags } },
        ],
      } as Where,
      limit,
      depth: 1,
      sort: '-createdAt',
    })
    return res.docs.map((d) => normalizeProduct(d as unknown as LooseRecord))
  } catch {
    return []
  }
}

async function fetchProductsByPersonality(
  payload: Awaited<ReturnType<typeof getPayload>>,
  mbtiType: MBTIType,
  limit: number,
): Promise<ProductLite[]> {
  try {
    const res = await payload.find({
      collection: 'products',
      where: {
        and: [
          { status: { equals: 'published' } },
          { personalityTypes: { contains: mbtiType } },
        ],
      } as Where,
      limit,
      depth: 1,
      sort: '-createdAt',
    })
    return res.docs.map((d) => normalizeProduct(d as unknown as LooseRecord))
  } catch {
    return []
  }
}

function normalizeProduct(d: LooseRecord): ProductLite {
  const featured = d.featuredImage as LooseRecord | string | number | null | undefined
  let imgUrl: string | null = null
  let imgAlt: string | null = null
  if (typeof featured === 'object' && featured && 'url' in featured) {
    imgUrl = (featured.url as string) ?? null
    imgAlt = (featured.alt as string) ?? null
  } else if (Array.isArray(d.images) && d.images.length > 0) {
    const first = (d.images as LooseRecord[])[0]
    const img = (first?.image as LooseRecord | undefined) ?? undefined
    imgUrl = (img?.url as string) ?? null
    imgAlt = (img?.alt as string) ?? null
  }
  return {
    id: Number(d.id),
    slug: (d.slug as string) ?? '',
    name: (d.name as string) ?? '',
    price: typeof d.price === 'number' ? (d.price as number) : null,
    salePrice: typeof d.salePrice === 'number' ? (d.salePrice as number) : null,
    imgUrl,
    imgAlt,
  }
}

/**
 * 把多份 ProductLite[] 合併、依 id 去重、保留出現順序，最後切到 limit
 */
function mergeUnique(lists: ProductLite[][], limit: number): ProductLite[] {
  const seen = new Set<number>()
  const out: ProductLite[] = []
  for (const list of lists) {
    for (const p of list) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push(p)
      if (out.length >= limit) return out
    }
  }
  return out
}

export default async function PersonalityPage() {
  const payload = await getPayload({ config })
  const headers = await nextHeaders()
  const { user: sessionUser } = await payload.auth({ headers })
  if (!sessionUser) redirect('/login?redirect=/account/personality')

  const user = (await payload.findByID({
    collection: 'users',
    id: sessionUser.id,
    depth: 0,
    overrideAccess: true,
  })) as unknown as LooseRecord

  const mbtiProfile = (user.mbtiProfile as LooseRecord | null | undefined) ?? null
  const mbtiType = (mbtiProfile?.mbtiType as MBTIType | null | undefined) ?? null
  const primaryOccasion =
    (mbtiProfile?.primaryOccasion as OccasionMode | null | undefined) ?? null
  const occasionScores = (mbtiProfile?.occasionScores as Record<string, number> | null | undefined) ?? null

  // ── 未測會員：CTA 引導去測驗 ──
  if (!mbtiType) {
    return (
      <main className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">MBTI64 PERSONALITY</p>
          <h1 className="text-2xl font-serif">我的個性穿搭分析</h1>
        </div>
        <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/10 rounded-3xl border border-purple-500/20 p-8 md:p-12 text-center">
          <p className="text-5xl mb-4">🧠</p>
          <p className="text-lg font-serif mb-2">尚未完成個性測驗</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-md mx-auto">
            32 題詳細 MBTI64 測驗 — 16 型 × 4 場合 = 64 sub-personality，找出你的個性穿搭風格。
            測完後可在這裡讀取你的完整分析、4 種場合對應穿搭、3 種模式商品推薦切換。
          </p>
          <Link
            href="/games/mbti-style"
            className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm tracking-wide hover:opacity-95 transition-opacity"
          >
            前往測驗（消耗 50 點）
          </Link>
        </div>
      </main>
    )
  }

  const baseResult = MBTI_RESULTS[mbtiType]
  const userPrimaryOccasion: OccasionMode = primaryOccasion ?? 'urban'
  const subKey = `${mbtiType}-${userPrimaryOccasion}`
  const subResult = MBTI_SUB_RESULTS[subKey] ?? MBTI_SUB_RESULTS[`${mbtiType}-urban`]

  // ── 為 4 場合 sub-personality 各 prep 資料給 client ──
  const fourOccasions = OCCASION_LIST.map((occ) => {
    const key = `${mbtiType}-${occ}`
    return {
      occasion: occ,
      label: OCCASION_META[occ].label,
      icon: OCCASION_META[occ].icon,
      accent: OCCASION_META[occ].accent,
      description: OCCASION_META[occ].description,
      ...(MBTI_SUB_RESULTS[key] ?? MBTI_SUB_RESULTS[`${mbtiType}-urban`]),
      isPrimary: occ === userPrimaryOccasion,
    }
  })

  // ── 3 種模式商品池，server-side prefetch ──
  // 1. 按我個性 (per-personality)：mbtiType matched products + sub-personality 場合 collectionTags
  const personalityList = await fetchProductsByPersonality(payload, mbtiType, 12)
  const subTagList = await fetchProductsByCollectionTags(
    payload,
    subResult.collectionTags ?? [],
    12,
  )
  const perPersonalityProducts = mergeUnique([personalityList, subTagList], 12)

  // 2. 平日好運：cozy + urban 場合 collectionTags（穩定日常）
  const luckyTags = LUCKY_DAILY_OCCASIONS.flatMap(
    (occ) => MBTI_SUB_RESULTS[`${mbtiType}-${occ}`]?.collectionTags ?? [],
  )
  const luckyDailyProducts = await fetchProductsByCollectionTags(payload, luckyTags, 12)

  // 3. 突破自己：對立場合的 collectionTags + 對立場合的 personality content
  const opposite = oppositeOccasion(userPrimaryOccasion)
  const breakSub = MBTI_SUB_RESULTS[`${mbtiType}-${opposite}`]
  const breakProducts = await fetchProductsByCollectionTags(
    payload,
    breakSub?.collectionTags ?? [],
    12,
  )

  const productsByMode: Record<ModeTabKey, ProductLite[]> = {
    'per-personality': perPersonalityProducts,
    'lucky-daily': luckyDailyProducts,
    'break-self': breakProducts,
  }

  return (
    <PersonalityClient
      mbtiType={mbtiType}
      nickname={baseResult.nickname}
      tagline={baseResult.tagline}
      personality={baseResult.personality}
      styleAnalysis={baseResult.styleAnalysis}
      styleKeywords={baseResult.styleKeywords}
      accentColor={baseResult.accentColor}
      primaryOccasion={userPrimaryOccasion}
      primaryOccasionLabel={OCCASION_META[userPrimaryOccasion].label}
      primaryOccasionIcon={OCCASION_META[userPrimaryOccasion].icon}
      oppositeOccasion={opposite}
      oppositeOccasionLabel={OCCASION_META[opposite].label}
      oppositeOccasionIcon={OCCASION_META[opposite].icon}
      fourOccasions={fourOccasions}
      occasionScores={occasionScores}
      productsByMode={productsByMode}
    />
  )
}
