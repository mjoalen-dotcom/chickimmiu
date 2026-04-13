'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ChevronDown, ShoppingBag, Truck, RotateCcw, CreditCard,
  Star, Gift, HelpCircle, MessageCircle, Package, Tag,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  'shopping-bag': ShoppingBag,
  truck: Truck,
  'rotate-ccw': RotateCcw,
  'credit-card': CreditCard,
  star: Star,
  gift: Gift,
  'help-circle': HelpCircle,
  'message-circle': MessageCircle,
  package: Package,
  tag: Tag,
}

interface FAQItem { q: string; a: string }
interface FAQCategory { icon: string; title: string; items: FAQItem[] }

interface FAQPageClientProps {
  heroImage: string
  heroTitle: string
  heroDesc: string
  categories: FAQCategory[]
  ctaTitle: string
  ctaDesc: string
}

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[#F0E6D6] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-[15px] font-medium text-[#2C2C2C] group-hover:text-[#C19A5B] transition-colors pr-4">
          {item.q}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#C19A5B] flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? 'max-h-96 pb-4' : 'max-h-0'
        }`}
      >
        <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">{item.a}</p>
      </div>
    </div>
  )
}

export function FAQPageClient({
  heroImage, heroTitle, heroDesc, categories, ctaTitle, ctaDesc,
}: FAQPageClientProps) {
  const [activeCat, setActiveCat] = useState(0)

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Hero Banner ── */}
      <section className="relative h-[320px] md:h-[420px] w-full overflow-hidden">
        <Image
          src={heroImage}
          alt={heroTitle}
          fill
          unoptimized
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-xs tracking-[0.4em] text-white/80 mb-3 uppercase">FAQ</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-widest drop-shadow-lg">
              {heroTitle}
            </h1>
            <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
            <p className="mt-4 text-white/80 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              {heroDesc}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        {/* ── Category Tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 mb-8">
          {categories.map((cat, i) => {
            const Icon = ICON_MAP[cat.icon] || HelpCircle
            return (
              <button
                key={cat.title}
                onClick={() => setActiveCat(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                  activeCat === i
                    ? 'bg-[#2C2C2C] text-white border-[#2C2C2C]'
                    : 'bg-white border-[#E8DFD3] text-[#2C2C2C]/70 hover:border-[#C19A5B] hover:text-[#2C2C2C]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.title}
              </button>
            )
          })}
        </div>

        {/* ── FAQ Content ── */}
        <div className="space-y-6">
          {categories.map((cat, i) => {
            const Icon = ICON_MAP[cat.icon] || HelpCircle
            return (
              <div key={cat.title} className={activeCat === i ? 'block' : 'hidden'}>
                <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[#C19A5B]/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#C19A5B]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[#2C2C2C]">{cat.title}</h2>
                      <p className="text-xs text-[#2C2C2C]/50">{cat.items.length} 個常見問題</p>
                    </div>
                  </div>
                  <div>
                    {cat.items.map((item, j) => (
                      <FAQAccordion key={j} item={item} />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── All Categories Overview (desktop) ── */}
        <div className="hidden lg:grid grid-cols-3 gap-4 mt-10">
          {categories.map((cat, i) => {
            const Icon = ICON_MAP[cat.icon] || HelpCircle
            return (
              <button
                key={cat.title}
                onClick={() => {
                  setActiveCat(i)
                  window.scrollTo({ top: 400, behavior: 'smooth' })
                }}
                className={`p-5 rounded-2xl border text-left transition-all hover:shadow-md ${
                  activeCat === i
                    ? 'bg-[#C19A5B]/5 border-[#C19A5B]/30'
                    : 'bg-white border-[#E8DFD3] hover:border-[#C19A5B]/40'
                }`}
              >
                <Icon className="w-6 h-6 text-[#C19A5B] mb-3" />
                <h3 className="font-semibold text-[#2C2C2C] text-sm">{cat.title}</h3>
                <p className="text-xs text-[#2C2C2C]/50 mt-1">{cat.items.length} 個問題</p>
              </button>
            )
          })}
        </div>

        {/* ── Contact CTA ── */}
        <section className="mt-12 bg-gradient-to-br from-[#2C2C2C] to-[#1a1a1a] rounded-2xl shadow-sm p-8 md:p-10 text-center">
          <MessageCircle className="w-10 h-10 text-[#C19A5B] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{ctaTitle}</h2>
          <p className="text-white/70 text-sm max-w-md mx-auto mb-6 leading-relaxed">
            {ctaDesc}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://page.line.me/nqo0262k?openQrModal=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#06C755] hover:bg-[#05b14c] text-white rounded-xl text-sm font-medium transition-colors"
            >
              LINE 客服 @ckmu
            </a>
            <Link
              href="/shopping-guide"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors border border-white/20"
            >
              <HelpCircle className="w-4 h-4" />
              購物說明
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
