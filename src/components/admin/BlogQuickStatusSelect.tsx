'use client'

import { useRouter } from 'next/navigation'
import React, { useState, useTransition } from 'react'

type QuickState = 'draft' | 'public' | 'unlisted' | 'password'

interface BlogQuickStatusSelectProps {
  hasPassword: boolean
  id: number | string
  status?: string | null
  visibility?: string | null
}

function currentState(status?: string | null, visibility?: string | null): QuickState {
  if (status !== 'published') return 'draft'
  if (visibility === 'unlisted' || visibility === 'password') return visibility
  return 'public'
}

export default function BlogQuickStatusSelect({
  hasPassword,
  id,
  status,
  visibility,
}: BlogQuickStatusSelectProps) {
  const router = useRouter()
  const initial = currentState(status, visibility)
  const [value, setValue] = useState<QuickState>(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, startTransition] = useTransition()

  async function update(next: QuickState) {
    let password: string | undefined
    if (next === 'password' && !hasPassword) {
      const entered = window.prompt('請設定文章密碼（至少 6 個字元）')
      if (entered === null) return
      if (entered.length < 6 || entered.length > 128) {
        setError('密碼需為 6 至 128 個字元')
        return
      }
      password = entered
    }

    const previous = value
    setValue(next)
    setError('')
    setSaving(true)
    let response: Response
    try {
      response = await fetch('/api/admin/blog/status', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, state: next, password }),
      })
    } catch {
      setValue(previous)
      setError('網路連線失敗，請稍後再試')
      setSaving(false)
      return
    }
    const result = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) {
      setValue(previous)
      setError(result?.error || '狀態更新失敗')
      setSaving(false)
      return
    }
    setSaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <div style={{ minWidth: 118 }}>
      <select
        aria-label="快速調整文章狀態"
        value={value}
        disabled={pending || saving}
        onChange={(event) => void update(event.currentTarget.value as QuickState)}
        style={{
          width: '100%',
          minHeight: 34,
          padding: '5px 24px 5px 8px',
          border: '1px solid var(--theme-elevation-250, #d5d5d5)',
          borderRadius: 6,
          background: 'var(--theme-input-bg, #fff)',
          color: 'var(--theme-text, #202124)',
          cursor: pending || saving ? 'wait' : 'pointer',
          fontSize: 12,
        }}
      >
        <option value="draft">草稿</option>
        <option value="public">公開</option>
        <option value="unlisted">隱密連結</option>
        <option value="password">密碼保護</option>
      </select>
      {error ? (
        <span style={{ display: 'block', marginTop: 4, color: '#b42318', fontSize: 10 }}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
