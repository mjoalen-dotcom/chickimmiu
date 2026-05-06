'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Phone, MapPin, Clock, ExternalLink, MessageCircle } from 'lucide-react'

interface FooterProps {
  businessInfo?: {
    legalName: string
    taxId: string
    phone: string
    email?: string
    address: string
    businessHours: string
  }
  socialLinks?: {
    instagram?: string
    facebook?: string
    line?: string
  }
  footerSections?: Array<{
    title: string
    links: Array<{ label: string; href: string }>
  }>
}

export function Footer({ businessInfo, socialLinks, footerSections }: FooterProps) {
  const t = useTranslations('footer')
  const biz = businessInfo || { legalName: '靚秀國際有限公司', taxId: '24540533', phone: '02-2718-9488', address: '台北市基隆路一段68號9樓', businessHours: '週一至週五 09:30-18:00' }
  const social = socialLinks || { instagram: 'https://www.instagram.com/chickimmiu/', facebook: 'https://www.facebook.com/chickimmiu/', line: 'https://page.line.me/nqo0262k?openQrModal=true' }

  // CMS 沒設 footerSections 時用 i18n fallback
  const defaultHelpLinks = [
    { href: '/shopping-guide', label: t('helpShoppingGuide') },
    { href: '/about', label: t('helpAbout') },
    { href: '/packaging', label: t('helpPackaging') },
    { href: '/terms', label: t('helpTerms') },
    { href: '/privacy-policy', label: t('helpPrivacy') },
    { href: '/return-policy', label: t('helpReturnPolicy') },
    { href: '/faq', label: t('helpFaq') },
  ]
  const defaultShoppingLinks = [
    { href: '/products', label: t('shoppingAll') },
    { href: '/products?tag=new', label: t('shoppingNew') },
    { href: '/products?tag=hot', label: t('shoppingHot') },
    { href: '/blog', label: t('shoppingBlog') },
    { href: '/games', label: t('shoppingGames') },
    { href: '/account', label: t('shoppingMember') },
    { href: '/account/orders', label: t('shoppingOrders') },
    { href: '/account/subscription', label: t('shoppingSubscription') },
    { href: '/account/referrals', label: t('shoppingReferrals') },
  ]
  return (
    <footer data-component="footer" className="bg-[#2C2C2C] text-cream-100">
      {/* ── 主體：五欄 ── */}
      <div className="container py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* ── 品牌 + 社群 ── */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Link href="/" className="flex items-center gap-2.5">
              {/* CKMU Icon */}
              <svg viewBox="0 0 200 200" width="36" height="36" className="text-gold-400">
                <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="10"/>
                <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="2.5"/>
                <path d="M 62,100 A 45,45 0 1,1 100,145" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"/>
                <g transform="translate(78, 72)">
                  <rect x="0" y="0" width="22" height="22" rx="3" fill="currentColor"/>
                  <rect x="25" y="0" width="22" height="22" rx="3" fill="currentColor"/>
                  <rect x="0" y="25" width="22" height="22" rx="3" fill="currentColor"/>
                  <rect x="25" y="25" width="22" height="22" rx="3" fill="currentColor"/>
                  <text x="11" y="16" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#2C2C2C" fontSize="13">K</text>
                  <text x="36" y="16" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#2C2C2C" fontSize="13">M</text>
                  <text x="11" y="41" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#2C2C2C" fontSize="13">M</text>
                  <text x="36" y="41" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fill="#2C2C2C" fontSize="13">U</text>
                </g>
              </svg>
              <div>
                <span className="text-base font-bold tracking-[0.12em] text-cream-100">
                  CHIC KIM &amp; MIU
                </span>
              </div>
            </Link>
            <p className="text-sm text-cream-300 leading-relaxed">
              {biz.legalName}
              <br />
              {t('tagline')}
            </p>
            <div className="text-xs text-cream-400 leading-relaxed space-y-0.5">
              <p className="text-gold-400 text-sm font-medium tracking-wider mb-1.5">{t('bankInfo')}</p>
              <p>{t('bankCode')}</p>
              <p>{t('bankBranch')}</p>
              <p>{t('bankAccount')}</p>
              <p>{t('bankName')}</p>
              <p>{t('taxId')}</p>
            </div>
            <div className="flex gap-3">
              {social.instagram && (
                <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="text-cream-300 hover:text-gold-400 transition-colors" aria-label="Instagram">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              )}
              {social.facebook && (
                <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="text-cream-300 hover:text-gold-400 transition-colors" aria-label="Facebook">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {social.line && (
                <a href={social.line} target="_blank" rel="noopener noreferrer" className="text-cream-300 hover:text-gold-400 transition-colors" aria-label="LINE">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                </a>
              )}
            </div>
          </div>

          {/* ── Contact（官網資訊） ── */}
          <div>
            <h4 className="text-sm font-medium tracking-wider text-gold-400 mb-4">{t('contact')}</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-1.5 text-sm text-cream-300">
                <Phone size={12} className="shrink-0" />
                {biz.phone}
              </li>
              <li>
                <a
                  href="https://page.line.me/nqo0262k?openQrModal=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-cream-300 hover:text-gold-400 transition-colors"
                >
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                  {t('lineLabel')}
                </a>
              </li>
              <li className="flex items-center gap-1.5 text-sm text-cream-300">
                <MessageCircle size={12} className="shrink-0" />
                {t('wechatLabel')}
              </li>
              <li className="flex items-center gap-1.5 text-sm text-cream-300">
                <Clock size={12} className="shrink-0" />
                {biz.businessHours.replace('週一至週五 ', '')}
              </li>
              <li className="flex items-start gap-1.5 text-xs text-cream-300">
                <MapPin size={12} className="shrink-0 mt-0.5" />
                <span>{biz.address}</span>
              </li>
            </ul>
            <a
              href="https://jinhow.ckmu.co"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition-colors mt-3"
            >
              <ExternalLink size={10} />
              {t('partnerLabel')}
            </a>
          </div>

          {/* ── Footer Link Sections ── */}
          {(footerSections && footerSections.length > 0 ? footerSections : [
            { title: t('helpTitle'), links: defaultHelpLinks },
            { title: t('shoppingTitle'), links: defaultShoppingLinks },
          ]).map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-medium tracking-wider text-gold-400 mb-4">{section.title}</h4>
              <ul className="space-y-1.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-cream-300 hover:text-gold-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── 版權列 ── */}
      <div className="border-t border-white/5">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-cream-400">
          <p>&copy; {new Date().getFullYear()} {biz.legalName} CHIC KIM &amp; MIU｜{t('taxIdLabel')} {biz.taxId}</p>
          <p>{t('rightsReserved')}</p>
        </div>
      </div>
    </footer>
  )
}
