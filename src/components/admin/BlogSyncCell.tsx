'use client'

import type { DefaultCellComponentProps } from 'payload'

export default function BlogSyncCell(props: DefaultCellComponentProps) {
  const rowData = props.rowData as Record<string, unknown> | undefined
  const syndicated = rowData?.publishToKimLafayette === true

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 24,
        color: syndicated ? '#a25e5e' : '#1d4ed8',
        fontSize: 12,
        fontWeight: syndicated ? 700 : 500,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: syndicated ? '#a25e5e' : '#3b82f6',
        }}
      />
      {syndicated ? '金老佛爺' : '購物網站'}
    </span>
  )
}
