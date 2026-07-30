'use client'

import { useAllFormFields } from '@payloadcms/ui'
import { reduceFieldsToValues } from 'payload/shared'
import React, { useMemo } from 'react'

import BlogStudioNav from './BlogStudioNav'

type EditorValues = {
  title?: string
  status?: string
  publishToKimLafayette?: boolean
  gallery?: unknown[]
}

export default function BlogEditorHeader() {
  const [fields] = useAllFormFields()
  const values = useMemo(() => reduceFieldsToValues(fields, true) as EditorValues, [fields])
  const published = values.status === 'published'
  const galleryCount = Array.isArray(values.gallery) ? values.gallery.length : 0

  return (
    <section style={{ marginBottom: 18 }}>
      <BlogStudioNav />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid var(--theme-elevation-200, #ddd)',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              color: '#a25e5e',
              fontSize: 11,
              fontWeight: 750,
              textTransform: 'uppercase',
            }}
          >
            Article Editor
          </p>
          <h2
            style={{
              maxWidth: 700,
              margin: 0,
              overflow: 'hidden',
              fontSize: 18,
              fontWeight: 700,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {values.title || '新增文章'}
          </h2>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <span
            style={{
              display: 'inline-flex',
              minHeight: 28,
              alignItems: 'center',
              padding: '4px 9px',
              border: `1px solid ${published ? '#a7f3d0' : '#fed7aa'}`,
              borderRadius: 999,
              background: published ? '#ecfdf5' : '#fff1e6',
              color: published ? '#087f5b' : '#9a3412',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {published ? '公開' : '草稿'}
          </span>
          <span
            style={{
              display: 'inline-flex',
              minHeight: 28,
              alignItems: 'center',
              padding: '4px 9px',
              border: '1px solid var(--theme-elevation-200, #ddd)',
              borderRadius: 999,
              color: values.publishToKimLafayette ? '#a25e5e' : 'var(--theme-elevation-550, #666)',
              fontSize: 11,
              fontWeight: 650,
            }}
          >
            {values.publishToKimLafayette ? 'Kim 已同步' : 'Kim 未同步'}
          </span>
          <span
            style={{
              display: 'inline-flex',
              minHeight: 28,
              alignItems: 'center',
              padding: '4px 9px',
              border: '1px solid var(--theme-elevation-200, #ddd)',
              borderRadius: 999,
              color: 'var(--theme-elevation-650, #555)',
              fontSize: 11,
              fontWeight: 650,
            }}
          >
            相簿 {galleryCount} 張
          </span>
        </div>
      </div>
    </section>
  )
}
