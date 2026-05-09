'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, X } from 'lucide-react'

/**
 * 遊戲規範同意書閘門（GameTermsGate）
 * ──────────────────────────────────
 * 包在 /games 入口外層；mount 時 GET /api/games 拿 termsState：
 *   - 未登入 → 不顯示 modal（讓既有頁面流程處理登入提示）
 *   - 已登入 + requiresAcceptance = true → 顯示全屏 modal 強制簽
 *   - 同意後 POST /api/games/accept-terms → reload 頁面
 *
 * GameSettings.terms.version 變動時自動失效，所有舊會員下次進來都要重簽。
 *
 * 法律存證：accept-terms endpoint 同步寫 IP + adultConfirmed flag 到 users.gameTermsAcceptance。
 */

type TermsState = {
  enabled: boolean
  currentVersion: string
  userAcceptedVersion: string | null
  requiresAcceptance: boolean
  shortSummary: string
  requireAdultConfirmation: boolean
}

export function GameTermsGate({ children }: { children: React.ReactNode }) {
  const [termsState, setTermsState] = useState<TermsState | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [adultConfirmed, setAdultConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTerms = useCallback(async () => {
    try {
      const res = await fetch('/api/games', { credentials: 'include' })
      if (res.status === 401) return // 未登入 — 不擋 UI
      if (!res.ok) return
      const json = await res.json() as {
        success: boolean
        data?: { termsState?: TermsState }
      }
      if (json.data?.termsState) setTermsState(json.data.termsState)
    } catch {
      // 靜默失敗 — modal 不顯示，遊戲頁照常 render
    }
  }, [])

  useEffect(() => {
    fetchTerms()
  }, [fetchTerms])

  const handleAccept = useCallback(async () => {
    if (!termsState) return
    if (!agreed) { setError('請勾選「我已閱讀並同意」'); return }
    if (termsState.requireAdultConfirmation && !adultConfirmed) {
      setError('請確認您已年滿 20 歲')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/games/accept-terms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adultConfirmed }),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || `送出失敗 (HTTP ${res.status})`)
        setSubmitting(false)
        return
      }
      // 同意成功 — reload 取最新狀態
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '網路錯誤')
      setSubmitting(false)
    }
  }, [termsState, agreed, adultConfirmed])

  const showModal = Boolean(termsState?.requiresAcceptance)

  return (
    <>
      {children}
      <AnimatePresence>
        {showModal && termsState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              className="relative bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-5 border-b border-cream-200 bg-cream-50">
                <div className="w-10 h-10 rounded-full bg-gold-500/15 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-gold-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">遊戲規範同意書</h2>
                  <p className="text-[11px] text-muted-foreground">版本 {termsState.currentVersion}</p>
                </div>
                <a
                  href="/"
                  className="ml-auto w-8 h-8 rounded-full hover:bg-cream-100 flex items-center justify-center text-muted-foreground"
                  aria-label="離開"
                  title="離開遊戲區"
                >
                  <X size={16} />
                </a>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
                <p className="text-muted-foreground leading-relaxed">
                  {termsState.shortSummary || '為保障您的權益，請於進入遊戲區前閱讀並同意本規範。'}
                </p>
                <div className="bg-cream-50 border border-cream-200 rounded-xl p-4 text-xs text-muted-foreground space-y-2">
                  <p>• 點數、購物金、優惠券皆為消費回饋，<span className="text-amber-700 font-medium">不得兌換現金</span></p>
                  <p>• 實體贈品（電影票等）<span className="text-amber-700 font-medium">隨下次訂單一同寄出</span>，須於 12 個月內下單</p>
                  <p>• 系統偵測到不正當行為（多帳號、機器人）將取消資格並追回獎品</p>
                  <p>• 爭議請於得獎日起 30 日內聯繫客服</p>
                </div>
                <a
                  href="/games/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-gold-600 underline"
                >
                  閱讀完整條文與獎項機率公示 →
                </a>
              </div>

              {/* Footer */}
              <div className="border-t border-cream-200 p-5 space-y-3 bg-white">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 accent-gold-500"
                  />
                  <span>我已閱讀並同意《CHIC KIM &amp; MIU 遊戲規範》全部條款</span>
                </label>
                {termsState.requireAdultConfirmation && (
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adultConfirmed}
                      onChange={(e) => setAdultConfirmed(e.target.checked)}
                      className="mt-0.5 accent-gold-500"
                    />
                    <span>我確認已年滿 20 歲（未滿 20 歲者請取得法定代理人同意）</span>
                  </label>
                )}
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <a
                    href="/"
                    className="flex-1 py-2.5 text-center text-sm rounded-full border border-cream-300 text-muted-foreground hover:bg-cream-50"
                  >
                    暫不同意
                  </a>
                  <button
                    onClick={handleAccept}
                    disabled={submitting || !agreed || (termsState.requireAdultConfirmation && !adultConfirmed)}
                    className="flex-1 py-2.5 text-sm rounded-full bg-gold-500 text-white hover:bg-gold-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? '送出中…' : '同意並開始遊戲'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
