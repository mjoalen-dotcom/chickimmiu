import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, Clock, Sparkles, Tag } from 'lucide-react'
import { RenderLexical } from '@/components/lexical/RenderLexical'
import { PodcastPlayerClient } from './PodcastPlayerClient'

const CATEGORY_LABELS: Record<string, string> = {
  'new-arrivals': '新貨開箱',
  trends: '韓系趨勢',
  sourcing: '採購故事',
  marketing: '行銷洞察',
  'customer-stories': '客戶故事',
  'brand-story': '品牌故事',
}

interface Props {
  params: Promise<{ slug: string }>
}

function formatDuration(secs?: number): string {
  if (!secs || secs < 0) return ''
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m} 分 ${String(s).padStart(2, '0')} 秒`
}

function formatDate(d?: string): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return ''
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'podcasts',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
    })
    const ep = docs[0] as unknown as Record<string, unknown> | undefined
    if (!ep) return { title: '節目不存在' }
    const seo = ep.seo as unknown as Record<string, unknown> | undefined
    const cover = ep.coverImage as { url?: string } | null
    const seoImg = (seo?.metaImage as { url?: string } | null) || cover
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'

    return {
      title: (seo?.metaTitle as string) || (ep.title as string),
      description: (seo?.metaDescription as string) || (ep.excerpt as string) || undefined,
      alternates: { canonical: `${siteUrl}/podcast/${slug}` },
      openGraph: {
        title: (seo?.metaTitle as string) || (ep.title as string),
        description: (seo?.metaDescription as string) || (ep.excerpt as string) || undefined,
        type: 'article',
        url: `${siteUrl}/podcast/${slug}`,
        images: seoImg?.url ? [{ url: seoImg.url }] : undefined,
        publishedTime: ep.publishedAt as string,
      },
    }
  } catch {
    return { title: slug }
  }
}

export default async function PodcastEpisodePage({ params }: Props) {
  const { slug } = await params
  let episode: Record<string, unknown> | null = null
  let related: Record<string, unknown>[] = []

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'podcasts',
        where: { slug: { equals: slug }, status: { equals: 'published' } },
        limit: 1,
        depth: 2,
      })
      episode = (docs[0] as unknown as Record<string, unknown>) || null

      if (episode) {
        const others = await payload.find({
          collection: 'podcasts',
          where: {
            status: { equals: 'published' },
            id: { not_equals: episode.id },
          },
          sort: '-episodeNumber',
          limit: 3,
          depth: 2,
        })
        related = others.docs as unknown as Record<string, unknown>[]
      }
    } catch {
      // DB not ready
    }
  }

  if (!episode) notFound()

  const epNum = episode.episodeNumber as number
  const cover = episode.coverImage as { url?: string; alt?: string } | null
  const audio = episode.audioFile as { url?: string; filename?: string } | null
  const duration = episode.duration as number | undefined
  const tags = (episode.tags as Array<{ tag: string }> | undefined) || []
  const sources = (episode.sources as Array<{ label: string; url?: string }> | undefined) || []
  const hosts = (episode.hosts as Array<{ name: string; role?: string }> | undefined) || []
  const relatedProducts = (episode.relatedProducts as Array<Record<string, unknown>> | undefined) || []
  const showNotes = episode.showNotes as unknown
  const aiGenerated = episode.aiGenerated as boolean | undefined
  const catLabel = CATEGORY_LABELS[episode.category as string] || ''

  return (
    <main className="bg-cream-50 min-h-screen">
      <div className="container py-8 md:py-12 max-w-3xl">
        {/* Back link */}
        <Link
          href="/podcast"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-gold-600 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> 返回節目列表
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] tracking-widest text-gold-500 uppercase">
              EP{String(epNum).padStart(2, '0')}
              {catLabel ? ` · ${catLabel}` : ''}
            </span>
            {aiGenerated ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/80 text-cream-50 text-[10px] tracking-wider">
                <Sparkles size={10} /> AI 生成
              </span>
            ) : null}
          </div>
          <h1 className="font-serif text-2xl md:text-3xl leading-tight mb-3">
            {episode.title as string}
          </h1>
          {episode.excerpt ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {episode.excerpt as string}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-[11px] text-muted-foreground">
            {duration ? (
              <span className="flex items-center gap-1">
                <Clock size={11} /> {formatDuration(duration)}
              </span>
            ) : null}
            {episode.publishedAt ? (
              <span className="flex items-center gap-1">
                <Calendar size={11} /> {formatDate(episode.publishedAt as string)}
              </span>
            ) : null}
            {hosts.length > 0 ? (
              <span className="text-muted-foreground">
                主持：{hosts.map((h) => h.name).join('、')}
              </span>
            ) : null}
          </div>
        </div>

        {/* Cover + Player */}
        {cover?.url ? (
          <div className="aspect-square max-w-md mx-auto rounded-2xl overflow-hidden mb-6 bg-cream-100 relative">
            <Image
              src={cover.url}
              alt={cover.alt || (episode.title as string)}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>
        ) : null}

        {audio?.url ? (
          <div className="mb-8">
            <PodcastPlayerClient
              audioUrl={audio.url}
              durationSeconds={duration}
              title={episode.title as string}
            />
          </div>
        ) : (
          <div className="mb-8 p-4 rounded-xl bg-cream-100 text-sm text-muted-foreground text-center">
            本集音訊尚未上傳
          </div>
        )}

        {/* Show notes */}
        {showNotes ? (
          <section className="mb-10">
            <h2 className="font-serif text-lg md:text-xl mb-4">節目筆記</h2>
            <div className="prose prose-sm md:prose-base max-w-none prose-headings:font-serif prose-a:text-gold-600 prose-a:no-underline hover:prose-a:underline">
              <RenderLexical content={showNotes} />
            </div>
          </section>
        ) : null}

        {/* Sources */}
        {sources.length > 0 ? (
          <section className="mb-10 p-5 rounded-xl bg-white border border-cream-200">
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Tag size={14} /> 參考來源
            </h2>
            <ul className="space-y-2 text-sm">
              {sources.map((src, i) => (
                <li key={i}>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-600 hover:underline break-all"
                    >
                      {src.label}
                    </a>
                  ) : (
                    <span>{src.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Tags */}
        {tags.length > 0 ? (
          <section className="mb-10">
            <div className="flex flex-wrap gap-2">
              {tags.map((t, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full bg-white border border-cream-200 text-[11px] text-foreground/70"
                >
                  #{t.tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* Related products */}
        {relatedProducts.length > 0 ? (
          <section className="mb-10">
            <h2 className="font-serif text-lg md:text-xl mb-4">節目提到的商品</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {relatedProducts.slice(0, 6).map((p) => {
                const prodSlug = p.slug as string
                const prodName = p.name as string
                const images = p.images as Array<{ image: { url?: string; alt?: string } }> | undefined
                const firstImg = images?.[0]?.image
                return (
                  <Link
                    key={p.id as unknown as string}
                    href={`/products/${prodSlug}?ref=podcast-${slug}`}
                    className="group block"
                  >
                    <div className="aspect-[3/4] bg-cream-100 rounded-xl overflow-hidden relative mb-2">
                      {firstImg?.url ? (
                        <Image
                          src={firstImg.url}
                          alt={firstImg.alt || prodName}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                          商品圖
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-tight group-hover:text-gold-600 transition-colors line-clamp-2">
                      {prodName}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Related episodes */}
        {related.length > 0 ? (
          <section className="mt-12 pt-8 border-t border-cream-200">
            <h2 className="font-serif text-lg md:text-xl mb-4">其他集數</h2>
            <ul className="space-y-3">
              {related.map((r) => {
                const rNum = r.episodeNumber as number
                return (
                  <li key={r.id as unknown as string}>
                    <Link
                      href={`/podcast/${r.slug as string}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-cream-200 hover:border-gold-400 transition-colors"
                    >
                      <span className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-gold-100 to-cream-200 text-gold-700 flex items-center justify-center text-[10px] tracking-widest">
                        EP{String(rNum).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight line-clamp-1">{r.title as string}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {(r.excerpt as string) || ''}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  )
}
