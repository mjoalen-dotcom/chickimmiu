'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  User, ShoppingBag, Heart, MapPin, Gift, Settings, Crown, Share2, RotateCcw,
  Star, FileText, Gamepad2, Sparkles, Brain, Wallet,
} from 'lucide-react'

/**
 * AccountSidebar — 會員中心分組導覽（2026-08-22 需求 ②「會員UI更直覺」）
 * ────────────────────────────────────────────────────────────────────
 * 原本 15 條平鋪連結：無分組、無所在頁指示、手機版疊成一長串。改為：
 * - 桌機：4 組分區 + 目前頁 highlight（左側粗線 + 白底 + 粗體 —
 *   明度對比雙重編碼，不只靠顏色，色弱可辨）
 * - 手機：單列橫向滑動 chips，目前頁深底白字
 * icon 用名稱字串傳入（server layout 傳 component reference 過不了
 * serialization），在這裡對映。
 */

const ICONS = {
  User, ShoppingBag, Heart, MapPin, Gift, Settings, Crown, Share2, RotateCcw,
  Star, FileText, Gamepad2, Sparkles, Brain, Wallet,
} as const

export type SidebarGroup = {
  title: string | null
  items: Array<{ href: string; label: string; icon: keyof typeof ICONS }>
}

function useIsActive() {
  const pathname = usePathname()
  return (href: string) => {
    if (href === '/account') return pathname === '/account'
    return pathname === href || pathname.startsWith(`${href}/`)
  }
}

export function AccountSidebar({ groups }: { groups: SidebarGroup[] }) {
  const isActive = useIsActive()
  const flatItems = groups.flatMap((g) => g.items)

  return (
    <>
      {/* ── 手機：橫向滑動 chips ── */}
      <nav className="md:hidden -mx-4 px-4 flex gap-2 overflow-x-auto pb-3 mb-2" aria-label="會員選單">
        {flatItems.map((item) => {
          const active = isActive(item.href)
          const IconComp = ICONS[item.icon]
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs whitespace-nowrap transition-colors ${
                active
                  ? 'bg-neutral-900 text-white font-medium'
                  : 'bg-white border border-cream-200 text-foreground/70'
              }`}
            >
              <IconComp size={13} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── 桌機：分組直欄 ── */}
      <nav className="hidden md:block space-y-5" aria-label="會員選單">
        {groups.map((group, gi) => (
          <div key={group.title ?? gi}>
            {group.title && (
              <p className="px-4 mb-1.5 text-[10px] tracking-[0.25em] text-neutral-400 uppercase">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href)
                const IconComp = ICONS[item.icon]
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-r-lg text-sm border-l-2 transition-colors ${
                      active
                        ? 'border-neutral-900 bg-white text-foreground font-medium'
                        : 'border-transparent text-foreground/70 hover:text-foreground hover:bg-cream-100'
                    }`}
                  >
                    <IconComp size={17} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  )
}
