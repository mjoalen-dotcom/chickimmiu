'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import React, { useEffect, useMemo, useState } from 'react'

import {
  blogCategoryLabel,
  blogCategoryOptionsForSite,
  type BlogSite,
} from '@/lib/blog/categoryTaxonomy'

interface BlogCategorySelectFieldProps {
  field?: {
    admin?: { description?: string }
    label?: string | Record<string, string>
  }
  path: string
}

type CategoryOption = { label: string; value: string }

function fieldLabel(label: string | Record<string, string> | undefined) {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') return label['zh-TW'] || label.en
  return '文章分類（依網站）'
}

export default function BlogCategorySelectField({
  field,
  path,
}: BlogCategorySelectFieldProps) {
  const { errorMessage, setValue, showError, value } = useField<string | null>({ path })
  const publishToKim = useFormFields(
    ([fields]) => fields.publishToKimLafayette?.value === true,
  )
  const site: BlogSite = publishToKim ? 'kim' : 'store'
  const siteLabel = publishToKim ? '金老佛爺部落格' : '購物網站部落格'
  const fallback = useMemo(() => blogCategoryOptionsForSite(site), [site])
  const [options, setOptions] = useState<CategoryOption[]>(fallback)
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setOptions(fallback)
    setLoading(true)
    setLoadFailed(false)

    void fetch(
      `/api/blog-categories?where[site][equals]=${site}&limit=100&depth=0&sort=displayOrder`,
      {
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as {
          docs?: Array<{ name?: unknown; value?: unknown }>
        }
        const managed = (data.docs || [])
          .map((doc) => ({
            label: String(doc.name || ''),
            value: String(doc.value || ''),
          }))
          .filter((option) => option.label && option.value)
        if (managed.length > 0) setOptions(managed)
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== 'AbortError') setLoadFailed(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [fallback, site])

  const normalizedValue = typeof value === 'string' ? value : ''
  const hasCurrent = options.some((option) => option.value === normalizedValue)

  return (
    <div className="field-type" style={{ marginBottom: 18 }}>
      <label
        htmlFor={`${path}-input`}
        style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 600 }}
      >
        {fieldLabel(field?.label)}
      </label>
      <select
        id={`${path}-input`}
        aria-invalid={showError || undefined}
        value={normalizedValue}
        onChange={(event) => setValue(event.currentTarget.value || null)}
        style={{
          width: '100%',
          minHeight: 40,
          padding: '8px 11px',
          border: `1px solid ${showError ? 'var(--theme-error-500)' : 'var(--theme-elevation-250)'}`,
          borderRadius: 6,
          background: 'var(--theme-input-bg)',
          color: 'var(--theme-text)',
        }}
      >
        <option value="">選擇{siteLabel}的分類</option>
        {!hasCurrent && normalizedValue ? (
          <option value={normalizedValue}>
            目前分類：{blogCategoryLabel(normalizedValue)}（請確認網站）
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p
        style={{
          margin: '7px 0 0',
          color: 'var(--theme-elevation-550)',
          fontSize: 11,
          lineHeight: 1.55,
        }}
      >
        目前文章網站：{siteLabel}。這裡只列出該網站的分類；先切換上方文章網站，選項會同步更新。
        {loading ? ' 正在載入後台分類…' : ''}
        {loadFailed ? ' 後台分類暫時無法載入，已顯示安全後備選項。' : ''}
      </p>
      {field?.admin?.description ? (
        <p style={{ margin: '4px 0 0', color: 'var(--theme-elevation-550)', fontSize: 11 }}>
          {field.admin.description}
        </p>
      ) : null}
      {showError && errorMessage ? (
        <p style={{ margin: '6px 0 0', color: 'var(--theme-error-500)', fontSize: 11 }}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
