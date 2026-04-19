'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Admin list view cell — 「處理中 + 列印檢貨單」一鍵 action.
 *
 * 只在 status=pending 時顯示按鈕；其他狀態顯示目前 status 文字。
 *
 * 點擊流程：
 *   1. PATCH /api/orders/<id> { status: 'processing' }
 *   2. 成功後 window.open('/api/order-print?id=<id>') 開新分頁列印
 *   3. router.refresh() 讓 list 重新拉資料，按鈕自動消失
 *
 * 失敗時 alert 錯誤並保留原狀態。
 */

const STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  processing: '處理中',
  shipped: '已出貨',
  delivered: '已送達',
  cancelled: '已取消',
  refunded: '已退款',
}

export default function OrderProcessingCellButton(props: DefaultCellComponentProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Payload passes the row's value for the field as `cellData`; for our UI field
  // it will be undefined. We need the row's `status` + `id` — those are on `rowData`.
  const rowData = props.rowData as Record<string, unknown> | undefined
  const status = (rowData?.status as string | undefined) ?? 'pending'
  const orderId = rowData?.id as string | number | undefined

  if (status !== 'pending') {
    return (
      <span style={{ fontSize: 11, color: '#888' }}>
        {STATUS_LABELS[status] ?? status}
      </span>
    )
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!orderId || busy) return

    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'processing' }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { errors?: { message: string }[]; message?: string }
          | null
        const msg = body?.errors?.[0]?.message || body?.message || `HTTP ${res.status}`
        alert(`更新失敗：${msg}`)
        setBusy(false)
        return
      }

      // 開新分頁列印檢貨單。瀏覽器若擋 popup 就讓使用者自己按允許；URL 複製到剪貼簿 fallback。
      const printUrl = `/api/order-print?id=${orderId}`
      const win = window.open(printUrl, '_blank', 'noopener,noreferrer')
      if (!win) {
        alert('瀏覽器擋下新分頁。狀態已改為「處理中」，請手動開啟檢貨單：\n' + printUrl)
      }

      router.refresh()
    } catch (err) {
      console.error('[OrderProcessingCell] error:', err)
      alert('更新失敗，請檢查網路後重試')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        background: busy ? '#B8A889' : '#C19A5B',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        cursor: busy ? 'wait' : 'pointer',
        whiteSpace: 'nowrap',
      }}
      title="將訂單狀態改為『處理中』並在新分頁開啟檢貨單"
    >
      {busy ? '處理中…' : '處理中 + 列印'}
    </button>
  )
}
