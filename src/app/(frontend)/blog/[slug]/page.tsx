import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, User, ArrowRight } from 'lucide-react'
import { ArticleJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { RenderLexical } from '@/components/lexical/RenderLexical'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'blog-posts',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
    })
    const post = docs[0] as unknown as Record<string, unknown> | undefined
    if (!post) return { title: '文章不存在' }
    const seo = post.seo as unknown as Record<string, unknown> | undefined
    const featuredImg = post.featuredImage as { url?: string } | null
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

    return {
      title: (seo?.metaTitle as string) || (post.title as string),
      description: (seo?.metaDescription as string) || (post.excerpt as string) || undefined,
      alternates: { canonical: `${siteUrl}/blog/${slug}` },
      openGraph: {
        title: (seo?.metaTitle as string) || (post.title as string),
        description: (seo?.metaDescription as string) || (post.excerpt as string) || undefined,
        type: 'article',
        url: `${siteUrl}/blog/${slug}`,
        images: featuredImg?.url ? [{ url: featuredImg.url }] : undefined,
        publishedTime: post.publishedAt as string,
      },
      twitter: {
        card: 'summary_large_image',
        title: (seo?.metaTitle as string) || (post.title as string),
        images: featuredImg?.url ? [featuredImg.url] : undefined,
      },
    }
  } catch {
    return { title: slug }
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  let post: Record<string, unknown> | null = null
  let relatedPosts: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'blog-posts',
        where: { slug: { equals: slug }, status: { equals: 'published' } },
        limit: 1,
        depth: 2,
      })
      post = (docs[0] as unknown as Record<string, unknown>) || null

      if (post) {
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
    } catch {
      // DB not ready — use demo
    }
  }

  // Demo fallback
  if (!post) {
    post = {
      id: 'demo',
      slug,
      title: '秋冬穿搭指南：5 個打造日常優雅的秘訣',
      excerpt: '從基本款單品開始，學會混搭出高級感的秋冬造型。',
      category: '穿搭教學',
      publishedAt: '2024-12-01',
      author: { name: 'CHIC KIM & MIU 編輯部' },
      content: null,
      featuredImage: null,
    }
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
            {post.category as string}
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

        {/* Featured image */}
        {featuredImage?.url && (
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
                  <p className="text-[10px] text-gold-500 tracking-wider mb-1">{rp.category as string}</p>
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
