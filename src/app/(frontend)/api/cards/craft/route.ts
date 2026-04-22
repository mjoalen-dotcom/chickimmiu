import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { CRAFT_COMMON_INPUT_COUNT } from '@/utils/collectibleCardConstants'

/**
 * POST /api/cards/craft
 *   body: { cardIds: number[] }
 *
 * 3 張同 SKU common 卡 → 1 張該 SKU limited 卡。
 *
 * 約束：
 *   - 必須登入
 *   - cardIds 剛好 3 張
 *   - 每張都是 common + active + 同 owner + 同 product
 *   - 該 product 必須有 active template + craftingPoolRemaining > 0
 *
 * 副作用（非嚴格 atomic，SQLite 單進程下依序執行近似原子）：
 *   1. 3 張 common 卡 status='burned', owner=null
 *   2. template craftingPoolRemaining--, nextSerialNo++
 *   3. 新 mint 1 張 limited 卡（mintedVia='craft'）
 *   4. 4 筆 CardEvent（3× craft-consume + 1× craft-result）
 */

function generateDesignSeed(): string {
  return crypto.randomBytes(16).toString('hex')
}

function generateShareSlug(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let cardIds: number[]
  try {
    const body = (await request.json()) as { cardIds?: unknown }
    if (!Array.isArray(body?.cardIds) || body.cardIds.length !== CRAFT_COMMON_INPUT_COUNT) {
      return NextResponse.json(
        { error: 'invalid_card_ids', required: CRAFT_COMMON_INPUT_COUNT },
        { status: 400 },
      )
    }
    cardIds = body.cardIds.map((x) => (typeof x === 'number' ? x : Number(x)))
    if (cardIds.some((n) => !Number.isFinite(n))) {
      return NextResponse.json({ error: 'invalid_card_ids' }, { status: 400 })
    }
    if (new Set(cardIds).size !== cardIds.length) {
      return NextResponse.json(
        { error: 'duplicate_card_ids', message: '3 張卡必須是不同張' },
        { status: 400 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // ── 撈 3 張卡 ──
  type CardRow = {
    id: number
    cardType?: string
    status?: string
    owner?: number | string
    product?: number | string
  }
  const cardFind = await payload.find({
    collection: 'collectible-cards',
    where: { id: { in: cardIds } },
    limit: CRAFT_COMMON_INPUT_COUNT,
    depth: 0,
    overrideAccess: true,
  })
  const cards = cardFind.docs as unknown as CardRow[]
  if (cards.length !== CRAFT_COMMON_INPUT_COUNT) {
    return NextResponse.json(
      { error: 'cards_not_found', foundCount: cards.length },
      { status: 404 },
    )
  }

  // 驗：都是 common + active + 同 owner (me) + 同 product
  const myId = Number(user.id)
  const productIds = new Set<number>()
  for (const c of cards) {
    if (String(c.cardType) !== 'common') {
      return NextResponse.json(
        { error: 'not_all_common', message: '只能用 3 張普通卡合成' },
        { status: 409 },
      )
    }
    if (String(c.status) !== 'active') {
      return NextResponse.json(
        { error: 'not_all_active', message: '有卡已銷毀或已撤回' },
        { status: 409 },
      )
    }
    const ownerId = typeof c.owner === 'number' ? c.owner : Number(c.owner)
    if (ownerId !== myId) {
      return NextResponse.json({ error: 'not_owner' }, { status: 403 })
    }
    const pid = typeof c.product === 'number' ? c.product : Number(c.product)
    productIds.add(pid)
  }
  if (productIds.size !== 1) {
    return NextResponse.json(
      { error: 'different_products', message: '3 張卡必須是相同商品' },
      { status: 409 },
    )
  }
  const productId = [...productIds][0]

  // ── 找 active template + 有 craftingPool 餘額 ──
  type TemplateRow = {
    id: number
    craftingPoolRemaining?: number
    nextSerialNo?: number
    totalSupply?: number
  }
  const tmplFind = await payload.find({
    collection: 'collectible-card-templates',
    where: {
      and: [
        { product: { equals: productId } },
        { isActive: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tmpl = tmplFind.docs[0] as unknown as TemplateRow | undefined
  if (!tmpl) {
    return NextResponse.json(
      { error: 'no_template', message: '此商品未開放合成' },
      { status: 409 },
    )
  }
  const poolRemaining = Number(tmpl.craftingPoolRemaining ?? 0)
  if (poolRemaining < 1) {
    return NextResponse.json(
      { error: 'crafting_pool_empty', message: '合成池已用完' },
      { status: 409 },
    )
  }
  const serialNo = Number(tmpl.nextSerialNo ?? 1)

  // ── 1. 消耗 3 張 common ──
  for (const c of cards) {
    await payload.update({
      collection: 'collectible-cards',
      id: c.id,
      data: { status: 'burned', owner: null },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'collectible-card-events',
      data: {
        card: c.id,
        action: 'craft-consume',
        fromUser: myId,
        notes: `合成消耗（共 ${CRAFT_COMMON_INPUT_COUNT} 張）`,
      },
      overrideAccess: true,
    })
  }

  // ── 2. 扣 craftingPool + 推進 serial ──
  await payload.update({
    collection: 'collectible-card-templates',
    id: tmpl.id,
    data: {
      craftingPoolRemaining: poolRemaining - 1,
      nextSerialNo: serialNo + 1,
    },
    overrideAccess: true,
  })

  // ── 3. Mint 新 limited 卡 ──
  const me = (await payload.findByID({
    collection: 'users',
    id: myId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as { name?: string; email?: string }

  const newCard = (await payload.create({
    collection: 'collectible-cards',
    data: {
      cardType: 'limited',
      product: productId,
      template: tmpl.id,
      serialNo,
      owner: myId,
      originalOwner: myId,
      status: 'active',
      mintedVia: 'craft',
      mintedAt: new Date().toISOString(),
      designSeed: generateDesignSeed(),
      shareSlug: generateShareSlug(),
      ownerNicknameSnapshot: me?.name || me?.email || '',
      displayTitle: `合成限量 #${String(serialNo).padStart(4, '0')}`,
    },
    overrideAccess: true,
  })) as unknown as { id: number }

  await payload.create({
    collection: 'collectible-card-events',
    data: {
      card: newCard.id,
      action: 'craft-result',
      toUser: myId,
      notes: `合成產出 limited #${serialNo}`,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    ok: true,
    newCardId: newCard.id,
    serialNo,
    totalSupply: tmpl.totalSupply,
  })
}
