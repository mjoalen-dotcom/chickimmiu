'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Admin list view cell — 商品價格（原價 / 特價）行內快編
 *
 * 顯示模式：點數字 → 進入編輯；輸入後 ✓ 提交 PATCH、✕ 取消、Enter/Esc 同義。
 * 由 clientProps 控制行為：
 *   - fieldName: 'price' | 'salePrice'
 *   - allowEmpty: true 代表清空 = 寫 null（特價用）
 *
 * 失敗時 alert API 回傳訊息（例如「特價 ≥ 原價」會被 beforeChange 擋下）。
 */

type ExtraProps = {
  readonly fieldName?: string
  readonly allowEmpty?: boolean
}

export default function ProductInlineNumberCell(
  props: DefaultCellComponentProps & ExtraProps,
) {
  const router = useRouter()
  const fieldName = props.fieldName ?? 'price'
  const allowEmpty = Boolean(props.allowEmpty)

  const rowData = props.rowData as Record<string, unknown> | undefined
  const productId = rowData?.id as string | number | undefined
  const rawValue = rowData?.[fieldName]
  const currentValue =
    typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<string>(currentValue?.toString() ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(currentValue?.toString() ?? '')
      // 進入編輯後自動 focus + 全選，加快連改下一個商品
      window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  }, [editing, currentValue])

  const formatDisplay = (n: number | null) => {
    if (n === null) return allowEmpty ? '—' : 'NT$ 0'
    return `NT$ ${n.toLocaleString('zh-TW')}`
  }

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy || !productId) return
    setEditing(true)
  }

  const cancel = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setEditing(false)
  }

  const submit = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!productId || busy) return

    const trimmed = draft.trim()
    let nextValue: number | null
    if (trimmed === '') {
      if (!allowEmpty) {
        alert('此欄位為必填，不可空白')
        return
      }
      nextValue = null
    } else {
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < 0) {
        alert('請輸入大於等於 0 的數字')
        return
      }
      nextValue = parsed
    }

    if (nextValue === currentValue) {
      setEditing(false)
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: nextValue }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { errors?: { message: string }[]; message?: string }
          | null
        const msg =
          body?.errors?.[0]?.message || body?.message || `HTTP ${res.status}`
        alert(`修改失敗：${msg}`)
        return
      }

      setEditing(false)
      router.refresh()
    } catch (err) {
      console.error('[ProductInlineNumberCell] error:', err)
      alert('修改失敗，請檢查網路後重試')
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setEditing(true)
          }
        }}
        title="點擊修改"
        style={{
          display: 'inline-block',
          padding: '2px 6px',
          borderRadius: 4,
          cursor: 'pointer',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.background =
            'var(--theme-elevation-50, #f4f4f5)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }}
      >
        {formatDisplay(currentValue)}
      </span>
    )
  }

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
      }}
    >
      <input
        ref={inputRef}
        type="number"
        min={0}
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={busy}
        placeholder={allowEmpty ? '空白 = 無' : '0'}
        style={{
          width: 90,
          padding: '3px 6px',
          fontSize: 12,
          border: '1px solid var(--theme-elevation-200, #d4d4d8)',
          borderRadius: 4,
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        title="確定變更"
        style={{
          width: 24,
          height: 24,
          padding: 0,
          background: '#10b981',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: busy ? 'wait' : 'pointer',
          fontSize: 13,
          lineHeight: '24px',
        }}
      >
        {busy ? '…' : '✓'}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        title="取消"
        style={{
          width: 24,
          height: 24,
          padding: 0,
          background: '#9ca3af',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: busy ? 'wait' : 'pointer',
          fontSize: 13,
          lineHeight: '24px',
        }}
      >
        ✕
      </button>
    </span>
  )
}
