'use client'

import React, { useState, useRef } from 'react'

type Props = {
  collectionSlug: string
}

const ImportExportButtons: React.FC<Props> = ({ collectionSlug }) => {
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setMessage('')
    try {
      const res = await fetch(`/api/${collectionSlug}/export?format=${format}`)
      if (!res.ok) {
        const err = await res.json()
        setMessage(`匯出失敗：${err.error || '未知錯誤'}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collectionSlug}-export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMessage(`${format.toUpperCase()} 匯出成功`)
    } catch {
      setMessage('匯出時發生錯誤')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/${collectionSlug}/import`, {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()

      if (res.ok) {
        setMessage(result.message || '匯入完成')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMessage(`匯入失敗：${result.error || '未知錯誤'}`)
      }
    } catch {
      setMessage('匯入時發生錯誤')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={containerStyle}>
      <button type="button" onClick={() => handleExport('csv')} style={btnStyle}>
        匯出 CSV
      </button>
      <button type="button" onClick={() => handleExport('xlsx')} style={btnStyle}>
        匯出 Excel
      </button>
      <label style={{ ...btnStyle, cursor: importing ? 'wait' : 'pointer' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleImport}
          style={{ display: 'none' }}
          disabled={importing}
        />
        {importing ? '匯入中…' : '匯入 CSV / Excel'}
      </label>
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

export default ImportExportButtons
