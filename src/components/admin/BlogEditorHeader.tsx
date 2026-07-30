'use client'

import {
  useAllFormFields,
  useDocumentInfo,
  useFormBackgroundProcessing,
  useFormModified,
} from '@payloadcms/ui'
import { Eye, Settings2 } from 'lucide-react'
import { reduceFieldsToValues } from 'payload/shared'
import React, { useMemo } from 'react'

import BlogStudioNav from './BlogStudioNav'

type EditorValues = {
  gallery?: unknown[]
  publishToKimLafayette?: boolean
  slug?: string
  status?: string
  title?: string
}

function savedLabel({
  backgroundProcessing,
  lastUpdateTime,
  modified,
}: {
  backgroundProcessing: boolean
  lastUpdateTime: number
  modified: boolean
}) {
  if (backgroundProcessing) return '正在儲存'
  if (modified) return '尚未儲存'
  if (!lastUpdateTime) return '新文章'

  return `已儲存 ${new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(lastUpdateTime))}`
}

export default function BlogEditorHeader() {
  const [fields] = useAllFormFields()
  const values = useMemo(
    () => reduceFieldsToValues(fields, true) as EditorValues,
    [fields],
  )
  const modified = useFormModified()
  const backgroundProcessing = useFormBackgroundProcessing()
  const { lastUpdateTime } = useDocumentInfo()
  const published = values.status === 'published'
  const galleryCount = Array.isArray(values.gallery) ? values.gallery.length : 0
  const publicURL =
    published && values.publishToKimLafayette && values.slug
      ? `https://blog.kimlafayette.com/blog/${encodeURIComponent(values.slug)}/`
      : null

  function focusArticleSettings() {
    const settings = document.querySelector<HTMLElement>(
      '.kim-blog-editor-settings',
    )
    settings?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    settings?.querySelector<HTMLButtonElement>('button')?.focus()
  }

  return (
    <section className="kim-blog-editor-header">
      <BlogStudioNav />
      <div className="kim-blog-editor-header__bar">
        <div className="kim-blog-editor-header__identity">
          <p>寫文章</p>
          <h2>{values.title || '新增文章'}</h2>
          <span
            data-state={
              backgroundProcessing ? 'saving' : modified ? 'modified' : 'saved'
            }
          >
            {savedLabel({
              backgroundProcessing,
              lastUpdateTime,
              modified,
            })}
          </span>
        </div>

        <div className="kim-blog-editor-header__actions">
          <span className="kim-blog-editor-header__site">
            {values.publishToKimLafayette
              ? '金老佛爺部落格'
              : '購物網站部落格'}
          </span>
          <span className="kim-blog-editor-header__status">
            {published ? '已發佈' : '草稿'}
          </span>
          <span className="kim-blog-editor-header__gallery">
            相簿 {galleryCount} 張
          </span>
          <button type="button" onClick={focusArticleSettings}>
            <Settings2 aria-hidden size={16} strokeWidth={1.8} />
            文章設定
          </button>
          {publicURL ? (
            <a href={publicURL} target="_blank" rel="noopener noreferrer">
              <Eye aria-hidden size={16} strokeWidth={1.8} />
              預覽
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}
