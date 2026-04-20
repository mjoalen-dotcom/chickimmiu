import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'

export const metadata: Metadata = {
  title: '我的造型卡收藏',
  description: '購物、點數兌換、合成取得的專屬造型卡。',
  robots: { index: false, follow: false },
}

/**
 * PR A: 造型卡收藏 dashboard（唯讀）。
 *
 * 此頁目前只顯示持有、已銷毀、已撤回三種狀態。
 * PR B 會補：轉送按鈕、銷毀按鈕、合成介面、action bar。
 * PR C 會補：分享到社群（OG 圖）、點數商店兌換卡片入口。
 */

type CardDoc = {
  id: number
  displayTitle?: string
  cardType: 'common' | 'limited'
  serialNo?: number | null
  status: 'active' | 'burned' | 'revoked' | 'transferred-out'
  mintedVia: 'purchase' | 'points-shop' | 'craft'
  mintedAt: string
  shareSlug: string
  product?:
    | {
        id: number
        title?: string
        images?: Array<{ image?: { url?: string } | string | null } | null>
      }
    | null
    | number
  template?: { id: number; totalSupply?: number } | null | number
}

type Tab = 'active' | 'burned' | 'revoked'

function pickProduct(p: CardDoc['product']): { title?: string; imageUrl?: string } {
  if (!p || typeof p !== 'object') return {}
  const title = p.title
  const firstImg = p.images?.[0]?.image
  const imageUrl =
    typeof firstImg === 'string'
      ? firstImg
      : firstImg && typeof firstImg === 'object'
        ? (firstImg as { url?: string }).url
        : undefined
  return { title, imageUrl }
}

function pickTotalSupply(t: CardDoc['template']): number | undefined {
  if (!t || typeof t !== 'object') return undefined
  return t.totalSupply
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/account/cards')

  const params = await searchParams
  const tab: Tab =
    params.tab === 'burned' || params.tab === 'revoked' ? params.tab : 'active'

  // active tab：owner = me AND status = active
  // burned / revoked：owner 可能已 null，要改用 originalOwner = me 過濾
  const where: Where =
    tab === 'active'
      ? {
          and: [
            { owner: { equals: user.id } },
            { status: { equals: 'active' } },
          ],
        }
      : {
          and: [
            { originalOwner: { equals: user.id } },
            { status: { equals: tab } },
          ],
        }

  const result = await payload.find({
    collection: 'collectible-cards',
    where,
    sort: '-mintedAt',
    limit: 200,
    depth: 1,
  })

  const cards = result.docs as unknown as CardDoc[]

  // active tab summary
  const counts = {
    common: cards.filter((c) => c.cardType === 'common' && c.status === 'active').length,
    limited: cards.filter((c) => c.cardType === 'limited' && c.status === 'active').length,
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          我的造型卡收藏
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          購物滿 NT$5,000 即獲限量編號卡；一般商品每件發放普通卡。3 張同款普通卡可合成 1 張限量卡。
        </p>
        {tab === 'active' && (
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">普通卡：</span>
              <span className="ml-1 font-semibold text-gray-900">{counts.common}</span>
            </div>
            <div>
              <span className="text-gray-500">限量卡：</span>
              <span className="ml-1 font-semibold text-amber-700">{counts.limited}</span>
            </div>
          </div>
        )}
      </header>

      <nav className="mb-6 flex gap-1 border-b border-gray-200">
        {(['active', 'burned', 'revoked'] as Tab[]).map((t) => (
          <Link
            key={t}
            href={`/account/cards${t === 'active' ? '' : `?tab=${t}`}`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-amber-600 text-amber-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'active' ? '持有中' : t === 'burned' ? '已銷毀' : '已撤回'}
          </Link>
        ))}
      </nav>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">
            {tab === 'active'
              ? '還沒有任何卡片。去逛逛商品，完成訂單就會獲得第一張卡！'
              : tab === 'burned'
                ? '還沒有銷毀過任何卡片。'
                : '沒有被撤回的卡片。'}
          </p>
          {tab === 'active' && (
            <Link
              href="/products"
              className="mt-4 inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              前往商品
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => {
            const { title, imageUrl } = pickProduct(c.product)
            const totalSupply = pickTotalSupply(c.template)
            const isLimited = c.cardType === 'limited'
            return (
              <div
                key={c.id}
                className={`group relative overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md ${
                  isLimited
                    ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-white'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="aspect-[4/5] w-full overflow-hidden bg-gray-100">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={title || 'Card'}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      無圖
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isLimited
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {isLimited ? '限量' : '普通'}
                    </span>
                    {isLimited && c.serialNo != null && (
                      <span className="text-xs font-mono text-amber-700">
                        #{String(c.serialNo).padStart(4, '0')}
                        {totalSupply ? ` / ${totalSupply}` : ''}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 line-clamp-1 text-sm font-medium text-gray-900">
                    {title || c.displayTitle || '未命名'}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(c.mintedAt).toLocaleDateString('zh-TW')}
                    {' · '}
                    {c.mintedVia === 'purchase'
                      ? '購買'
                      : c.mintedVia === 'points-shop'
                        ? '點數兌換'
                        : '合成'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <footer className="mt-10 rounded-lg bg-gray-50 p-4 text-xs text-gray-500">
        <p>
          <strong className="text-gray-700">即將開放：</strong>
          轉送給朋友、銷毀換點數、三張合成限量卡、分享到社群平台、點數商店兌換限量卡。
        </p>
      </footer>
    </div>
  )
}
