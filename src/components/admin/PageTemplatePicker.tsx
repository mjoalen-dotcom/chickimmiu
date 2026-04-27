'use client'

import { useState } from 'react'

/**
 * PageTemplatePicker
 * ──────────────────
 * 註冊在 Pages collection 的 admin.components.beforeListTable，
 * 在 /admin/collections/pages 列表上方顯示「快速樣板」面板。
 *
 * 五個樣板對應 src/lib/pageTemplates.ts；點選後 POST 到
 * /api/pages/from-template，後端建立 page → 跳轉到 edit view。
 */

type TemplateMeta = {
  id: 'fashion-magazine' | 'vogue' | 'luxury' | 'kol-personal' | 'cosmopolitan'
  name: string
  description: string
  accent: string
  emoji: string
  taglines: string[]
}

const templates: TemplateMeta[] = [
  {
    id: 'fashion-magazine',
    name: '時尚雜誌',
    description: '編輯精選 × 主題策展',
    accent: '#1A1F36',
    emoji: '📖',
    taglines: ['雜誌封面 + Pull Quote', '三位風格人物 Editorial', '訂閱新刊 CTA'],
  },
  {
    id: 'vogue',
    name: 'Vogue 風格宣言',
    description: '大膽宣言 × 標誌性視覺',
    accent: '#000000',
    emoji: '🖤',
    taglines: ['Dark Cover + Manifesto', 'Lookbook 三位主角', 'Editorial 獨白 + ICON CTA'],
  },
  {
    id: 'luxury',
    name: 'Luxury 私密典藏',
    description: '限量 × 邀請制 × 工坊敘事',
    accent: '#C19A5B',
    emoji: '✦',
    taglines: ['Gold Cover · 邀請制', '工坊七年敘事 (3-row Editorial)', 'Countdown + FAQ + Invitation'],
  },
  {
    id: 'kol-personal',
    name: 'KOL 個人風格',
    description: '第一人稱 × 私房分享',
    accent: '#E8B4B8',
    emoji: '✿',
    taglines: ['KOL 大頭照 + 社群連結', '衣櫃故事 Editorial', '粉絲回饋 + 訂閱'],
  },
  {
    id: 'cosmopolitan',
    name: 'Cosmopolitan',
    description: '城市女孩 × Lifestyle Mix',
    accent: '#E84A6E',
    emoji: '🌆',
    taglines: ['City Guide Cover · 左對齊', '5 大態度單品 Listicle', '聚會倒數 + 報名'],
  },
]

const wrapperStyle: React.CSSProperties = {
  marginBottom: 24,
  border: '1px solid #E8DDD0',
  borderRadius: 12,
  overflow: 'hidden',
  background: '#fff',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px',
  cursor: 'pointer',
  background: 'linear-gradient(135deg, #fdfaf3 0%, #f9f3e6 100%)',
  borderBottom: '1px solid #E8DDD0',
  userSelect: 'none',
}

const titleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14,
  fontWeight: 600,
  color: '#1A1F36',
}

const captionStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6B6560',
  marginLeft: 8,
}

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  padding: 20,
  background: '#fafaf7',
}

const cardBaseStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E8DDD0',
  borderRadius: 10,
  padding: 16,
  cursor: 'pointer',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  position: 'relative',
  overflow: 'hidden',
}

const cardEmojiStyle: React.CSSProperties = {
  fontSize: 24,
  marginBottom: 6,
}

const cardNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#1A1F36',
  marginBottom: 4,
}

const cardDescStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6B6560',
  marginBottom: 10,
  lineHeight: 1.5,
}

const tagListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
}

const tagItemStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  paddingLeft: 12,
  position: 'relative',
}

const accentBarStyle = (color: string): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: 4,
  height: '100%',
  background: color,
})

const previewLinkStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  fontSize: 11,
  fontWeight: 500,
  color: '#6B6560',
  background: '#fff',
  border: '1px solid #E8DDD0',
  borderRadius: 999,
  padding: '4px 10px',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  zIndex: 2,
  transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
}

const messageStyle: React.CSSProperties = {
  margin: '8px 20px 16px',
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.5,
}

const messageSuccess: React.CSSProperties = {
  ...messageStyle,
  background: '#f0f9f0',
  border: '1px solid #c8e6c9',
  color: '#2e7d32',
}

const messageError: React.CSSProperties = {
  ...messageStyle,
  background: '#fdecea',
  border: '1px solid #f5c2c0',
  color: '#c62828',
}

export default function PageTemplatePicker() {
  const [isOpen, setIsOpen] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handlePick(templateId: string) {
    if (pendingId) return
    setError(null)
    setSuccess(null)
    setPendingId(templateId)
    try {
      const res = await fetch('/api/pages/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      setSuccess(data?.message || '已建立樣板頁面，正在跳轉…')
      // redirect
      const id = data?.id
      if (id) {
        window.location.href = `/admin/collections/pages/${id}`
      } else {
        // fallback — refresh list
        window.location.reload()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗，請重試')
      setPendingId(null)
    }
  }

  return (
    <div style={wrapperStyle}>
      <div style={headerStyle} onClick={() => setIsOpen(!isOpen)}>
        <div style={titleStyle}>
          <span style={{ fontSize: 18 }}>✨</span>
          <span>快速樣板（一鍵建立活動一頁式網頁）</span>
          <span style={captionStyle}>點卡片 → 建立 draft；點「👁 預覽」→ 新分頁先看樣本</span>
        </div>
        <span
          style={{
            fontSize: 16,
            color: '#888',
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
          }}
        >
          ⌃
        </span>
      </div>

      {isOpen && (
        <>
          {error && <div style={messageError}>⚠️ {error}</div>}
          {success && <div style={messageSuccess}>✓ {success}</div>}

          <div style={cardGridStyle}>
            {templates.map((t) => {
              const isPending = pendingId === t.id
              const isDisabled = pendingId !== null
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => !isDisabled && handlePick(t.id)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                      e.preventDefault()
                      handlePick(t.id)
                    }
                  }}
                  style={{
                    ...cardBaseStyle,
                    cursor: isDisabled ? 'wait' : 'pointer',
                    opacity: isDisabled && !isPending ? 0.5 : 1,
                    borderColor: isPending ? t.accent : '#E8DDD0',
                    boxShadow: isPending
                      ? `0 0 0 2px ${t.accent}33`
                      : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled) {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = `0 4px 12px ${t.accent}22`
                      e.currentTarget.style.borderColor = t.accent
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPending) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.borderColor = '#E8DDD0'
                    }
                  }}
                >
                  <div style={accentBarStyle(t.accent)} />
                  <a
                    href={`/preview/templates/${t.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={previewLinkStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = t.accent
                      e.currentTarget.style.color = '#fff'
                      e.currentTarget.style.borderColor = t.accent
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff'
                      e.currentTarget.style.color = '#6B6560'
                      e.currentTarget.style.borderColor = '#E8DDD0'
                    }}
                    aria-label={`預覽 ${t.name}`}
                  >
                    <span aria-hidden>👁</span>
                    <span>預覽</span>
                  </a>
                  <div style={{ paddingLeft: 8 }}>
                    <div style={cardEmojiStyle}>{t.emoji}</div>
                    <div style={cardNameStyle}>{t.name}</div>
                    <div style={cardDescStyle}>{t.description}</div>
                    <ul style={tagListStyle}>
                      {t.taglines.map((line, i) => (
                        <li key={i} style={tagItemStyle}>
                          <span style={{ position: 'absolute', left: 0 }}>·</span>
                          {line}
                        </li>
                      ))}
                    </ul>
                    {isPending && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 11,
                          color: t.accent,
                          fontWeight: 600,
                        }}
                      >
                        建立中…
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div
            style={{
              padding: '0 20px 16px',
              fontSize: 11,
              color: '#888',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: '#1A1F36' }}>提示：</strong>
            樣板會建立為「草稿」狀態並自動跳轉到編輯頁。圖片展示區塊會用媒體庫第一張圖補位（若媒體庫為空則略過該區塊）；
            倒數計時的結束時間預設為 14 / 30 天後，請依活動實際時程調整；影片區塊的 URL 為範例，請替換為實際 YouTube / Vimeo 網址。
          </div>
        </>
      )}
    </div>
  )
}
