import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'

import CardsClient, { type CardRow } from './CardsClient'

export const metadata: Metadata = {
  title: '我的造型卡收藏',
  description: '購物、點數兌換、合成取得的專屬造型卡。',
  robots: { index: false, follow: false },
}

/**
 * PR B: 造型卡收藏 dashboard。
 *
 * 此頁的行動按鈕（轉送、銷毀、合成）在 CardsClient.tsx；
 * 伺服器端抓 owner+originalOwner 所有卡（3 種 status），交由 client 端切 tab。
 *
 * PR C 會加分享到社群（OG 圖）、點數商店兌換卡片入口。
 */

type CardDoc = {
  id: number
  displayTitle?: string
  cardType: 'common' | 'limited'
  serialNo?: number | null
  status: 'active' | 'burned' | 'revoked' | 'transferred-out'
  mintedVia: 'purchase' | 'points-shop' | 'craft'
  mintedAt: string
  shareSlug: string
  product?:
    | {
        id: number
        title?: string
        name?: string
        images?: Array<{ image?: { url?: string } | string | null } | null>
      }
    | null
    | number
  template?: { id: number; totalSupply?: number; burnPointsReward?: number } | null | number
}

function flattenCard(c: CardDoc): CardRow {
  const p = c.product
  let productTitle = ''
  let productImageUrl: string | undefined
  let productId: number | null = null
  if (p && typeof p === 'object') {
    productTitle = p.title || p.name || ''
    productId = Number(p.id)
    const firstImg = p.images?.[0]?.image
    if (typeof firstImg === 'string') productImageUrl = firstImg
    else if (firstImg && typeof firstImg === 'object') {
      productImageUrl = (firstImg as { url?: string }).url
    }
  } else if (typeof p === 'number') {
    productId = p
  }
  const t = c.template
  let totalSupply: number | undefined
  let burnReward: number | undefined
  if (t && typeof t === 'object') {
    totalSupply = t.totalSupply
    burnReward = t.burnPointsReward
  }
  return {
    id: Number(c.id),
    displayTitle: c.displayTitle,
    cardType: c.cardType,
    serialNo: c.serialNo ?? null,
    status: c.status,
    mintedVia: c.mintedVia,
    mintedAt: c.mintedAt,
    shareSlug: c.shareSlug,
    productId,
    productTitle,
    productImageUrl,
    templateTotalSupply: totalSupply,
    templateBurnReward: burnReward,
  }
}

export default async function CardsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/account/cards')

  // 撈所有跟我有關的卡（現在擁有 + 原始擁有但現已 burned/revoked/transferred-out）
  // 一次撈再讓 client 切 tab，避免每次切 tab 都往 server 跑。
  const where: Where = {
    or: [
      { owner: { equals: user.id } },
      { originalOwner: { equals: user.id } },
    ],
  }
  const result = await payload.find({
    collection: 'collectible-cards',
    where,
    sort: '-mintedAt',
    limit: 500,
    depth: 1,
  })

  const cards: CardRow[] = (result.docs as unknown as CardDoc[]).map(flattenCard)

  return <CardsClient cards={cards} currentUserId={Number(user.id)} />
}
