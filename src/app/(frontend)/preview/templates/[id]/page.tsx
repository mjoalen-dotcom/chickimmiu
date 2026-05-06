import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { PageBlocks, type PageBlock } from '@/components/page-blocks/PageBlocks'
import PreviewBanner from '@/components/page-blocks/PreviewBanner'
import { getTemplateById, hydrateTemplateLayout } from '@/lib/pageTemplates'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '樣本預覽',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ id: string }>
}

/**
 * /preview/templates/[id]
 * ───────────────────────
 * Admin-only preview of a quick-start Page template — renders the template
 * using the same SectionRenderer the live /pages/[slug] route uses, so admins
 * can see exactly what the template looks like before committing to create.
 *
 * Auth: admin only (redirects non-admin to /admin/login).
 * Hydration mirrors the /api/pages/from-template flow so what you preview is
 * exactly what `pnpm payload create` would persist.
 */
export default async function TemplatePreviewPage({ params }: Props) {
  const { id } = await params

  const template = getTemplateById(id)
  if (!template) notFound()

  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user || (user as { role?: string }).role !== 'admin') {
    redirect(`/admin/login?redirect=${encodeURIComponent(`/preview/templates/${id}`)}`)
  }

  // Pull first Media for image-gallery / lookbook-grid placeholder, mirroring
  // src/app/api/pages/from-template/route.ts.
  let placeholderImageId: string | number | null = null
  try {
    const mediaResult = await payload.find({
      collection: 'media',
      sort: 'createdAt',
      limit: 1,
      depth: 0,
    })
    const firstMedia = mediaResult.docs[0] as { id?: string | number } | undefined
    if (firstMedia?.id) placeholderImageId = firstMedia.id
  } catch {
    /* best-effort */
  }

  const hydrated = hydrateTemplateLayout(template.layout, {
    now: new Date(),
    placeholderImageId,
  })

  // The hydrate step inserts placeholder *ids*; for visual fidelity in the
  // preview we want the actual url. Re-fetch and replace on each block that
  // has the placeholder id.
  let placeholderMedia: { id: string | number; url?: string; alt?: string } | null = null
  if (placeholderImageId != null) {
    try {
      const m = (await payload.findByID({
        collection: 'media',
        id: placeholderImageId,
        depth: 0,
      })) as { id?: string | number; url?: string; alt?: string } | null
      if (m?.id != null) {
        placeholderMedia = { id: m.id, url: m.url, alt: m.alt }
      }
    } catch {
      /* best-effort */
    }
  }

  const blocksForRender: PageBlock[] = placeholderMedia
    ? hydrated.map((block) => expandPlaceholder(block, placeholderImageId, placeholderMedia!))
    : (hydrated as PageBlock[])

  return (
    <main className="bg-cream-50 min-h-screen">
      <PreviewBanner
        templateId={template.id}
        templateName={template.name}
        hadPlaceholder={Boolean(placeholderImageId)}
      />
      <PageBlocks blocks={blocksForRender} />
    </main>
  )
}

/**
 * The hydrate function leaves images as bare ids (because payload.create
 * resolves them). For the preview's renderer we need the full media doc so
 * <Image src=…> works. Walk known shapes and replace.
 */
function expandPlaceholder(
  block: PageBlock,
  placeholderId: string | number | null,
  media: { id: string | number; url?: string; alt?: string },
): PageBlock {
  if (placeholderId == null) return block
  const matches = (v: unknown) => v === placeholderId

  switch (block.blockType) {
    case 'image-gallery': {
      const images = (block.images as Array<Record<string, unknown>>) || []
      return {
        ...block,
        images: images.map((img) => (matches(img.image) ? { ...img, image: media } : img)),
      }
    }
    case 'lookbook-grid': {
      const items = (block.items as Array<Record<string, unknown>>) || []
      return {
        ...block,
        items: items.map((it) => (matches(it.image) ? { ...it, image: media } : it)),
      }
    }
    case 'magazine-cover':
      return matches(block.image) ? { ...block, image: media } : block
    case 'kol-persona':
      return matches(block.avatar) ? { ...block, avatar: media } : block
    case 'editorial-spread': {
      const rows = (block.rows as Array<Record<string, unknown>>) || []
      return {
        ...block,
        rows: rows.map((r) => (matches(r.image) ? { ...r, image: media } : r)),
      }
    }
    default:
      return block
  }
}
