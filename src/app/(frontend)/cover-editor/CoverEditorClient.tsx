'use client'

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Columns2, ImagePlus, Loader2, Plus, RectangleHorizontal,
  RefreshCw, Save, Search, Trash2, Upload, X, ExternalLink, Film,
} from 'lucide-react'
import { normalizeMediaUrl } from '@/lib/media-url'

/**
 * CoverEditorClient — 歡迎頁畫布編輯器本體
 * ────────────────────────────────────────
 * 所見版面 = 正式封面同一套版型（hero → 媒體牆列 → end card），直接在
 * 每個區塊上操作：換素材（媒體庫挑選或現場上傳）、整幅/雙欄切換、
 * ↑↓ 排序、刪列、疊字。儲存 = POST /api/globals/homepage-settings
 * （admin cookie 認證；afterChange hook 會自動 revalidate / 與 /home）。
 */

type MediaDoc = {
  id: number | string
  url?: string
  mimeType?: string
  filename?: string
  sizes?: { thumbnail?: { url?: string | null } | null } | null
}

type Row = {
  layout: 'full' | 'split' | 'grid3'
  media: MediaDoc | null
  mediaRight: MediaDoc | null
  mediaThird: MediaDoc | null
  heading: string
  caption: string
  link: string
}

const LAYOUT_CYCLE: Row['layout'][] = ['full', 'split', 'grid3']
const LAYOUT_LABEL: Record<Row['layout'], string> = {
  full: '整幅',
  split: '雙欄（貼合）',
  grid3: '三欄（微間距）',
}

type CoverState = {
  heroMode: 'video' | 'image'
  heroVideo: MediaDoc | null
  heroVideoMobile: MediaDoc | null
  heroImage: MediaDoc | null
  heroLink: string
  sideImage: MediaDoc | null
  sideVideo: MediaDoc | null
  rows: Row[]
}

const mediaUrl = (doc: MediaDoc | null): string | null =>
  doc ? normalizeMediaUrl(doc.url) ?? null : null
const thumbUrl = (doc: MediaDoc): string | null =>
  normalizeMediaUrl(doc.sizes?.thumbnail?.url ?? undefined) ?? mediaUrl(doc)
const isVideo = (doc: MediaDoc | null): boolean =>
  Boolean(doc?.mimeType?.startsWith('video/'))

function asMediaDoc(val: unknown): MediaDoc | null {
  if (!val || typeof val !== 'object') return null
  const v = val as Record<string, unknown>
  if (v.id == null) return null
  return v as unknown as MediaDoc
}

/* ── 媒體庫挑選 / 上傳 modal ── */
function MediaPicker({
  accept,
  onPick,
  onClose,
}: {
  accept: 'image' | 'video' | 'any'
  onPick: (doc: MediaDoc) => void
  onClose: () => void
}) {
  const [docs, setDocs] = useState<MediaDoc[]>([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(
    async (p: number, keyword: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('limit', '24')
        params.set('page', String(p))
        params.set('sort', '-createdAt')
        params.set('depth', '0')
        let i = 0
        if (accept !== 'any') {
          params.set(`where[and][${i}][mimeType][contains]`, accept)
          i += 1
        }
        if (keyword.trim()) {
          params.set(`where[and][${i}][filename][contains]`, keyword.trim())
        }
        const res = await fetch(`/api/media?${params.toString()}`, { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as { docs: MediaDoc[]; hasNextPage?: boolean }
        // load 只服務第 1 頁（搜尋/初載）；翻頁走 loadMore 自己 append
        setDocs(json.docs)
        setHasNext(Boolean(json.hasNextPage))
      } catch {
        setError('媒體庫載入失敗，請重試')
      } finally {
        setLoading(false)
      }
    },
    [accept],
  )

  // 首載 + 搜尋 debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      void load(1, q)
    }, 300)
    return () => clearTimeout(t)
  }, [q, load])

  const loadMore = async () => {
    const next = page + 1
    setPage(next)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '24')
      params.set('page', String(next))
      params.set('sort', '-createdAt')
      params.set('depth', '0')
      let i = 0
      if (accept !== 'any') {
        params.set(`where[and][${i}][mimeType][contains]`, accept)
        i += 1
      }
      if (q.trim()) params.set(`where[and][${i}][filename][contains]`, q.trim())
      const res = await fetch(`/api/media?${params.toString()}`, { credentials: 'include' })
      const json = (await res.json()) as { docs: MediaDoc[]; hasNextPage?: boolean }
      setDocs((prev) => [...prev, ...json.docs])
      setHasNext(Boolean(json.hasNextPage))
    } catch {
      setError('載入更多失敗')
    } finally {
      setLoading(false)
    }
  }

  const onUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('_payload', JSON.stringify({ alt: file.name.replace(/\.[a-z0-9]+$/i, '') }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: form })
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(detail?.errors?.[0]?.message || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as { doc: MediaDoc }
      onPick(json.doc)
    } catch (err) {
      setError(`上傳失敗：${err instanceof Error ? err.message : '未知錯誤'}`)
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-white flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-3.5">
          <p className="text-sm font-medium">
            選擇素材{accept === 'image' ? '（圖片）' : accept === 'video' ? '（影片）' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 bg-neutral-900 text-white px-3.5 py-2 text-xs hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              上傳新檔
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept === 'image' ? 'image/*' : accept === 'video' ? 'video/mp4' : 'image/*,video/mp4'}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onUpload(f)
              }}
            />
            <button onClick={onClose} aria-label="關閉" className="p-2 text-neutral-400 hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-cream-200">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋檔名…"
              className="w-full border border-cream-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {docs.map((d) => {
              const t = thumbUrl(d)
              return (
                <button
                  key={String(d.id)}
                  onClick={() => onPick(d)}
                  className="group relative aspect-square overflow-hidden bg-cream-100 border border-cream-200 hover:border-neutral-800 transition-colors"
                  title={d.filename}
                >
                  {isVideo(d) ? (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-neutral-500">
                      <Film size={20} />
                      <span className="text-[9px] px-1 truncate max-w-full">{d.filename}</span>
                    </span>
                  ) : t ? (
                    <img src={t} alt={d.filename || ''} className="absolute inset-0 w-full h-full object-cover" />
                  ) : null}
                </button>
              )
            })}
          </div>
          {loading && <p className="text-center text-xs text-neutral-400 py-4">載入中…</p>}
          {!loading && docs.length === 0 && (
            <p className="text-center text-sm text-neutral-400 py-8">沒有符合的素材，可直接「上傳新檔」</p>
          )}
          {hasNext && !loading && (
            <button onClick={() => void loadMore()} className="mt-4 w-full border border-cream-200 py-2 text-xs text-neutral-500 hover:border-neutral-500 transition-colors">
              載入更多
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 單格素材（編輯器內預覽） ── */
function CellPreview({ doc, emptyHint }: { doc: MediaDoc | null; emptyHint: string }) {
  const url = mediaUrl(doc)
  if (!doc || !url) {
    return (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
        <ImagePlus size={22} />
        {emptyHint}
      </span>
    )
  }
  if (isVideo(doc)) {
    return <video src={url} muted autoPlay loop playsInline className="absolute inset-0 w-full h-full object-cover" />
  }
  return <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
}

/* ── 主編輯器 ── */
export function CoverEditorClient() {
  const [state, setState] = useState<CoverState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [picker, setPicker] = useState<{
    accept: 'image' | 'video' | 'any'
    assign: (doc: MediaDoc) => void
  } | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/globals/homepage-settings?depth=2', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const g = (await res.json()) as Record<string, unknown>
      const cp = (g.coverPage as Record<string, unknown>) || {}
      const rawSections = (cp.sections as Array<Record<string, unknown>> | undefined) || []
      setState({
        heroMode: cp.heroMode === 'image' ? 'image' : 'video',
        heroVideo: asMediaDoc(cp.heroVideo),
        heroVideoMobile: asMediaDoc(cp.heroVideoMobile),
        heroImage: asMediaDoc(cp.heroImage),
        heroLink: (cp.heroLink as string) || '',
        sideImage: asMediaDoc(cp.sideImage),
        sideVideo: asMediaDoc(cp.sideVideo),
        rows: rawSections.map((s) => ({
          layout: s.layout === 'split' ? 'split' as const : s.layout === 'grid3' ? 'grid3' as const : 'full' as const,
          media: asMediaDoc(s.media),
          mediaRight: asMediaDoc(s.mediaRight),
          mediaThird: asMediaDoc(s.mediaThird),
          heading: (s.heading as string) || '',
          caption: (s.caption as string) || '',
          link: (s.link as string) || '',
        })),
      })
      setDirty(false)
    } catch {
      setLoadError('設定載入失敗 — 請確認已用後台帳號登入 /admin 後重試')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const mutate = (fn: (s: CoverState) => CoverState) => {
    setState((s) => (s ? fn(s) : s))
    setDirty(true)
    setSavedAt(null)
  }

  const moveRow = (i: number, dir: -1 | 1) =>
    mutate((s) => {
      const rows = [...s.rows]
      const j = i + dir
      if (j < 0 || j >= rows.length) return s
      ;[rows[i], rows[j]] = [rows[j], rows[i]]
      return { ...s, rows }
    })

  const save = async () => {
    if (!state) return
    setSaving(true)
    try {
      const body = {
        coverPage: {
          heroMode: state.heroMode,
          heroVideo: state.heroVideo?.id ?? null,
          heroVideoMobile: state.heroVideoMobile?.id ?? null,
          heroImage: state.heroImage?.id ?? null,
          heroLink: state.heroLink || null,
          sideImage: state.sideImage?.id ?? null,
          sideVideo: state.sideVideo?.id ?? null,
          sections: state.rows
            .filter((r) => r.media)
            .map((r) => ({
              layout: r.layout,
              media: r.media!.id,
              mediaRight: r.layout !== 'full' ? (r.mediaRight?.id ?? null) : null,
              mediaThird: r.layout === 'grid3' ? (r.mediaThird?.id ?? null) : null,
              heading: r.heading || null,
              caption: r.caption || null,
              link: r.link || null,
            })),
        },
      }
      const res = await fetch('/api/globals/homepage-settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(detail?.errors?.[0]?.message || `HTTP ${res.status}`)
      }
      setDirty(false)
      setSavedAt(Date.now())
    } catch (err) {
      alert(`儲存失敗：${err instanceof Error ? err.message : '未知錯誤'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-neutral-600 mb-4">{loadError}</p>
          <button onClick={() => void load()} className="border border-neutral-800 px-5 py-2.5 text-xs tracking-[0.2em] hover:bg-neutral-900 hover:text-white transition-colors">
            重試
          </button>
        </div>
      </main>
    )
  }
  if (!state) {
    return (
      <main className="min-h-screen bg-cream-50 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-neutral-400" />
      </main>
    )
  }

  const pick = (accept: 'image' | 'video' | 'any', assign: (doc: MediaDoc) => void) =>
    setPicker({ accept, assign })

  const heroPreview =
    state.heroMode === 'video' ? state.heroVideo : state.heroImage

  return (
    <main className="min-h-screen bg-neutral-100 pb-24">
      {/* ── 頂部工具列 ── */}
      <div className="sticky top-0 z-[60] bg-white border-b border-cream-200 shadow-sm">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium">歡迎頁畫布編輯</p>
            <p className="text-[11px] text-neutral-400">
              {dirty ? '● 有未發布的變更' : savedAt ? '✓ 已發布（正式頁最慢 5 分鐘生效）' : '直接在下方版面上點著改'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-cream-200 px-3.5 py-2 text-xs text-neutral-600 hover:border-neutral-500 transition-colors"
            >
              <ExternalLink size={13} /> 看正式頁
            </a>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 border border-cream-200 px-3.5 py-2 text-xs text-neutral-600 hover:border-neutral-500 transition-colors"
            >
              <RefreshCw size={13} /> 還原
            </button>
            <button
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 bg-neutral-900 text-white px-5 py-2 text-xs tracking-[0.15em] hover:bg-neutral-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              儲存並發布
            </button>
          </div>
        </div>
      </div>

      {/* ── 畫布 ── */}
      <div className="max-w-4xl mx-auto mt-6 px-4 space-y-3">
        {/* HERO */}
        <section className="bg-white border border-cream-200">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-cream-200">
            <span className="text-[10px] tracking-[0.25em] text-neutral-400 uppercase mr-auto">主視覺</span>
            <div className="flex border border-cream-200">
              {(['video', 'image'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => mutate((s) => ({ ...s, heroMode: m }))}
                  className={`px-3 py-1.5 text-[11px] transition-colors ${
                    state.heroMode === m ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-foreground'
                  }`}
                >
                  {m === 'video' ? '大影片' : '大圖'}
                </button>
              ))}
            </div>
            {state.heroMode === 'video' ? (
              <>
                <button
                  onClick={() => pick('video', (d) => mutate((s) => ({ ...s, heroVideo: d })))}
                  className="text-[11px] border border-cream-200 px-3 py-1.5 hover:border-neutral-500 transition-colors"
                >
                  換桌機影片
                </button>
                <button
                  onClick={() => pick('video', (d) => mutate((s) => ({ ...s, heroVideoMobile: d })))}
                  className="text-[11px] border border-cream-200 px-3 py-1.5 hover:border-neutral-500 transition-colors"
                >
                  換手機影片
                </button>
              </>
            ) : (
              <button
                onClick={() => pick('image', (d) => mutate((s) => ({ ...s, heroImage: d })))}
                className="text-[11px] border border-cream-200 px-3 py-1.5 hover:border-neutral-500 transition-colors"
              >
                換大圖
              </button>
            )}
          </div>
          <div className="px-4 py-2 border-b border-cream-200">
            <input
              value={state.heroLink}
              onChange={(e) => mutate((s) => ({ ...s, heroLink: e.target.value }))}
              placeholder="主視覺連結（留空 = 進入賣場 /home）"
              className="w-full text-xs border border-cream-200 px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div className="relative aspect-video bg-neutral-950">
            <CellPreview
              doc={heroPreview}
              emptyHint={state.heroMode === 'video' ? '未設定 — 用內建品牌影片' : '未設定 — 用輪播第一張'}
            />
            <span className="absolute bottom-3 left-4 text-[10px] tracking-[0.3em] text-white/80 uppercase pointer-events-none">
              Chic Kim &amp; Miu · 進入賣場
            </span>
          </div>
        </section>

        {/* 媒體牆列 */}
        {state.rows.map((row, i) => (
          <section key={i} className="bg-white border border-cream-200">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-cream-200">
              <span className="text-[10px] tracking-[0.25em] text-neutral-400 uppercase mr-auto">第 {i + 1} 列</span>
              <button
                onClick={() =>
                  mutate((s) => {
                    const rows = [...s.rows]
                    const next = LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(rows[i].layout) + 1) % LAYOUT_CYCLE.length]
                    rows[i] = { ...rows[i], layout: next }
                    return { ...s, rows }
                  })
                }
                className="inline-flex items-center gap-1.5 text-[11px] border border-cream-200 px-3 py-1.5 hover:border-neutral-500 transition-colors"
                title="點擊循環切換版型"
              >
                {row.layout === 'full' ? <RectangleHorizontal size={12} /> : <Columns2 size={12} />}
                {LAYOUT_LABEL[row.layout]} → {LAYOUT_LABEL[LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(row.layout) + 1) % LAYOUT_CYCLE.length]]}
              </button>
              <button onClick={() => moveRow(i, -1)} disabled={i === 0} aria-label="上移" className="p-1.5 border border-cream-200 disabled:opacity-30 hover:border-neutral-500 transition-colors">
                <ArrowUp size={12} />
              </button>
              <button onClick={() => moveRow(i, 1)} disabled={i === state.rows.length - 1} aria-label="下移" className="p-1.5 border border-cream-200 disabled:opacity-30 hover:border-neutral-500 transition-colors">
                <ArrowDown size={12} />
              </button>
              <button
                onClick={() => mutate((s) => ({ ...s, rows: s.rows.filter((_, j) => j !== i) }))}
                aria-label="刪除此列"
                className="p-1.5 border border-cream-200 text-red-600 hover:border-red-600 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {row.layout === 'full' ? (
              <button
                onClick={() =>
                  pick('any', (d) =>
                    mutate((s) => {
                      const rows = [...s.rows]
                      rows[i] = { ...rows[i], media: d }
                      return { ...s, rows }
                    }),
                  )
                }
                className="relative block w-full aspect-[21/9] bg-cream-100 hover:opacity-90 transition-opacity"
              >
                <CellPreview doc={row.media} emptyHint="點擊選擇素材" />
              </button>
            ) : (
              <div className={row.layout === 'grid3' ? 'grid grid-cols-3 gap-1' : 'grid grid-cols-2 gap-0'}>
                {(row.layout === 'grid3' ? (['media', 'mediaRight', 'mediaThird'] as const) : (['media', 'mediaRight'] as const)).map((k) => (
                  <button
                    key={k}
                    onClick={() =>
                      pick('any', (d) =>
                        mutate((s) => {
                          const rows = [...s.rows]
                          rows[i] = { ...rows[i], [k]: d }
                          return { ...s, rows }
                        }),
                      )
                    }
                    className="relative aspect-[3/4] bg-cream-100 hover:opacity-90 transition-opacity"
                  >
                    <CellPreview doc={row[k]} emptyHint={k === 'media' ? '第 1 格' : k === 'mediaRight' ? '第 2 格' : '第 3 格'} />
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 py-2.5 border-t border-cream-200 grid gap-2 sm:grid-cols-3">
              <input
                value={row.heading}
                onChange={(e) =>
                  mutate((s) => {
                    const rows = [...s.rows]
                    rows[i] = { ...rows[i], heading: e.target.value }
                    return { ...s, rows }
                  })
                }
                placeholder="區塊大標（選填，chuu 式，顯示在列上方）"
                className="w-full text-xs border border-cream-200 px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
              <input
                value={row.caption}
                onChange={(e) =>
                  mutate((s) => {
                    const rows = [...s.rows]
                    rows[i] = { ...rows[i], caption: e.target.value }
                    return { ...s, rows }
                  })
                }
                placeholder="疊字（選填，顯示在該列左下角）"
                className="w-full text-xs border border-cream-200 px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
              <input
                value={row.link}
                onChange={(e) =>
                  mutate((s) => {
                    const rows = [...s.rows]
                    rows[i] = { ...rows[i], link: e.target.value }
                    return { ...s, rows }
                  })
                }
                placeholder="連結（留空 = 進入賣場 /home）"
                className="w-full text-xs border border-cream-200 px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </section>
        ))}

        {/* 新增列 */}
        <button
          onClick={() =>
            mutate((s) => ({
              ...s,
              rows: [...s.rows, { layout: 'full', media: null, mediaRight: null, mediaThird: null, heading: '', caption: '', link: '' }],
            }))
          }
          className="w-full border-2 border-dashed border-neutral-300 py-5 text-xs text-neutral-500 hover:border-neutral-500 hover:text-foreground transition-colors inline-flex items-center justify-center gap-2"
        >
          <Plus size={14} /> 新增一列
        </button>

        {state.rows.length === 0 && (
          <p className="text-[11px] text-neutral-400 text-center">
            目前沒有自訂列 — 正式頁會顯示預設精簡版（一半圖一半影片＋形象大圖）。新增第一列後即以上方內容取代。
          </p>
        )}

        {/* End card（固定） */}
        <section className="bg-neutral-950 text-white text-center py-10">
          <p className="text-[10px] tracking-[0.3em] text-white/50 uppercase mb-2">Chic Kim &amp; Miu</p>
          <p className="font-serif">優雅，是妳本來的樣子。（固定結尾卡）</p>
        </section>
      </div>

      {picker && (
        <MediaPicker
          accept={picker.accept}
          onPick={(doc) => {
            picker.assign(doc)
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </main>
  )
}
