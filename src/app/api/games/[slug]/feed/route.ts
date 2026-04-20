import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

import { isSocialGameType } from '@/lib/games/socialGameActions'

/**
 * GET /api/games/[slug]/feed?limit=20&offset=0
 *
 * 回傳指定 social game 的作品 feed（最新投稿在前），並標註登入者是否已對每份作品按過 like。
 *
 * 權限：需登入（走 Payload access `isAdminOrAuthor`，可讀 submitted/approved/winner 狀態的作品）。
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       items: Array<{
 *         id, caption, voteCount, createdAt,
 *         playerDisplayName,  // 遮罩過的稱呼，例：「小*」
 *         images: Array<{ url, thumbnailUrl, alt }>,
 *         myLiked: boolean,   // 目前登入者是否已 like 過
 *       }>,
 *       hasMore: boolean,
 *       total: number,
 *     }
 *   }
 */

const MAX_LIMIT = 40
const DEFAULT_LIMIT = 12

function maskName(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '會員'
  // 中英文通用：保第一字 + '*'
  const arr = Array.from(raw)
  return arr.length === 1 ? `${arr[0]}*` : `${arr[0]}*`
}

function pickDisplayName(userObj: Record<string, unknown> | undefined): string {
  if (!userObj) return '會員'
  return (
    maskName(userObj.name) ||
    maskName(userObj.firstName) ||
    maskName(userObj.email)
  )
}

interface MediaDoc {
  id: number | string
  url?: string | null
  alt?: string | null
  sizes?: Record<string, { url?: string | null } | null | undefined> | null
}

function resolveMediaUrl(m: MediaDoc | null | undefined, size: 'thumbnail' | 'card' = 'card'): string | null {
  if (!m) return null
  const sized = m.sizes?.[size]?.url
  return sized || m.url || null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    if (!isSocialGameType(slug)) {
      return NextResponse.json(
        { success: false, error: `Invalid game slug: ${slug}` },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const url = new URL(req.url)
    const limitRaw = Number(url.searchParams.get('limit')) || DEFAULT_LIMIT
    const offsetRaw = Number(url.searchParams.get('offset')) || 0
    const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    const offset = Math.max(0, offsetRaw)
    const page = Math.floor(offset / limit) + 1

    const where: Where = {
      and: [
        { gameType: { equals: slug } },
        { status: { in: ['submitted', 'approved', 'winner'] } },
      ],
    }

    const res = await payload.find({
      collection: 'style-submissions',
      where,
      limit,
      page,
      sort: '-createdAt',
      depth: 1, // populate player + images[].image
    })

    const docs = res.docs as unknown as Array<Record<string, unknown>>

    // Bulk query: 登入者對這批 submissions 的 like vote
    const submissionIds = docs.map((d) => d.id as number | string)
    let likedSet = new Set<string>()
    if (submissionIds.length > 0) {
      try {
        const voteRes = await payload.find({
          collection: 'style-votes',
          where: {
            and: [
              { voter: { equals: user.id } },
              { submission: { in: submissionIds } },
              { voteType: { equals: 'like' } },
            ],
          } as Where,
          limit: submissionIds.length,
          depth: 0,
        })
        likedSet = new Set(
          (voteRes.docs as unknown as Array<Record<string, unknown>>).map((v) => {
            const sub = v.submission
            const subId =
              typeof sub === 'object' && sub
                ? (sub as Record<string, unknown>).id
                : sub
            return String(subId)
          }),
        )
      } catch {
        // 讀不到 myLiked 不擋 feed
      }
    }

    const items = docs.map((d) => {
      const playerObj = d.player as Record<string, unknown> | undefined
      const imagesArr = (d.images as Array<Record<string, unknown>> | undefined) ?? []
      const images = imagesArr
        .map((row) => {
          const img = row.image
          const media = typeof img === 'object' && img ? (img as MediaDoc) : null
          if (!media) return null
          return {
            url: resolveMediaUrl(media, 'card'),
            thumbnailUrl: resolveMediaUrl(media, 'thumbnail'),
            alt: (media.alt as string | null) ?? '',
          }
        })
        .filter((x): x is { url: string | null; thumbnailUrl: string | null; alt: string } => x !== null && x.url !== null)

      const playerId =
        playerObj && typeof playerObj === 'object' ? (playerObj.id as number | string) : undefined

      return {
        id: d.id as number | string,
        caption: (d.caption as string) ?? '',
        voteCount: (d.voteCount as number) ?? 0,
        createdAt: d.createdAt as string,
        playerDisplayName: pickDisplayName(playerObj),
        isMine: playerId !== undefined && String(playerId) === String(user.id),
        images,
        myLiked: likedSet.has(String(d.id)),
      }
    })

    const hasMore = res.totalDocs > offset + items.length

    return NextResponse.json({
      success: true,
      data: {
        items,
        hasMore,
        total: res.totalDocs,
      },
    })
  } catch (error) {
    console.error('[feed] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
