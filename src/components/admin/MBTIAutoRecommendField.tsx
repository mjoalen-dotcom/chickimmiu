'use client'

import React, { useState } from 'react'
import { useField, useDocumentInfo, useForm } from '@payloadcms/ui'

/**
 * MBTIAutoRecommendField
 * ──────────────────────
 * Products.personalityTypes 的後台 custom Field。
 *   - 16 個 MBTI 類型 chip 切換
 *   - 「🤖 自動推薦」按鈕：依商品的 name/tags/collectionTags/category
 *     呼叫 /api/games/mbti/suggest-product-types 取得建議，合併進已選清單
 *
 * MUST be a client component — Payload v3 admin.components.Field inside a
 * tab/group silently empties the entire form's render-fields if the
 * component is async/RSC (見 feedback memory `payload_v3_group_field_rsc`).
 */

interface MBTIOption {
  value: string
  label: string
}

const MBTI_OPTIONS: MBTIOption[] = [
  { value: 'INTJ', label: 'INTJ 建築師' },
  { value: 'INTP', label: 'INTP 邏輯學家' },
  { value: 'ENTJ', label: 'ENTJ 指揮官' },
  { value: 'ENTP', label: 'ENTP 辯論家' },
  { value: 'INFJ', label: 'INFJ 提倡者' },
  { value: 'INFP', label: 'INFP 調停者' },
  { value: 'ENFJ', label: 'ENFJ 主人公' },
  { value: 'ENFP', label: 'ENFP 競選者' },
  { value: 'ISTJ', label: 'ISTJ 物流師' },
  { value: 'ISFJ', label: 'ISFJ 守衛者' },
  { value: 'ESTJ', label: 'ESTJ 總經理' },
  { value: 'ESFJ', label: 'ESFJ 執政官' },
  { value: 'ISTP', label: 'ISTP 鑑賞家' },
  { value: 'ISFP', label: 'ISFP 探險家' },
  { value: 'ESTP', label: 'ESTP 企業家' },
  { value: 'ESFP', label: 'ESFP 表演者' },
]

interface Props {
  path: string
}

const MBTIAutoRecommendField: React.FC<Props> = ({ path }) => {
  const { value, setValue } = useField<string[]>({ path })
  const { id: docId } = useDocumentInfo()
  const { getData } = useForm()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'success' | 'warn' | 'error'>('success')

  const selected: string[] = Array.isArray(value) ? value : []

  const toggle = (v: string) => {
    if (selected.includes(v)) {
      setValue(selected.filter((x) => x !== v))
    } else {
      setValue([...selected, v])
    }
  }

  const clear = () => {
    setValue([])
    setMessage(null)
  }

  const autoSuggest = async () => {
    setBusy(true)
    setMessage(null)
    try {
      let body: Record<string, unknown> = {}
      if (docId != null) {
        body = { productId: docId }
      } else {
        // 新建商品（尚未存）：從 in-memory form state 讀
        const form = (typeof getData === 'function' ? getData() : null) as Record<string, unknown> | null
        if (form) {
          body = {
            name: form.name,
            description: form.description,
            tags: form.tags,
            collectionTags: form.collectionTags,
            category: form.category,
          }
        }
      }

      const res = await fetch('/api/games/mbti/suggest-product-types', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!data.success) {
        setMessageKind('error')
        setMessage(data.message || '推薦失敗')
        return
      }

      const suggested: string[] = Array.isArray(data.suggested) ? data.suggested : []
      if (suggested.length === 0) {
        setMessageKind('warn')
        setMessage('沒有匹配的關鍵詞，請先填寫商品名稱、標籤、分類後再試一次')
        return
      }

      const merged = Array.from(new Set([...selected, ...suggested]))
      setValue(merged)
      setMessageKind('success')
      setMessage(`已加入 ${suggested.length} 個推薦類型：${suggested.join('、')}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      setMessageKind('error')
      setMessage(msg)
    } finally {
      setBusy(false)
    }
  }

  const messageColor =
    messageKind === 'error' ? '#dc2626' : messageKind === 'warn' ? '#d97706' : '#16a34a'

  return (
    <div className="field-type" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--theme-elevation-800, #18181b)',
          }}
        >
          適合的個性類型 (MBTI)
          {selected.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#71717a' }}>
              已選 {selected.length} 個
            </span>
          )}
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                border: '1px solid var(--theme-elevation-200, #d4d4d8)',
                borderRadius: 6,
                background: 'var(--theme-bg, #fff)',
                color: 'var(--theme-elevation-600, #52525b)',
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              清空
            </button>
          )}
          <button
            type="button"
            onClick={autoSuggest}
            disabled={busy}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 500,
              border: '1px solid #818cf8',
              borderRadius: 6,
              background: busy ? '#e0e7ff' : '#eef2ff',
              color: '#4338ca',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? '推薦中…' : '🤖 自動推薦'}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 6,
        }}
      >
        {MBTI_OPTIONS.map((opt) => {
          const checked = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              style={{
                padding: '8px 10px',
                fontSize: 13,
                border: checked
                  ? '2px solid #6366f1'
                  : '1px solid var(--theme-elevation-200, #d4d4d8)',
                borderRadius: 6,
                background: checked ? '#eef2ff' : 'var(--theme-input-bg, #fff)',
                color: checked ? '#4338ca' : 'var(--theme-elevation-700, #3f3f46)',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: checked ? 500 : 400,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <p
        style={{
          fontSize: 11,
          color: 'var(--theme-elevation-500, #71717a)',
          marginTop: 6,
        }}
      >
        建議勾選 1-4 個此商品最適合的 MBTI 類型。新建商品儲存時若未勾選會依 tag/分類自動填入（已勾選則尊重不覆蓋）。
      </p>

      {message && (
        <p style={{ fontSize: 12, marginTop: 6, color: messageColor }}>{message}</p>
      )}
    </div>
  )
}

export default MBTIAutoRecommendField
