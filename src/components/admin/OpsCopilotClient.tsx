'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * OpsCopilotClient — 營運 AI 助理指揮艙
 * ────────────────────────────────────────────────
 * 三塊：① 日報訊號　② 待核准提案　③ 對話查詢
 *
 * 🎨 色弱友善（Alan 有色弱，硬性要求）：
 *   嚴重度**不靠色相區分**。每張卡都有：
 *     · 文字徽章（緊急 / 注意 / 提醒）
 *     · 左側邊條粗細不同（6px / 4px / 3px）
 *     · 邊框明度對比 ≥ 3:1（深色邊 #1f2937 / #4b5563 / #9ca3af，配淺底）
 *   顏色只是輔助，拿掉顏色資訊仍然完整。
 */

// ── 型別（與 lib/ops-copilot/types.ts 對應） ──────────────

type Severity = 'critical' | 'warning' | 'info'

interface Signal {
  id: string
  category: string
  severity: Severity
  title: string
  metrics: Record<string, string | number>
  entities?: Array<{ collection: string; id: string | number; label: string }>
}

interface Briefing {
  generatedAt: string
  headline: string
  signals: Signal[]
  proposedActionIds: Array<string | number>
  degraded: boolean
}

interface ActionPreview {
  headline: string
  changes: Array<{ field: string; before: string; after: string }>
  blockers?: string[]
}

interface ProposedAction {
  id: string | number
  summary: string
  actionType: string
  risk: 'low' | 'high'
  status: string
  sourceSignalId?: string
  preview?: ActionPreview
  createdAt: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>
}

// ── 視覺（明度優先，色相只是輔助） ───────────────────────

const SEVERITY_STYLE: Record<
  Severity,
  { label: string; border: string; bar: number; bg: string }
> = {
  // border 全部是深色（明度對比 ≥3:1 對淺底），差異靠 bar 粗細 + 文字徽章
  critical: { label: '緊急', border: '#1f2937', bar: 6, bg: '#fdf2f2' },
  warning: { label: '注意', border: '#4b5563', bar: 4, bg: '#fdf8ee' },
  info: { label: '提醒', border: '#9ca3af', bar: 3, bg: '#f5f7fa' },
}

const CATEGORY_LABEL: Record<string, string> = {
  inventory: '庫存',
  pricing: '定價',
  orders: '訂單',
  members: '會員',
  engagement: '互動',
  risk: '風險',
  marketing: '行銷',
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #4b5563',
  borderRadius: 8,
  padding: 20,
  marginBottom: 20,
}

const btn = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  border: '2px solid #1f2937',
  background: variant === 'primary' ? '#1f2937' : '#fff',
  color: variant === 'primary' ? '#fff' : '#1f2937',
  ...(variant === 'danger' ? { borderStyle: 'dashed' as const } : {}),
})

// ── 主元件 ──────────────────────────────────────────────

const OpsCopilotClient: React.FC = () => {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [actions, setActions] = useState<ProposedAction[]>([])
  const [busyAction, setBusyAction] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [chatting, setChatting] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadActions = useCallback(async () => {
    try {
      const res = await fetch('/api/ops-copilot/actions?status=pending', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
      const json = await res.json()
      setActions(json.actions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '待辦載入失敗')
    }
  }, [])

  useEffect(() => {
    void loadActions()
  }, [loadActions])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatting])

  const runBriefing = useCallback(async () => {
    setBriefingLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ops-copilot/briefing', { credentials: 'include' })
      if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`)
      setBriefing(await res.json())
      await loadActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '日報產生失敗')
    } finally {
      setBriefingLoading(false)
    }
  }, [loadActions])

  const decide = useCallback(
    async (action: ProposedAction, decision: 'execute' | 'reject') => {
      if (decision === 'execute' && action.risk === 'high') {
        const ok = window.confirm(
          `這是高風險行動，執行後會實際改動線上資料：\n\n${action.summary}\n\n確定要執行嗎？`,
        )
        if (!ok) return
      }
      setBusyAction(action.id)
      setError(null)
      try {
        const res = await fetch(`/api/ops-copilot/actions/${action.id}/execute`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, confirm: true }),
        })
        const json = await res.json()
        if (!res.ok || json.ok === false) {
          setError(json.error || `HTTP ${res.status}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '執行失敗')
      } finally {
        setBusyAction(null)
        await loadActions()
      }
    },
    [loadActions],
  )

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || chatting) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setDraft('')
    setChatting(true)
    setError(null)
    try {
      const res = await fetch('/api/ops-copilot/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setMessages([
        ...next,
        { role: 'assistant', content: json.text, toolCalls: json.toolCalls },
      ])
      // 對話裡可能提了新提案，重新拉待辦
      await loadActions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '對話失敗')
      setMessages(next)
    } finally {
      setChatting(false)
    }
  }, [draft, chatting, messages, loadActions])

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>營運 AI 助理</h1>
        <p style={{ color: '#4b5563', marginTop: 6, fontSize: 14, lineHeight: 1.7 }}>
          日報的每個數字都由程式掃描實際資料算出，AI 只負責排序與敘述，不產生數字。
          AI 提出的行動一律要你在這裡按下執行才會生效 —— 它沒有直接改資料的權限。
        </p>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            ...card,
            borderWidth: 2,
            borderColor: '#1f2937',
            background: '#fdf2f2',
            padding: 14,
          }}
        >
          <strong>錯誤：</strong> {error}
        </div>
      )}

      {/* ── ① 日報 ────────────────────────────────── */}
      <section style={card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>營運日報</h2>
          <button type="button" style={btn('primary')} onClick={runBriefing} disabled={briefingLoading}>
            {briefingLoading ? '掃描中…（約 5–20 秒）' : '產生今日日報'}
          </button>
        </div>

        {!briefing && !briefingLoading && (
          <p style={{ color: '#4b5563', fontSize: 14 }}>
            尚未產生。按下按鈕會掃描庫存、競品價、卡單、沉睡會員、穿搭投票、信用分數與提領逾時。
          </p>
        )}

        {briefing && (
          <>
            <div
              style={{
                background: '#f5f7fa',
                border: '1px solid #4b5563',
                borderLeft: '6px solid #1f2937',
                borderRadius: 6,
                padding: '14px 16px',
                fontSize: 15,
                lineHeight: 1.8,
                marginBottom: 18,
              }}
            >
              {briefing.headline}
              {briefing.degraded && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>
                  ⚠ AI 敘述服務不可用，以上為系統自動摘要（數字仍為實際掃描結果）。
                </div>
              )}
            </div>

            <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 12 }}>
              產生時間 {new Date(briefing.generatedAt).toLocaleString('zh-TW')}
              　·　訊號 {briefing.signals.length} 項
              　·　本次新增提案 {briefing.proposedActionIds.length} 筆
            </div>

            {briefing.signals.length === 0 ? (
              <p style={{ fontSize: 14 }}>沒有偵測到需要處理的訊號。</p>
            ) : (
              briefing.signals.map((s) => {
                const style = SEVERITY_STYLE[s.severity]
                return (
                  <article
                    key={s.id}
                    style={{
                      border: `1px solid ${style.border}`,
                      borderLeft: `${style.bar}px solid ${style.border}`,
                      borderRadius: 6,
                      background: style.bg,
                      padding: '14px 16px',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          border: `2px solid ${style.border}`,
                          borderRadius: 4,
                          padding: '1px 8px',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {style.label}
                      </span>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                        {CATEGORY_LABEL[s.category] ?? s.category}
                      </span>
                      <strong style={{ fontSize: 15 }}>{s.title}</strong>
                    </div>

                    <dl
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                        gap: '4px 16px',
                        margin: '10px 0 0',
                        fontSize: 13,
                      }}
                    >
                      {Object.entries(s.metrics).map(([k, v]) => (
                        <div key={k}>
                          <dt style={{ display: 'inline', color: '#4b5563' }}>{k}：</dt>
                          <dd style={{ display: 'inline', margin: 0, fontWeight: 600 }}>{String(v)}</dd>
                        </div>
                      ))}
                    </dl>

                    {s.entities && s.entities.length > 0 && (
                      <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
                        {s.entities.map((e) => (
                          <li key={`${e.collection}-${e.id}`}>
                            <a
                              href={`/admin/collections/${e.collection}/${e.id}`}
                              style={{ textDecoration: 'underline' }}
                            >
                              {e.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                )
              })
            )}
          </>
        )}
      </section>

      {/* ── ② 待核准提案 ──────────────────────────── */}
      <section style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>
          待你核准（{actions.length}）
        </h2>
        <p style={{ color: '#4b5563', fontSize: 13, margin: '0 0 16px' }}>
          執行前系統會重跑一次預覽與熔斷檢查 —— 提案到現在資料若已改變會被擋下。
        </p>

        {actions.length === 0 ? (
          <p style={{ fontSize: 14 }}>目前沒有待處理的提案。</p>
        ) : (
          actions.map((a) => (
            <article
              key={a.id}
              style={{
                border: '1px solid #4b5563',
                borderLeft: a.risk === 'high' ? '6px solid #1f2937' : '3px solid #9ca3af',
                borderRadius: 6,
                padding: '14px 16px',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    border: '2px solid #1f2937',
                    borderRadius: 4,
                    padding: '1px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderStyle: a.risk === 'high' ? 'solid' : 'dashed',
                  }}
                >
                  {a.risk === 'high' ? '高風險' : '低風險'}
                </span>
                <strong style={{ fontSize: 15 }}>{a.summary}</strong>
              </div>

              {a.preview && (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    margin: '12px 0 0',
                  }}
                >
                  <thead>
                    <tr>
                      {['項目', '現在', '執行後'].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left',
                            borderBottom: '2px solid #4b5563',
                            padding: '4px 8px',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.preview.changes.map((c) => (
                      <tr key={c.field}>
                        <td style={{ borderBottom: '1px solid #d1d5db', padding: '4px 8px' }}>{c.field}</td>
                        <td style={{ borderBottom: '1px solid #d1d5db', padding: '4px 8px' }}>{c.before}</td>
                        <td
                          style={{
                            borderBottom: '1px solid #d1d5db',
                            padding: '4px 8px',
                            fontWeight: 700,
                          }}
                        >
                          {c.after}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  style={btn('primary')}
                  disabled={busyAction === a.id}
                  onClick={() => decide(a, 'execute')}
                >
                  {busyAction === a.id ? '執行中…' : '核准並執行'}
                </button>
                <button
                  type="button"
                  style={btn('danger')}
                  disabled={busyAction === a.id}
                  onClick={() => decide(a, 'reject')}
                >
                  駁回
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* ── ③ 對話 ────────────────────────────────── */}
      <section style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>問點什麼</h2>
        <p style={{ color: '#4b5563', fontSize: 13, margin: '0 0 16px' }}>
          可以問「這個月哪些款該補貨」「哪些會員快流失」「近 30 天營收多少」。
          助理只能唯讀查詢；要改東西它會提案，由你在上面按核准。
        </p>

        <div
          style={{
            border: '1px solid #4b5563',
            borderRadius: 6,
            padding: 14,
            minHeight: 140,
            maxHeight: 460,
            overflowY: 'auto',
            marginBottom: 12,
            background: '#fafbfc',
          }}
        >
          {messages.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>還沒有對話。</p>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                {m.role === 'user' ? '你' : '助理'}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{m.content}</div>
              {m.toolCalls && m.toolCalls.length > 0 && (
                <details style={{ marginTop: 6, fontSize: 12, color: '#4b5563' }}>
                  <summary style={{ cursor: 'pointer' }}>
                    查了 {m.toolCalls.length} 次資料（點開看查了什麼）
                  </summary>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {m.toolCalls.map((t, j) => (
                      <li key={j}>
                        <code>{t.name}</code> {JSON.stringify(t.input).slice(0, 160)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
          {chatting && <div style={{ fontSize: 14, color: '#4b5563' }}>助理查詢中…</div>}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="例：近 30 天哪三款賣最好？庫存夠嗎？"
            disabled={chatting}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: 14,
              border: '2px solid #4b5563',
              borderRadius: 6,
            }}
          />
          <button type="button" style={btn('primary')} onClick={send} disabled={chatting || !draft.trim()}>
            送出
          </button>
        </div>
      </section>
    </div>
  )
}

export default OpsCopilotClient
