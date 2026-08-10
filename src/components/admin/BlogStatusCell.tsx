'use client'

import type { DefaultCellComponentProps } from 'payload'

import BlogQuickStatusSelect from './BlogQuickStatusSelect'

export default function BlogStatusCell(props: DefaultCellComponentProps) {
  const rowData = props.rowData as Record<string, unknown> | undefined
  const id = rowData?.id

  if (typeof id !== 'number' && typeof id !== 'string') return null

  return (
    <BlogQuickStatusSelect
      id={id}
      status={typeof rowData?.status === 'string' ? rowData.status : null}
      visibility={typeof rowData?.visibility === 'string' ? rowData.visibility : null}
      hasPassword={
        rowData?.visibility === 'password' ||
        (typeof rowData?.accessPasswordHash === 'string' && rowData.accessPasswordHash.length > 0)
      }
    />
  )
}
