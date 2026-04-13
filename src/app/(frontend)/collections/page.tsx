import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '主題精選',
  description: '探索 CHIC KIM & MIU 主題精選系列 — 金老佛爺 Live、品牌自訂款、婚禮洋裝、現貨速到等。',
}

const IMG = (id: string, ext = 'png') =>
  `https://shoplineimg.com/559df3efe37ec64e9f000092/${id}/1500x.webp?source_format=${ext}`

const COLLECTIONS = [
  {
    title: '金老佛爺 Live',
    href: '/collections/jin-live',
    image: IMG('69d3d8324c5226e1bcda99eb'),
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    title: '金金同款專區',
    href: '/collections/jin-style',
    image: IMG('69ca4f60043ccd59ea96d5db'),
    span: '',
  },
  {
    title: '主播同款專區',
    href: '/collections/host-style',
    image: IMG('69ca51927d644d009eac3783'),
    span: '',
  },
  {
    title: '品牌自訂款',
    href: '/collections/brand-custom',
    image: IMG('69ca53a3584149d3b5f646f9'),
    span: 'md:col-span-2',
  },
  {
    title: '婚禮洋裝 / 正式洋裝',
    href: '/collections/formal-dresses',
    image: IMG('69ca5266dd7f90b1732e8a5d'),
    span: '',
  },
  {
    title: '現貨速到專區 Rush',
    href: '/collections/rush',
    image: IMG('69d3d83b4ef225a55ea202e5'),
    span: '',
  },
  {
    title: '藝人穿搭',
    href: '/collections/celebrity-style',
    image: IMG('69d3d850293e6404cf30e5ce'),
    span: 'md:col-span-2',
  },
]

export default function CollectionsPage() {
  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Hero ── */}
      <section className="py-12 md:py-16 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-widest">
          主題精選
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-[#C19A5B] mx-auto" />
        <p className="mt-4 text-[#2C2C2C]/60 text-sm max-w-md mx-auto">
          依風格、場合、主題瀏覽我們為您精心策劃的系列
        </p>
      </section>

      {/* ── Bento Grid ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5 auto-rows-[260px] md:auto-rows-[280px]">
          {COLLECTIONS.map((col) => (
            <Link
              key={col.href}
              href={col.href}
              className={`group relative rounded-2xl overflow-hidden ${col.span}`}
            >
              <Image
                src={col.image}
                alt={col.title}
                fill
                unoptimized
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Default overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent transition-opacity duration-500" />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-[#C19A5B]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {/* Title */}
              <div className="absolute inset-0 flex items-end p-6 md:p-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-md transition-transform duration-500 group-hover:-translate-y-1">
                    {col.title}
                  </h2>
                  <div className="mt-2 w-0 group-hover:w-12 h-[2px] bg-[#C19A5B] transition-all duration-500" />
                  <p className="mt-2 text-white/80 text-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                    瀏覽系列 →
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
