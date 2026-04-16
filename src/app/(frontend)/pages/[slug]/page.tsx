import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { normalizeMediaUrl } from '@/lib/media-url'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug }, status: { equals: 'published' } },
      limit: 1,
    })
    const page = docs[0] as unknown as Record<string, unknown> | undefined
    if (!page) return { title: '頁面不存在' }
    const seo = page.seo as unknown as Record<string, unknown> | undefined
    return {
      title: (seo?.metaTitle as string) || (page.title as string),
      description: (seo?.metaDescription as string) || undefined,
    }
  } catch {
    return { title: slug }
  }
}

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params
  let page: Record<string, unknown> | null = null

  if (process.env.DATABASE_URI) {
    try {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'pages',
        where: { slug: { equals: slug }, status: { equals: 'published' } },
        limit: 1,
        depth: 3,
      })
      page = (docs[0] as unknown as Record<string, unknown>) || null
    } catch {
      // DB not ready
    }
  }

  if (!page) notFound()

  const sections = (page.layout as unknown as Record<string, unknown>[]) || (page.sections as unknown as Record<string, unknown>[]) || []

  return (
    <main className="bg-cream-50 min-h-screen">
      {sections.map((section, idx) => (
        <SectionRenderer key={idx} section={section} />
      ))}
    </main>
  )
}

function SectionRenderer({ section }: { section: Record<string, unknown> }) {
  const blockType = section.blockType as string

  switch (blockType) {
    case 'hero-banner':
      return (
        <section className="relative min-h-[60vh] flex items-center bg-gradient-to-br from-cream-100 to-blush-50">
          {Boolean((section.backgroundImage as unknown as Record<string, unknown>)?.url) && (
            <Image
              src={(section.backgroundImage as unknown as Record<string, unknown>).url as string}
              alt=""
              fill
              className="object-cover"
            />
          )}
          {Boolean(section.overlay) && (
            <div className="absolute inset-0 bg-black/30" />
          )}
          <div className="container relative z-10 py-16 text-center">
            <h1 className="text-3xl md:text-5xl font-serif mb-4">{section.heading as string}</h1>
            {Boolean(section.subheading) && (
              <p className="text-base text-muted-foreground max-w-lg mx-auto mb-8">
                {section.subheading as string}
              </p>
            )}
            {Boolean(section.ctaText) && (
              <Link
                href={(section.ctaLink as string) || '#'}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold-500 text-white rounded-full text-sm tracking-wide hover:bg-gold-600 transition-colors"
              >
                {section.ctaText as string} <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </section>
      )

    case 'rich-content':
      return (
        <section className="py-12 md:py-16">
          <div className="container max-w-3xl">
            <div className="bg-white rounded-2xl border border-cream-200 p-8 prose prose-sm max-w-none">
              <p className="text-sm text-muted-foreground">
                頁面內容載入中，請稍候…
              </p>
            </div>
          </div>
        </section>
      )

    case 'image-gallery':
      return (
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {((section.images as unknown as Record<string, unknown>[]) || []).map((img, i) => {
                const image = img.image as unknown as Record<string, unknown> | undefined
                return (
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 relative">
                    {image?.url ? (
                      <Image src={normalizeMediaUrl(image.url as string) || ''} alt="" fill className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">圖片 {i + 1}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )

    case 'call-to-action':
      return (
        <section className="py-12 md:py-16">
          <div className="container">
            <div className="rounded-3xl overflow-hidden bg-gradient-to-r from-gold-500/10 to-blush-100 p-8 md:p-16 text-center">
              <h2 className="text-2xl md:text-3xl font-serif mb-4">{section.heading as string}</h2>
              {Boolean(section.description) && (
                <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                  {section.description as string}
                </p>
              )}
              {Boolean(section.buttonText) && (
                <Link
                  href={(section.buttonLink as string) || '#'}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-foreground text-cream-50 rounded-full text-sm tracking-wide hover:bg-foreground/90 transition-colors"
                >
                  {section.buttonText as string} <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </section>
      )

    case 'faq':
      return (
        <section className="py-12 md:py-16 bg-white">
          <div className="container max-w-3xl">
            <h2 className="text-2xl font-serif mb-8 text-center">{section.heading as string}</h2>
            <div className="space-y-4">
              {((section.questions as unknown as Record<string, unknown>[]) || []).map((q, i) => (
                <details key={i} className="bg-cream-50 rounded-xl p-5 border border-cream-200 group">
                  <summary className="cursor-pointer text-sm font-medium list-none flex items-center justify-between">
                    {q.question as string}
                    <span className="text-gold-500 group-open:rotate-45 transition-transform text-lg">+</span>
                  </summary>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    常見問題答案（由 Payload Rich Text 渲染）
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )

    case 'countdown':
      return (
        <section className="py-12 md:py-16 bg-gradient-to-r from-blush-100 to-cream-100">
          <div className="container text-center">
            <h2 className="text-2xl md:text-3xl font-serif mb-3">{section.heading as string}</h2>
            {Boolean(section.description) && (
              <p className="text-sm text-muted-foreground mb-6">{section.description as string}</p>
            )}
            <div className="flex justify-center gap-4 mb-8">
              {['天', '時', '分', '秒'].map((unit) => (
                <div key={unit} className="bg-white rounded-xl p-4 w-16 shadow-sm">
                  <p className="text-2xl font-medium">00</p>
                  <p className="text-[10px] text-muted-foreground">{unit}</p>
                </div>
              ))}
            </div>
            {Boolean(section.ctaText) && (
              <Link
                href={(section.ctaLink as string) || '#'}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gold-500 text-white rounded-full text-sm hover:bg-gold-600 transition-colors"
              >
                {section.ctaText as string} <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </section>
      )

    case 'testimonial':
      return (
        <section className="py-12 md:py-16">
          <div className="container">
            <h2 className="text-2xl font-serif mb-8 text-center">{section.heading as string}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {((section.testimonials as unknown as Record<string, unknown>[]) || []).map((t, i) => (
                <div key={i} className="bg-white rounded-2xl border border-cream-200 p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-cream-100 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground italic mb-3 leading-relaxed">
                    &ldquo;{t.content as string}&rdquo;
                  </p>
                  <p className="text-xs font-medium">{t.name as string}</p>
                  {(t.rating as number) && (
                    <p className="text-gold-500 text-xs mt-1">
                      {'★'.repeat(t.rating as number)}{'☆'.repeat(5 - (t.rating as number))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )

    case 'divider':
      return (
        <div className="container py-4">
          <hr className="border-cream-200" style={{ height: `${(section.height as number) || 1}px` }} />
        </div>
      )

    case 'video':
      return (
        <section className="py-12 md:py-16">
          <div className="container max-w-3xl">
            <div className="aspect-video bg-cream-100 rounded-2xl border border-cream-200 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">影片嵌入：{section.url as string}</p>
            </div>
            {Boolean(section.caption) && (
              <p className="text-xs text-center text-muted-foreground mt-3">{section.caption as string}</p>
            )}
          </div>
        </section>
      )

    default:
      return null
  }
}
