'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import React, { useMemo } from 'react'

import {
  blogCategoryLabel,
  blogCategoryOptionsForSite,
  isBlogSite,
} from '@/lib/blog/categoryTaxonomy'

interface Props {
  path: string
}

export default function BlogCategoryValueField({ path }: Props) {
  const { setValue, value } = useField<string | null>({ path })
  const rawSite = useFormFields(([fields]) => fields.site?.value)
  const site = isBlogSite(rawSite) ? rawSite : 'store'
  const options = useMemo(() => blogCategoryOptionsForSite(site), [site])
  const normalizedValue = typeof value === 'string' ? value : ''
  const hasCurrent = options.some((option) => option.value === normalizedValue)
  const siteLabel = site === 'kim' ? '金老佛爺部落格' : '購物網站部落格'

  return (
    <div className="field-type" style={{ marginBottom: 18 }}>
      <label
        htmlFor={`${path}-input`}
        style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 600 }}
      >
        對應文章分類值 <span aria-hidden>*</span>
      </label>
      <select
        id={`${path}-input`}
        value={normalizedValue}
        onChange={(event) => setValue(event.currentTarget.value || null)}
        style={{
          width: '100%',
          minHeight: 40,
          padding: '8px 11px',
          border: '1px solid var(--theme-elevation-250)',
          borderRadius: 6,
          background: 'var(--theme-input-bg)',
          color: 'var(--theme-text)',
        }}
      >
        <option value="">選擇{siteLabel}的分類值</option>
        {!hasCurrent && normalizedValue ? (
          <option value={normalizedValue}>目前值：{blogCategoryLabel(normalizedValue)}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p style={{ margin: '7px 0 0', color: 'var(--theme-elevation-550)', fontSize: 11 }}>
        只列出{siteLabel}可用的值；文章會以「所屬網站＋此分類值」對應。
      </p>
    </div>
  )
}
