'use client'

import { useState } from 'react'

/**
 * PreviewBanner
 * ─────────────
 * Sticky banner shown at the top of /preview/templates/[id].
 * Displays「樣本預覽」label + the template name + a「建立此樣板」CTA that
 * POSTs to /api/pages/from-template (same flow as PageTemplatePicker) and
 * redirects to the admin edit view on success.
 */

type Props = {
  templateId: string
  templateName: string
  hadPlaceholder: boolean
}

export default function PreviewBanner({ templateId, templateName, hadPlaceholder }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (pending) return
    setError(null)
    setPending(true)
    try {
      const res = await fetch('/api/pages/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      const id = data?.id
      if (id) {
        window.location.href = `/admin/collections/pages/${id}`
      } else {
        window.location.href = '/admin/collections/pages'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗，請重試')
      setPending(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-foreground text-cream-50 border-b border-foreground/30 shadow-md">
      <div className="container py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 bg-gold-500/20 text-gold-100 px-2.5 py-1 rounded-full text-[11px] tracking-wider uppercase font-semibold">
            <span aria-hidden>🔍</span> 樣本預覽
          </span>
          <span className="font-serif text-base">{templateName}</span>
          {!hadPlaceholder && (
            <span className="text-[11px] text-cream-200/70 hidden md:inline">
              · 媒體庫無圖，圖片區塊以底色佔位
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[11px] text-red-200 bg-red-900/50 px-2 py-1 rounded">
              ⚠️ {error}
            </span>
          )}
          <a
            href="/admin/collections/pages"
            className="text-xs px-3 py-2 rounded-full border border-cream-50/30 text-cream-50 hover:bg-cream-50/10 transition-colors"
          >
            ← 返回後台
          </a>
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            className="text-xs px-4 py-2 rounded-full bg-gold-500 text-white font-semibold hover:bg-gold-600 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {pending ? '建立中…' : '🚀 用此樣板建立'}
          </button>
        </div>
      </div>
    </div>
  )
}
