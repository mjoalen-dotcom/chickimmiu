'use client'

import Link from 'next/link'
import Image from 'next/image'
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/stores/cartStore'

export function CartDrawer() {
  const { items, isDrawerOpen, closeDrawer, updateQuantity, removeItem } =
    useCartStore()

  const subtotal = items.reduce(
    (sum, i) => sum + (i.salePrice ?? i.price) * i.quantity,
    0,
  )

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55]"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-gold-500" />
                <h2 className="font-medium">購物車</h2>
                <span className="text-xs text-muted-foreground">
                  ({items.length} 件商品)
                </span>
              </div>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 rounded-full hover:bg-cream-100 flex items-center justify-center transition-colors"
                aria-label="關閉"
              >
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag size={48} className="mx-auto text-cream-200 mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    你的購物車是空的
                  </p>
                  <Link
                    href="/products"
                    onClick={closeDrawer}
                    className="inline-block text-sm text-gold-600 hover:underline"
                  >
                    去逛逛 →
                  </Link>
                </div>
              ) : (
                items.map((item) => {
                  const key = item.variant?.sku || item.productId
                  const unitPrice = item.salePrice ?? item.price
                  return (
                    <div
                      key={key}
                      className="flex gap-4 p-3 rounded-xl bg-cream-50/50 border border-cream-200"
                    >
                      {/* Thumb */}
                      <div className="relative w-20 h-24 rounded-lg overflow-hidden bg-cream-100 shrink-0">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                            圖片
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 flex flex-col min-w-0">
                        <Link
                          href={`/products/${item.slug}`}
                          onClick={closeDrawer}
                          className="text-sm font-medium truncate hover:text-gold-600 transition-colors"
                        >
                          {item.name}
                        </Link>
                        {item.variant && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {item.variant.colorName} / {item.variant.size}
                          </p>
                        )}
                        <p className="text-sm text-gold-600 mt-1">
                          NT$ {unitPrice.toLocaleString()}
                        </p>

                        <div className="flex items-center justify-between mt-auto pt-2">
                          <div className="inline-flex items-center border border-cream-200 rounded-md">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.quantity - 1,
                                  item.variant?.sku,
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-7 text-center text-xs">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.quantity + 1,
                                  item.variant?.sku,
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() =>
                              removeItem(item.productId, item.variant?.sku)
                            }
                            className="p-1.5 text-muted-foreground/50 hover:text-red-500 transition-colors"
                            aria-label="刪除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-cream-200 px-6 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">小計</span>
                  <span className="text-lg font-medium">
                    NT$ {subtotal.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  運費及折扣將於結帳時計算
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/cart"
                    onClick={closeDrawer}
                    className="flex-1 py-3 text-center border border-foreground/20 rounded-xl text-sm tracking-wide hover:bg-cream-50 transition-colors"
                  >
                    查看購物車
                  </Link>
                  <Link
                    href="/checkout"
                    onClick={closeDrawer}
                    className="flex-1 py-3 text-center bg-foreground text-cream-50 rounded-xl text-sm tracking-wide hover:bg-foreground/90 transition-colors"
                  >
                    去結帳
                  </Link>
                </div>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
