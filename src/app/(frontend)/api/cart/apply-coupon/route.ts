import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

/**
 * POST /api/cart/apply-coupon
 * ──────────────────────────
 * Body: { code: string, subtotal: number, items?: { productId: string|number, subtotal: number }[] }
 *
 * 驗 coupon 是否可套用並回傳實際折抵金額（前台顯示用）。
 * 不寫 CouponRedemptions — 那由訂單 create 時 Orders afterChange hook 觸發
 * （避免 apply → 放棄下單導致 usageCount 誤增）。
 *
 * 回傳：
 *   200 { valid: true, discountAmount: number, discountType, freeShipping, couponId, couponCode, name }
 *   200 { valid: false, reason: string }  （故意 200，前台依 valid 分流；錯誤 UX 不當 4xx）
 *   500 { valid: false, reason: 'internal_error' }
 */
export const dynamic = 'force-dynamic'

type ApplyBody = {
  code?: string
  subtotal?: number
  items?: { productId?: string | number; subtotal?: number }[]
}

export async function POST(request: Request) {
  let body: ApplyBody = {}
  try {
    body = (await request.json()) as ApplyBody
  } catch {
    return NextResponse.json({ valid: false, reason: '無效的請求' }, { status: 400 })
  }

  const rawCode = (body.code || '').trim().toUpperCase()
  const subtotal = typeof body.subtotal === 'number' ? body.subtotal : 0
  const items = Array.isArray(body.items) ? body.items : []

  if (!rawCode) {
    return NextResponse.json({ valid: false, reason: '請輸入優惠碼' })
  }

  try {
    const payload = await getPayload({ config })

    // 1. 查 coupon by code
    const result = await payload.find({
      collection: 'coupons',
      where: { code: { equals: rawCode } } as Where,
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const coupon = result.docs[0] as unknown as Record<string, unknown> | undefined

    if (!coupon) {
      return NextResponse.json({ valid: false, reason: '優惠碼不存在' })
    }
    if (!coupon.isActive) {
      return NextResponse.json({ valid: false, reason: '此優惠券已停用' })
    }

    // 2. 時間窗驗證
    const now = Date.now()
    if (coupon.startsAt && new Date(coupon.startsAt as string).getTime() > now) {
      return NextResponse.json({ valid: false, reason: '優惠券尚未開始' })
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt as string).getTime() < now) {
      return NextResponse.json({ valid: false, reason: '優惠券已過期' })
    }

    // 3. 總使用次數
    const usageLimit = typeof coupon.usageLimit === 'number' ? coupon.usageLimit : 0
    const usageCount = typeof coupon.usageCount === 'number' ? coupon.usageCount : 0
    if (usageLimit > 0 && usageCount >= usageLimit) {
      return NextResponse.json({ valid: false, reason: '優惠券已達使用上限' })
    }

    // 4. 門檻驗證
    const minOrderAmount = typeof coupon.minOrderAmount === 'number' ? coupon.minOrderAmount : 0
    if (subtotal < minOrderAmount) {
      return NextResponse.json({
        valid: false,
        reason: `消費滿 NT$ ${minOrderAmount.toLocaleString()} 才可使用`,
      })
    }

    // 5. 每人使用上限（需已登入）
    //    用 Payload auth 從 request cookie 抽 user
    const usageLimitPerUser =
      typeof coupon.usageLimitPerUser === 'number' ? coupon.usageLimitPerUser : 0
    if (usageLimitPerUser > 0) {
      try {
        const { user } = await payload.auth({ headers: request.headers })
        if (user?.id) {
          const redemptions = await payload.count({
            collection: 'coupon-redemptions',
            where: {
              and: [
                { coupon: { equals: coupon.id } },
                { user: { equals: user.id } },
              ],
            } as Where,
            overrideAccess: true,
          })
          if (redemptions.totalDocs >= usageLimitPerUser) {
            return NextResponse.json({
              valid: false,
              reason: `您已達此優惠券使用次數上限（${usageLimitPerUser} 次）`,
            })
          }
        }
        // Guest 模式暫不擋（下單時仍會 recheck；封測會員 100% 登入）
      } catch {
        /* auth 失敗不擋，後續下單流程再驗證 */
      }
    }

    // 6. 商品限定：若有 productInclude，calc eligible subtotal（僅計入符合的品項）
    const conditions = (coupon.conditions || {}) as Record<string, unknown>
    const include = Array.isArray(conditions.productInclude)
      ? (conditions.productInclude as Array<number | string | Record<string, unknown>>).map((p) =>
          String(typeof p === 'object' && p != null ? (p as Record<string, unknown>).id : p),
        )
      : []
    const exclude = Array.isArray(conditions.productExclude)
      ? (conditions.productExclude as Array<number | string | Record<string, unknown>>).map((p) =>
          String(typeof p === 'object' && p != null ? (p as Record<string, unknown>).id : p),
        )
      : []

    let eligibleSubtotal = subtotal
    if (include.length > 0 || exclude.length > 0) {
      eligibleSubtotal = items.reduce((acc, it) => {
        const pid = String(it.productId ?? '')
        if (include.length > 0 && !include.includes(pid)) return acc
        if (exclude.includes(pid)) return acc
        return acc + (typeof it.subtotal === 'number' ? it.subtotal : 0)
      }, 0)
      if (eligibleSubtotal <= 0) {
        return NextResponse.json({ valid: false, reason: '購物車內無符合此優惠券的商品' })
      }
    }

    // 7. 計算折扣
    const discountType = coupon.discountType as string
    const discountValue = typeof coupon.discountValue === 'number' ? coupon.discountValue : 0
    const maxDiscountAmount =
      typeof coupon.maxDiscountAmount === 'number' ? coupon.maxDiscountAmount : 0
    let discountAmount = 0
    let freeShipping = false
    if (discountType === 'percentage') {
      discountAmount = Math.floor(eligibleSubtotal * (discountValue / 100))
      if (maxDiscountAmount > 0 && discountAmount > maxDiscountAmount) {
        discountAmount = maxDiscountAmount
      }
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, eligibleSubtotal)
    } else if (discountType === 'free_shipping') {
      discountAmount = 0
      freeShipping = true
    }

    return NextResponse.json({
      valid: true,
      couponId: coupon.id,
      couponCode: coupon.code,
      name: coupon.name,
      discountType,
      discountAmount,
      freeShipping,
    })
  } catch (err) {
    console.error('[apply-coupon] 驗證失敗:', err)
    return NextResponse.json(
      { valid: false, reason: 'internal_error' },
      { status: 500 },
    )
  }
}
