'use client'

import React, { useMemo, useState } from 'react'

interface CampaignOption {
  id: number | string
  name: string
  slug: string
  source: string
  medium: string
  defaultContent: string
  defaultTerm: string
}

interface Props {
  campaigns: CampaignOption[]
  defaultBaseUrl: string
}

const SOURCE_OPTIONS = [
  'facebook', 'instagram', 'google', 'line', 'youtube', 'tiktok',
  'email', 'sms', 'direct', 'affiliate', 'other',
]
const MEDIUM_OPTIONS = [
  'cpc', 'cpm', 'social', 'email', 'sms', 'referral',
  'organic', 'display', 'influencer', 'other',
]

export default function UTMBuilderClient({ campaigns, defaultBaseUrl }: Props) {
  const [mode, setMode] = useState<'fromCampaign' | 'freeform'>(
    campaigns.length > 0 ? 'fromCampaign' : 'freeform',
  )
  const [campaignId, setCampaignId] = useState<string>(
    campaigns.length > 0 ? String(campaigns[0].id) : '',
  )
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl)
  const [source, setSource] = useState('facebook')
  const [medium, setMedium] = useState('cpc')
  const [campaign, setCampaign] = useState('')
  const [term, setTerm] = useState('')
  const [content, setContent] = useState('')
  const [copied, setCopied] = useState(false)

  // 當選定 campaign 時自動填欄位
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => String(c.id) === campaignId),
    [campaigns, campaignId],
  )

  React.useEffect(() => {
    if (mode === 'fromCampaign' && selectedCampaign) {
      setSource(selectedCampaign.source || 'facebook')
      setMedium(selectedCampaign.medium || 'cpc')
      setCampaign(selectedCampaign.slug || '')
      setTerm(selectedCampaign.defaultTerm || '')
      setContent(selectedCampaign.defaultContent || '')
    }
  }, [mode, selectedCampaign])

  // 產出 URL
  const finalUrl = useMemo(() => {
    if (!baseUrl.trim()) return ''
    let url: URL
    try {
      url = new URL(baseUrl.trim())
    } catch {
      return '(網址格式不正確)'
    }
    const setParam = (k: string, v: string) => {
      const trimmed = v.trim()
      if (trimmed) url.searchParams.set(k, trimmed)
      else url.searchParams.delete(k)
    }
    setParam('utm_source', source)
    setParam('utm_medium', medium)
    setParam('utm_campaign', campaign)
    setParam('utm_term', term)
    setParam('utm_content', content)
    return url.toString()
  }, [baseUrl, source, medium, campaign, term, content])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--theme-bg, #fff)',
    border: '1px solid var(--theme-elevation-100, #eee)',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 4,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--theme-elevation-150, #ddd)',
    borderRadius: 4,
    background: 'var(--theme-input-bg, #fff)',
    color: 'var(--theme-text, #000)',
    fontSize: 14,
  }
  const rowStyle: React.CSSProperties = { marginBottom: 16 }
  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    background: 'var(--theme-success-500, #2563eb)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  }

  return (
    <div>
      {/* Mode 切換 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'fromCampaign'}
              onChange={() => setMode('fromCampaign')}
              disabled={campaigns.length === 0}
            />{' '}
            從活動清單選 ({campaigns.length})
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'freeform'}
              onChange={() => setMode('freeform')}
            />{' '}
            自由輸入
          </label>
        </div>
      </div>

      {/* Campaign 選擇器 */}
      {mode === 'fromCampaign' && campaigns.length > 0 && (
        <div style={cardStyle}>
          <label style={labelStyle}>活動</label>
          <select
            style={inputStyle}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name} ({c.slug})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* URL + UTM 表單 */}
      <div style={cardStyle}>
        <div style={rowStyle}>
          <label style={labelStyle}>Base URL</label>
          <input
            style={inputStyle}
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://chickimmiu.com/products/some-dress"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={rowStyle}>
            <label style={labelStyle}>UTM Source *</label>
            <input
              style={inputStyle}
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              list="utm-source-list"
              required
            />
            <datalist id="utm-source-list">
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>UTM Medium *</label>
            <input
              style={inputStyle}
              type="text"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              list="utm-medium-list"
              required
            />
            <datalist id="utm-medium-list">
              {MEDIUM_OPTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>UTM Campaign *</label>
          <input
            style={inputStyle}
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="例：spring-2026-launch"
            list="utm-campaign-list"
            required
          />
          <datalist id="utm-campaign-list">
            {campaigns.map((c) => (
              <option key={c.slug} value={c.slug} />
            ))}
          </datalist>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={rowStyle}>
            <label style={labelStyle}>UTM Term（選填）</label>
            <input
              style={inputStyle}
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="關鍵字"
            />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>UTM Content（選填）</label>
            <input
              style={inputStyle}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="廣告素材識別"
            />
          </div>
        </div>
      </div>

      {/* 產出 URL */}
      <div style={{ ...cardStyle, background: 'var(--theme-elevation-50, #f9f9f9)' }}>
        <label style={labelStyle}>產出網址</label>
        <textarea
          style={{
            ...inputStyle,
            height: 80,
            fontFamily: 'monospace',
            fontSize: 13,
            wordBreak: 'break-all',
          }}
          value={finalUrl}
          readOnly
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" style={buttonStyle} onClick={handleCopy} disabled={!finalUrl}>
            {copied ? '✓ 已複製' : '複製網址'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--theme-elevation-500, #888)' }}>
            點選文字框可全選 · 提示：先在「UTM 活動」collection 建好活動，這裡 dropdown 才會有
          </span>
        </div>
      </div>
    </div>
  )
}
