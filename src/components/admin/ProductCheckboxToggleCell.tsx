'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Admin list view cell — 商品布林標記行內切換
 *
 * 顯示 ☑ / ☐，點擊即 PATCH /api/products/<id> { [field]: !value }。
 * 由 clientProps 控制：
 *   - fieldName: 'isHot' | 'isNew' | 'isLowStock'
 *   - readOnly:  true → 只顯示不可改（給 isLowStock 系統自動判斷用）
 */

type ExtraProps = {
  readonly fieldName?: string
  readonly readOnly?: boolean
}

export default function ProductCheckboxToggleCell(
  props: DefaultCellComponentProps & ExtraProps,
) {
  const router = useRouter()
  const fieldName = props.fieldName ?? ''
  const readOnly = Boolean(props.readOnly)

  const rowData = props.rowData as Record<string, unknown> | undefined
  const productId = rowData?.id as string | number | undefined
  const value = Boolean(rowData?.[fieldName])

  const [busy, setBusy] = useState(false)
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const displayValue = optimistic ?? value

  const toggle = async () => {
    if (readOnly || !productId || busy || !fieldName) return
    const next = !displayValue
    setOptimistic(next)
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { errors?: { message: string }[]; message?: string }
          | null
        const msg =
          body?.errors?.[0]?.message || body?.message || `HTTP ${res.status}`
        alert(`切換失敗：${msg}`)
        setOptimistic(null)
        return
      }
      router.refresh()
      // 等 router.refresh 拉到新資料後 props.rowData 會更新，optimistic 自動退場
      window.setTimeout(() => setOptimistic(null), 600)
    } catch (err) {
      console.error('[ProductCheckboxToggleCell] error:', err)
      alert('切換失敗，請檢查網路後重試')
      setOptimistic(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={displayValue}
        disabled={busy || readOnly}
        onChange={() => {
          void toggle()
        }}
        title={readOnly ? '系統自動判斷' : '點擊切換'}
        style={{
          width: 16,
          height: 16,
          cursor: readOnly ? 'default' : busy ? 'wait' : 'pointer',
          accentColor: '#10b981',
          margin: 0,
        }}
      />
    </span>
  )
}
