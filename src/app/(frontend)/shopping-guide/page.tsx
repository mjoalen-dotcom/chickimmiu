import type { Metadata } from 'next'
import Image from 'next/image'
import { MapPin, Clock, AlertTriangle, Train, Bus, Car, Bike, Package } from 'lucide-react'
import { getPolicySettings } from '@/lib/getPolicySettings'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPolicySettings()
  const sg = (settings?.shoppingGuide || null) as Record<string, unknown> | null
  return {
    title: (sg?.seoTitle as string) || '購物說明',
    description: (sg?.seoDescription as string) || 'CHIC KIM & MIU 購物說明 — 商品來源、工作室試穿預約、交通方式、預購須知。',
  }
}

export default async function ShoppingGuidePage() {
  const settings = await getPolicySettings()
  const sg = (settings?.shoppingGuide || null) as Record<string, unknown> | null
  const pageTitle = (sg?.pageTitle as string) || '購物說明'
  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Hero Banner ── */}
      <section className="relative h-[320px] md:h-[420px] w-full overflow-hidden">
        <Image
          src="https://shoplineimg.com/559df3efe37ec64e9f000092/69ce99f6a88927d62e71333c/1296x.webp?source_format=png"
          alt="購物說明"
          fill
          unoptimized
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-widest drop-shadow-lg">
              {pageTitle}
            </h1>
            <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16 space-y-10">
        {/* ── Section 1: 商品來源 ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#C19A5B]" />
            商品來源
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <div className="text-[#2C2C2C]/80 leading-relaxed space-y-4 text-[15px]">
            <p>
              我們的服飾商品主要和台灣與韓國廠商合作分成、自製、採購、研發，主要韓國直接空運來台，於每項商品頁面中也會註明來源
            </p>
            <p>
              為了不耽誤您的重要時刻及精緻形象，我們提供了工作室的專屬試穿服務，讓您可以實際體驗服飾質感
            </p>
            <p>
              如您有試穿需求歡迎聯繫客服Line /{' '}
              <span className="font-semibold text-[#C19A5B]">@ckmu</span>
              ，提供想試穿『款式、顏色、尺寸』，將依工作室庫存為主為您預約專屬服務哦
            </p>
          </div>
        </section>

        {/* ── Section 2: 工作室資訊 ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-[#C19A5B]" />
            工作室資訊
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />

          <div className="bg-[#FDF8F3] rounded-xl p-6 border border-[#C19A5B]/20 space-y-5">
            {/* 地址 */}
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#C19A5B] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-[#2C2C2C]">地址</p>
                <p className="text-[#2C2C2C]/80 text-[15px]">
                  臺北市信義區基隆路一段68號9樓(京華大樓)
                </p>
              </div>
            </div>

            {/* 開放預約時間 */}
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#C19A5B] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-[#2C2C2C]">開放預約時間</p>
                <ul className="text-[#2C2C2C]/80 text-[15px] mt-1 space-y-1">
                  <li>一三五：10:00-12:00、13:30-16:30</li>
                  <li>二五：13:30-16:30</li>
                </ul>
              </div>
            </div>

            {/* 注意事項 */}
            <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4 border border-amber-200/60">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-amber-800 text-sm leading-relaxed">
                此服務項目須先預約，請先向客服申請試穿款式及時段，請勿自行前往
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 3: 交通方式 ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1 flex items-center gap-2">
            <Train className="w-6 h-6 text-[#C19A5B]" />
            交通方式
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />

          <div className="space-y-5">
            {/* 捷運 */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-6">
              <h3 className="font-bold text-[#2C2C2C] flex items-center gap-2 mb-4 text-lg">
                <Train className="w-5 h-5 text-blue-600" />
                捷運
              </h3>
              <ul className="space-y-3 text-[15px] text-[#2C2C2C]/80">
                <li className="flex items-start gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span>
                    捷運板南線（藍線）：搭至{' '}
                    <strong>市政府站（出口3）</strong>，步行約 8-10 分鐘 或轉乘公車 即可抵達。
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <span>
                    捷運松山新店線（綠線）：搭至{' '}
                    <strong>南京三民站（出口3）</strong>，步行約 10-12 分鐘 或轉乘公車 即可抵達。
                  </span>
                </li>
              </ul>
            </div>

            {/* 公車 */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-6">
              <h3 className="font-bold text-[#2C2C2C] flex items-center gap-2 mb-4 text-lg">
                <Bus className="w-5 h-5 text-emerald-600" />
                轉乘公車
                <span className="text-sm font-normal text-[#2C2C2C]/60">
                  （於「基隆路口二」或「東興路」下車）
                </span>
              </h3>
              <ul className="space-y-3 text-[15px] text-[#2C2C2C]/80">
                <li className="flex items-start gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <span>
                    「捷運市政府站」搭乘至「基隆路口二」，步行約 3 分鐘即可抵達
                    <span className="ml-2 inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      藍10
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <span>
                    「南京公寓(捷運南京三民)」搭乘至「東興路」，步行約 3 分鐘即可抵達
                    {['612', '277', '279', '46', '藍10', '藍26'].map((bus) => (
                      <span
                        key={bus}
                        className="ml-1 inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium"
                      >
                        {bus}
                      </span>
                    ))}
                  </span>
                </li>
              </ul>
            </div>

            {/* 開車 */}
            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-6">
              <h3 className="font-bold text-[#2C2C2C] flex items-center gap-2 mb-4 text-lg">
                <Car className="w-5 h-5 text-orange-600" />
                開車
              </h3>
              <p className="text-[15px] text-[#2C2C2C]/80 mb-4">
                高速公路走國道 1 號（中山高速公路）→ 接 建國高架道路 → 由基隆路出口下交流道，即可抵達。
              </p>
              <div className="bg-white/70 rounded-lg p-4">
                <p className="font-semibold text-[#2C2C2C] text-sm mb-2">
                  鄰近停車場（步行 3 分鐘內）
                </p>
                <ol className="list-decimal list-inside text-[15px] text-[#2C2C2C]/80 space-y-1">
                  <li>
                    日月亭台泥基隆路場（台北市信義區基隆路一段52號，步行約 2 分鐘）
                  </li>
                  <li>
                    正氣橋下停車場（台北市信義區基隆路地下道52號，步行約 2 分鐘）
                  </li>
                </ol>
              </div>
            </div>

            {/* YouBike */}
            <div className="rounded-xl border border-yellow-100 bg-yellow-50/40 p-6">
              <h3 className="font-bold text-[#2C2C2C] flex items-center gap-2 mb-4 text-lg">
                <Bike className="w-5 h-5 text-yellow-600" />
                YouBike
              </h3>
              <p className="text-[15px] text-[#2C2C2C]/80">
                最近的 YouBike 站點：<strong>東興路口站</strong>（步行約 5 分鐘）
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 4: 預購時間 ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1 flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#C19A5B]" />
            預購時間
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <ol className="space-y-4 text-[15px] text-[#2C2C2C]/80 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-[#C19A5B] text-white flex items-center justify-center text-sm font-bold">
                1
              </span>
              <span>
                預購商品正常追加時間為7-14天（不含假日）
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-[#C19A5B] text-white flex items-center justify-center text-sm font-bold">
                2
              </span>
              <span>
                預購商品如遇到原物料缺貨或者其他不可控制因素導致交期延後發生，請見諒
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-[#C19A5B] text-white flex items-center justify-center text-sm font-bold">
                3
              </span>
              <span>
                由於韓國換貨速度很快，若遇斷貨狀況，實在很抱歉，我們會主動聯繫您，若三天內未回覆，商品金額將轉為購物金，若需退款請找客服中心聯絡，我們會盡快處理退款事宜
              </span>
            </li>
          </ol>
        </section>
      </div>
    </main>
  )
}
