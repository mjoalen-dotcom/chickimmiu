'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, DollarSign, ChevronDown } from 'lucide-react'

const LANGUAGES = [
  { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
]

const CURRENCIES = [
  { code: 'TWD', symbol: 'NT$', label: '新台幣' },
  { code: 'USD', symbol: 'US$', label: '美元' },
  { code: 'JPY', symbol: '¥', label: '日圓' },
  { code: 'KRW', symbol: '₩', label: '韓圜' },
  { code: 'CNY', symbol: '¥', label: '人民幣' },
]

/* ── 語言選擇 ── */
export function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState('zh-TW')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const lang = LANGUAGES.find((l) => l.code === currentLang)

  const handleChange = (code: string) => {
    setCurrentLang(code)
    // Google Translate integration
    if (typeof window !== 'undefined') {
      const el = document.querySelector('.goog-te-combo') as HTMLSelectElement | null
      if (el) {
        el.value = code === 'zh-TW' ? '' : code.split('-')[0]
        el.dispatchEvent(new Event('change'))
      }
    }
    setIsOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-foreground/70 hover:text-gold-600 transition-colors rounded-lg hover:bg-cream-100"
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
                l.code === currentLang
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
  const [currentCurrency, setCurrentCurrency] = useState('TWD')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currency = CURRENCIES.find((c) => c.code === currentCurrency)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-foreground/70 hover:text-gold-600 transition-colors rounded-lg hover:bg-cream-100"
      >
        <DollarSign size={14} />
        <span className="hidden md:inline">{currency?.code}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-cream-200 overflow-hidden z-50 py-1">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => { setCurrentCurrency(c.code); setIsOpen(false) }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                c.code === currentCurrency
                  ? 'bg-gold-500/10 text-gold-600 font-medium'
                  : 'hover:bg-cream-50 text-foreground/80'
              }`}
            >
              <span>{c.label}</span>
              <span className="text-xs text-muted-foreground">{c.symbol}</span>
            </button>
          ))}
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
