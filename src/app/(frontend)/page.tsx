import { getPayload } from 'payload'
import { getMediaUrl } from '@/lib/media-url'
import config from '@payload-config'
import { CoverView } from '@/components/home/CoverView'

/**
 * `/` 歡迎頁（展示封面）— server 資料層
 * ─────────────────────────────────────
 * 渲染全在 CoverView（client）：公開訪客吃這裡 SSR 的 initialData；
 * 後台「首頁設定 → 即時預覽」開同一頁時，CoverView 的 useLivePreview
 * 讓欄位所改即所見。版面規格與歷次決策見 CoverView.tsx 檔頭。
 */

export const revalidate = 300

async function fetchCoverData() {
  const defaults = {
    initialGlobal: {} as Record<string, unknown>,
    fallbackProductImage: null as string | null,
  }
  if (!process.env.DATABASE_URI) return defaults

  try {
    const payload = await getPayload({ config })

    const [homepage, newDocs] = await Promise.all([
      payload
        .findGlobal({ slug: 'homepage-settings', depth: 2 })
        .then((r) => r as unknown as Record<string, unknown>)
        .catch(() => ({}) as Record<string, unknown>),
      payload
        .find({ collection: 'products', sort: '-createdAt', limit: 1, depth: 1 })
        .then((r) => r.docs as unknown as Record<string, unknown>[])
        .catch(() => [] as Record<string, unknown>[]),
    ])

    const firstProduct = newDocs[0]
    const productImages = firstProduct?.images as { image?: { url?: string } | number }[] | undefined
    const firstImg = productImages?.[0]?.image
    const fallbackProductImage =
      typeof firstImg === 'object' && firstImg !== null ? getMediaUrl(firstImg) || null : null

    return { initialGlobal: homepage, fallbackProductImage }
  } catch {
    return defaults
  }
}

export default async function CoverPage() {
  const { initialGlobal, fallbackProductImage } = await fetchCoverData()

  return (
    <CoverView
      initialGlobal={initialGlobal}
      fallbackProductImage={fallbackProductImage}
      serverURL={process.env.NEXT_PUBLIC_SITE_URL || ''}
    />
  )
}
