'use client'

import React, { useState } from 'react'

const OrderExportButton: React.FC = () => {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setMessage('')
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/export?format=${format}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '伺服器錯誤' }))
        setMessage(`匯出失敗：${err.error || '未知錯誤'}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMessage(`${format.toUpperCase()} 匯出成功`)
    } catch {
      setMessage('匯出時發生錯誤')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>訂單匯出：</span>
      <button type="button" onClick={() => handleExport('csv')} style={btnStyle} disabled={busy}>
        下載 CSV
      </button>
      <button type="button" onClick={() => handleExport('xlsx')} style={btnStyle} disabled={busy}>
        下載 Excel
      </button>
      {message && <span style={msgStyle}>{message}</span>}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 0',
  flexWrap: 'wrap',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#555',
  marginRight: '4px',
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: '13px',
  border: '1px solid #d0cec7',
  borderRadius: '4px',
  background: '#faf9f6',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#333',
}

const msgStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#888',
  marginLeft: '8px',
}

export default OrderExportButton
