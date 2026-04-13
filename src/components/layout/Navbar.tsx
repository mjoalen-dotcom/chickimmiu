'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Search, User, ShoppingBag, Heart, ChevronDown } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { useWishlistStore } from '@/stores/wishlistStore'
import { LanguageSwitcher, CurrencySwitcher } from './LanguageCurrencySwitcher'

interface MenuItem {
  label: string
  href: string
  children?: { label: string; href: string }[]
}

const DEFAULT_NAV_LINKS: MenuItem[] = [
  { href: '/products', label: '全部商品' },
  { href: '/products?tag=new', label: '新品上市' },
  { href: '/products?tag=hot', label: '熱銷推薦' },
  { href: '/products?tag=sale', label: '限時優惠' },
  { href: '#', label: '主題精選', children: [
    { href: '/collections/jin-live', label: '金老佛爺 Live' },
    { href: '/collections/jin-style', label: '金金同款專區' },
    { href: '/collections/host-style', label: '主播同款專區' },
    { href: '/collections/brand-custom', label: '品牌自訂款' },
    { href: '/collections/formal-dresses', label: '婚禮洋裝/正式洋裝' },
    { href: '/collections/rush', label: '現貨速到 Rush' },
    { href: '/collections/celebrity-style', label: '藝人穿搭' },
  ]},
  { href: '/blog', label: '穿搭誌' },
]

const DEFAULT_LOGO = 'https://shoplineimg.com/559df3efe37ec64e9f000092/69ae37b56be0c5b5e4ceb2d9/1200x.webp?source_format=png'

interface NavbarProps {
  announcementText?: string
  announcementLink?: string
  announcementStyle?: string
  menuItems?: MenuItem[]
  logoUrl?: string
}

export function Navbar({ announcementText, announcementLink, announcementStyle = 'default', menuItems, logoUrl }: NavbarProps) {
  const navLinks = menuItems && menuItems.length > 0 ? menuItems : DEFAULT_NAV_LINKS
  const logo = logoUrl && logoUrl !== '/images/logo-ckmu.svg' ? logoUrl : DEFAULT_LOGO
  const [isOpen, setIsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false)
  const [isMobileCollectionsOpen, setIsMobileCollectionsOpen] = useState(false)
  const { data: session } = useSession()
  const cartCount = useCartStore((s) => s.totalItems())
  const openCartDrawer = useCartStore((s) => s.openDrawer)
  const wishlistCount = useWishlistStore((s) => s.count())

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
              {announcementText || '全館滿 $1,000 免運費 ♥ 新會員註冊即享 9 折'}
            </Link>
          ) : (
            announcementText || '全館滿 $1,000 免運費 ♥ 新會員註冊即享 9 折'
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
              aria-label="選單"
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
              aria-label="搜尋"
            >
              <Search size={20} />
            </button>
            <Link
              href="/wishlist"
              className="hidden md:flex p-2 text-foreground/70 hover:text-gold-600 transition-colors relative"
              aria-label="收藏"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </Link>
            <Link
              href={session ? '/account' : '/login'}
              className="p-2 text-foreground/70 hover:text-gold-600 transition-colors"
              aria-label="會員"
            >
              <User size={20} />
            </Link>
            <button
              onClick={openCartDrawer}
              className="p-2 text-foreground/70 hover:text-gold-600 transition-colors relative"
              aria-label="購物車"
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
            {navLinks.map((link) =>
              link.children && link.children.length > 0 ? (
                <li
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setIsCollectionsOpen(true)}
                  onMouseLeave={() => setIsCollectionsOpen(false)}
                >
                  <button
                    className="flex items-center gap-0.5 text-base tracking-wide text-foreground/80 hover:text-gold-600 transition-colors relative group"
                    onClick={() => setIsCollectionsOpen(!isCollectionsOpen)}
                  >
                    {link.label}
                    <ChevronDown size={14} className={`transition-transform ${isCollectionsOpen ? 'rotate-180' : ''}`} />
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-gold-500 transition-all group-hover:w-full" />
                  </button>
                  <AnimatePresence>
                    {isCollectionsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white rounded-xl shadow-lg border border-cream-200 py-2 z-50"
                      >
                        {link.children.map((cl) => (
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
              ) : (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-base tracking-wide text-foreground/80 hover:text-gold-600 transition-colors relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-gold-500 transition-all group-hover:w-full" />
                  </Link>
                </li>
              ),
            )}
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
                    window.location.href = `/products?q=${encodeURIComponent(q.trim())}`
                  }
                }}
              >
                <input
                  name="q"
                  type="search"
                  placeholder="搜尋商品、分類或關鍵字…"
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
                {navLinks.map((link) =>
                  link.children && link.children.length > 0 ? (
                    <div key={link.label}>
                      <button
                        onClick={() => setIsMobileCollectionsOpen(!isMobileCollectionsOpen)}
                        className="flex items-center justify-between w-full px-4 py-3 text-base tracking-wide text-foreground/80 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                      >
                        {link.label}
                        <ChevronDown size={14} className={`transition-transform ${isMobileCollectionsOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {isMobileCollectionsOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            {link.children.map((cl) => (
                              <Link
                                key={cl.href}
                                href={cl.href}
                                onClick={() => setIsOpen(false)}
                                className="block pl-8 pr-4 py-2.5 text-sm text-foreground/60 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                              >
                                {cl.label}
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-3 text-base tracking-wide text-foreground/80 hover:text-gold-600 hover:bg-cream-100 rounded-md transition-colors"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </nav>
              <div className="p-4 border-t border-cream-200 space-y-2">
                <Link
                  href={session ? '/account' : '/login'}
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-3 text-sm bg-gold-500 text-white rounded-md hover:bg-gold-600 transition-colors"
                >
                  {session ? '我的帳戶' : '登入 / 註冊'}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
