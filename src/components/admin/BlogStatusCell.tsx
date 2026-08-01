'use client'

import type { DefaultCellComponentProps } from 'payload'

const statusStyles = {
  draft: {
    label: '草稿',
    background: '#fff1e6',
    color: '#9a3412',
    border: '#fed7aa',
  },
  published: {
    label: '公開',
    background: '#ecfdf5',
    color: '#087f5b',
    border: '#a7f3d0',
  },
  unlisted: {
    label: '隱密連結',
    background: '#f5f3ff',
    color: '#6d28d9',
    border: '#ddd6fe',
  },
  password: {
    label: '密碼保護',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
  },
} as const

export default function BlogStatusCell(props: DefaultCellComponentProps) {
  const rowData = props.rowData as Record<string, unknown> | undefined
  const status =
    rowData?.status !== 'published'
      ? 'draft'
      : rowData?.visibility === 'unlisted' || rowData?.visibility === 'password'
        ? rowData.visibility
        : 'published'
  const style = statusStyles[status]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 24,
        padding: '3px 9px',
        border: `1px solid ${style.border}`,
        borderRadius: 999,
        background: style.background,
        color: style.color,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  )
}
