'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, DollarSign, ChevronDown } from 'lucide-react'
import { useLocaleStore, type LocaleCode } from '@/stores/localeStore'

const LANGUAGES: { code: LocaleCode; label: string; flag: string }[] = [
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
]

/* ── 語言選擇 ── */
export function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentLocale = useLocaleStore((s) => s.currentLocale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const lang = LANGUAGES.find((l) => l.code === currentLocale)

  /**
   * PR 1：先 wire 到 store + cookie；UI 文字實際翻譯在 PR 2（next-intl）落地。
   * 切了會持久化到 localStorage + cookie ckm_locale，等 PR 2 上線就直接生效。
   */
  const handleChange = (code: LocaleCode) => {
    setLocale(code)
    setIsOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-foreground/70 hover:text-gold-600 transition-colors rounded-lg hover:bg-cream-100"
        aria-label="切換語言"
      >
        <Globe size={14} />
        <span className="hidden md:inline">{lang?.flag}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-cream-200 overflow-hidden z-50 py-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => handleChange(l.code)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                l.code === currentLocale
                  ? 'bg-gold-500/10 text-gold-600 font-medium'
                  : 'hover:bg-cream-50 text-foreground/80'
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 幣別選擇 ── */
export function CurrencySwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentCurrency = useLocaleStore((s) => s.currentCurrency)
  const currencies = useLocaleStore((s) => s.currencies)
  const setCurrency = useLocaleStore((s) => s.setCurrency)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currency = currencies.find((c) => c.code === currentCurrency) ?? currencies[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-foreground/70 hover:text-gold-600 transition-colors rounded-lg hover:bg-cream-100"
        aria-label="切換顯示幣別"
      >
        <DollarSign size={14} />
        <span className="hidden md:inline">{currency?.code}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-44 bg-white rounded-xl shadow-xl border border-cream-200 overflow-hidden z-50 py-1">
          {currencies.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                setCurrency(c.code)
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                c.code === currentCurrency
                  ? 'bg-gold-500/10 text-gold-600 font-medium'
                  : 'hover:bg-cream-50 text-foreground/80'
              }`}
            >
              <span>
                {c.label}{' '}
                <span className="text-[10px] text-muted-foreground">({c.code})</span>
              </span>
              <span className="text-xs text-muted-foreground">{c.symbol}</span>
            </button>
          ))}
          <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-cream-200 leading-relaxed">
            交易以新台幣結算，其他幣別僅供參考。
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 保留舊的組合版 export，向下相容 ── */
export function LanguageCurrencySwitcher() {
  return (
    <div className="flex items-center gap-0.5">
      <LanguageSwitcher />
      <CurrencySwitcher />
    </div>
  )
}
