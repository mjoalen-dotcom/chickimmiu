'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Gift, Plus, Check } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'

/**
 * 19D 促銷三件套 — 結帳頁加購 / 贈品 UI
 * ───────────────────────────────────
 * 掛在 checkout 頁面訂單摘要之上。職責：
 *   1. 讀 cart subtotal + productIds，打 /api/cart/gifts → replaceGifts()
 *      （贈品自動入 cart，客戶無法取消）
 *   2. 讀 cart subtotal + productIds，打 /api/cart/add-ons → 顯示清單
 *      客戶勾選加購品，點「加入」後以 addOnPrice 加進 cart（isAddOn=true）
 *
 * Gift 會出現在訂單摘要的 items.map 裡（因為已寫入 cart.items），不需要 UI 單獨顯示；
 * 但會用 🎁 符號在名稱前標示「[贈品]」（由 API 加的）。
 */

type AddOnOption = {
  id: number | string
  name: string
  addOnPrice: number
  productId: string
  productSlug: string
  productName: string
  productImage: string
  usageLimitPerOrder: number
  priority: number
}

export function PromoUpsellSection() {
  const items = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const replaceGifts = useCartStore((s) => s.replaceGifts)

  const [addOns, setAddOns] = useState<AddOnOption[]>([])
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // 排除贈品計算的 subtotal + 商品 id 清單（避免贈品觸發新的贈品；無限迴圈）
  const nonGiftItems = items.filter((i) => !i.isGift)
  const subtotal = nonGiftItems.reduce(
    (sum, i) => sum + (i.salePrice ?? i.price) * i.quantity,
    0,
  )
  const productIds = nonGiftItems.map((i) => i.productId).join(',')

  // Gift auto-insert（每次 subtotal 或 cart 商品變動）
  useEffect(() => {
    let cancelled = false
    if (subtotal <= 0) {
      replaceGifts([])
      return
    }
    const params = new URLSearchParams({ subtotal: String(subtotal), productIds })
    fetch(`/api/cart/gifts?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { gifts?: Array<Record<string, unknown>> }) => {
        if (cancelled) return
        const gifts = (data.gifts ?? []).map((g) => ({
          productId: String(g.productId ?? ''),
          slug: String(g.slug ?? ''),
          name: String(g.name ?? ''),
          image: typeof g.image === 'string' ? g.image : undefined,
          price: 0,
          isGift: true,
          giftRuleRef: g.giftRuleRef as string | number,
        }))
        replaceGifts(gifts)
      })
      .catch(() => {
        // 靜默失敗；贈品不是致命路徑
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, productIds])

  // Add-ons 查詢
  useEffect(() => {
    let cancelled = false
    if (subtotal <= 0) {
      setAddOns([])
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ subtotal: String(subtotal), productIds })
    fetch(`/api/cart/add-ons?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { items?: AddOnOption[] }) => {
        if (cancelled) return
        setAddOns(data.items ?? [])
      })
      .catch(() => setAddOns([]))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, productIds])

  if (addOns.length === 0 && !loading) return null

  return (
    <div className="bg-white rounded-2xl border border-gold-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Gift size={16} className="text-gold-700" />
        <h3 className="text-sm font-medium">加購推薦</h3>
        <span className="text-[10px] text-muted-foreground">專屬結帳優惠價</span>
      </div>
      <ul className="space-y-3">
        {addOns.map((a) => {
          const added = addedIds.has(String(a.id))
          return (
            <li key={a.id} className="flex items-center gap-3 pb-3 last:pb-0 border-b border-cream-100 last:border-0">
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-cream-100 shrink-0">
                {a.productImage ? (
                  <Image src={a.productImage} alt={a.productName} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                    圖
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.productName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{a.name}</p>
                <p className="text-xs mt-1">
                  <span className="text-gold-700 font-medium">NT$ {a.addOnPrice.toLocaleString()}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={added}
                onClick={() => {
                  addItem({
                    productId: a.productId,
                    slug: a.productSlug,
                    name: `[加購] ${a.productName}`,
                    image: a.productImage || undefined,
                    price: a.addOnPrice,
                    isAddOn: true,
                    addOnRuleRef: a.id,
                  })
                  setAddedIds((prev) => new Set(prev).add(String(a.id)))
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  added
                    ? 'bg-green-50 text-green-700 cursor-default'
                    : 'bg-gold-600 text-white hover:bg-gold-700'
                }`}
              >
                {added ? (
                  <>
                    <Check size={12} />
                    已加入
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    加購
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
