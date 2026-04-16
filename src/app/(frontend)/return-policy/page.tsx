import type { Metadata } from 'next'
import Link from 'next/link'
import { getPolicySettings, extractPolicySections, type PolicySection } from '@/lib/getPolicySettings'

const DEFAULT_SECTIONS: PolicySection[] = [
  { title: '一、適用範圍', content: '適用於 CHIC KIM & MIU 官方網站完成之網路訂單。門市、工作室等非通訊交易方式購買之商品，原則上不適用本網站之通訊交易退貨權益。' },
  { title: '二、退貨權益說明', items: [{ text: '依消保法，收受商品次日起 7 日內可解除契約。' }, { text: '另提供 14 天安心退貨服務。' }, { text: '以物流送達／超商取貨／簽收之次日起算。' }] },
  { title: '三、退貨／換貨申請方式', content: '請聯繫客服提供以下資訊：訂單編號、收件人姓名、聯絡電話、退貨／換貨原因、瑕疵照片／影片。\n⚠️ 未經客服確認即自行寄回者得不受理。' },
  { title: '四、可受理退貨／換貨之條件', items: [{ text: '商品為全新狀態。' }, { text: '原包裝／吊牌／標籤／配件／贈品／發票完整。' }, { text: '無人為污損／異味。' }, { text: '未經修改／裁剪。' }] },
  { title: '五、以下情形恕不受理退換貨', items: [{ text: '超過 14 天安心退貨期限。' }, { text: '福利品／出清品（購買時已註明不退換）。' }, { text: '泳衣／貼身衣物（基於衛生考量）。' }, { text: '鞋類已於室外穿著或鞋底已磨損。' }, { text: '吊牌已拆除或遺失。' }, { text: '已使用／已下水洗滌。' }, { text: '反覆退貨／棄單之異常行為帳號。' }, { text: '於實體場域（工作室）確認後購買之商品。' }, { text: '其他經客服判定不符退換貨條件之情形。' }] },
  { title: '六、非瑕疵範圍說明', content: '以下情況屬正常範圍，不視為瑕疵：', items: [{ text: '尺寸誤差在合理範圍內（約 1-3 cm）。' }, { text: '螢幕色差（因不同螢幕顯示略有差異）。' }, { text: '線頭／輕微壓痕（運送過程中可能產生）。' }, { text: '新品氣味（新製品可能帶有輕微味道，清洗後即消退）。' }, { text: '極輕微細節差異（手工製品之自然特性）。' }] },
  { title: '七、瑕疵商品或寄錯商品', content: '收貨後請儘速聯繫客服，建議 48 小時內提供照片／影片。經客服確認後，將協助換貨／補寄／退款處理。' },
  { title: '八、換貨說明', content: '請先聯繫客服確認庫存，換貨以同款有現貨為限。若無庫存則改以退款方式處理。' },
  { title: '九、退款說明', items: [{ text: '收到退回商品確認後，依原付款方式退款。' }, { text: '信用卡付款將退回原信用卡帳戶。' }, { text: '使用折扣／贈品／優惠後退貨，可能重新計算退款金額。' }, { text: '不符退貨條件者，商品將退回寄件人，並酌收運費。' }] },
]

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPolicySettings()
  const data = extractPolicySections((settings?.returnPolicy || null) as Record<string, unknown> | null, DEFAULT_SECTIONS)
  return {
    title: data.seoTitle || '退換貨政策',
    description: data.seoDescription || 'CHIC KIM & MIU 退換貨政策 — 退貨、換貨、退款說明及售後分級制度。',
  }
}

/* ── FAQ ── */

const faqItems = [
  {
    q: 'Q1：可以退貨嗎？',
    a: '可以。本公司提供 14 天安心鑑賞期（優於消保法 7 天規定）。',
  },
  {
    q: 'Q2：怎麼申請退貨？',
    a: '請透過 LINE 客服（@ckmu）或客服電話聯繫，提供訂單編號與退貨原因即可。',
  },
  {
    q: 'Q3：哪些情況可以退？',
    a: '商品全新未使用、原包裝完整、吊牌未拆、在退貨期限內，即可申請退貨。',
  },
  {
    q: 'Q4：哪些情況不能退？',
    a: '超過 14 天、福利品、貼身衣物、已使用／已下水、吊牌已拆、鞋底已磨損等情況不受理。',
  },
  {
    q: 'Q5：Bra Top／泳衣可以退嗎？',
    a: '基於衛生考量，泳衣及貼身衣物恕不受理退換貨。',
  },
  {
    q: 'Q6：鞋子可以退嗎？',
    a: '可以，但僅限室內試穿、鞋底無磨損、原包裝完整的情況。',
  },
  {
    q: 'Q7：收到瑕疵品怎麼辦？',
    a: '請於 48 小時內聯繫客服並提供照片／影片，確認後將協助換貨、補寄或退款。',
  },
  {
    q: 'Q8：退款多久完成？',
    a: '收到退回商品確認後，信用卡約 7-14 個工作天退回原帳戶，其他方式視金流處理時間而定。',
  },
  {
    q: 'Q9：怎麼聯繫客服？',
    a: '客服電話 02-2718-9488（週一至週五 09:30-18:00），或加 LINE 官方帳號 @ckmu。',
  },
]

/* ── After-Sales Tier ── */

const afterSalesTiers = [
  {
    grade: 'A 級',
    color: 'bg-emerald-50 border-emerald-200',
    badgeColor: 'bg-emerald-500',
    conditions: ['收到 7 天內', '未實穿外出', '明顯製造瑕疵'],
    result: '全額退換貨，運費品牌吸收',
  },
  {
    grade: 'B 級',
    color: 'bg-amber-50 border-amber-200',
    badgeColor: 'bg-amber-500',
    conditions: ['收貨 30 天內', '有實穿', '非正常快速損壞（脫皮、脫膠）'],
    result: '提供原價 20-30% 購物金，明確一次性',
  },
  {
    grade: 'C 級',
    color: 'bg-red-50 border-red-200',
    badgeColor: 'bg-red-400',
    conditions: ['超過 30 天', '已實穿', '屬耗損或保存問題'],
    result:
      '不退貨不換貨，可視情況提供 10-20% 購物金（主管核准），需標註：個案',
  },
]

export default async function ReturnPolicyPage() {
  const settings = await getPolicySettings()
  const data = extractPolicySections((settings?.returnPolicy || null) as Record<string, unknown> | null, DEFAULT_SECTIONS)

  const pageTitle = data.pageTitle || '退換貨政策'
  const enTitle = data.enTitle || 'Return & Exchange Policy'
  const effectiveDate = data.effectiveDate || '2026年4月12日'
  const version = data.version || '1.1'

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Header ── */}
      <section className="bg-gradient-to-b from-[#C19A5B]/10 to-[#FDF8F3] pt-16 pb-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#C19A5B] tracking-[0.3em] text-sm font-medium mb-3">
            CHIC KIM & MIU
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-wide">
            {pageTitle}
          </h1>
          <p className="text-[#2C2C2C]/50 text-sm mt-1">
            {enTitle}
          </p>
          <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
          <p className="mt-4 text-[#2C2C2C]/60 text-sm">
            生效日期：{effectiveDate} ｜ 版本：{version}
          </p>
        </div>
      </section>

      {/* ── Policy Sections ── */}
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        {data.sections.map((section) => (
          <section
            key={section.title}
            className="bg-white rounded-2xl shadow-sm p-8 md:p-10"
          >
            <h2 className="text-xl font-bold text-[#2C2C2C] mb-1">
              {section.title}
            </h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mb-5" />

            {section.content && (
              <p className="text-[15px] text-[#2C2C2C]/80 leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            )}

            {section.items && section.items.length > 0 && (
              <ul className="mt-4 space-y-2">
                {section.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-[15px] text-[#2C2C2C]/80 leading-relaxed"
                  >
                    <span className="mt-2 w-2 h-2 rounded-full bg-[#C19A5B] shrink-0" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* ── Section 10: Contact ── */}
        <section className="bg-gradient-to-br from-[#C19A5B]/10 to-[#C19A5B]/5 border border-[#C19A5B]/20 rounded-2xl p-8 md:p-10">
          <h2 className="text-xl font-bold text-[#2C2C2C] mb-1">
            十、客服聯繫方式
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-5" />
          <div className="space-y-3 text-[15px] text-[#2C2C2C]/80">
            <p className="flex items-start gap-3">
              <span className="mt-2 w-2 h-2 rounded-full bg-[#C19A5B] shrink-0" />
              <span>客服電話：02-2718-9488</span>
            </p>
            <p className="flex items-start gap-3">
              <span className="mt-2 w-2 h-2 rounded-full bg-[#C19A5B] shrink-0" />
              <span>客服時間：週一至週五 09:30 - 18:00</span>
            </p>
            <p className="flex items-start gap-3">
              <span className="mt-2 w-2 h-2 rounded-full bg-[#C19A5B] shrink-0" />
              <span>
                LINE 官方帳號：
                <Link
                  href="https://page.line.me/nqo0262k"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#C19A5B] underline underline-offset-2 hover:text-[#A07A3B] transition-colors"
                >
                  @ckmu
                </Link>
              </span>
            </p>
          </div>
        </section>

        {/* ── FAQ Section ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">
            常見問題 FAQ
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <div className="space-y-5">
            {faqItems.map((faq) => (
              <div
                key={faq.q}
                className="border-b border-[#C19A5B]/10 pb-5 last:border-b-0 last:pb-0"
              >
                <h3 className="font-semibold text-[#2C2C2C] text-[15px] mb-1.5">
                  {faq.q}
                </h3>
                <p className="text-[15px] text-[#2C2C2C]/70 leading-relaxed pl-1">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── After-Sales Tier System ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">
            售後分級制度
          </h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <div className="space-y-5">
            {afterSalesTiers.map((tier) => (
              <div
                key={tier.grade}
                className={`rounded-xl border p-6 ${tier.color}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className={`${tier.badgeColor} text-white text-sm font-bold px-3 py-1 rounded-full`}
                  >
                    {tier.grade}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-[#2C2C2C]/60">
                    適用條件：
                  </p>
                  <ul className="space-y-1">
                    {tier.conditions.map((c) => (
                      <li
                        key={c}
                        className="flex items-start gap-2 text-[15px] text-[#2C2C2C]/80"
                      >
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#2C2C2C]/40 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white/60 rounded-lg px-4 py-3">
                  <p className="text-sm">
                    <span className="font-semibold text-[#2C2C2C]">
                      處理方式：
                    </span>
                    <span className="text-[#2C2C2C]/80">{tier.result}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
