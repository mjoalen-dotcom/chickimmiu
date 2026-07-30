'use client'

import React, { useState } from 'react'

import {
  validateBlogDraftTopic,
  type BlogAIDraftInput,
  type BlogAIDraftOutput,
} from '@/lib/blog/aiDraft'
import {
  getArticleStudioTemplate,
  type ArticleStudioTemplateKey,
} from '@/lib/blog/articleStudio'

import BlogStudioImagePanel, {
  type BlogStudioImageValue,
  type BlogStudioResearchSource,
} from './BlogStudioImagePanel'

/**
 * BlogAIDraftClient — 客端表單 + 結果預覽 + 落地按鈕
 *
 * 流程：
 *   1. 使用者填表（主題必填，其它可選）
 *   2. 按「產生草稿」→ POST /api/admin/blog/ai-draft action=generate
 *   3. 顯示 LLM 回的 title / excerpt / contentMarkdown / tags / SEO
 *   4. 使用者可：
 *      a. 手動編輯草稿欄位
 *      b. 按「重新生成」回到 step 2 用新 prompt
 *      c. 按「建立部落格草稿」→ POST action=create → server 寫進 BlogPosts → redirect 到編輯頁
 *
 * 沒有 controlled-form lib，純 useState + 原生 input/textarea，避免引入額外 bundle。
 */

const SEASON_OPTIONS: Array<{ value: NonNullable<BlogAIDraftInput['season']>; label: string }> = [
  { value: 'all', label: '不限季節' },
  { value: 'spring', label: '春季 3-5 月' },
  { value: 'summer', label: '夏季 6-8 月' },
  { value: 'autumn', label: '秋季 9-11 月' },
  { value: 'winter', label: '冬季 12-2 月' },
]

const CATEGORY_OPTIONS: Array<{ value: NonNullable<BlogAIDraftInput['category']>; label: string }> = [
  { value: 'styling', label: '穿搭教學' },
  { value: 'new-arrivals', label: '新品介紹' },
  { value: 'brand-story', label: '品牌故事' },
  { value: 'promotions', label: '優惠活動' },
  { value: 'trends', label: '時尚趨勢' },
]

const TEMPLATE_OPTIONS: Array<{
  description: string
  label: string
  value: ArticleStudioTemplateKey
}> = [
  {
    value: 'fashion',
    label: '時尚／穿搭文章',
    description: '沿用 CHIC KIM & MIU 原本的穿搭與新品文章格式',
  },
  {
    value: 'kpop-boy-group',
    label: 'KPOP 男團介紹',
    description: '團體背景、成員介紹、成長歷程、作品與新手入坑指南',
  },
  {
    value: 'kpop-girl-group',
    label: 'KPOP 女團介紹',
    description: '團體背景、成員介紹、成長歷程、作品與新手入坑指南',
  },
]

interface Props {
  defaultTakedownEmail: string
  groqConfigured: boolean
}

const BlogAIDraftClient: React.FC<Props> = ({
  defaultTakedownEmail,
  groqConfigured,
}) => {
  // ── 表單狀態 ──
  const [templateKey, setTemplateKey] =
    useState<ArticleStudioTemplateKey>('fashion')
  const [topic, setTopic] = useState('')
  const [season, setSeason] = useState<NonNullable<BlogAIDraftInput['season']>>('all')
  const [category, setCategory] =
    useState<NonNullable<BlogAIDraftInput['category']>>('styling')
  const [wordCountTarget, setWordCountTarget] = useState<number>(1000)
  const [productHints, setProductHints] = useState('')
  const [styleKeywords, setStyleKeywords] = useState('')
  const [studioImages, setStudioImages] = useState<BlogStudioImageValue[]>([])
  const [researchContext, setResearchContext] = useState('')
  const [researchSources, setResearchSources] =
    useState<BlogStudioResearchSource[]>([])
  const [researchCheckedAt, setResearchCheckedAt] = useState('')
  const [takedownEmail, setTakedownEmail] = useState(defaultTakedownEmail)

  // ── 互動狀態 ──
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<BlogAIDraftOutput | null>(null)

  const isKpop = templateKey !== 'fashion'
  const template = getArticleStudioTemplate(templateKey)

  const buildInput = (): BlogAIDraftInput => {
    const sourceUrls = researchSources.map((source) => source.url)
    return {
      topic: topic.trim(),
      templateKey,
      season: isKpop ? 'all' : season,
      category: isKpop ? template.category : category,
      wordCountTarget,
      productHints: isKpop
        ? []
        : productHints
            .split(/[,，、\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
      styleKeywords: styleKeywords
        .split(/[,，、\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      researchContext: isKpop ? researchContext : undefined,
      sourceUrls: isKpop ? sourceUrls : [],
    }
  }

  const handleTemplateChange = (value: ArticleStudioTemplateKey) => {
    setTemplateKey(value)
    setDraft(null)
    setError(null)
    if (value === 'fashion') {
      setCategory('styling')
      setWordCountTarget(1000)
    } else {
      setCategory(
        value === 'kpop-boy-group' ? 'kpop-boy-groups' : 'kpop-girl-groups',
      )
      setWordCountTarget(1400)
    }
  }

  const persistImageRights = async (image: BlogStudioImageValue) => {
    const response = await fetch(`/api/media/${encodeURIComponent(String(image.mediaId))}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        alt: image.alt,
        usageRights: {
          creator: image.creator || '',
          evidenceUrl: image.evidenceUrl || '',
          licenseKind: image.licenseKind,
          licenseUrl: image.licenseUrl || '',
          promotionalUseAllowed: image.promotionalUseAllowed === true,
          sourceLabel: image.sourceLabel || '',
          sourceUrl: image.sourceUrl || '',
          verifiedAt: image.verifiedAt || new Date().toISOString(),
          verificationNote:
            '由金老佛爺自動文章工具儲存；正式發布前仍須通過授權白名單。',
        },
      }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(
        json?.errors?.[0]?.message ||
          json?.message ||
          `媒體 #${String(image.mediaId)} 授權資料儲存失敗`,
      )
    }
  }

  const handleGenerate = async () => {
    setError(null)
    const input = buildInput()
    const topicValidation = validateBlogDraftTopic(input)
    if (!topicValidation.valid) {
      setError(`請輸入至少 ${topicValidation.minLength} 個字的文章主題或團名`)
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/blog/ai-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'generate', input }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`)
        return
      }
      setDraft(json.draft as BlogAIDraftOutput)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const handleCreate = async () => {
    if (!draft) return
    setError(null)
    setCreating(true)
    try {
      await Promise.all(studioImages.map(persistImageRights))
      const res = await fetch('/api/admin/blog/ai-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create',
          input: buildInput(),
          draft,
          images: studioImages.map((image) => ({
            alt: image.alt,
            mediaId: image.mediaId,
            personName: image.personName,
            role: image.role,
          })),
          researchCheckedAt,
          researchSources: researchSources.map(({ label, provider, url }) => ({
            label,
            provider,
            url,
          })),
          takedownEmail,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`)
        return
      }
      // 跳轉到新建的部落格文章編輯頁
      window.location.href = json.editUrl as string
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  // ── 樣式 ──
  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150, #e4e4e7)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    background: 'var(--theme-elevation-0, #fff)',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: 'var(--theme-elevation-800, #222)',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--theme-elevation-200, #ccc)',
    borderRadius: 6,
    fontSize: 14,
    background: 'var(--theme-elevation-0, #fff)',
    color: 'var(--theme-elevation-1000, #000)',
  }
  const buttonStyle = (variant: 'primary' | 'secondary' = 'primary'): React.CSSProperties => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    background:
      variant === 'primary'
        ? 'var(--theme-success-500, #22c55e)'
        : 'var(--theme-elevation-100, #f5f5f5)',
    color:
      variant === 'primary'
        ? '#fff'
        : 'var(--theme-elevation-900, #111)',
  })

  return (
    <div>
      {/* ── 表單 ── */}
      <div style={cardStyle}>
        <h2 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
          1. 選擇樣板與文章主題
        </h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: 10,
            }}
          >
            {TEMPLATE_OPTIONS.map((option) => {
              const selected = templateKey === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTemplateChange(option.value)}
                  disabled={generating || creating}
                  style={{
                    padding: 14,
                    border: selected
                      ? '2px solid var(--theme-success-500, #22c55e)'
                      : '1px solid var(--theme-elevation-200, #ccc)',
                    borderRadius: 9,
                    background: selected
                      ? 'var(--theme-success-50, #f0fdf4)'
                      : 'var(--theme-elevation-0, #fff)',
                    color: 'var(--theme-elevation-900, #111)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 14 }}>
                    {option.label}
                  </strong>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 5,
                      color: 'var(--theme-elevation-600, #666)',
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>

          <div>
            <label style={labelStyle}>
              文章主題 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                isKpop
                  ? '例：SEVENTEEN 完整介紹、TWICE 成員與成長故事'
                  : '例：秋天到冬天的針織疊穿、首爾通勤穿搭'
              }
              style={inputStyle}
              disabled={generating}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isKpop ? '2fr 1fr' : '1fr 1fr 1fr',
              gap: 12,
            }}
          >
            {isKpop ? (
              <div>
                <label style={labelStyle}>文章分類</label>
                <input
                  readOnly
                  value={template.label}
                  style={{ ...inputStyle, background: 'var(--theme-elevation-50, #fafafa)' }}
                />
              </div>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>季節</label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value as typeof season)}
                    style={inputStyle}
                    disabled={generating}
                  >
                    {SEASON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>文章分類</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as typeof category)}
                    style={inputStyle}
                    disabled={generating}
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>目標字數</label>
              <input
                type="number"
                min={600}
                max={2000}
                step={100}
                value={wordCountTarget}
                onChange={(e) => setWordCountTarget(Number(e.target.value) || 1000)}
                style={inputStyle}
                disabled={generating}
              />
            </div>
          </div>

          {!isKpop ? (
            <div>
              <label style={labelStyle}>
                商品提示（可選，用逗號分隔；LLM 會自然帶入但不保證全部提到）
              </label>
              <input
                type="text"
                value={productHints}
                onChange={(e) => setProductHints(e.target.value)}
                placeholder="例：駝色長版針織開衫、酒紅色高腰百褶裙、黑色挺版西外"
                style={inputStyle}
                disabled={generating}
              />
            </div>
          ) : null}

          <div>
            <label style={labelStyle}>風格 / 方向關鍵字（可選）</label>
            <input
              type="text"
              value={styleKeywords}
              onChange={(e) => setStyleKeywords(e.target.value)}
              placeholder={
                isKpop
                  ? '例：新手友善、溫暖、成長故事、完整成員資料'
                  : '例：知性、極簡、溫柔復古、上班族、約會、旅行'
              }
              style={inputStyle}
              disabled={generating}
            />
          </div>

          <div
            style={{
              borderTop: '1px solid var(--theme-elevation-150, #e4e4e7)',
              paddingTop: 16,
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>
              2. 研究資料與照片
            </h2>
            <BlogStudioImagePanel
              disabled={generating || creating}
              images={studioImages}
              onImagesChange={setStudioImages}
              onResearchReady={({ checkedAt, context, sources }) => {
                setResearchCheckedAt(checkedAt)
                setResearchContext(context)
                setResearchSources(sources)
              }}
              templateKey={templateKey}
              topic={topic}
            />
          </div>

          <div>
            <label style={labelStyle}>圖片權利聯絡信箱</label>
            <input
              type="email"
              value={takedownEmail}
              onChange={(event) => setTakedownEmail(event.target.value)}
              placeholder="service@chickimmiu.com"
              style={inputStyle}
              disabled={generating || creating}
            />
            <small
              style={{
                display: 'block',
                marginTop: 5,
                color: 'var(--theme-elevation-600, #666)',
                lineHeight: 1.5,
              }}
            >
              系統會自動附上圖片來源與下架聯絡說明；這段說明不等於取得授權，
              未通過白名單的圖片只能保留在草稿。
            </small>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !groqConfigured}
              style={{
                ...buttonStyle('primary'),
                opacity: generating || !groqConfigured ? 0.5 : 1,
                cursor: generating || !groqConfigured ? 'not-allowed' : 'pointer',
              }}
            >
              {generating ? '生成中…（5-15 秒）' : '✨ 3. 產生草稿'}
            </button>
            {draft && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                style={buttonStyle('secondary')}
              >
                🔁 重新生成
              </button>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 6,
                background: 'var(--theme-error-100, #fee2e2)',
                color: 'var(--theme-error-900, #991b1b)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── 草稿預覽 ── */}
      {draft && (
        <div style={cardStyle}>
          <h2 style={{ margin: 0, marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
            4. 確認草稿（建立前可在這裡微調）
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>標題</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                style={inputStyle}
                disabled={creating}
              />
            </div>
            <div>
              <label style={labelStyle}>摘要</label>
              <textarea
                value={draft.excerpt}
                onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                disabled={creating}
              />
            </div>
            <div>
              <label style={labelStyle}>
                文章內容（Markdown）— 建立後在 Lexical 編輯器仍可修改格式
              </label>
              <textarea
                value={draft.contentMarkdown}
                onChange={(e) => setDraft({ ...draft, contentMarkdown: e.target.value })}
                rows={20}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                disabled={creating}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>建議標籤（逗號分隔）</label>
                <input
                  type="text"
                  value={draft.suggestedTags.join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      suggestedTags: e.target.value
                        .split(/[,，、]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  style={inputStyle}
                  disabled={creating}
                />
              </div>
              <div>
                <label style={labelStyle}>SEO 標題</label>
                <input
                  type="text"
                  value={draft.seoMetaTitle}
                  onChange={(e) => setDraft({ ...draft, seoMetaTitle: e.target.value })}
                  style={inputStyle}
                  disabled={creating}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>SEO 描述</label>
              <textarea
                value={draft.seoMetaDescription}
                onChange={(e) => setDraft({ ...draft, seoMetaDescription: e.target.value })}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                disabled={creating}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                style={{
                  ...buttonStyle('primary'),
                  opacity: creating ? 0.5 : 1,
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? '建立中…' : '✅ 建立部落格草稿（status=draft）'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--theme-elevation-600, #666)' }}>
                建立後跳轉編輯頁，可繼續用 Lexical 編輯器 polish 後改成「已發佈」。
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BlogAIDraftClient
