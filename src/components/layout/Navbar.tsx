'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Search, User, ShoppingBag, Heart, ChevronDown, LogOut, Gift, Package, UserCircle, Instagram, Facebook, Youtube, MessageCircle, BookOpen, Headphones, Smartphone } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { useWishlistStore } from '@/stores/wishlistStore'
import type { CurrentUser } from '@/lib/auth/getCurrentUser'
import { LanguageSwitcher, CurrencySwitcher } from './LanguageCurrencySwitcher'

interface MenuGroupItem {
  label: string
  href: string
  desc?: string
  icon?: string
  external?: boolean
}

interface MenuGroup {
  title: string
  items: MenuGroupItem[]
}

interface MenuItem {
  label: string
  href: string
  children?: { label: string; href: string }[]
  groups?: MenuGroup[]
}

/**
 * 主題精選 dropdown — 品牌 IP 名稱，hardcoded 中文不翻譯（多語版會降識別性）。
 * 若 PR 3+ 要翻可加到 dictionary 的 navbar.collections.* namespace。
 */
const DEFAULT_COLLECTIONS_CHILDREN = [
  { href: '/collections/jin-live', label: '金老佛爺 Live' },
  { href: '/collections/jin-style', label: '金金同款專區' },
  { href: '/collections/host-style', label: '主播同款專區' },
  { href: '/collections/brand-custom', label: '品牌自訂款' },
  { href: '/collections/formal-dresses', label: '婚禮洋裝/正式洋裝' },
  { href: '/collections/rush', label: '現貨速到 Rush' },
  { href: '/collections/celebrity-style', label: '藝人穿搭' },
]

/**
 * 最新消息 mega-menu — 兩欄 (內容 + 社群)。
 *
 * 社群 URL 已 2026-05-11 對照真實官方帳號全面校正：
 * - IG @chickimmiu_official (8K 粉)、FB chic.kmu (60K 粉)、LINE lin.ee/AYWzgKW、YouTube @CKMU_、iOS App
 * - 改 social handle 兩邊 (Footer + 此處) 都要動。
 */
const DEFAULT_NEWS_GROUPS: MenuGroup[] = [
  {
    title: '內容',
    items: [
      { href: '/blog', label: '穿搭誌', desc: '韓系穿搭靈感與時尚趨勢', icon: 'BookOpen' },
      { href: '/podcast', label: 'Podcast', desc: '韓系穿衣間電台節目', icon: 'Headphones' },
      { href: '/app', label: '下載 APP', desc: 'iOS / Android 雙版本', icon: 'Smartphone' },
    ],
  },
  {
    title: '社群',
    items: [
      { href: 'https://www.instagram.com/chickimmiu_official/', label: 'Instagram', desc: '官方帳號 @chickimmiu_official', icon: 'Instagram', external: true },
      { href: 'https://www.instagram.com/kimlafayette/', label: '金老佛爺 IG', desc: 'KOL 主理人 @kimlafayette', icon: 'Instagram', external: true },
      { href: 'https://www.facebook.com/chic.kmu/', label: 'Facebook', desc: '官方粉絲團', icon: 'Facebook', external: true },
      { href: 'https://lin.ee/AYWzgKW', label: 'LINE 官方', desc: '客服與優惠通知', icon: 'MessageCircle', external: true },
      { href: 'https://www.youtube.com/@CKMU_', label: 'YouTube', desc: '頻道 @CKMU_', icon: 'Youtube', external: true },
    ],
  },
]

const GROUP_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  BookOpen, Headphones, Smartphone, Instagram, Facebook, Youtube, MessageCircle,
}

const DEFAULT_LOGO = 'https://shoplineimg.com/559df3efe37ec64e9f000092/69ae37b56be0c5b5e4ceb2d9/1200x.webp?source_format=png'

interface NavbarProps {
  announcementText?: string
  announcementLink?: string
  announcementStyle?: string
  menuItems?: MenuItem[]
  logoUrl?: string
  currentUser?: CurrentUser | null
}

export function Navbar({ announcementText, announcementLink, announcementStyle = 'default', menuItems, logoUrl, currentUser }: NavbarProps) {
  const t = useTranslations('navbar')
  // CMS 有資料用 CMS；沒設才走 i18n + hardcoded 預設。
  // 2026-05-11：把「最新消息 / Podcast / 下載 APP / 社群」4 個 top-level 合併成
  // 單一「最新消息」mega-menu (內容 + 社群兩欄)，降低 nav noise 從 9 項 → 6 項。
  const defaultNavLinks: MenuItem[] = [
    { href: '/products', label: t('navAllProducts') },
    { href: '/products?tag=new', label: t('navNewArrivals') },
    { href: '/products?tag=hot', label: t('navHotItems') },
    { href: '/products?tag=sale', label: t('navSale') },
    { href: '#', label: t('navCollections'), children: DEFAULT_COLLECTIONS_CHILDREN },
    { href: '#', label: '最新消息', groups: DEFAULT_NEWS_GROUPS },
  ]
  const navLinks = menuItems && menuItems.length > 0 ? menuItems : defaultNavLinks
  const logo = logoUrl && logoUrl !== '/images/logo-ckmu.svg' ? logoUrl : DEFAULT_LOGO
  const [isOpen, setIsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // 用 label 當 key 避免多 dropdown 共用同一 state（2026-05-11 修：原本 `isCollectionsOpen`
  // 讓「主題精選」「社群」hover 任一就一起開）
  const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(null)
  const [mobileExpandedLabel, setMobileExpandedLabel] = useState<string | null>(null)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  // TODO: 若未來確認 Payload session 永遠是真相（bridge 流程穩定），
  // 可完全移除 useSession() + NextAuthProvider 以簡化 bundle。
  // 目前保留當 fallback：OAuth 剛完成但 bridge 尚未補 Payload cookie 時仍能顯示。
  const { data: session } = useSession()
  const router = useRouter()
  const cartCount = useCartStore((s) => s.totalItems())
  const openCartDrawer = useCartStore((s) => s.openDrawer)
  const wishlistCount = useWishlistStore((s) => s.count())

  // Canonical user：優先 SSR 帶進來的 currentUser（Payload session），
  // fallback 到 client-side NextAuth session。
  const memberFallback = t('memberFallback')
  const effectiveUser = currentUser
    ? { name: currentUser.name, email: currentUser.email }
    : session?.user
      ? { name: session.user.name || session.user.email || memberFallback, email: session.user.email || '' }
      : null
  const isLoggedIn = effectiveUser !== null
  const displayName = effectiveUser?.name || memberFallback

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setIsUserMenuOpen(false)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // ignore network errors — still proceed to clear NextAuth + refresh
    }
    try {
      await nextAuthSignOut({ redirect: false })
    } catch {
      // ignore
    }
    router.push('/')
    router.refresh()
  }

  const isMenuOpen = (label: string) => openMenuLabel === label

  return (
    <div data-component="navbar">
      {/* 公告列 */}
      {(announcementText || !menuItems) && (
        <div className={`text-white text-center text-sm py-1.5 tracking-wider ${
          announcementStyle === 'festive' ? 'bg-red-600' :
          announcementStyle === 'promo' ? 'bg-[#2C2C2C]' :
          'bg-gold-500'
        }`}>
          {announcementLink ? (
            <Link href={announcementLink} className="hover:underline">
              {announcementText || t('announcementDefault')}
            </Link>
          ) : (
            announcementText || t('announcementDefault')
          )}
        </div>
      )}

      <header className="sticky top-0 z-50 bg-cream-50/95 backdrop-blur-md border-b border-cream-200">
        {/* Top bar: logo centered */}
        <div className="container flex items-center justify-center h-20 md:h-28 relative">
          {/* Left: hamburger (mobile) + nav links (desktop) */}
          <div className="absolute left-4 md:left-6 flex items-center gap-1">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 -ml-2 text-foreground"
              aria-label={t('menu')}
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="hidden md:flex items-center gap-0.5">
              <LanguageSwitcher />
              <CurrencySwitcher />
            </div>
          </div>

          {/* Center: Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src={logo}
              alt="CHIC KIM & MIU"
              width={260}
              height={86}
              className="h-16 md:h-24 w-auto object-contain"
              priority
              unoptimized
            />
          </Link>

          {/* Right icons */}
          <div className="absolute right-3 md:right-6 flex items-center gap-0.5 md:gap-2">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-foreground/70 hover:text-gold-600 transition-colors"
              aria-label={t('search')}
              data-track="navbar-search"
            >
              <Search size={20} />
            </button>
            <Link
              href="/wishlist"
              className="hidden md:flex p-2 text-foreground/70 hover:text-gold-600 transition-colors relative"
              aria-label={t('wishlist')}
              data-track="navbar-wishlist"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>
            {isLoggedIn ? (
              <div
                className="relative"
                onMouseEnter={() => setIsUserMenuOpen(true)}
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1 p-2 text-foreground/70 hover:text-gold-600 transition-colors"
                  aria-label={t('accountMenu')}
                  aria-expanded={isUserMenuOpen}
                >
                  <User size={20} />
                  <span className="hidden md:inline text-xs max-w-[7rem] truncate">{displayName}</span>
                  <ChevronDown size={12} className={`hidden md:inline transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-cream-200 py-2 z-50"
                    >
                      <div className="px-4 py-2 border-b border-cream-100">
                        <div className="text-sm font-medium truncate">{displayName}</div>
                        {effectiveUser?.email && (
                          <div className="text-xs text-muted-foreground truncate">{effectiveUser.email}</div>
                        )}
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:text-gold-600 hover:bg-cream-50 transition-colors"
                      >
                        <UserCircle size={16} />
                        {t('memberOverview')}
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:text-gold-600 hover:bg-cream-50 transition-colors"
                      >
                        <Package size={16} />
                        {t('myOrders')}
                      </Link>
                      <Link
                        href="/account/points"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground/80 hover:text-gold-600 hover:bg-cream-50 transition-colors"
                      >
                        <Gift size={16} />
                        {t('pointsAndCredit')}
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-cream-100 mt-1 disabled:opacity-60"
                      >
                        <LogOut size={16} />
                        {isLoggingOut ? t('loggingOut') : t('logout')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/login"
                className="p-2 text-foreground/70 hover:text-gold-600 transition-colors"
                aria-label={t('login')}
                data-track="navbar-login"
              >
                <User size={20} />
              </Link>
            )}
            <button
              onClick={openCartDrawer}
              className="p-2 text-foreground/70 hover:text-gold-600 transition-colors relative"
              aria-label={t('cart')}
              data-track="navbar-cart"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gold-500 text-white text-[10px] flex items-center justify-center">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop nav links — below logo */}
        <nav className="hidden md:block border-t border-cream-200/50">
          <ul className="container flex items-center justify-center gap-8 h-10">
            {navLinks.map((link) => {
              const hasGroups = Boolean(link.groups && link.groups.length > 0)
              const hasChildren = Boolean(link.children && link.children.length > 0)
              if (!hasGroups && !hasChildren) {
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-base tracking-wide text-foreground/80 hover:text-gold-600 transition-colors relative group"
                    >
                      {link.label}
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-gold-500 transition-all group-hover:w-full" />
                    </Link>
                  </li>
                )
              }
              return (
                <li
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setOpenMenuLabel(link.label)}
                  onMouseLeave={() => setOpenMenuLabel((cur) => (cur === link.label ? null : cur))}
                >
                  <button
                    className="flex items-center gap-0.5 text-base tracking-wide text-foreground/80 hover:text-gold-600 transition-colors relative group"
                    onClick={() => setOpenMenuLabel(isMenuOpen(link.label) ? null : link.label)}
                  >
                    {link.label}
                    <ChevronDown size={14} className={`transition-transform ${isMenuOpen(link.label) ? 'rotate-180' : ''}`} />
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-gold-500 transition-all group-hover:w-full" />
                  </button>
                  <AnimatePresence>
                    {isMenuOpen(link.label) && hasGroups && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[640px] bg-white rounded-xl shadow-xl border border-cream-200 p-6 z-50"
                      >
                        <div className="grid grid-cols-2 gap-6">
                          {link.groups!.map((group) => (
                            <div key={group.title}>
                              <p className="text-[10px] tracking-[0.3em] text-gold-500 uppercase mb-3 pb-2 border-b border-cream-100">
                                {group.title}
                              </p>
                              <div className="space-y-1">
                                {group.items.map((item) => {
                                  const IconComp = item.icon ? GROUP_ICON_MAP[item.icon] : null
                                  return item.external ? (
                                    <a
                                      key={item.href}
                                      href={item.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-cream-50 transition-colors group/item"
                                    >
                                      {IconComp && (
                                        <div className="w-9 h-9 rounded-lg bg-cream-50 group-hover/item:bg-gold-50 flex items-center justify-center text-gold-600 transition-colors shrink-0">
                                          <IconComp size={16} />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground/90 group-hover/item:text-gold-600 transition-colors truncate">
                                          {item.label}
                                        </p>
                                        {item.desc && (
                                          <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                                        )}
                                      </div>
                                    </a>
                                  ) : (
                                    <Link
                                      key={item.href}
                                      href={item.href}
                                      className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-cream-50 transition-colors group/item"
                                    >
                                      {IconComp && (
                                        <div className="w-9 h-9 rounded-lg bg-cream-50 group-hover/item:bg-gold-50 flex items-center justify-center text-gold-600 transition-colors shrink-0">
                                          <IconComp size={16} />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground/90 group-hover/item:text-gold-600 transition-colors truncate">
                                          {item.label}
                                        </p>
                                        {item.desc && (
                                          <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                                        )}
                                      </div>
                                    </Link>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    {isMenuOpen(link.label) && hasChildren && !hasGroups && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white rounded-xl shadow-lg border border-cream-200 py-2 z-50"
                      >
                        {link.children!.map((cl) => (
                          <Link
                            key={cl.href}
                            href={cl.href}
                            className="block px-4 py-2.5 text-sm text-foreground/80 hover:text-gold-600 hover:bg-cream-50 transition-colors"
                          >
                            {cl.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* 搜尋列 */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-cream-200 overflow-hidden"
            >
              <form
                className="container py-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const q = new FormData(e.currentTarget).get('q') as string
                  if (q.trim()) {
                    try {
                      // 行為追蹤：搜尋字（cookie consent 沒同意 → no-op）
                      // dynamic import 避免在 SSR / 拒絕 consent 時也載這支
                      import('@/lib/behaviorTracking').then((m) =>
                        m.trackBehaviorSearch(q.trim()),
                      )
                    } catch {
                      // ignore
                    }
                    window.location.href = `/products?q=${encodeURIComponent(q.trim())}`
                  }
                }}
              >
                <input
                  name="q"
                  type="search"
                  placeholder={t('searchPlaceholder')}
                  className="w-full px-4 py-3 rounded-lg bg-white border border-cream-200 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold-400/40"
                  autoFocus
                />
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="absolute left-0 top-0 h-full w-72 bg-cream-50 shadow-xl flex flex-col"
            >
              <div className="p-6 border-b border-cream-200">
                <Image
                  src={logo}
                  alt="CHIC KIM & MIU"
                  width={200}
                  height={66}
                  className="h-16 w-auto object-contain"
                  unoptimized
                />
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navLinks.map((link) => {
                  const hasGroups = Boolean(link.groups && link.groups.length > 0)
                  const hasChildren = Boolean(link.children && link.children.length > 0)
                  if (!hasGroups && !hasChildren) {
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className="block px-4 py-3 text-base tracking-wide text-foreground/80 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                      >
                        {link.label}
                      </Link>
                    )
                  }
                  const expanded = mobileExpandedLabel === link.label
                  return (
                    <div key={link.label}>
                      <button
                        onClick={() => setMobileExpandedLabel(expanded ? null : link.label)}
                        className="flex items-center justify-between w-full px-4 py-3 text-base tracking-wide text-foreground/80 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                      >
                        {link.label}
                        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            {hasGroups ? (
                              link.groups!.map((group) => (
                                <div key={group.title} className="py-1">
                                  <p className="px-6 pt-2 pb-1 text-[10px] tracking-[0.3em] text-gold-500 uppercase">
                                    {group.title}
                                  </p>
                                  {group.items.map((item) =>
                                    item.external ? (
                                      <a
                                        key={item.href}
                                        href={item.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setIsOpen(false)}
                                        className="block pl-8 pr-4 py-2 text-sm text-foreground/70 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                                      >
                                        {item.label}
                                      </a>
                                    ) : (
                                      <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className="block pl-8 pr-4 py-2 text-sm text-foreground/70 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                                      >
                                        {item.label}
                                      </Link>
                                    ),
                                  )}
                                </div>
                              ))
                            ) : (
                              link.children!.map((cl) => (
                                <Link
                                  key={cl.href}
                                  href={cl.href}
                                  onClick={() => setIsOpen(false)}
                                  className="block pl-8 pr-4 py-2.5 text-sm text-foreground/60 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                                >
                                  {cl.label}
                                </Link>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </nav>
              <div className="p-4 border-t border-cream-200 space-y-2">
                {isLoggedIn ? (
                  <>
                    <div className="px-2 pb-2 text-xs text-muted-foreground">
                      {t('loggedInAs')}<span className="font-medium text-foreground/80">{displayName}</span>
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setIsOpen(false)}
                      className="block w-full text-center px-4 py-3 text-sm bg-gold-500 text-white rounded-md hover:bg-gold-600 transition-colors"
                    >
                      {t('myAccount')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false)
                        void handleLogout()
                      }}
                      disabled={isLoggingOut}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors disabled:opacity-60"
                    >
                      <LogOut size={16} />
                      {isLoggingOut ? t('loggingOut') : t('logout')}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center px-4 py-3 text-sm bg-gold-500 text-white rounded-md hover:bg-gold-600 transition-colors"
                  >
                    {t('loginOrRegister')}
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
