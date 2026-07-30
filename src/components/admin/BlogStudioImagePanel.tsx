'use client'

import React, { useRef, useState } from 'react'

import {
  articleImageWidth,
  evaluateImageRights,
  type ArticleImageRole,
  type ArticleStudioTemplateKey,
  type ImageLicenseKind,
  type ImageRightsMetadata,
} from '@/lib/blog/articleStudio'

export interface BlogStudioImageValue extends ImageRightsMetadata {
  alt: string
  mediaId: number | string
  personName?: string
  previewUrl?: string
  role: ArticleImageRole
}

export interface BlogStudioResearchSource {
  extract?: string
  label: string
  provider: 'official' | 'wikipedia' | 'wikidata' | 'manual'
  url: string
}

interface CommonsCandidate {
  alt: string
  creator: string
  downloadUrl: string
  height: number | null
  licenseKind: ImageLicenseKind
  licenseLabel: string
  licenseUrl: string
  pageTitle: string
  sourceLabel: string
  sourceUrl: string
  width: number | null
}

interface ResearchResult {
  checkedAt: string
  images: CommonsCandidate[]
  sources: Array<{
    extract: string
    label: string
    provider: 'Wikipedia'
    url: string
  }>
}

interface Props {
  disabled?: boolean
  images: BlogStudioImageValue[]
  onImagesChange: (images: BlogStudioImageValue[]) => void
  onResearchReady: (value: {
    checkedAt: string
    context: string
    sources: BlogStudioResearchSource[]
  }) => void
  templateKey: ArticleStudioTemplateKey
  topic: string
}

const ROLE_OPTIONS: Array<{ label: string; value: ArticleImageRole }> = [
  { value: 'hero', label: '團體封面／橫式大圖（1000px）' },
  { value: 'member', label: '成員照片（800px）' },
  { value: 'story', label: '成長歷程大圖（1000px）' },
  { value: 'inline', label: '一般內文照片（800px）' },
]

const LICENSE_OPTIONS: Array<{ label: string; value: ImageLicenseKind }> = [
  { value: 'owned', label: '自有圖片' },
  { value: 'explicit-permission', label: '權利人明確授權' },
  { value: 'official-promo', label: '官方宣傳素材' },
  { value: 'public-domain', label: '公有領域' },
  { value: 'cc0', label: 'CC0' },
  { value: 'cc-by', label: 'CC BY' },
  { value: 'cc-by-sa', label: 'CC BY-SA' },
  { value: 'cc-by-nc', label: 'CC BY-NC（須人工確認）' },
  { value: 'unknown', label: '授權待確認' },
]

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 10,
  padding: 16,
  background: 'var(--theme-elevation-50, #fafafa)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--theme-elevation-200, #ccc)',
  borderRadius: 6,
  background: 'var(--theme-elevation-0, #fff)',
  color: 'var(--theme-elevation-1000, #111)',
  fontSize: 13,
}

function absoluteMediaUrl(value: unknown) {
  const source = String(value || '').trim()
  if (!source) return ''
  if (/^https?:\/\//i.test(source)) return source
  return source.startsWith('/') ? source : `/${source}`
}

function filenameAlt(file: File) {
  return file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

const BlogStudioImagePanel: React.FC<Props> = ({
  disabled,
  images,
  onImagesChange,
  onResearchReady,
  templateKey,
  topic,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [researching, setResearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importingPage, setImportingPage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [research, setResearch] = useState<ResearchResult | null>(null)

  const isKpop =
    templateKey === 'kpop-boy-group' || templateKey === 'kpop-girl-group'

  const updateImage = (
    index: number,
    patch: Partial<BlogStudioImageValue>,
  ) => {
    let next = images.map((image, imageIndex) =>
      imageIndex === index ? { ...image, ...patch } : image,
    )
    if (patch.role === 'hero') {
      next = next.map((image, imageIndex) =>
        imageIndex !== index && image.role === 'hero'
          ? { ...image, role: 'inline' }
          : image,
      )
    }
    onImagesChange(next)
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    try {
      const next = [...images]
      for (const file of Array.from(files).slice(0, 30 - images.length)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error(`${file.name} 不是支援的 JPG、PNG 或 WebP`)
        }
        if (file.size > 8 * 1024 * 1024) {
          throw new Error(`${file.name} 超過 8MB`)
        }
        const form = new FormData()
        form.append('file', file)
        form.append(
          '_payload',
          JSON.stringify({
            alt: filenameAlt(file),
            folderName: 'Kim Blog 已授權圖片',
          }),
        )
        const response = await fetch('/api/media', {
          method: 'POST',
          body: form,
          credentials: 'include',
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(json?.errors?.[0]?.message || `${file.name} 上傳失敗`)
        }
        const media = json?.doc || json
        const mediaId = media?.id
        if (mediaId == null) throw new Error(`${file.name} 上傳後沒有媒體 ID`)
        const firstImage = next.length === 0
        next.push({
          alt: filenameAlt(file),
          licenseKind: 'unknown',
          mediaId,
          previewUrl: absoluteMediaUrl(
            media?.sizes?.blog800?.url ||
              media?.sizes?.thumbnail?.url ||
              media?.url,
          ),
          role: firstImage ? 'hero' : 'member',
          sourceLabel: '自行上傳',
          verifiedAt: new Date().toISOString(),
        })
      }
      onImagesChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleResearch = async () => {
    setError(null)
    if (topic.trim().length < 2) {
      setError('請先輸入 KPOP 團體名稱')
      return
    }
    setResearching(true)
    try {
      const response = await fetch('/api/admin/blog/ai-draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'research', query: topic.trim() }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${response.status}`)
      }
      const value = json.research as ResearchResult
      setResearch(value)
      const sources: BlogStudioResearchSource[] = value.sources.map((source) => ({
        extract: source.extract,
        label: source.label,
        provider: 'wikipedia',
        url: source.url,
      }))
      onResearchReady({
        checkedAt: value.checkedAt,
        context: value.sources
          .map(
            (source) =>
              `來源：${source.label}\n網址：${source.url}\n${source.extract}`,
          )
          .join('\n\n'),
        sources,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setResearching(false)
    }
  }

  const importCandidate = async (
    candidate: CommonsCandidate,
    role: ArticleImageRole,
  ) => {
    setError(null)
    setImportingPage(candidate.pageTitle)
    try {
      const response = await fetch('/api/admin/blog/ai-draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'import-commons-image',
          alt: candidate.alt,
          pageTitle: candidate.pageTitle,
          role,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${response.status}`)
      }
      const imported = json.image as BlogStudioImageValue
      const next = [
        ...images.map((image) =>
          role === 'hero' && image.role === 'hero'
            ? { ...image, role: 'inline' as const }
            : image,
        ),
        {
          ...imported,
          previewUrl: candidate.downloadUrl,
        },
      ]
      onImagesChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportingPage(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ display: 'block', fontSize: 14 }}>
              文章照片（公開文章只使用 800px／1000px）
            </strong>
            <span
              style={{
                display: 'block',
                marginTop: 3,
                color: 'var(--theme-elevation-600, #666)',
                fontSize: 12,
              }}
            >
              原圖保留於媒體庫；角色會自動決定輸出寬度與插入位置。
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(event) => handleFiles(event.target.files)}
            />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? '上傳中…' : '上傳自己的授權照片'}
            </button>
            {isKpop ? (
              <button
                type="button"
                disabled={disabled || researching}
                onClick={handleResearch}
              >
                {researching ? '研究中…' : '搜尋可署名的 KPOP 素材'}
              </button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p style={{ color: 'var(--theme-error-700, #b91c1c)', fontSize: 12 }}>
            {error}
          </p>
        ) : null}
      </div>

      {research ? (
        <div style={panelStyle}>
          <strong style={{ fontSize: 14 }}>本次事實資料來源</strong>
          {research.sources.length === 0 ? (
            <p style={{ color: '#92400e', fontSize: 12 }}>
              沒有找到可用的 Wikipedia 條目；產生文章後請將未核實內容保留為「待人工核實」。
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8, margin: '8px 0 16px' }}>
              {research.sources.map((source) => (
                <details
                  key={source.url}
                  style={{
                    border: '1px solid var(--theme-elevation-200, #ddd)',
                    borderRadius: 7,
                    padding: '8px 10px',
                    background: 'var(--theme-elevation-0, #fff)',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                    Wikipedia：
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {source.label}
                    </a>
                    （請確認是正確團體）
                  </summary>
                  <p
                    style={{
                      maxHeight: 220,
                      margin: '9px 0 0',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      color: 'var(--theme-elevation-700, #444)',
                      fontSize: 11,
                      lineHeight: 1.65,
                    }}
                  >
                    {source.extract}
                  </p>
                </details>
              ))}
            </div>
          )}

          <strong style={{ fontSize: 14 }}>授權白名單候選圖</strong>
          <p
            style={{
              margin: '5px 0 12px',
              color: 'var(--theme-elevation-600, #666)',
              fontSize: 12,
            }}
          >
            僅顯示公有領域、CC0、CC BY、CC BY-SA；匯入前伺服器會再次查核。
          </p>
          {research.images.length === 0 ? (
            <p style={{ fontSize: 13 }}>目前沒有找到可自動使用的圖片，請上傳已授權照片。</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 12,
              }}
            >
              {research.images.slice(0, 12).map((candidate) => (
                <article
                  key={candidate.pageTitle}
                  style={{
                    border: '1px solid var(--theme-elevation-200, #ddd)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'var(--theme-elevation-0, #fff)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={candidate.downloadUrl}
                    alt={candidate.alt}
                    style={{
                      width: '100%',
                      aspectRatio: '4 / 3',
                      objectFit: 'cover',
                      background: '#eee',
                    }}
                  />
                  <div style={{ padding: 10 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 650 }}>
                      {candidate.creator}
                    </p>
                    <p
                      style={{
                        margin: '4px 0 8px',
                        color: 'var(--theme-elevation-600, #666)',
                        fontSize: 11,
                      }}
                    >
                      {candidate.licenseLabel} · {candidate.width || '?'}px
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button
                        type="button"
                        disabled={importingPage === candidate.pageTitle}
                        onClick={() => importCandidate(candidate, 'hero')}
                      >
                        封面 1000
                      </button>
                      <button
                        type="button"
                        disabled={importingPage === candidate.pageTitle}
                        onClick={() => importCandidate(candidate, 'member')}
                      >
                        成員 800
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {images.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {images.map((image, index) => {
            const rights = evaluateImageRights(image)
            return (
              <article
                key={`${String(image.mediaId)}-${index}`}
                style={{
                  ...panelStyle,
                  display: 'grid',
                  gridTemplateColumns: '140px minmax(0, 1fr)',
                  gap: 14,
                }}
              >
                <div>
                  {image.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.previewUrl}
                      alt={image.alt}
                      style={{
                        width: 140,
                        height: 140,
                        objectFit: 'cover',
                        borderRadius: 7,
                        background: '#eee',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 140,
                        height: 140,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 7,
                        background: '#eee',
                        fontSize: 12,
                      }}
                    >
                      媒體 #{String(image.mediaId)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onImagesChange(images.filter((_, itemIndex) => itemIndex !== index))
                    }
                    style={{ width: '100%', marginTop: 7 }}
                  >
                    從草稿移除
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 9 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>
                      圖片 {index + 1} · 輸出 {articleImageWidth(image.role)}px
                    </strong>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: rights.allowed ? '#dcfce7' : '#fef3c7',
                        color: rights.allowed ? '#166534' : '#92400e',
                        fontSize: 11,
                      }}
                    >
                      {rights.allowed ? '授權資料可用' : '只可保留草稿'}
                    </span>
                  </div>
                  <select
                    value={image.role}
                    onChange={(event) =>
                      updateImage(index, {
                        role: event.target.value as ArticleImageRole,
                      })
                    }
                    style={inputStyle}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {image.role === 'member' ? (
                    <input
                      value={image.personName || ''}
                      onChange={(event) =>
                        updateImage(index, { personName: event.target.value })
                      }
                      placeholder="對應成員姓名（須與文章小標一致）"
                      style={inputStyle}
                    />
                  ) : null}
                  <input
                    value={image.alt}
                    onChange={(event) => updateImage(index, { alt: event.target.value })}
                    placeholder="圖片替代文字"
                    style={inputStyle}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <input
                      value={image.creator || ''}
                      onChange={(event) =>
                        updateImage(index, { creator: event.target.value })
                      }
                      placeholder="攝影／權利人"
                      style={inputStyle}
                    />
                    <select
                      value={image.licenseKind}
                      onChange={(event) =>
                        updateImage(index, {
                          licenseKind: event.target.value as ImageLicenseKind,
                        })
                      }
                      style={inputStyle}
                    >
                      {LICENSE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={image.sourceLabel || ''}
                    onChange={(event) =>
                      updateImage(index, { sourceLabel: event.target.value })
                    }
                    placeholder="來源名稱"
                    style={inputStyle}
                  />
                  <input
                    type="url"
                    value={image.sourceUrl || ''}
                    onChange={(event) =>
                      updateImage(index, { sourceUrl: event.target.value })
                    }
                    placeholder="原始圖片頁網址"
                    style={inputStyle}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    <input
                      type="url"
                      value={image.licenseUrl || ''}
                      onChange={(event) =>
                        updateImage(index, { licenseUrl: event.target.value })
                      }
                      placeholder="授權條款網址"
                      style={inputStyle}
                    />
                    <input
                      type="url"
                      value={image.evidenceUrl || ''}
                      onChange={(event) =>
                        updateImage(index, { evidenceUrl: event.target.value })
                      }
                      placeholder="書面授權／Press Kit 證明頁"
                      style={inputStyle}
                    />
                  </div>
                  {image.licenseKind === 'official-promo' ? (
                    <label style={{ fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={image.promotionalUseAllowed === true}
                        onChange={(event) =>
                          updateImage(index, {
                            promotionalUseAllowed: event.target.checked,
                          })
                        }
                      />{' '}
                      條款明確允許在此品牌部落格進行宣傳介紹
                    </label>
                  ) : null}
                  {!rights.allowed ? (
                    <small style={{ color: '#92400e' }}>{rights.reason}</small>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default BlogStudioImagePanel
