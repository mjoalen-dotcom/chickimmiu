import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, CheckCircle2, XCircle, MessageCircle, FileText, RotateCcw } from 'lucide-react'

export const metadata: Metadata = {
  title: '退換貨說明',
  description: 'CHIC KIM & MIU 退換貨流程 — 14 天安心鑑賞期、3 步驟申請流程、可退與不可退商品一覽。',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'}/returns`,
  },
}

const ALLOWED = [
  '商品保持全新未使用',
  '原包裝、吊牌、標籤、配件、贈品完整',
  '未經人為損壞、污損、異味',
  '未經修改、裁剪或下水洗滌',
]

const DENIED = [
  '泳衣 / 貼身衣物（衛生考量）',
  '已穿著外出或鞋底已磨損的鞋類',
  '吊牌已拆除或遺失',
  '福利品 / 出清品（購買時已註明）',
  '超過 14 天鑑賞期',
  '反覆退貨 / 棄單之異常帳號',
]

const STEPS = [
  {
    n: '1',
    title: '申請退換貨',
    desc: '會員可於「我的帳戶 → 退換貨」提交申請；訪客可透過下方「聯繫客服」送出申請。',
    cta: { href: '/account/returns', label: '會員退換貨中心' },
  },
  {
    n: '2',
    title: '等待客服確認',
    desc: '客服將於 1-2 個工作天內回覆並提供退貨地址或換貨流程。',
  },
  {
    n: '3',
    title: '寄回並完成退款',
    desc: '商品經檢查後無誤，退款將依原付款方式退回（信用卡 7-14 個工作天、其他 3-5 個工作天）。',
  },
]

export default function ReturnsPage() {
  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Header ── */}
      <section className="bg-gradient-to-b from-[#C19A5B]/10 to-[#FDF8F3] pt-16 pb-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#C19A5B] tracking-[0.3em] text-sm font-medium mb-3">CHIC KIM & MIU</p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-wide">退換貨說明</h1>
          <p className="text-[#2C2C2C]/50 text-sm mt-1">Returns & Exchanges</p>
          <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
          <p className="mt-4 text-[#2C2C2C]/70 text-sm max-w-xl mx-auto leading-relaxed">
            本頁為簡要說明。完整條款請參閱
            <Link href="/return-policy" className="text-[#C19A5B] underline underline-offset-2 mx-1">
              退換貨政策
            </Link>
            ；會員可直接進入退換貨中心提交申請。
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 space-y-10">
        {/* ── Highlight ── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 md:p-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#C19A5B]/10 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-[#C19A5B]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2C2C2C] mb-1">14 天安心鑑賞期</h2>
              <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">
                依消保法，通訊交易享有 7 天鑑賞期；CHIC KIM & MIU 額外提供 <strong className="text-[#C19A5B]">14 天安心退貨</strong>，
                自商品送達（或至超商取貨簽收）次日起算。鑑賞期並非試用期，商品須保持全新狀態方可退貨。
              </p>
            </div>
          </div>
        </section>

        {/* ── 3-step flow ── */}
        <section>
          <div className="text-center mb-8">
            <p className="text-xs tracking-[0.3em] text-[#C19A5B] mb-2 uppercase">How it works</p>
            <h2 className="text-2xl font-bold text-[#2C2C2C]">退換貨流程</h2>
            <div className="w-10 h-[2px] bg-[#C19A5B] mx-auto mt-2" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white rounded-2xl shadow-sm p-6 md:p-7">
                <div className="w-10 h-10 rounded-full bg-[#C19A5B] text-white flex items-center justify-center font-bold mb-4">
                  {s.n}
                </div>
                <h3 className="text-base font-bold text-[#2C2C2C] mb-2">{s.title}</h3>
                <p className="text-sm text-[#2C2C2C]/70 leading-relaxed">{s.desc}</p>
                {s.cta && (
                  <Link
                    href={s.cta.href}
                    className="inline-flex items-center gap-1 text-sm text-[#C19A5B] hover:underline mt-3"
                  >
                    {s.cta.label} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Allowed / Denied ── */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border-l-4 border-emerald-400">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <h3 className="text-lg font-bold text-[#2C2C2C]">可退換貨</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-[#2C2C2C]/80">
              {ALLOWED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 border-l-4 border-red-400">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-bold text-[#2C2C2C]">不可退換貨</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-[#2C2C2C]/80">
              {DENIED.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA cards ── */}
        <section className="grid md:grid-cols-3 gap-4">
          <Link
            href="/account/returns"
            className="bg-[#2C2C2C] hover:bg-[#1a1a1a] text-white rounded-2xl p-6 transition-colors"
          >
            <RotateCcw className="w-6 h-6 text-[#C19A5B] mb-3" />
            <h3 className="text-base font-bold mb-1">立即申請退換貨</h3>
            <p className="text-sm text-white/70">會員登入後可查看可退訂單並直接提交申請</p>
          </Link>
          <Link
            href="/return-policy"
            className="bg-white hover:bg-cream-50 border border-cream-200 rounded-2xl p-6 transition-colors"
          >
            <FileText className="w-6 h-6 text-[#C19A5B] mb-3" />
            <h3 className="text-base font-bold text-[#2C2C2C] mb-1">完整退換貨政策</h3>
            <p className="text-sm text-[#2C2C2C]/70">包含 A/B/C 級售後分級制度、瑕疵處理等詳盡說明</p>
          </Link>
          <Link
            href="/contact?category=return_exchange"
            className="bg-white hover:bg-cream-50 border border-cream-200 rounded-2xl p-6 transition-colors"
          >
            <MessageCircle className="w-6 h-6 text-[#C19A5B] mb-3" />
            <h3 className="text-base font-bold text-[#2C2C2C] mb-1">聯絡客服</h3>
            <p className="text-sm text-[#2C2C2C]/70">訪客或特殊案件可直接透過聯絡表單送出申請</p>
          </Link>
        </section>
      </div>
    </main>
  )
}
