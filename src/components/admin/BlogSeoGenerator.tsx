'use client'

import { useField, useForm } from '@payloadcms/ui'
import { CheckCircle2, ImagePlus, Sparkles, TriangleAlert } from 'lucide-react'
import React, { useState } from 'react'

type RelationValue = number | string | { id?: number | string } | null | undefined

interface SeoResult {
  focusKeyword: string
  metaDescription: string
  metaTitle: string
  source: 'ai' | 'fallback'
  supportingKeywords: string[]
  warning?: string
}

interface ApiResponse {
  error?: string
  seo?: SeoResult
  success?: boolean
}

function characterCount(value: unknown): number {
  return Array.from(String(value || '')).length
}

function relationId(value: RelationValue): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const id = value.id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

function articleText(value: unknown, output: string[] = []): string {
  if (!value || output.join(' ').length >= 12_000) return output.join(' ')
  if (Array.isArray(value)) {
    value.forEach((item) => articleText(item, output))
    return output.join(' ')
  }
  if (typeof value !== 'object') return output.join(' ')

  const node = value as Record<string, unknown>
  if (typeof node.text === 'string' && node.text.trim()) output.push(node.text.trim())
  if (node.root) articleText(node.root, output)
  if (Array.isArray(node.children)) articleText(node.children, output)
  return output.join(' ').replace(/\s+/g, ' ').trim().slice(0, 12_000)
}

function tagValues(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        return String((item as { tag?: unknown }).tag || '').trim()
      }
      return ''
    })
    .filter(Boolean)
    .slice(0, 8)
}

export default function BlogSeoGenerator() {
  const titleField = useField<string>({ path: 'seo.metaTitle' })
  const descriptionField = useField<string>({ path: 'seo.metaDescription' })
  const imageField = useField<RelationValue>({ path: 'seo.metaImage' })
  const { getData } = useForm()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SeoResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'error' | 'success' | 'warning'>(
    'success',
  )

  const hasExisting = Boolean(
    String(titleField.value || '').trim() ||
      String(descriptionField.value || '').trim(),
  )

  async function generate() {
    if (
      hasExisting &&
      !window.confirm('目前已有 SEO 標題或描述。要以新生成內容覆蓋嗎？')
    ) {
      return
    }

    const data = getData() as Record<string, unknown>
    const title = String(data.title || '').trim()
    if (!title) {
      setMessageKind('error')
      setMessage('請先填寫文章標題。')
      return
    }

    setBusy(true)
    setMessage(null)
    setResult(null)
    try {
      const response = await fetch('/api/admin/blog/seo-generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          excerpt: String(data.excerpt || ''),
          contentText: articleText(data.content),
          category: String(data.category || ''),
          tags: tagValues(data.tags),
        }),
      })
      const payload = (await response.json()) as ApiResponse
      if (!response.ok || !payload.success || !payload.seo) {
        throw new Error(payload.error || `SEO 生成失敗（HTTP ${response.status}）`)
      }

      titleField.setValue(payload.seo.metaTitle)
      descriptionField.setValue(payload.seo.metaDescription)

      const featuredImageId = relationId(data.featuredImage as RelationValue)
      const usedFeaturedImage = !relationId(imageField.value) && featuredImageId != null
      if (usedFeaturedImage) imageField.setValue(featuredImageId)

      setResult(payload.seo)
      setMessageKind(payload.seo.warning ? 'warning' : 'success')
      setMessage(
        payload.seo.warning ||
          `AI SEO 已填入表單${usedFeaturedImage ? '，OG 圖片已沿用封面' : ''}。`,
      )
    } catch (error) {
      setMessageKind('error')
      setMessage(error instanceof Error ? error.message : 'SEO 生成失敗')
    } finally {
      setBusy(false)
    }
  }

  const messageIcon =
    messageKind === 'success' ? (
      <CheckCircle2 aria-hidden size={16} />
    ) : (
      <TriangleAlert aria-hidden size={16} />
    )

  return (
    <section className="kim-blog-seo-generator">
      <div className="kim-blog-seo-generator__heading">
        <div>
          <p>SEO 自動生成</p>
          <span>
            標題 {characterCount(titleField.value)}/60 · 描述{' '}
            {characterCount(descriptionField.value)}/160
          </span>
        </div>
        <button type="button" disabled={busy} onClick={generate}>
          <Sparkles aria-hidden size={17} strokeWidth={1.8} />
          {busy ? '生成中…' : hasExisting ? '重新生成 SEO' : '一鍵生成 SEO'}
        </button>
      </div>

      {result ? (
        <div className="kim-blog-seo-generator__result">
          <strong>{result.focusKeyword}</strong>
          {result.supportingKeywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
          {!relationId(imageField.value) ? (
            <span className="kim-blog-seo-generator__image-note">
              <ImagePlus aria-hidden size={14} />
              尚未設定 OG 圖片
            </span>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p
          className="kim-blog-seo-generator__message"
          data-kind={messageKind}
          role={messageKind === 'error' ? 'alert' : 'status'}
        >
          {messageIcon}
          {message}
        </p>
      ) : null}
    </section>
  )
}
