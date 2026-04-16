'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  LayoutGrid,
  X,
  Home,
  ShoppingBag,
  User,
  Gamepad2,
  Grid3X3,
  Crown,
  Gift,
  ArrowUp,
} from 'lucide-react'

const QUICK_LINKS = [
  { href: '/', label: '首頁', icon: Home, color: 'bg-cream-100 text-foreground' },
  { href: '/products', label: '商品', icon: Grid3X3, color: 'bg-gold-500/10 text-gold-600' },
  { href: '/cart', label: '購物車', icon: ShoppingBag, color: 'bg-blue-50 text-blue-600' },
  { href: '/account', label: '會員', icon: User, color: 'bg-green-50 text-green-600' },
  { href: '/account/subscription', label: '訂閱', icon: Crown, color: 'bg-purple-50 text-purple-600' },
  { href: '/games', label: '遊戲', icon: Gamepad2, color: 'bg-pink-50 text-pink-600' },
  { href: '/account/referrals', label: '推薦', icon: Gift, color: 'bg-orange-50 text-orange-600' },
]

export function FloatingQuickMenu() {
  const [isOpen, setIsOpen] = useState(false)

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div data-component="floating-menu" className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-cream-200 p-4 w-56 opacity-100 translate-y-0 scale-100 transition-all duration-200">
          <p className="text-xs text-muted-foreground mb-3 px-1">快速導覽</p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl hover:bg-cream-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${link.color}`}>
                  <link.icon size={16} />
                </div>
                <span className="text-[10px] text-foreground/70">{link.label}</span>
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { scrollToTop(); setIsOpen(false) }}
            className="w-full mt-3 pt-3 border-t border-cream-200 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-gold-600 transition-colors"
          >
            <ArrowUp size={12} />
            回到頂部
          </button>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-11 h-11 rounded-full bg-foreground/80 text-cream-50 shadow-lg hover:bg-foreground transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
        aria-label="快速選單"
      >
        {isOpen ? <X size={18} /> : <LayoutGrid size={18} />}
      </button>
    </div>
  )
}
