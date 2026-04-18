import type { Metadata } from 'next'
import Link from 'next/link'
import { Phone, MapPin, Clock, Mail } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ContactForm } from './ContactForm'

export const metadata: Metadata = {
  title: '聯絡我們',
  description: 'CHIC KIM & MIU 客服聯繫表單 — 訂單查詢、退換貨、尺寸建議、合作洽談，我們將儘速回覆您。',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://chickimmiu.com'}/contact`,
  },
}

async function getBusinessInfo() {
  if (!process.env.DATABASE_URI) return null
  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({
      slug: 'global-settings',
      depth: 0,
    })) as unknown as Record<string, unknown>
    return (settings?.businessInfo || null) as Record<string, unknown> | null
  } catch {
    return null
  }
}

export default async function ContactPage() {
  const biz = await getBusinessInfo()
  const phone = (biz?.phone as string) || '02-2718-9488'
  const email = (biz?.email as string) || 'service@chickimmiu.com'
  const address = (biz?.address as string) || '台北市基隆路一段68號9樓'
  const hours = (biz?.businessHours as string) || '週一至週五 09:30-18:00'

  return (
    <main className="bg-[#FDF8F3] min-h-screen">
      {/* ── Header ── */}
      <section className="bg-gradient-to-b from-[#C19A5B]/10 to-[#FDF8F3] pt-16 pb-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#C19A5B] tracking-[0.3em] text-sm font-medium mb-3">CHIC KIM & MIU</p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#2C2C2C] tracking-wide">聯絡我們</h1>
          <p className="text-[#2C2C2C]/50 text-sm mt-1">Contact Us</p>
          <div className="mt-4 w-16 h-[2px] bg-[#C19A5B] mx-auto" />
          <p className="mt-4 text-[#2C2C2C]/70 text-sm max-w-xl mx-auto">
            任何訂購、穿搭、退換貨或合作相關問題，歡迎填寫下方表單，我們將於 1-2 個工作天內回覆您。
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-12 md:py-16 grid md:grid-cols-[1fr_360px] gap-8">
        {/* ── Form ── */}
        <section className="bg-white rounded-2xl shadow-sm p-6 md:p-10">
          <h2 className="text-xl font-bold text-[#2C2C2C] mb-1">留言給我們</h2>
          <div className="w-10 h-[2px] bg-[#C19A5B] mb-6" />
          <ContactForm />
        </section>

        {/* ── Sidebar ── */}
        <aside className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <h3 className="text-base font-bold text-[#2C2C2C] mb-4">其他聯繫方式</h3>
            <ul className="space-y-4 text-sm text-[#2C2C2C]/80">
              <li className="flex items-start gap-3">
                <Phone size={16} className="shrink-0 text-[#C19A5B] mt-0.5" />
                <div>
                  <p className="font-medium text-[#2C2C2C]">客服電話</p>
                  <a href={`tel:${phone}`} className="hover:text-[#C19A5B] transition-colors">
                    {phone}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={16} className="shrink-0 text-[#C19A5B] mt-0.5" />
                <div>
                  <p className="font-medium text-[#2C2C2C]">客服信箱</p>
                  <a href={`mailto:${email}`} className="hover:text-[#C19A5B] transition-colors break-all">
                    {email}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-4 h-4 shrink-0 text-[#C19A5B] mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                <div>
                  <p className="font-medium text-[#2C2C2C]">LINE 官方帳號</p>
                  <a
                    href="https://page.line.me/nqo0262k?openQrModal=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#C19A5B] transition-colors"
                  >
                    @ckmu
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock size={16} className="shrink-0 text-[#C19A5B] mt-0.5" />
                <div>
                  <p className="font-medium text-[#2C2C2C]">服務時間</p>
                  <p>{hours}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={16} className="shrink-0 text-[#C19A5B] mt-0.5" />
                <div>
                  <p className="font-medium text-[#2C2C2C]">工作室地址</p>
                  <p>{address}</p>
                  <p className="text-xs text-[#2C2C2C]/50 mt-0.5">（預約制，請先聯繫客服）</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-[#C19A5B]/10 to-[#C19A5B]/5 border border-[#C19A5B]/20 rounded-2xl p-6 md:p-8">
            <h3 className="text-base font-bold text-[#2C2C2C] mb-2">您的問題可能已在這裡</h3>
            <p className="text-sm text-[#2C2C2C]/70 mb-4 leading-relaxed">
              訂單、退貨、配送、付款等常見問題，我們已整理了詳細說明。
            </p>
            <div className="space-y-2">
              <Link href="/faq" className="block text-sm text-[#C19A5B] hover:underline">
                → 常見問題 FAQ
              </Link>
              <Link href="/shipping" className="block text-sm text-[#C19A5B] hover:underline">
                → 運送與配送說明
              </Link>
              <Link href="/returns" className="block text-sm text-[#C19A5B] hover:underline">
                → 退換貨說明
              </Link>
              <Link href="/size-guide" className="block text-sm text-[#C19A5B] hover:underline">
                → 尺寸對照表
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
