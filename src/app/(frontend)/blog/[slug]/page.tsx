import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, User, ArrowRight } from 'lucide-react'
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { RenderLexical } from '@/components/lexical/RenderLexical'
import { BrandHeroPlayer } from '@/components/blog/BrandHeroPlayer'

/**
 * 找 published 文章：先用精確 slug match，沒命中時用 prefix `${slug}-%` 找
 * （救歷史 AI 草稿的 `-{timestamp}` 後綴 slug，user 把 hash 拿掉貼短 URL 仍能 redirect 到正式 URL）。
 * 回傳：{ post, canonicalSlug } — 若 canonicalSlug 跟原本不同，呼叫端應 permanentRedirect。
 */
/**
 * Next.js 15 prod build 對 `[slug]` 動態段不會自動 URL-decode 非 ASCII params
 * （15.5 已確認 regression）。BlogListClient 用 `href={\`/blog/\${slug}\`}` 把
 * raw 中文字塞 href，browser 送 request 時 percent-encode UTF-8，server 端 params
 * 拿到的卻是 encoded `2026-%E5%A4%8F...`。DB slug 是 raw UTF-8 `2026-夏...`，
 * 直接 equals query 永遠 0 match → 我們在 query 前先 decode。
 */
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    // 萬一 raw 內含非合法 %XX 序列（例如已經 decode 的字串再被 decode），直接回原值。
    return raw
  }
}

// BlogPosts.category 的 select 值 → 中文標籤（與 BlogCategories seed 一致）
const CATEGORY_LABELS: Record<string, string> = {
  styling: '穿搭教學',
  'new-arrivals': '新品介紹',
  'brand-story': '品牌故事',
  promotions: '優惠活動',
  trends: '時尚趨勢',
}
function catLabel(v: unknown): string {
  const s = typeof v === 'string' ? v : ''
  return CATEGORY_LABELS[s] || s
}

async function findPublishedPost(
  rawSlug: string,
): Promise<{ post: Record<string, unknown> | null; canonicalSlug: string | null }> {
  const slug = decodeSlug(rawSlug)
  const payload = await getPayload({ config })

  const exact = await payload.find({
    collection: 'blog-posts',
    where: { slug: { equals: slug }, status: { equals: 'published' } },
    limit: 1,
    depth: 2,
  })
  if (exact.docs[0]) {
    return { post: exact.docs[0] as unknown as Record<string, unknown>, canonicalSlug: slug }
  }

  // Prefix fallback：例如 user 訪問 `foo` 但 DB 是 `foo-mp0tixa9`
  const prefix = await payload.find({
    collection: 'blog-posts',
    where: { slug: { like: `${slug}-` }, status: { equals: 'published' } },
    limit: 2,
    depth: 2,
  })
  if (prefix.docs.length === 1) {
    const doc = prefix.docs[0] as unknown as Record<string, unknown>
    return { post: doc, canonicalSlug: doc.slug as string }
  }

  return { post: null, canonicalSlug: null }
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }
  // 查詢包 try（DB 錯誤 → 佔位 title）；miss 判斷放 try 外——
  // notFound() 是 throw 實作，放進 try 會被 catch 吞掉還記成 error。
  let post: Record<string, unknown> | null = null
  let canonicalSlug: string | null = null
  try {
    const r = await findPublishedPost(slug)
    post = r.post
    canonicalSlug = r.canonicalSlug
  } catch (err) {
    console.error('[blog/[slug]/generateMetadata] threw:', err instanceof Error ? err.stack : err)
    return { title: slug }
  }
  // 查無文章：metadata 階段 notFound()（soft-404 緩解；狀態碼受 loading.tsx flush 限制）
  if (!post) notFound()

  const seo = post.seo as unknown as Record<string, unknown> | undefined
  const featuredImg = post.featuredImage as { url?: string } | null
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'
  const canonical = `${siteUrl}/blog/${canonicalSlug || slug}`

  return {
    title: (seo?.metaTitle as string) || (post.title as string),
    description: (seo?.metaDescription as string) || (post.excerpt as string) || undefined,
    alternates: { canonical },
    openGraph: {
      title: (seo?.metaTitle as string) || (post.title as string),
      description: (seo?.metaDescription as string) || (post.excerpt as string) || undefined,
      type: 'article',
      url: canonical,
      images: featuredImg?.url ? [{ url: featuredImg.url }] : undefined,
      publishedTime: post.publishedAt as string,
    },
    twitter: {
      card: 'summary_large_image',
      title: (seo?.metaTitle as string) || (post.title as string),
      images: featuredImg?.url ? [featuredImg.url] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params

  if (!process.env.DATABASE_URI) {
    notFound()
  }

  let post: Record<string, unknown> | null = null
  let canonicalSlug: string | null = null
  let relatedPosts: Record<string, unknown>[] = []

  try {
    const result = await findPublishedPost(slug)
    post = result.post
    canonicalSlug = result.canonicalSlug

    if (post) {
      const payload = await getPayload({ config })
      const related = await payload.find({
        collection: 'blog-posts',
        where: {
          status: { equals: 'published' },
          id: { not_equals: post.id },
          category: { equals: post.category },
        },
        limit: 3,
        depth: 2,
      })
      relatedPosts = related.docs as unknown as Record<string, unknown>[]
    }
  } catch (err) {
    // 之前是 silent catch + demo fallback → user 以為「後台沒套進來」其實是 throw 被吞掉。
    // 現在改成印出來 + 跳 404，至少 prod log 看得到 root cause。
    console.error(
      '[blog/[slug]/page] payload.find threw:',
      err instanceof Error ? err.stack : err,
    )
    notFound()
  }

  if (!post) {
    notFound()
  }

  // 若 user 訪問 short slug 但 DB 是 long slug（AI 草稿的 timestamp 後綴），301 到正式 URL。
  // 比較 decoded slug 而非 raw（raw 可能是 percent-encoded），避免 encoded URL 觸發無用 301。
  if (canonicalSlug && canonicalSlug !== decodeSlug(slug)) {
    permanentRedirect(`/blog/${canonicalSlug}`)
  }

  const featuredImage = post.featuredImage as { url?: string; alt?: string } | null
  const author = post.author as unknown as Record<string, unknown> | null

  return (
    <>
      <ArticleJsonLd
        title={post.title as string}
        description={(post.excerpt as string) || undefined}
        publishedAt={post.publishedAt as string}
        authorName={(author?.name as string) || undefined}
        slug={slug}
        image={featuredImage?.url || undefined}
      />
      <BreadcrumbJsonLd
        items={[
          { name: '首頁', href: '/' },
          { name: '穿搭誌', href: '/blog' },
          { name: post.title as string, href: `/blog/${slug}` },
        ]}
      />
    <main className="bg-cream-50 min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-b from-cream-100 to-cream-50 border-b border-cream-200">
        <div className="container py-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft size={14} />
            返回穿搭誌
          </Link>
        </div>
      </div>

      <article className="container max-w-3xl py-8 md:py-12">
        {/* Meta */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] tracking-widest text-gold-500 uppercase">
            {catLabel(post.category)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar size={10} />
            {post.publishedAt as string}
          </span>
          {author && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User size={10} />
              {author.name as string}
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif leading-tight mb-6">
          {post.title as string}
        </h1>

        {Boolean(post.excerpt) && (
          <p className="text-base text-muted-foreground leading-relaxed mb-8">
            {post.excerpt as string}
          </p>
        )}

        {/* Brand hero player — 影片 / 音檔 / 歌詞 / credit（任一空就不渲染對應區塊） */}
        <BrandHeroPlayer
          heroVideo={post.heroVideo as { url?: string; alt?: string; width?: number; height?: number } | null}
          heroAudio={post.heroAudio as { url?: string; alt?: string } | null}
          poster={featuredImage}
          lyrics={post.lyrics as string | null}
          mediaCredit={post.mediaCredit as string | null}
          title={post.title as string}
        />

        {/* Featured image — heroVideo 存在時不再顯示，避免重複視覺 */}
        {!post.heroVideo && featuredImage?.url && (
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-10 border border-cream-200">
            <Image
              src={featuredImage.url}
              alt={featuredImage.alt || (post.title as string)}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Content — Lexical richText rendered via RenderLexical；
            支援 productButton block 直接連到商品頁並帶 ?ref=blog-{slug} 追蹤。 */}
        <div className="bg-white rounded-2xl border border-cream-200 p-8 md:p-12">
          {post.content ? (
            <RenderLexical content={post.content} blogSlug={slug} />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              本篇文章尚未撰寫內容。
            </p>
          )}
        </div>

        {/* Author */}
        <div className="flex items-center gap-4 mt-10 pt-8 border-t border-cream-200">
          <div className="w-12 h-12 rounded-full bg-cream-100 flex items-center justify-center">
            <User size={20} className="text-gold-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{(author?.name as string) || 'CHIC KIM & MIU 編輯部'}</p>
            <p className="text-xs text-muted-foreground">分享穿搭靈感與時尚生活</p>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="bg-white border-t border-cream-200 py-12">
          <div className="container max-w-3xl">
            <h2 className="text-lg font-serif mb-6">相關文章</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.id as unknown as string}
                  href={`/blog/${rp.slug as string}`}
                  className="group bg-cream-50 rounded-xl p-4 hover:bg-cream-100 transition-colors"
                >
                  <p className="text-[10px] text-gold-500 tracking-wider mb-1">{catLabel(rp.category)}</p>
                  <h3 className="text-xs font-medium group-hover:text-gold-600 line-clamp-2">
                    {rp.title as string}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
    </>
  )
}
