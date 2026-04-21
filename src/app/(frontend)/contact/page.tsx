import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'

import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: '聯絡我們 — CHIC KIM & MIU',
  description: '有任何問題、合作邀約或售後服務需求，歡迎透過客服信箱、電話或下方表單聯繫我們。',
}

type GlobalSettingsShape = {
  businessInfo?: {
    legalName?: string
    phone?: string
    email?: string
    address?: string
    businessHours?: string
  }
  customerService?: {
    lineOaUrl?: string
    enableLineWidget?: boolean
  }
  socialLinks?: {
    instagram?: string
    facebook?: string
    line?: string
  }
}

async function getContactInfo(): Promise<GlobalSettingsShape> {
  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({
      slug: 'global-settings',
      depth: 0,
    })) as unknown as GlobalSettingsShape
    return settings || {}
  } catch {
    return {}
  }
}

export default async function ContactPage() {
  const settings = await getContactInfo()
  const biz = settings.businessInfo ?? {}
  const cs = settings.customerService ?? {}
  const social = settings.socialLinks ?? {}

  const lineUrl = cs.lineOaUrl || social.line

  return (
    <main className="bg-cream-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.3em] text-gold-600 mb-3">CONTACT US</p>
          <h1 className="text-3xl sm:text-4xl font-light text-foreground">聯絡我們</h1>
          <p className="mt-4 text-sm text-foreground/60 max-w-xl mx-auto leading-relaxed">
            有任何問題、合作邀約或售後服務需求，歡迎透過以下方式聯繫我們。<br />
            客服團隊將於營業時間內回覆您的訊息。
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-6 mb-12">
          {/* 聯絡資訊 */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-cream-100">
              <h2 className="text-sm font-medium text-foreground mb-4 tracking-wide">聯絡資訊</h2>
              <ul className="space-y-4 text-sm">
                {biz.email && (
                  <li className="flex items-start gap-3">
                    <Mail size={16} className="text-gold-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-foreground/50 mb-0.5">客服信箱</div>
                      <a href={`mailto:${biz.email}`} className="text-foreground hover:text-gold-600 transition-colors">
                        {biz.email}
                      </a>
                    </div>
                  </li>
                )}
                {biz.phone && (
                  <li className="flex items-start gap-3">
                    <Phone size={16} className="text-gold-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-foreground/50 mb-0.5">客服電話</div>
                      <a href={`tel:${biz.phone.replace(/[^\d+]/g, '')}`} className="text-foreground hover:text-gold-600 transition-colors">
                        {biz.phone}
                      </a>
                    </div>
                  </li>
                )}
                {biz.address && (
                  <li className="flex items-start gap-3">
                    <MapPin size={16} className="text-gold-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-foreground/50 mb-0.5">公司地址</div>
                      <div className="text-foreground leading-relaxed">{biz.address}</div>
                    </div>
                  </li>
                )}
                {biz.businessHours && (
                  <li className="flex items-start gap-3">
                    <Clock size={16} className="text-gold-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-foreground/50 mb-0.5">營業時間</div>
                      <div className="text-foreground">{biz.businessHours}</div>
                    </div>
                  </li>
                )}
              </ul>
            </div>

            {lineUrl && (
              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-[#06C755] text-white rounded-xl p-4 text-center hover:bg-[#05a847] transition-colors"
              >
                <div className="text-sm font-medium">LINE 官方帳號</div>
                <div className="text-xs opacity-90 mt-0.5">即時客服，請按我加入好友</div>
              </a>
            )}
          </div>

          {/* 聯絡表單 */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-cream-100">
              <h2 className="text-sm font-medium text-foreground mb-4 tracking-wide">填寫表單</h2>
              <ContactForm />
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-foreground/40 leading-relaxed">
          急件請直接撥打客服電話或透過 LINE 聯繫；表單訊息客服將於 1-2 個工作日內回覆。
        </p>
      </div>
    </main>
  )
}
