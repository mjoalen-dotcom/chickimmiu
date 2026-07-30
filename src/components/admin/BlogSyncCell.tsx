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
        color: syndicated ? '#a25e5e' : 'var(--theme-elevation-500, #777)',
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
          background: syndicated ? '#a25e5e' : '#b8b8b8',
        }}
      />
      {syndicated ? '已同步' : '未同步'}
    </span>
  )
}
