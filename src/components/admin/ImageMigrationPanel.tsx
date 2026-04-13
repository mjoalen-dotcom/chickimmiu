'use client'

import { useState, useEffect, useCallback } from 'react'

interface ProductImageStatus {
  id: number
  name: string
  slug: string
  imageCount: number
  hasImages: boolean
}

interface MigrationResult {
  name: string
  status: string
  imageCount: number
  error?: string
}

/* ─── Styles ─── */
const panelStyle: React.CSSProperties = {
  marginBottom: 24,
  border: '1px solid var(--theme-elevation-150, #333)',
  borderRadius: 8,
  overflow: 'hidden',
  background: 'var(--theme-elevation-50, #1a1a1a)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  cursor: 'pointer',
  background: 'var(--theme-elevation-100, #222)',
  borderBottom: '1px solid var(--theme-elevation-150, #333)',
  userSelect: 'none',
}

const headerTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--theme-text, #fff)',
}

const bodyStyle: React.CSSProperties = {
  padding: 16,
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  background: '#C19A5B',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--theme-elevation-100, #222)',
  border: '1px solid var(--theme-elevation-200, #444)',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--theme-text, #fff)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
}

const cardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--theme-elevation-150, #333)',
  background: 'var(--theme-elevation-50, #1a1a1a)',
}

export default function ImageMigrationPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div style={panelStyle}>
      <div style={headerStyle} onClick={() => setIsOpen(!isOpen)}>
        <div style={headerTitleStyle}>
          <span style={{ fontSize: 16 }}>🖼️</span>
          <span>商品圖片遷移</span>
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(96, 165, 250, 0.15)',
            color: '#60a5fa',
          }}>
            Shopline CDN
          </span>
        </div>
        <span style={{ fontSize: 18, color: 'var(--theme-text, #888)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▾
        </span>
      </div>

      {isOpen && (
        <div style={bodyStyle}>
          <ImageMigrationContent />
        </div>
      )}
    </div>
  )
}

function ImageMigrationContent() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'migrating' | 'done' | 'error'>('idle')
  const [products, setProducts] = useState<ProductImageStatus[]>([])
  const [summary, setSummary] = useState({ total: 0, withImages: 0, withoutImages: 0 })
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([])
  const [error, setError] = useState('')

  // Manual image URL input
  const [manualUrl, setManualUrl] = useState('')
  const [manualProductId, setManualProductId] = useState('')
  const [manualStatus, setManualStatus] = useState<string>('')

  // Bulk JSON input
  const [bulkJson, setBulkJson] = useState('')

  const loadStatus = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/migrate-images', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(data.products)
      setSummary({ total: data.total, withImages: data.withImages, withoutImages: data.withoutImages })
      setStatus('ready')
    } catch (err: unknown) {
      setError((err as Error).message)
      setStatus('error')
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleManualMigrate = async () => {
    if (!manualUrl || !manualProductId) {
      setManualStatus('❌ 請填寫圖片 URL 和商品 ID')
      return
    }

    setManualStatus('⏳ 下載中...')
    try {
      const res = await fetch('/api/migrate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageUrl: manualUrl, productId: parseInt(manualProductId) }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setManualStatus(`✅ 圖片已上傳 (media ID: ${data.mediaId})`)
        setManualUrl('')
        setManualProductId('')
        loadStatus()
      } else {
        setManualStatus(`❌ ${data.error || '上傳失敗'}`)
      }
    } catch (err: unknown) {
      setManualStatus(`❌ ${(err as Error).message}`)
    }
  }

  const handleBulkMigrate = async () => {
    if (!bulkJson.trim()) return

    let productList: { name: string; slug?: string; imageIds: string[] }[]
    try {
      productList = JSON.parse(bulkJson)
      if (!Array.isArray(productList)) throw new Error('需要是陣列格式')
    } catch (err: unknown) {
      setError(`JSON 格式錯誤: ${(err as Error).message}`)
      return
    }

    setStatus('migrating')
    setMigrationResults([])

    try {
      const res = await fetch('/api/migrate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ products: productList }),
      })
      const data = await res.json()
      if (res.ok) {
        setMigrationResults(data.results || [])
        setStatus('done')
        loadStatus() // Refresh
      } else {
        setError(data.error || '遷移失敗')
        setStatus('error')
      }
    } catch (err: unknown) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  if (status === 'loading' || status === 'idle') {
    return <p style={{ fontSize: 13, color: '#888' }}>⏳ 載入商品圖片狀態中...</p>
  }

  if (status === 'error' && !products.length) {
    return <p style={{ fontSize: 13, color: '#f87171' }}>❌ {error}</p>
  }

  const noImageProducts = products.filter(p => !p.hasImages)

  return (
    <div>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 11, color: '#888' }}>總商品數</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--theme-text, #fff)' }}>{summary.total}</p>
        </div>
        <div style={{ ...cardStyle, borderColor: 'rgba(74, 222, 128, 0.3)' }}>
          <p style={{ fontSize: 11, color: '#888' }}>有圖片</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>{summary.withImages}</p>
        </div>
        <div style={{ ...cardStyle, borderColor: summary.withoutImages > 0 ? 'rgba(248, 113, 113, 0.3)' : 'rgba(74, 222, 128, 0.3)' }}>
          <p style={{ fontSize: 11, color: '#888' }}>缺少圖片</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: summary.withoutImages > 0 ? '#f87171' : '#4ade80' }}>{summary.withoutImages}</p>
        </div>
      </div>

      {/* No-image products list */}
      {noImageProducts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text, #fff)', marginBottom: 8 }}>
            缺少圖片的商品 ({noImageProducts.length}):
          </p>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--theme-elevation-150, #333)', borderRadius: 6 }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--theme-elevation-100, #222)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--theme-elevation-150, #333)' }}>ID</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--theme-elevation-150, #333)' }}>商品名稱</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--theme-elevation-150, #333)' }}>Slug</th>
                </tr>
              </thead>
              <tbody>
                {noImageProducts.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--theme-elevation-100, #222)' }}>
                    <td style={{ padding: '4px 10px', fontFamily: 'monospace', color: '#888' }}>{p.id}</td>
                    <td style={{ padding: '4px 10px', color: 'var(--theme-text, #fff)' }}>{p.name as string}</td>
                    <td style={{ padding: '4px 10px', color: '#888', fontSize: 11 }}>{p.slug as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Single Image Migration */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--theme-text, #fff)' }}>
          📸 單張圖片遷移
        </p>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
          輸入 Shopline CDN 圖片 URL 和目標商品 ID，將圖片下載並關聯到商品。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>圖片 URL</label>
            <input
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://img.shoplineapp.com/media/image_clips/xxxx/original.png"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>商品 ID</label>
            <input
              type="number"
              value={manualProductId}
              onChange={(e) => setManualProductId(e.target.value)}
              placeholder="例如 42"
              style={inputStyle}
            />
          </div>
          <button onClick={handleManualMigrate} style={{ ...btnPrimary, whiteSpace: 'nowrap' }}>
            上傳
          </button>
        </div>
        {manualStatus && (
          <p style={{ fontSize: 12, marginTop: 8, color: manualStatus.startsWith('✅') ? '#4ade80' : manualStatus.startsWith('⏳') ? '#fbbf24' : '#f87171' }}>
            {manualStatus}
          </p>
        )}
      </div>

      {/* Bulk JSON Migration */}
      <div style={cardStyle}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--theme-text, #fff)' }}>
          📦 批量圖片遷移
        </p>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
          貼上 JSON 陣列格式: {`[{"name": "商品名", "slug": "product-slug", "imageIds": ["shopline-image-id-1", "id-2"]}]`}
        </p>
        <textarea
          value={bulkJson}
          onChange={(e) => setBulkJson(e.target.value)}
          rows={6}
          placeholder={`[\n  { "name": "Dream 拼接絲緞蝴蝶結洋裝", "slug": "dream-spliced-satin-bow-dress", "imageIds": ["69d3d8324c5226e1bcda99eb"] }\n]`}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
        />
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleBulkMigrate}
            disabled={status === 'migrating' || !bulkJson.trim()}
            style={{ ...btnPrimary, opacity: status === 'migrating' || !bulkJson.trim() ? 0.5 : 1 }}
          >
            {status === 'migrating' ? '⏳ 遷移中...' : '🚀 開始批量遷移'}
          </button>
          {status === 'migrating' && (
            <span style={{ fontSize: 12, color: '#fbbf24' }}>請耐心等待，正在下載並上傳圖片...</span>
          )}
        </div>
      </div>

      {/* Migration Results */}
      {(status === 'done' || migrationResults.length > 0) && (
        <div style={{ marginTop: 12, padding: 12, background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8 }}>
          <p style={{ fontWeight: 600, color: '#4ade80', marginBottom: 8, fontSize: 13 }}>遷移結果</p>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {migrationResults.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid var(--theme-elevation-100, #222)' }}>
                <span style={{ color: 'var(--theme-text, #fff)' }}>{r.name}</span>
                <span style={{
                  color: r.status === 'success' ? '#4ade80' : r.status === 'skipped' ? '#fbbf24' : '#f87171',
                }}>
                  {r.status === 'success' ? `✅ ${r.imageCount} 張` : r.status === 'skipped' ? `⏭ ${r.error}` : `❌ ${r.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && status !== 'error' && (
        <p style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>⚠️ {error}</p>
      )}
    </div>
  )
}
