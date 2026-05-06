'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safe-storage'

/**
 * Locale + Currency 全域偏好設定 Store
 * ──────────────────────────────────────
 *
 * 持久化策略：
 *   1. zustand persist → localStorage（key: ckm-locale）
 *   2. 同步寫 cookie：`ckm_locale` / `ckm_currency`（path=/, max-age=1y）
 *      → 讓 SSR / middleware 能讀到偏好（PR 2 next-intl middleware 會用）
 *
 * SSR 安全：
 *   - skipHydration: true，由 Providers.tsx 在 useEffect 手動 rehydrate
 *   - 在沒 rehydrate 前 store 用 default values，避免 hydration mismatch
 *
 * Currency rates:
 *   - 從 /api/currencies 拉，放在 currencies 欄
 *   - fetchCurrencies() 在 Providers mount 時呼叫一次
 *   - 失敗 fallback 到 hardcoded baseline（TWD only），保證 UI 不爆
 */

export type LocaleCode = 'zh-TW' | 'zh-CN' | 'en' | 'ja' | 'ko'

export interface CurrencyDef {
  code: string
  label: string
  symbol: string
  rateAgainstTwd: number
  decimalPlaces: number
  isActive: boolean
  displayOrder: number
}

const FALLBACK_CURRENCY: CurrencyDef = {
  code: 'TWD',
  label: '新台幣',
  symbol: 'NT$',
  rateAgainstTwd: 1,
  decimalPlaces: 0,
  isActive: true,
  displayOrder: 1,
}

interface LocaleState {
  /** 目前選用語系 */
  currentLocale: LocaleCode
  /** 目前選用幣別 (ISO 4217) */
  currentCurrency: string
  /** 從 /api/currencies 拉到的活躍幣別清單（含匯率） */
  currencies: CurrencyDef[]
  /** currencies 是否已從 server 拉過一次 */
  currenciesLoaded: boolean

  setLocale: (l: LocaleCode) => void
  setCurrency: (code: string) => void
  setCurrencies: (list: CurrencyDef[]) => void

  /** 取得目前幣別 def（找不到回 TWD fallback） */
  getCurrentCurrency: () => CurrencyDef
  /** 從 /api/currencies 拉一次（idempotent，已 loaded 就 skip） */
  fetchCurrencies: () => Promise<void>
}

/** 寫 cookie（client only），讓 server-side 讀偏好 */
function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  // 1 year, path=/, samesite=Lax 預設值
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=Lax`
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      currentLocale: 'zh-TW',
      currentCurrency: 'TWD',
      currencies: [FALLBACK_CURRENCY],
      currenciesLoaded: false,

      setLocale: (l) => {
        set({ currentLocale: l })
        writeCookie('ckm_locale', l)
      },

      setCurrency: (code) => {
        set({ currentCurrency: code })
        writeCookie('ckm_currency', code)
      },

      setCurrencies: (list) => {
        // 排序 + 過濾掉非啟用
        const active = list
          .filter((c) => c.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder)
        // 確保 TWD fallback 永遠有
        const hasTwd = active.some((c) => c.code === 'TWD')
        const final = hasTwd ? active : [FALLBACK_CURRENCY, ...active]
        set({ currencies: final, currenciesLoaded: true })
      },

      getCurrentCurrency: () => {
        const { currentCurrency, currencies } = get()
        return (
          currencies.find((c) => c.code === currentCurrency) ?? FALLBACK_CURRENCY
        )
      },

      fetchCurrencies: async () => {
        if (get().currenciesLoaded) return
        try {
          const res = await fetch('/api/currencies', {
            credentials: 'same-origin',
            cache: 'no-store',
          })
          if (!res.ok) throw new Error(`status ${res.status}`)
          const data = (await res.json()) as { currencies: CurrencyDef[] }
          if (Array.isArray(data?.currencies) && data.currencies.length > 0) {
            get().setCurrencies(data.currencies)
          }
        } catch (err) {
          // 失敗保持 fallback；mark loaded 以免 retry 暴衝
          // eslint-disable-next-line no-console
          console.warn('[localeStore] fetchCurrencies failed', err)
          set({ currenciesLoaded: true })
        }
      },
    }),
    {
      name: 'ckm-locale',
      storage: safeLocalStorage,
      // Defer rehydration until after mount to avoid SSR hydration mismatch.
      // Manual rehydrate() is called from Providers.
      skipHydration: true,
      // 不持久化 currencies / currenciesLoaded（每次 mount 重抓最新匯率）
      partialize: (state) => ({
        currentLocale: state.currentLocale,
        currentCurrency: state.currentCurrency,
      }),
    },
  ),
)
