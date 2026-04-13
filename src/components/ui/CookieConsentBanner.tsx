'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { grantTrackingConsent } from '@/lib/tracking'

type Props = {
  enabled?: boolean
  bannerText?: string | null
  privacyPolicyUrl?: string | null
  acceptButtonText?: string | null
}

const COOKIE_CONSENT_KEY = 'ckm-cookie-consent'

/**
 * Cookie 同意橫幅（符合台灣個資法）
 * props 由 (frontend)/layout.tsx 從 GlobalSettings 取得並傳入
 * 使用者同意後才透過 Google Consent Mode v2 啟用追蹤腳本
 */
export function CookieConsentBanner({
  enabled = true,
  bannerText,
  privacyPolicyUrl,
  acceptButtonText,
}: Props) {
  const [visible, setVisible] = useState(false)

  const text =
    bannerText ||
    '本網站使用 Cookie 以提供更好的瀏覽體驗與個人化推薦。繼續使用即表示您同意我們的 Cookie 政策。'
  const privacyUrl = privacyPolicyUrl || '/privacy'
  const btnText = acceptButtonText || '我知道了'

  useEffect(() => {
    if (!enabled) return
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
      if (consent === 'accepted') {
        // 已同意 — 直接啟用追蹤
        grantTrackingConsent()
      } else {
        setVisible(true)
      }
    } catch {
      // SSR or localStorage blocked
    }
  }, [enabled])

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
    } catch {
      // localStorage blocked
    }
    // 通知 GTM / Google Consent Mode 更新為 granted
    grantTrackingConsent()
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 inset-x-0 z-[60] p-4"
        >
          <div className="container max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-cream-200 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-sm text-foreground/80 flex-1 leading-relaxed">
              {text}{' '}
              <Link
                href={privacyUrl}
                className="text-gold-600 underline underline-offset-2 hover:text-gold-700"
              >
                了解更多
              </Link>
            </p>
            <button
              onClick={handleAccept}
              className="shrink-0 px-6 py-2.5 bg-gold-500 text-white text-sm rounded-full hover:bg-gold-600 transition-colors tracking-wide"
            >
              {btnText}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
