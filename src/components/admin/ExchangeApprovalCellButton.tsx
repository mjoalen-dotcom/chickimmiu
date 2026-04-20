'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Admin list-view cell for Exchanges — mirror of ReturnApprovalCellButton.
 * 只是 PATCH 打到 /api/exchanges/<id>，status 語意相同（approved/rejected）。
 */

const STATUS_LABELS: Record<string, string> = {
  pending: '待審核',
  approved: '已核准',
  returning: '退回中',
  received: '已收到',
  shipped: '新品已寄出',
  completed: '已完成',
  rejected: '已拒絕',
}

export default function ExchangeApprovalCellButton(
  props: DefaultCellComponentProps,
) {
  const router = useRouter()
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null)

  const rowData = props.rowData as Record<string, unknown> | undefined
  const status = (rowData?.status as string | undefined) ?? 'pending'
  const recordId = rowData?.id as string | number | undefined

  if (status !== 'pending') {
    return (
      <span style={{ fontSize: 11, color: '#888' }}>
        {STATUS_LABELS[status] ?? status}
      </span>
    )
  }

  const doUpdate = async (
    e: React.MouseEvent,
    decision: 'approve' | 'reject',
  ): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    if (!recordId || busy) return

    let adminNote: string | undefined
    if (decision === 'reject') {
      const raw = window.prompt('請填寫拒絕原因（會寄信給會員）：', '')
      if (raw === null) return
      adminNote = raw.trim() || undefined
    }

    setBusy(decision)
    try {
      const res = await fetch(`/api/exchanges/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: decision === 'approve' ? 'approved' : 'rejected',
          ...(adminNote ? { adminNote } : {}),
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { errors?: { message: string }[]; message?: string }
          | null
        const msg = body?.errors?.[0]?.message || body?.message || `HTTP ${res.status}`
        alert(`更新失敗：${msg}`)
        setBusy(null)
        return
      }

      router.refresh()
    } catch (err) {
      console.error('[ExchangeApprovalCell] error:', err)
      alert('更新失敗，請檢查網路後重試')
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      <button
        type="button"
        onClick={(e) => doUpdate(e, 'approve')}
        disabled={busy !== null}
        style={{
          padding: '4px 10px',
          background: busy === 'approve' ? '#A8C8A4' : '#6BA368',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
        title="核准此申請並寄通知信給會員"
      >
        {busy === 'approve' ? '核准中…' : '核准'}
      </button>
      <button
        type="button"
        onClick={(e) => doUpdate(e, 'reject')}
        disabled={busy !== null}
        style={{
          padding: '4px 10px',
          background: busy === 'reject' ? '#E0A6A6' : '#C15B5B',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
        title="拒絕此申請並寄通知信給會員"
      >
        {busy === 'reject' ? '拒絕中…' : '拒絕'}
      </button>
    </div>
  )
}
