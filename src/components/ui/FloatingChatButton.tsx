'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Loader2, UserRound, Sparkles, Headset } from 'lucide-react'

/**
 * 站內客服浮動視窗（客服中心 Phase 1C）
 * ──────────────────────────────────
 * 三層依序：AI 小幫手先答 → 答不出來自動轉真人（工單進後台收件匣）
 * → 客戶想直接找人時再走 LINE / Messenger 外部管道。
 *
 * 「轉真人客服」鈕永遠在（Alan 2026-09-02）：不想跟機器人耗的客戶按一下就切成
 * 留言模式，AI 立刻退場，之後每句話都直接進客服待辦；急件再點 LINE。
 * 客戶已經不耐煩時還讓機器人繼續搭話，只會把人惹得更火。
 *
 * 訊息一律經 /api/cs/chat 落地成 Conversations + Messages，
 * 轉真人時客服在後台看得到完整前情，不必請客戶重講一次。
 *
 * 配色注意：邊線一律用深色（#7A5A28 / #2C2C2C），不靠色相區分角色——
 * 訊息左右位置 + 文字標籤（「AI 小幫手」/「您」）才是主要辨識依據。
 */

type Props = {
  lineOaUrl?: string | null
  metaPageId?: string | null
  enableLine?: boolean
  enableMessenger?: boolean
  /** 站內 AI 客服總開關（後台 cs-settings.ai.enabled 由 API 端把關，這裡只控制入口顯示） */
  enableAiChat?: boolean
  greeting?: string | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  escalated?: boolean
}

const STORAGE_KEY = 'ckmu_cs_conversation'
const DEFAULT_GREETING = '哈囉！我是 CHIC KIM & MIU 的客服小幫手，請問需要什麼協助呢？'
const QUICK_ASKS = ['貴賓試衣間營業時間？', '店面在哪裡？', '要怎麼預約試穿？', '運費怎麼算？', '可以退換貨嗎？']

function readStoredConversation(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredConversation(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 無痕模式 / 停用儲存 → 這次對話仍可用，只是重整後接不回來 */
  }
}

export function FloatingChatButton({
  lineOaUrl,
  metaPageId,
  enableLine = true,
  enableMessenger = true,
  enableAiChat = true,
  greeting,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disclaimer, setDisclaimer] = useState<string | null>(null)
  const [handedOff, setHandedOff] = useState(false)
  const [aiOff, setAiOff] = useState(false)
  const [humanMode, setHumanMode] = useState(false)
  const conversationRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const welcome = (greeting || '').trim() || DEFAULT_GREETING

  /* 開啟時取後台設定 + 接回上次對話（重整/換頁都不會斷） */
  useEffect(() => {
    if (!isOpen || !enableAiChat || restoredRef.current) return
    restoredRef.current = true
    const stored = readStoredConversation()
    if (stored) conversationRef.current = stored
    const url = stored ? `/api/cs/chat?conversationId=${encodeURIComponent(stored)}` : '/api/cs/chat'

    fetch(url)
      .then((r) => r.json())
      .then(
        (data: {
          config?: { aiEnabled?: boolean; greeting?: string; disclaimer?: string }
          humanMode?: boolean
          conversationId?: string | number | null
          messages?: Array<{ id: string | number; role: string; text: string }>
        }) => {
          if (data?.config?.aiEnabled === false) setAiOff(true)
          if (data?.humanMode) {
            setHumanMode(true)
            setHandedOff(true)
          }
          if (data?.config?.disclaimer) setDisclaimer(data.config.disclaimer)
          const hello = (data?.config?.greeting || '').trim() || welcome

          if (!data?.conversationId || !data.messages?.length) {
            writeStoredConversation(null)
            conversationRef.current = null
            setMessages([{ id: 'greeting', role: 'assistant', text: hello }])
            return
          }
          conversationRef.current = String(data.conversationId)
          setMessages(
            data.messages
              .filter((m) => m.text)
              .map((m) => ({
                id: String(m.id),
                role: m.role === 'user' ? 'user' : 'assistant',
                text: m.text,
              })),
          )
        },
      )
      .catch(() => {
        setMessages([{ id: 'greeting', role: 'assistant', text: welcome }])
      })
  }, [isOpen, enableAiChat, welcome])

  /* 新訊息捲到底 */
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  const send = useCallback(
    async (raw: string, opts?: { requestHuman?: boolean }) => {
      const text = raw.trim()
      const wantHuman = opts?.requestHuman === true
      if ((!text && !wantHuman) || sending) return
      setError(null)
      setInput('')
      setSending(true)
      if (text) {
        setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text }])
      }

      try {
        const res = await fetch('/api/cs/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            ...(wantHuman ? { requestHuman: true } : {}),
            conversationId: conversationRef.current,
            pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          reply?: string
          conversationId?: string | number
          escalated?: boolean
          humanMode?: boolean
          disclaimer?: string
        }

        if (!res.ok || !data.ok) {
          setError(data.error || '訊息送出失敗，請稍後再試')
          return
        }
        if (data.conversationId) {
          conversationRef.current = String(data.conversationId)
          writeStoredConversation(String(data.conversationId))
        }
        if (data.disclaimer) setDisclaimer(data.disclaimer)
        if (data.escalated) setHandedOff(true)
        if (data.humanMode) setHumanMode(true)
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            text: data.reply || '',
            escalated: data.escalated,
          },
        ])
      } catch {
        setError('連線失敗，請檢查網路後再試一次')
      } finally {
        setSending(false)
      }
    },
    [sending],
  )

  if (!enableLine && !enableMessenger && !enableAiChat) return null

  const showChannelLinks = enableLine || (enableMessenger && metaPageId)

  return (
    <div
      data-component="floating-chat"
      // --consent-h 由 CookieConsentBanner 提供，避免客服鈕被同意條蓋住
      style={{ bottom: 'calc(var(--consent-h, 0px) + 1.5rem)' }}
      className="fixed right-6 z-50 flex flex-col items-end gap-3"
    >
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#7A5A28] w-[min(22rem,calc(100vw-3rem))] overflow-hidden flex flex-col max-h-[min(32rem,calc(100vh-8rem))]">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#2C2C2C] text-white">
            <div className="flex items-center gap-2">
              {humanMode ? <Headset size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
              <span className="text-sm font-medium">{humanMode ? '真人客服留言' : '客服小幫手'}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-white/15 transition-colors"
              aria-label="關閉客服視窗"
            >
              <X size={16} />
            </button>
          </div>

          {enableAiChat ? (
            <>
              {/* 訊息區 */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#FBF8F3]">
                {aiOff && (
                  <div className="rounded-xl border-2 border-[#2C2C2C] bg-white px-3 py-2 text-xs text-[#2C2C2C]">
                    AI 自動回覆目前關閉中。您留下的訊息會直接建立客服工單，真人客服會在營業時間內回覆。
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className="max-w-[85%]">
                      <div className="text-[11px] text-[#2C2C2C]/60 mb-1 px-1">
                        {m.role === 'user' ? '您' : humanMode || aiOff ? '客服中心' : 'AI 小幫手'}
                      </div>
                      <div
                        className={
                          m.role === 'user'
                            ? 'rounded-2xl rounded-tr-sm border-2 border-[#2C2C2C] bg-white px-3 py-2 text-sm text-[#2C2C2C] whitespace-pre-wrap leading-relaxed'
                            : 'rounded-2xl rounded-tl-sm border-2 border-[#7A5A28] bg-white px-3 py-2 text-sm text-[#2C2C2C] whitespace-pre-wrap leading-relaxed'
                        }
                      >
                        {m.text}
                      </div>
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-tl-sm border-2 border-[#7A5A28] bg-white px-3 py-2 text-sm text-[#2C2C2C]/70 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      正在為您查詢…
                    </div>
                  </div>
                )}

                {handedOff && (
                  <div className="rounded-xl border-2 border-[#2C2C2C] bg-white px-3 py-2.5 text-xs text-[#2C2C2C]">
                    <div className="flex items-start gap-2">
                      <UserRound size={14} className="mt-0.5 shrink-0" aria-hidden />
                      <span>
                        {humanMode
                          ? '已轉由真人客服接手，AI 小幫手先退場。您在這裡留的訊息客服都看得到，會在營業時間內回覆。'
                          : '已為您建立客服工單，真人客服會在營業時間內回覆。'}
                      </span>
                    </div>
                    {enableLine && (
                      <a
                        href={lineOaUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#06C755] text-white text-xs border-2 border-[#04913F] hover:opacity-90 transition-opacity"
                      >
                        急件？點這裡用 LINE 直接找客服
                      </a>
                    )}
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border-2 border-[#B3261E] bg-white px-3 py-2 text-xs text-[#B3261E]">
                    {error}
                  </div>
                )}

                {/* 常見問題快捷 */}
                {messages.length <= 1 && !sending && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {QUICK_ASKS.map((q) => (
                      <button
                        key={q}
                        onClick={() => void send(q)}
                        className="text-xs px-2.5 py-1.5 rounded-full border border-[#7A5A28] text-[#7A5A28] bg-white hover:bg-[#F5EDE0] transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 輸入區 */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void send(input)
                }}
                className="border-t-2 border-[#E3D5BC] bg-white px-3 py-2.5"
              >
                {!humanMode && !aiOff && (
                  <button
                    type="button"
                    onClick={() => void send('', { requestHuman: true })}
                    disabled={sending}
                    className="mb-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[#2C2C2C] text-[#2C2C2C] bg-white text-xs hover:bg-[#F5EDE0] disabled:opacity-40 transition-colors"
                  >
                    <Headset size={13} aria-hidden />
                    不想跟 AI 聊？轉真人客服
                  </button>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void send(input)
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder={humanMode ? '留言給真人客服…' : '輸入您的問題…'}
                    aria-label={humanMode ? '留言給真人客服' : '輸入您的問題'}
                    className="flex-1 resize-none rounded-xl border-2 border-[#B79A6B] px-3 py-2 text-sm text-[#2C2C2C] placeholder:text-[#2C2C2C]/40 focus:outline-none focus:border-[#7A5A28] max-h-24"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="shrink-0 w-10 h-10 rounded-xl bg-[#2C2C2C] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#000] transition-colors"
                    aria-label="送出訊息"
                  >
                    <Send size={16} />
                  </button>
                </div>
                {disclaimer && !humanMode && !aiOff && (
                  <p className="mt-2 text-[11px] leading-snug text-[#2C2C2C]/55">{disclaimer}</p>
                )}
              </form>
            </>
          ) : (
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-[#2C2C2C] mb-1">需要幫助嗎？</p>
              <p className="text-xs text-[#2C2C2C]/60">歡迎透過以下方式聯繫我們的客服團隊</p>
            </div>
          )}

          {/* 真人管道 */}
          {showChannelLinks && (
            <div className="border-t-2 border-[#E3D5BC] bg-white px-4 py-3 space-y-2">
              <p className="text-[11px] text-[#2C2C2C]/60">想直接找真人客服？</p>
              {enableLine && (
                <a
                  href={lineOaUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#06C755] text-white text-sm border-2 border-[#04913F] hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                  LINE 客服
                </a>
              )}
              {enableMessenger && metaPageId && (
                <a
                  href={`https://m.me/${metaPageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0084FF] text-white text-sm border-2 border-[#0057AD] hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.465 3.442.465 6.627 0 12-4.975 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.2l3.131 3.259L19.752 8.2l-6.559 6.763z"/></svg>
                  Messenger 客服
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gold-500 text-white shadow-lg border-2 border-[#7A5A28] hover:bg-gold-600 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
        aria-label={isOpen ? '關閉客服視窗' : '聯絡客服'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  )
}
