import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { ReturnsClient, type ReturnLite, type ExchangeLite } from './ReturnsClient'

const RETURN_REASON_LABEL: Record<string, string> = {
  defective: '商品瑕疵',
  wrong_size: '尺寸不合',
  color_mismatch: '顏色與圖片不符',
  wrong_item: '收到錯誤商品',
  not_wanted: '不喜歡 / 不需要',
  other: '其他',
}

const EXCHANGE_REASON_LABEL: Record<string, string> = {
  wrong_size: '尺寸不合',
  color_mismatch: '顏色不符',
  defective: '商品瑕疵',
  other: '其他',
}

const REFUND_METHOD_LABEL: Record<string, string> = {
  original: '原路退回',
  credit: '購物金',
  bank_transfer: '銀行轉帳',
}

const FALLBACK_NOTICE = {
  title: '退換貨須知',
  items: [
    '商品到貨後 7 天內可申請退換貨',
    '商品需保持原包裝、未拆封、未使用',
    '個人衛生用品（貼身衣物等）恕不接受退換',
    '退款將於收到退回商品後 3-5 個工作天處理',
    '換貨若產生價差，將另行通知補退差額',
  ],
}

export const dynamic = 'force-dynamic'

export default async function ReturnsPage() {
  const payload = await getPayload({ config })
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) redirect('/login?redirect=/account/returns')

  const userId = Number(user.id)
  const where: Where = { customer: { equals: userId } }

  const [returnsResult, exchangesResult, noticeSettings] = await Promise.all([
    payload.find({
      collection: 'returns',
      where,
      depth: 1,
      limit: 50,
      sort: '-createdAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'exchanges',
      where,
      depth: 1,
      limit: 50,
      sort: '-createdAt',
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'policy-pages-settings' }).catch(() => null),
  ])

  const returns: ReturnLite[] = returnsResult.docs.map((raw) => {
    const r = raw as unknown as Record<string, unknown>
    const order = r.order as Record<string, unknown> | null | undefined
    const items = (r.items as Array<Record<string, unknown>> | undefined) ?? []
    return {
      id: String(r.id ?? ''),
      returnNumber: String(r.returnNumber ?? ''),
      orderNumber: String(order?.orderNumber ?? ''),
      createdAt: String(r.createdAt ?? ''),
      status: String(r.status ?? 'pending'),
      items: items.map((it) => {
        const product = it.product as Record<string, unknown> | null | undefined
        return {
          productName: String(product?.name ?? '商品'),
          variant: (it.variant as string | undefined) ?? undefined,
          qty: (it.quantity as number) ?? 0,
          reasonLabel:
            RETURN_REASON_LABEL[String(it.reason ?? '')] ??
            String(it.reason ?? '—'),
        }
      }),
      refundAmount: (r.refundAmount as number | undefined) ?? undefined,
      refundMethodLabel: REFUND_METHOD_LABEL[String(r.refundMethod ?? '')] ?? undefined,
    }
  })

  const exchanges: ExchangeLite[] = exchangesResult.docs.map((raw) => {
    const e = raw as unknown as Record<string, unknown>
    const order = e.order as Record<string, unknown> | null | undefined
    const items = (e.items as Array<Record<string, unknown>> | undefined) ?? []
    return {
      id: String(e.id ?? ''),
      exchangeNumber: String(e.exchangeNumber ?? ''),
      orderNumber: String(order?.orderNumber ?? ''),
      createdAt: String(e.createdAt ?? ''),
      status: String(e.status ?? 'pending'),
      items: items.map((it) => {
        const product = it.product as Record<string, unknown> | null | undefined
        return {
          productName: String(product?.name ?? '商品'),
          from: String(it.originalVariant ?? ''),
          to: String(it.newVariant ?? ''),
          qty: (it.quantity as number) ?? 0,
          reasonLabel:
            EXCHANGE_REASON_LABEL[String(it.reason ?? '')] ??
            String(it.reason ?? '—'),
        }
      }),
      priceDifference: (e.priceDifference as number | undefined) ?? 0,
    }
  })

  let notice = FALLBACK_NOTICE
  if (noticeSettings) {
    const settings = noticeSettings as unknown as Record<string, unknown>
    const accountNotice = settings?.accountReturnsNotice as
      | { title?: string; items?: { text?: string }[] }
      | undefined
    const items =
      accountNotice?.items?.map((it) => String(it?.text || '')).filter(Boolean) ?? []
    if (items.length > 0) {
      notice = {
        title: accountNotice?.title || FALLBACK_NOTICE.title,
        items,
      }
    }
  }

  return (
    <main className="space-y-8">
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">
          RETURNS &amp; EXCHANGES
        </p>
        <h1 className="text-2xl font-serif">退換貨管理</h1>
      </div>

      <ReturnsClient returns={returns} exchanges={exchanges} />

      <div className="bg-cream-50 rounded-2xl border border-cream-200 p-5 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">{notice.title}</p>
        <ul className="space-y-1 list-disc list-inside">
          {notice.items.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </div>
    </main>
  )
}
