'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCartStore } from '@/stores/cartStore'
import { CartCrossSell } from '@/components/recommendation/CartCrossSell'
import { CartCampaignProgress } from '@/components/campaign/CartCampaignProgress'
import { Price } from '@/components/common/Price'

export default function CartPage() {
  const t = useTranslations('cart')
  const { items, updateQuantity, removeItem, clearCart } = useCartStore()

  const subtotal = items.reduce(
    (sum, i) => sum + (i.salePrice ?? i.price) * i.quantity,
    0,
  )
  const shippingFee = subtotal >= 1000 ? 0 : 60
  const total = subtotal + shippingFee

  if (items.length === 0) {
    return (
      <main className="bg-cream-50 min-h-screen">
        <div className="container py-16 text-center">
          <ShoppingBag size={64} className="mx-auto text-cream-200 mb-6" />
          <h1 className="text-2xl font-serif mb-3">{t('emptyTitle')}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {t('emptySubtitle')}
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
          >
            {t('emptyCta')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8 md:py-12">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">{t('eyebrow')}</p>
          <h1 className="text-2xl md:text-3xl font-serif">{t('title')}</h1>
        </div>
      </div>

      <div className="container py-8 md:py-12">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          {/* ── Items ── */}
          <div className="space-y-4">
            {/* Campaign Engine：Style Quest 進度（0/2 → 1/2 → UNLOCKED，server 評估） */}
            <CartCampaignProgress surface="cart" />
            {/* Header row (desktop) */}
            <div className="hidden md:grid grid-cols-[1fr_120px_140px_100px_40px] gap-4 text-xs text-muted-foreground px-4 pb-2 border-b border-cream-200">
              <span>{t('headerProduct')}</span>
              <span className="text-center">{t('headerUnitPrice')}</span>
              <span className="text-center">{t('headerQuantity')}</span>
              <span className="text-right">{t('headerSubtotal')}</span>
              <span />
            </div>

            {items.map((item) => {
              const key = item.variant?.sku || item.productId
              const unitPrice = item.salePrice ?? item.price
              const lineTotal = unitPrice * item.quantity
              return (
                <div
                  key={key}
                  className="bg-white rounded-2xl border border-cream-200 p-4 md:p-5"
                >
                  <div className="md:grid md:grid-cols-[1fr_120px_140px_100px_40px] md:gap-4 md:items-center">
                    {/* Product info */}
                    <div className="flex gap-4 mb-4 md:mb-0">
                      <div className="relative w-20 h-24 md:w-24 md:h-28 rounded-xl overflow-hidden bg-cream-100 shrink-0">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                            {t('imageFallback')}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <Link
                          href={`/products/${item.slug}`}
                          className="text-sm font-medium truncate hover:text-gold-600 transition-colors"
                        >
                          {item.name}
                        </Link>
                        {item.variant && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.variant.colorName} / {item.variant.size}
                          </p>
                        )}
                        {/* Mobile price */}
                        <Price twd={unitPrice} className="text-sm text-gold-600 mt-2 md:hidden block" />
                      </div>
                    </div>

                    {/* Unit price (desktop) */}
                    <div className="hidden md:block text-center">
                      <Price twd={unitPrice} className="text-sm text-gold-600" />
                      {item.salePrice && item.salePrice < item.price && (
                        <Price
                          twd={item.price}
                          className="block text-[10px] text-muted-foreground line-through"
                        />
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center justify-between md:justify-center mb-4 md:mb-0">
                      <span className="text-xs text-muted-foreground md:hidden">{t('qtyLabel')}</span>
                      <div className="inline-flex items-center border border-cream-200 rounded-lg">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1, item.variant?.sku)
                          }
                          className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1, item.variant?.sku)
                          }
                          className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Line total */}
                    <p className="hidden md:block text-right text-sm font-medium">
                      <Price twd={lineTotal} />
                    </p>

                    {/* Delete */}
                    <div className="hidden md:flex justify-end">
                      <button
                        onClick={() => removeItem(item.productId, item.variant?.sku)}
                        className="p-2 text-muted-foreground/50 hover:text-red-500 transition-colors"
                        aria-label={t('delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Mobile footer */}
                    <div className="flex items-center justify-between md:hidden pt-3 border-t border-cream-100">
                      <Price twd={lineTotal} className="text-sm font-medium" />
                      <button
                        onClick={() => removeItem(item.productId, item.variant?.sku)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        {t('remove')}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Bottom actions */}
            <div className="flex items-center justify-between pt-4">
              <Link
                href="/products"
                className="flex items-center gap-2 text-sm text-foreground/60 hover:text-gold-600 transition-colors"
              >
                <ArrowLeft size={16} />
                {t('continueShopping')}
              </Link>
              <button
                onClick={clearCart}
                className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                {t('clearCart')}
              </button>
            </div>

            {/* ── AI 智能推薦：搭配加購 & 小額加購 ── */}
            <CartCrossSell />
          </div>

          {/* ── Summary Sidebar ── */}
          <div className="lg:sticky lg:top-28 h-fit">
            <div className="bg-white rounded-2xl border border-cream-200 p-6 space-y-5">
              <h2 className="font-medium">{t('summaryTitle')}</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <Price twd={subtotal} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('shipping')}</span>
                  <span>
                    {shippingFee === 0 ? (
                      <span className="text-green-600">{t('freeShipping')}</span>
                    ) : (
                      <Price twd={shippingFee} />
                    )}
                  </span>
                </div>
                {subtotal < 1000 && (
                  <p className="text-[10px] text-gold-600">
                    {t('freeShippingHintPrefix')}<Price twd={1000 - subtotal} />{t('freeShippingHintSuffix')}
                  </p>
                )}
              </div>

              <div className="border-t border-cream-200 pt-4 flex justify-between items-baseline">
                <span className="font-medium">{t('total')}</span>
                <Price twd={total} className="text-xl font-medium text-gold-600" />
              </div>

              <Link
                href="/checkout"
                className="block w-full py-3.5 text-center bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
              >
                {t('goToCheckout')}
              </Link>

              <div className="grid grid-cols-3 gap-2 text-center">
                {['PayPal', '信用卡', 'LINE Pay'].map((m) => (
                  <div
                    key={m}
                    className="py-2 bg-cream-50 rounded-lg text-[10px] text-muted-foreground"
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
