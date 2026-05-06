'use client'

import { useState } from 'react'

type RecountResponse = {
  ok: boolean
  count?: number
  changed?: Array<{ id: number; before: number; after: number }>
  error?: string
}

export default function CategoryRecountButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const onClick = async () => {
    setBusy(true)
    setMsg('計算中...')
    try {
      const r = await fetch('/api/categories/recount', {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await r.json()) as RecountResponse
      if (j.ok) {
        setMsg(`完成：總 ${j.count ?? 0} 個分類，更新 ${j.changed?.length ?? 0} 個`)
      } else {
        setMsg(`失敗：${j.error ?? r.statusText}`)
      }
    } catch (e) {
      setMsg(`失敗：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        padding: 12,
        background: '#fffbe6',
        border: '1px solid #f0e0a0',
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        style={{
          padding: '6px 14px',
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: 4,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? '計算中…' : '重新計算所有分類商品數'}
      </button>
      {msg && <span style={{ marginLeft: 12, fontSize: 13 }}>{msg}</span>}
    </div>
  )
}
