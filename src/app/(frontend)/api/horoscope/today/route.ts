import { headers as nextHeaders } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getSeedHoroscope } from '@/lib/horoscope/seed'
import { generateViaGroq } from '@/lib/horoscope/groq'
import type { HoroscopeContent } from '@/lib/horoscope/types'
import { normalizeMediaUrl } from '@/lib/media-url'
import {
  getZodiacFromBirthday,
  normalizeGender,
  todayInTaipei,
  ZODIAC_LABELS,
  type HoroscopeGender,
  type ZodiacSign,
} from '@/lib/horoscope/zodiac'

/**
 * GET /api/horoscope/today
 * ───────────────────────
 * 回傳今日（Asia/Taipei）運勢 + 站內商品推薦。
 *
 * Auth：Payload session cookie（同 /account 入口）
 *
 * 流程：
 *   1. 取 user.birthday + user.gender → 推 zodiacSign（無生日 → 回 needsBirthday）
 *   2. 查 daily_horoscopes (sign, date, gender) → cache hit 直接回
 *   3. cache miss：呼 Groq（若 HOROSCOPE_LLM_PROVIDER=groq 且有 key）或 seed fallback，寫回快取
 *   4. 用 styleKeywords ∩ Products.collectionTags 撈 3 件商品；不足用最新已上架補
 *
 * 失敗政策：
 *   - LLM throw → 自動 fallback 到 seed（不讓 user 看到空白）
 *   - DB 寫入失敗 → 仍回應運勢內容（純讀邏輯，不阻塞 UI）
 */

export const dynamic = 'force-dynamic'

interface ApiResponse {
  needsBirthday?: boolean
  sign?: ZodiacSign
  signLabel?: string
  signEmoji?: string
  gender?: HoroscopeGender
  date?: string
  workFortune?: string
  relationshipFortune?: string
  moneyFortune?: string
  cautionFortune?: string
  outfitAdvice?: string
  luckyColors?: string[]
  styleKeywords?: string[]
  generatedBy?: string
  products?: Array<{
    id: string | number
    name: string
    slug: string
    price: number
    salePrice: number | null
    imageUrl: string | null
  }>
}

function parseList(raw: unknown): string[] {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function GET(): Promise<NextResponse<ApiResponse | { error: string }>> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userDoc = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
  })) as unknown as Record<string, unknown>

  const birthday = (userDoc.birthday as string | null | undefined) ?? null
  const sign = getZodiacFromBirthday(birthday)
  if (!sign) {
    return NextResponse.json({ needsBirthday: true })
  }
  const gender = normalizeGender(userDoc.gender)
  const birthTime = (userDoc.birthTime as string | null | undefined) ?? null
  const date = todayInTaipei()

  // 1. Cache hit?
  const cached = await payload.find({
    collection: 'daily-horoscopes',
    where: {
      and: [
        { zodiacSign: { equals: sign } },
        { date: { equals: date } },
        { gender: { equals: gender } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let entry = cached.docs[0] as unknown as Record<string, unknown> | undefined

  if (!entry) {
    // 2. Generate
    const wantsLLM = process.env.HOROSCOPE_LLM_PROVIDER === 'groq'
    let content: HoroscopeContent
    let generatedBy: 'seed' | 'groq' = 'seed'
    if (wantsLLM) {
      try {
        content = await generateViaGroq({ sign, gender, date, birthTime })
        generatedBy = 'groq'
      } catch (err) {
        // Graceful degradation — never let LLM failure black out the UI
        // eslint-disable-next-line no-console
        console.warn('[horoscope] Groq failed, falling back to seed:', err)
        content = getSeedHoroscope({ sign, gender, date })
      }
    } else {
      content = getSeedHoroscope({ sign, gender, date })
    }

    try {
      const created = await payload.create({
        collection: 'daily-horoscopes',
        overrideAccess: true,
        data: {
          zodiacSign: sign,
          date,
          gender,
          workFortune: content.workFortune,
          relationshipFortune: content.relationshipFortune,
          moneyFortune: content.moneyFortune,
          cautionFortune: content.cautionFortune,
          outfitAdvice: content.outfitAdvice,
          luckyColors: content.luckyColors.join(','),
          styleKeywords: content.styleKeywords.join(','),
          generatedBy,
        },
      })
      entry = created as unknown as Record<string, unknown>
    } catch (err) {
      // DB write failure — still serve fortune; another request will retry write
      // eslint-disable-next-line no-console
      console.warn('[horoscope] cache write failed:', err)
      entry = {
        zodiacSign: sign,
        date,
        gender,
        workFortune: content.workFortune,
        relationshipFortune: content.relationshipFortune,
        moneyFortune: content.moneyFortune,
        cautionFortune: content.cautionFortune,
        outfitAdvice: content.outfitAdvice,
        luckyColors: content.luckyColors.join(','),
        styleKeywords: content.styleKeywords.join(','),
        generatedBy,
      }
    }
  }

  const styleKeywords = parseList(entry?.styleKeywords)
  const luckyColors = parseList(entry?.luckyColors)

  // 3. Match products by collectionTags
  const products = await matchProducts(payload, styleKeywords)

  return NextResponse.json({
    sign,
    signLabel: ZODIAC_LABELS[sign].zh,
    signEmoji: ZODIAC_LABELS[sign].emoji,
    gender,
    date,
    workFortune: String(entry?.workFortune ?? ''),
    relationshipFortune: String(entry?.relationshipFortune ?? ''),
    moneyFortune: String(entry?.moneyFortune ?? ''),
    cautionFortune: String(entry?.cautionFortune ?? ''),
    outfitAdvice: String(entry?.outfitAdvice ?? ''),
    luckyColors,
    styleKeywords,
    generatedBy: String(entry?.generatedBy ?? 'seed'),
    products,
  })
}

interface MatchedProduct {
  id: string | number
  name: string
  slug: string
  price: number
  salePrice: number | null
  imageUrl: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function matchProducts(payload: any, styleKeywords: string[]): Promise<MatchedProduct[]> {
  const want = 3

  // Try by collectionTags
  if (styleKeywords.length > 0) {
    try {
      const result = await payload.find({
        collection: 'products',
        where: {
          and: [
            { status: { equals: 'published' } },
            { collectionTags: { in: styleKeywords } },
          ],
        },
        limit: want,
        depth: 2,
        overrideAccess: true,
      })
      const matched = result.docs.map(toMatchedProduct)
      if (matched.length >= want) return matched
      // Top up with latest published
      const ids = new Set(matched.map((m: MatchedProduct) => m.id))
      const fillResult = await payload.find({
        collection: 'products',
        where: {
          and: [{ status: { equals: 'published' } }, { id: { not_in: Array.from(ids) } }],
        },
        sort: '-createdAt',
        limit: want - matched.length,
        depth: 2,
        overrideAccess: true,
      })
      const filled: MatchedProduct[] = [...matched, ...fillResult.docs.map(toMatchedProduct)]
      return filled.slice(0, want)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[horoscope] product match failed:', err)
    }
  }

  // Pure fallback
  const fallback = await payload.find({
    collection: 'products',
    where: { status: { equals: 'published' } },
    sort: '-createdAt',
    limit: want,
    depth: 1,
    overrideAccess: true,
  })
  return fallback.docs.map(toMatchedProduct)
}

function toMatchedProduct(p: unknown): MatchedProduct {
  const r = p as Record<string, unknown>
  // Mirror /products listing: prefer images[0].image, fall back to featuredImage.
  // Most CKMU products only populate `images` (admin description even says
  // featuredImage falls back to first gallery image). Run through normalizeMediaUrl
  // to rewrite /api/media/file/* → /media/* (CF Tunnel can't proxy Payload binaries).
  const images = r.images as Array<{ image?: { url?: string } }> | undefined
  const firstGalleryUrl = images?.[0]?.image?.url
  const featured = r.featuredImage as { url?: string } | null | undefined
  const rawUrl = firstGalleryUrl ?? featured?.url ?? null
  return {
    id: r.id as string | number,
    name: String(r.name ?? '—'),
    slug: String(r.slug ?? ''),
    price: Number(r.price ?? 0),
    salePrice: r.salePrice == null ? null : Number(r.salePrice),
    imageUrl: normalizeMediaUrl(rawUrl) ?? null,
  }
}
