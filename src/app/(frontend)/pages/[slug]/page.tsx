import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PageBlocks, type PageBlock } from '@/components/page-blocks/PageBlocks'

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

  const sections =
    (page.layout as unknown as PageBlock[]) || (page.sections as unknown as PageBlock[]) || []

  return (
    <main className="bg-cream-50 min-h-screen">
      <PageBlocks blocks={sections} />
    </main>
  )
}
