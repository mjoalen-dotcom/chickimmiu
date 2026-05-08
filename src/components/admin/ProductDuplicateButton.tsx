'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type ToastState =
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string }
  | null

function extractDuplicatedId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>

  const directId = data.id
  if (typeof directId === 'string' || typeof directId === 'number') {
    return String(directId)
  }

  const doc = data.doc
  if (doc && typeof doc === 'object') {
    const docId = (doc as Record<string, unknown>).id
    if (typeof docId === 'string' || typeof docId === 'number') {
      return String(docId)
    }
  }

  const result = data.result
  if (result && typeof result === 'object') {
    const resultId = (result as Record<string, unknown>).id
    if (typeof resultId === 'string' || typeof resultId === 'number') {
      return String(resultId)
    }
    const resultDoc = (result as Record<string, unknown>).doc
    if (resultDoc && typeof resultDoc === 'object') {
      const resultDocId = (resultDoc as Record<string, unknown>).id
      if (typeof resultDocId === 'string' || typeof resultDocId === 'number') {
        return String(resultDocId)
      }
    }
  }

  return null
}

const ProductDuplicateButton: React.FC = () => {
  const { id: docId } = useDocumentInfo()
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (docId == null || docId === '') return null

  const showToast = (next: Exclude<ToastState, null>) => {
    setToast(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), 2200)
  }

  const handleDuplicate = async () => {
    if (busy) return
    if (!window.confirm('即將複製此商品，並重設為草稿。確定要繼續嗎？')) return

    setBusy(true)
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(String(docId))}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errData = data as {
          message?: string
          errors?: Array<{ message?: string }>
        }
        throw new Error(errData.errors?.[0]?.message || errData.message || `HTTP ${res.status}`)
      }

      const newId = extractDuplicatedId(data)
      if (!newId) {
        throw new Error('找不到新商品 ID，請重新整理後確認是否已建立')
      }

      showToast({ kind: 'success', text: '✅ 已建立複本，正在前往新商品…' })
      window.location.href = `/admin/collections/products/${encodeURIComponent(newId)}`
    } catch (err) {
      showToast({
        kind: 'error',
        text: `❌ 複製失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleDuplicate}
        disabled={busy}
        style={{
          border: '1px solid var(--theme-elevation-250, #c9c9cf)',
          background: busy ? 'var(--theme-elevation-100, #f4f4f5)' : 'var(--theme-elevation-50, #fafafa)',
          color: 'var(--theme-text, #171717)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? '複製中…' : '🧬 複製此商品'}
      </button>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 84,
            right: 16,
            zIndex: 80,
            maxWidth: 360,
            borderRadius: 8,
            padding: '10px 12px',
            border:
              toast.kind === 'success'
                ? '1px solid #86efac'
                : '1px solid #fca5a5',
            background:
              toast.kind === 'success'
                ? 'rgba(236, 253, 245, 0.96)'
                : 'rgba(254, 242, 242, 0.96)',
            color: toast.kind === 'success' ? '#166534' : '#991b1b',
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: '0 10px 24px rgba(0, 0, 0, 0.15)',
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}

export default ProductDuplicateButton
