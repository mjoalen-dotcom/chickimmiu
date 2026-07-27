import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { CategoryPLPClient } from './CategoryPLPClient'
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd'
import { normalizeMediaUrl } from '@/lib/media-url'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PAGE_SIZE = 24

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!process.env.DATABASE_URI) return { title: slug }
  // 查詢包 try（DB 錯誤 → 佔位 title）；miss 判斷放 try 外——
  // notFound() 是 throw 實作，放進 try 會被 catch 吞掉。
  let cat: Record<string, unknown> | undefined
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    cat = docs[0] as unknown as Record<string, unknown> | undefined
  } catch {
    return { title: slug }
  }
  // 查無分類：metadata 階段 notFound()（soft-404 緩解；狀態碼受 loading.tsx flush 限制）
  if (!cat) notFound()
  const seo = cat.seo as Record<string, unknown> | undefined
  return {
    title: (seo?.metaTitle as string) || `${(cat as { name?: string }).name} | CHIC KIM & MIU`,
    description:
      (seo?.metaDescription as string) || (cat as { description?: string }).description,
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const page = Math.max(1, parseInt((sp.page as string) || '1', 10) || 1)
  const sort = (sp.sort as string) || '-createdAt'

  if (!process.env.DATABASE_URI) notFound()

  const payload = await getPayload({ config })

  const catRes = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug }, isActive: { not_equals: false } },
    limit: 1,
    depth: 1,
  })
  const category = catRes.docs[0] as unknown as Record<string, unknown> | undefined
  if (!category) notFound()

  const childRes = await payload.find({
    collection: 'categories',
    where: { parent: { equals: category.id as number } },
    limit: 100,
    depth: 0,
  })
  const familyIds = [category.id as number, ...childRes.docs.map((d) => d.id as number)]

  // 主分類（category）OR 其他分類（additionalCategories hasMany）任一命中即列入
  const where: Where = {
    and: [
      {
        or: [
          { category: { in: familyIds } },
          { additionalCategories: { in: familyIds } },
        ],
      },
      { status: { equals: 'published' } },
    ],
  }

  const result = await payload.find({
    collection: 'products',
    where,
    sort,
    limit: PAGE_SIZE,
    page,
    depth: 2,
  })

  let parent: Record<string, unknown> | null = null
  const parentField = category.parent
  if (parentField) {
    const parentId =
      typeof parentField === 'object' ? (parentField as { id: number }).id : parentField
    const parentRes = await payload.find({
      collection: 'categories',
      where: { id: { equals: parentId } },
      limit: 1,
      depth: 0,
    })
    parent = (parentRes.docs[0] as unknown as Record<string, unknown>) ?? null
  }

  const heroImg = normalizeMediaUrl(
    (category.image as { url?: string } | undefined)?.url,
  )
  const categoryDescription =
    typeof category.description === 'string' ? category.description : ''

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: '首頁', href: '/' },
          { name: '全部商品', href: '/products' },
          ...(parent
            ? [{ name: parent.name as string, href: `/category/${parent.slug as string}` }]
            : []),
          { name: category.name as string, href: `/category/${slug}` },
        ]}
      />
      <main className="bg-cream-50 min-h-screen">
        <section className="relative bg-[#2C2C2C] py-12 md:py-20 overflow-hidden">
          {heroImg && (
            <Image
              src={heroImg}
              alt={category.name as string}
              fill
              unoptimized
              className="object-cover opacity-30"
            />
          )}
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <p className="text-[#C19A5B] text-sm tracking-[0.3em] uppercase mb-3">CATEGORY</p>
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-wider">
              {category.name as string}
            </h1>
            <div className="mt-4 w-12 h-[2px] bg-[#C19A5B] mx-auto" />
            {categoryDescription && (
              <p className="mt-4 text-white/70 text-sm md:text-base max-w-lg mx-auto">
                {categoryDescription}
              </p>
            )}
          </div>
        </section>

        <CategoryPLPClient
          products={result.docs as unknown as Record<string, unknown>[]}
          totalDocs={result.totalDocs}
          totalPages={result.totalPages}
          page={page}
          slug={slug}
          sort={sort}
        />
      </main>
    </>
  )
}
