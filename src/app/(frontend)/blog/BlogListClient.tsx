'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Calendar } from 'lucide-react'

const CATEGORIES = ['全部', '穿搭教學', '時尚趨勢', '新品開箱', '生活風格', '品牌故事']

// Demo posts when DB has no data
const DEMO_POSTS = [
  {
    id: '1', slug: 'autumn-style-guide', title: '秋冬穿搭指南：5 個打造日常優雅的秘訣',
    excerpt: '從基本款單品開始，學會混搭出高級感的秋冬造型，讓你每天都像走在時裝週。',
    category: '穿搭教學', publishedAt: '2024-12-01', featuredImage: null,
  },
  {
    id: '2', slug: 'knit-collection-review', title: '本季必入手：韓系針織系列全開箱',
    excerpt: '從慵懶 oversize 到合身剪裁，每一款都讓你愛不釋手。',
    category: '新品開箱', publishedAt: '2024-11-25', featuredImage: null,
  },
  {
    id: '3', slug: 'size-inclusive-fashion', title: '包容性尺碼的時尚革命：美麗沒有標準答案',
    excerpt: 'CHIC KIM & MIU 相信每位女性都值得穿上讓自己自信的衣服。',
    category: '品牌故事', publishedAt: '2024-11-20', featuredImage: null,
  },
  {
    id: '4', slug: 'office-to-date-look', title: '辦公室到約會：一套衣服兩種風格',
    excerpt: '教你如何用最少的單品，從白天的幹練切換到晚上的甜美。',
    category: '穿搭教學', publishedAt: '2024-11-15', featuredImage: null,
  },
  {
    id: '5', slug: 'winter-trends-2024', title: '2024 冬季時尚趨勢預覽',
    excerpt: '從巧克力棕到奶油白，今年冬季的色彩趨勢比你想像的更柔軟。',
    category: '時尚趨勢', publishedAt: '2024-11-10', featuredImage: null,
  },
  {
    id: '6', slug: 'morning-routine', title: '晨間穿搭儀式感：從選衣服開始的美好一天',
    excerpt: '養成每天花 5 分鐘搭配衣服的習慣，為自己注入一整天的好心情。',
    category: '生活風格', publishedAt: '2024-11-05', featuredImage: null,
  },
]

interface Props {
  initialPosts: Record<string, unknown>[]
}

export function BlogListClient({ initialPosts }: Props) {
  const posts = initialPosts.length > 0 ? initialPosts : DEMO_POSTS
  const [activeCategory, setActiveCategory] = useState('全部')

  const filtered = useMemo(() => {
    if (activeCategory === '全部') return posts
    return posts.filter((p) => (p.category as string) === activeCategory)
  }, [posts, activeCategory])

  return (
    <main className="bg-cream-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-10 md:py-14 text-center">
          <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">STYLE JOURNAL</p>
          <h1 className="text-3xl md:text-4xl font-serif mb-3">穿搭誌</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            穿搭靈感、時尚趨勢與生活風格分享
          </p>
        </div>
      </div>

      <div className="container py-8 md:py-12">
        {/* Category tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-foreground text-cream-50'
                  : 'bg-white border border-cream-200 text-foreground/70 hover:border-gold-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((post) => {
              const featuredImage = post.featuredImage as { url?: string; alt?: string } | null
              return (
                <Link
                  key={post.id as unknown as string}
                  href={`/blog/${post.slug as string}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-cream-200 hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[16/10] bg-cream-100 relative overflow-hidden">
                    {featuredImage?.url ? (
                      <Image
                        src={featuredImage.url}
                        alt={featuredImage.alt || (post.title as string)}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">文章封面</p>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] tracking-widest text-gold-500 uppercase">
                        {post.category as string}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar size={10} />
                        {post.publishedAt as string}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium mb-2 group-hover:text-gold-600 transition-colors line-clamp-2">
                      {post.title as string}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {post.excerpt as string}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-gold-600 mt-3 group-hover:underline">
                      閱讀更多 <ArrowRight size={12} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">此分類目前沒有文章</p>
          </div>
        )}
      </div>
    </main>
  )
}
