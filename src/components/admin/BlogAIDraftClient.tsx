'use client'

import React, { useState } from 'react'

import type { BlogAIDraftInput, BlogAIDraftOutput } from '@/lib/blog/aiDraft'

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

interface Props {
  groqConfigured: boolean
}

const BlogAIDraftClient: React.FC<Props> = ({ groqConfigured }) => {
  // ── 表單狀態 ──
  const [topic, setTopic] = useState('')
  const [season, setSeason] = useState<NonNullable<BlogAIDraftInput['season']>>('all')
  const [category, setCategory] =
    useState<NonNullable<BlogAIDraftInput['category']>>('styling')
  const [wordCountTarget, setWordCountTarget] = useState<number>(1000)
  const [productHints, setProductHints] = useState('')
  const [styleKeywords, setStyleKeywords] = useState('')

  // ── 互動狀態 ──
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<BlogAIDraftOutput | null>(null)

  const buildInput = (): BlogAIDraftInput => ({
    topic: topic.trim(),
    season,
    category,
    wordCountTarget,
    productHints: productHints
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
    styleKeywords: styleKeywords
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
  })

  const handleGenerate = async () => {
    setError(null)
    if (topic.trim().length < 4) {
      setError('請輸入至少 4 個字的文章主題')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/blog/ai-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'generate', input: buildInput() }),
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
      const res = await fetch('/api/admin/blog/ai-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'create', input: buildInput(), draft }),
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
          1. 描述你想要的文章
        </h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={labelStyle}>
              文章主題 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例：秋天到冬天的針織疊穿、首爾通勤穿搭、婚禮賓客的優雅選擇"
              style={inputStyle}
              disabled={generating}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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

          <div>
            <label style={labelStyle}>風格 / 方向關鍵字（可選）</label>
            <input
              type="text"
              value={styleKeywords}
              onChange={(e) => setStyleKeywords(e.target.value)}
              placeholder="例：知性、極簡、溫柔復古、上班族、約會、旅行"
              style={inputStyle}
              disabled={generating}
            />
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
              {generating ? '生成中…（5-15 秒）' : '✨ 產生草稿'}
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
            2. 確認草稿（建立前可在這裡微調）
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
