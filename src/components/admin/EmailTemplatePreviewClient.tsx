'use client'

import React, { useCallback, useEffect, useState } from 'react'

/**
 * EmailTemplatePreviewClient — 事件選單 + iframe 即時預覽 + 測試寄送
 *
 * 純 useState + fetch /api/admin/email-templates/test，無額外 lib。
 * preview：POST action=preview → iframe srcDoc 顯示合併後完整 HTML。
 * send：POST action=send → 寄到登入 admin 自己信箱（不寄客戶）。
 */

export interface PreviewTemplateMeta {
  eventKey: string
  label: string
  name: string
  enabled: boolean | null
  docId: string | null
  variables: Array<{ name: string; desc: string }>
}

interface Props {
  templates: PreviewTemplateMeta[]
  adminEmail: string
  resendConfigured: boolean
}

interface PreviewResp {
  ok?: boolean
  subject?: string
  html?: string
  enabled?: boolean | null
  usingDefault?: boolean
  error?: string
}

const EmailTemplatePreviewClient: React.FC<Props> = ({ templates, adminEmail, resendConfigured }) => {
  const [selected, setSelected] = useState<string>(templates[0]?.eventKey || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [sending, setSending] = useState(false)
  const [sentMsg, setSentMsg] = useState<string | null>(null)

  const current = templates.find((t) => t.eventKey === selected) || null

  const loadPreview = useCallback(async (eventKey: string) => {
    setLoading(true)
    setError(null)
    setSentMsg(null)
    try {
      const res = await fetch('/api/admin/email-templates/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'preview', eventKey }),
      })
      const json = (await res.json()) as PreviewResp
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`)
        setPreview(null)
        return
      }
      setPreview(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selected) loadPreview(selected)
  }, [selected, loadPreview])

  const handleSend = async () => {
    setSending(true)
    setError(null)
    setSentMsg(null)
    try {
      const res = await fetch('/api/admin/email-templates/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send', eventKey: selected }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError((json.error || `HTTP ${res.status}`) + (json.hint ? `\n${json.hint}` : ''))
        return
      }
      setSentMsg(
        resendConfigured
          ? `已寄出測試信到 ${json.sentTo}`
          : `已記錄到 server log（未設 RESEND_API_KEY，不會真的寄出）。收件人：${json.sentTo}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  // ── 樣式 ──
  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150, #e4e4e7)',
    borderRadius: 12,
    background: 'var(--theme-elevation-0, #fff)',
  }
  const eventBtn = (active: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
    border: 'none',
    borderLeft: active ? '3px solid var(--theme-success-500, #22c55e)' : '3px solid transparent',
    background: active ? 'var(--theme-elevation-100, #f5f5f5)' : 'transparent',
    color: 'var(--theme-elevation-900, #111)',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>
      {/* ── 左：事件清單 ── */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div
          style={{
            padding: '10px 14px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--theme-elevation-600, #666)',
            borderBottom: '1px solid var(--theme-elevation-150, #e4e4e7)',
          }}
        >
          事件
        </div>
        {templates.map((t) => (
          <button
            key={t.eventKey}
            type="button"
            onClick={() => setSelected(t.eventKey)}
            style={eventBtn(t.eventKey === selected)}
          >
            {t.label}
            {t.enabled === false && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--theme-warning-700, #b45309)' }}>
                （停用）
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 右：預覽 + 動作 ── */}
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{current?.label}</div>
            {preview?.usingDefault && (
              <span style={{ fontSize: 12, color: 'var(--theme-elevation-600,#666)' }}>
                （尚未建立模板，預覽系統預設）
              </span>
            )}
            {preview?.enabled === false && (
              <span style={{ fontSize: 12, color: 'var(--theme-warning-700,#b45309)' }}>
                （此模板已停用，實際寄信會回退預設）
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {current?.docId && (
                <a
                  href={`/admin/collections/email-templates/${current.docId}`}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    background: 'var(--theme-elevation-100, #f5f5f5)',
                    color: 'var(--theme-elevation-900, #111)',
                  }}
                >
                  ✏️ 編輯此模板
                </a>
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !adminEmail}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: sending || !adminEmail ? 'not-allowed' : 'pointer',
                  background: 'var(--theme-success-500, #22c55e)',
                  color: '#fff',
                  opacity: sending || !adminEmail ? 0.5 : 1,
                }}
              >
                {sending ? '寄送中…' : `✉️ 寄測試到 ${adminEmail || '我的信箱'}`}
              </button>
            </div>
          </div>

          {preview?.subject && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 12px',
                background: 'var(--theme-elevation-50, #fafafa)',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--theme-elevation-800, #222)',
              }}
            >
              <strong>主旨：</strong> {preview.subject}
            </div>
          )}

          {sentMsg && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 6,
                background: 'var(--theme-success-100, #dcfce7)',
                color: 'var(--theme-success-900, #14532d)',
                fontSize: 13,
              }}
            >
              ✅ {sentMsg}
            </div>
          )}
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 6,
                background: 'var(--theme-error-100, #fee2e2)',
                color: 'var(--theme-error-900, #991b1b)',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* iframe 預覽 */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 14px',
              fontSize: 12,
              color: 'var(--theme-elevation-600, #666)',
              borderBottom: '1px solid var(--theme-elevation-150, #e4e4e7)',
            }}
          >
            預覽（範例變數）
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-500,#888)' }}>
              載入中…
            </div>
          ) : (
            <iframe
              title="email-preview"
              srcDoc={preview?.html || '<p style="padding:24px;font-family:sans-serif">無預覽內容</p>'}
              style={{ width: '100%', height: 640, border: 'none', background: '#faf6ec' }}
            />
          )}
        </div>

        {/* 可用變數 */}
        {current && (
          <div style={{ ...cardStyle, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>可用變數</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
              {current.variables.map((v) => (
                <div key={v.name} style={{ fontSize: 13, color: 'var(--theme-elevation-700,#444)' }}>
                  <code
                    style={{
                      background: 'var(--theme-elevation-100,#f0f0f0)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >{`{{${v.name}}}`}</code>{' '}
                  — {v.desc}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmailTemplatePreviewClient
