'use client'

import type { DefaultCellComponentProps } from 'payload'

const formatter = new Intl.DateTimeFormat('zh-TW', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Taipei',
})

export default function BlogPublishedAtCell(
  props: DefaultCellComponentProps,
) {
  const rowData = props.rowData as Record<string, unknown> | undefined
  const raw = rowData?.publishedAt
  if (typeof raw !== 'string' || !raw) {
    return <span style={{ color: 'var(--theme-elevation-400, #999)' }}>—</span>
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return <span>{raw}</span>

  return (
    <time dateTime={raw} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
      {formatter.format(date)}
    </time>
  )
}
