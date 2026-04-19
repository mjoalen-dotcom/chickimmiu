import { getPayload } from 'payload'
import config from '@payload-config'
import { ReturnsClient } from './ReturnsClient'

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

export default async function ReturnsPage() {
  const payload = await getPayload({ config })

  let notice = FALLBACK_NOTICE
  try {
    const settings = (await payload.findGlobal({ slug: 'policy-pages-settings' })) as unknown as Record<
      string,
      unknown
    >
    const accountNotice = settings?.accountReturnsNotice as
      | { title?: string; items?: { text?: string }[] }
      | undefined
    const items = accountNotice?.items?.map((it) => String(it?.text || '')).filter(Boolean) ?? []
    if (items.length > 0) {
      notice = {
        title: accountNotice?.title || FALLBACK_NOTICE.title,
        items,
      }
    }
  } catch (err) {
    console.error('[ReturnsPage] 讀取 PolicyPagesSettings.accountReturnsNotice 失敗:', err)
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs tracking-[0.3em] text-gold-500 mb-2">RETURNS &amp; EXCHANGES</p>
        <h1 className="text-2xl font-serif">退換貨管理</h1>
      </div>

      <ReturnsClient />

      {/* Policy reminder — admin-editable via PolicyPagesSettings.accountReturnsNotice */}
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
