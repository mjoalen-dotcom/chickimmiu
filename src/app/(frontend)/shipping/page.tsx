import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Truck, Package, MapPin, Plane, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '運送說明',
  description: 'CHIC KIM & MIU 運送方式、費用與配送時程說明 — 宅配、超商取貨、郵政、國際配送全指南。',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'}/shipping`,
  },
}

type ShippingMethod = {
  id: string | number
  name: string
  carrier: string
  description?: string
  baseFee: number
  freeShippingThreshold?: number
  estimatedDays?: string
  maxWeight?: number
  regions?: string[]
  isActive?: boolean
  sortOrder?: number
}

const CARRIER_LABEL: Record<string, string> = {
  tcat: '黑貓宅急便',
  hct: '新竹物流',
  '711': '7-ELEVEN 超商',
  family: '全家超商',
  hilife: '萊爾富超商',
  ok: 'OK 超商',
  post: '中華郵政',
  dhl: 'DHL 國際',
  fedex: 'FedEx 國際',
  other: '其他',
}

const REGION_LABEL: Record<string, string> = {
  taiwan: '台灣本島',
  offshore: '離島',
  international: '國際',
}

const CARRIER_KIND_ICON: Record<string, typeof Truck> = {
  '711': Package,
  family: Package,
  hilife: Package,
  ok: Package,
  tcat: Truck,
  hct: Truck,
  post: Truck,
  dhl: Plane,
  fedex: Plane,
  other: Package,
}

async function getShippingMethods(): Promise<ShippingMethod[]> {
  if (!process.env.DATABASE_URI) return []
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'shipping-methods',
      where: { isActive: { equals: true } },
      sort: 'sortOrder',
      limit: 50,
      depth: 0,
    })
    return (result.docs as unknown as ShippingMethod[]) || []
  } catch {
    return []
  }
}

function formatFee(n: number): string {
  if (!n) return '免運'
  return `NT$ ${n.toLocaleString('zh-TW')}`
}

export default async function ShippingPage() {
  const methods = await getShippingMethods()

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Header ── */}
      <section className="bg-gradient-to-b from-[#C19A5B]/10 to-[#FDF8F3] pt-16 pb-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#C19A5B] tracking-[0.3em] text-sm font-medium mb-3">CHIC KIM & MIU</p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-wide">運送說明</h1>
          <p className="text-[#2C2C2C]/50 text-sm mt-1">Shipping Information</p>
          <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
          <p className="mt-4 text-[#2C2C2C]/70 text-sm max-w-xl mx-auto leading-relaxed">
            現貨商品於付款完成後 1-2 個工作天內安排出貨；預購商品依商品頁標示到貨時間為準。
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 space-y-10">
        {/* ── Methods ── */}
        <section>
          <div className="text-center mb-8">
            <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">Shipping Methods</p>
            <h2 className="text-2xl font-bold text-[#2C2C2C]">配送方式與費用</h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mx-auto mt-2" />
          </div>

          {methods.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-sm text-[#2C2C2C]/60">
              目前運送方式正在維護中，請聯繫客服取得運費資訊。
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {methods.map((m) => {
                const Icon = CARRIER_KIND_ICON[m.carrier] || Truck
                const regions = (m.regions || [])
                  .map((r) => REGION_LABEL[r] || r)
                  .join(' / ')
                return (
                  <div key={String(m.id)} className="bg-white rounded-2xl shadow-sm p-6 md:p-7 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#C19A5B]/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[#C19A5B]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-[#2C2C2C]">{m.name}</h3>
                        <p className="text-xs text-[#2C2C2C]/50 mt-0.5">
                          {CARRIER_LABEL[m.carrier] || m.carrier}
                        </p>
                      </div>
                    </div>
                    {m.description && (
                      <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">{m.description}</p>
                    )}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm pt-2 border-t border-cream-100">
                      <div>
                        <dt className="text-xs text-[#2C2C2C]/50">運費</dt>
                        <dd className="font-medium text-[#2C2C2C]">{formatFee(m.baseFee)}</dd>
                      </div>
                      {m.freeShippingThreshold && m.freeShippingThreshold > 0 && (
                        <div>
                          <dt className="text-xs text-[#2C2C2C]/50">免運門檻</dt>
                          <dd className="font-medium text-[#2C2C2C]">
                            NT$ {m.freeShippingThreshold.toLocaleString('zh-TW')}
                          </dd>
                        </div>
                      )}
                      {m.estimatedDays && (
                        <div>
                          <dt className="text-xs text-[#2C2C2C]/50">預計到貨</dt>
                          <dd className="font-medium text-[#2C2C2C]">{m.estimatedDays}</dd>
                        </div>
                      )}
                      {regions && (
                        <div>
                          <dt className="text-xs text-[#2C2C2C]/50">配送區域</dt>
                          <dd className="font-medium text-[#2C2C2C]">{regions}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Policy Sections ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <h2 className="text-xl font-bold text-[#2C2C2C] mb-1">出貨與配送說明</h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <div className="space-y-6 text-[15px] text-[#2C2C2C]/80 leading-relaxed">
            <div>
              <h3 className="font-bold text-[#2C2C2C] mb-2 flex items-center gap-2">
                <Package size={16} className="text-[#C19A5B]" />
                出貨時間
              </h3>
              <ul className="space-y-1.5 text-sm list-disc pl-5">
                <li>現貨商品：付款完成後 1-2 個工作天內出貨。</li>
                <li>預購商品：依商品頁標示到貨時間為準，通常為 7-14 個工作天。</li>
                <li>遇國定假日、連續假期或極端天候可能順延，將於訂單頁通知。</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#2C2C2C] mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-[#C19A5B]" />
                超商取貨
              </h3>
              <ul className="space-y-1.5 text-sm list-disc pl-5">
                <li>結帳時可選擇 7-ELEVEN、全家、萊爾富、OK 超商指定門市。</li>
                <li>商品送達門市後將以簡訊通知取件碼。</li>
                <li>請於通知後 7 日內取件，逾期商品將退回。</li>
                <li>單筆包裹限制：5 公斤 / 長寬高合計 &lt; 105 cm。</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#2C2C2C] mb-2 flex items-center gap-2">
                <MapPin size={16} className="text-[#C19A5B]" />
                離島／偏遠地區
              </h3>
              <ul className="space-y-1.5 text-sm list-disc pl-5">
                <li>澎湖、金門、馬祖、綠島、蘭嶼等離島地區可能加收運費 NT$ 200-400，結帳時將自動計算。</li>
                <li>部分物流商不配送離島，建議改用中華郵政掛號。</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#2C2C2C] mb-2 flex items-center gap-2">
                <Plane size={16} className="text-[#C19A5B]" />
                國際配送
              </h3>
              <ul className="space-y-1.5 text-sm list-disc pl-5">
                <li>目前僅接受少數國家國際訂單，費用依目的地與商品重量計算。</li>
                <li>清關費用、進口關稅由收件人承擔，本公司不代繳。</li>
                <li>若需國際配送請透過 LINE 客服或聯絡表單與我們確認。</li>
              </ul>
            </div>

            <div className="bg-[#FDF8F3] border border-[#C19A5B]/20 rounded-xl p-5 flex gap-3">
              <Info size={16} className="text-[#C19A5B] shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-[#2C2C2C] mb-1">物流追蹤</p>
                <p className="text-[#2C2C2C]/70">
                  出貨後將以 Email 及站內通知寄出追蹤碼，您可於
                  <Link href="/account/orders" className="text-[#C19A5B] underline underline-offset-2 mx-1">
                    我的訂單
                  </Link>
                  頁面隨時查看最新物流狀態。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-br from-[#C19A5B]/10 to-[#C19A5B]/5 border border-[#C19A5B]/20 rounded-2xl p-8 md:p-10 text-center">
          <h2 className="text-xl font-bold text-[#2C2C2C] mb-2">有其他運送相關疑問？</h2>
          <p className="text-sm text-[#2C2C2C]/70 max-w-lg mx-auto mb-6">
            包裹遺失、換件配送、地址修改等問題，請透過下方方式聯繫我們。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact?category=shipping_status"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#C19A5B] hover:bg-[#A07A3B] text-white rounded-full text-sm font-medium transition-colors"
            >
              聯絡客服
            </Link>
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-cream-50 text-[#2C2C2C] rounded-full text-sm font-medium transition-colors border border-cream-200"
            >
              常見問題 FAQ
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
