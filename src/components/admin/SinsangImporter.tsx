'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * Sinsang Market 商品匯入器
 * ─────────────────────────────
 * 放置於 Products 後台列表頁頂部
 * 輸入商品 ID → 抓取資料 → 預填表單 → 管理員自由修改後上架
 *
 * 重要原則：
 * - 供應商名稱/位置/韓文描述僅後台可見，前台完全隱藏
 * - 圖片不自動匯入，由後台人員手動上傳
 * - 所有預填欄位均可自由修改
 * - 換算係數可單次覆蓋，不影響系統預設值
 */

interface SinsangProduct {
  name: string
  priceKRW: number
  colors: string[]
  sizes: string[]
  material: string
  madeIn: string
  fabric: {
    thickness: string
    transparency: string
    elasticity: string
  }
  sourceId: string
  supplierName: string
  supplierLocation: string
  originalDescription: string
}

type ImportStatus = 'idle' | 'fetching' | 'preview' | 'creating' | 'done' | 'error'

export default function SinsangImporter() {
  const [isOpen, setIsOpen] = useState(false)
  const [goodsId, setGoodsId] = useState('')
  const [rate, setRate] = useState(0.023)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [product, setProduct] = useState<SinsangProduct | null>(null)
  const [createMsg, setCreateMsg] = useState('')

  // 載入系統預設換算係數
  useEffect(() => {
    if (!isOpen) return
    fetch('/api/sinsang?id=0')
      .then(r => r.json())
      .then(d => { if (d.defaultRate) setRate(d.defaultRate) })
      .catch(() => {})
  }, [isOpen])

  const handleFetch = useCallback(async () => {
    const trimmedId = goodsId.trim()
    if (!trimmedId || !/^\d+$/.test(trimmedId)) {
      setErrorMsg('請輸入有效的商品 ID（純數字）')
      setStatus('error')
      return
    }

    setStatus('fetching')
    setErrorMsg('')
    setProduct(null)

    try {
      const res = await fetch(`/api/sinsang?id=${trimmedId}`)
      const data = await res.json()

      if (!data.success) {
        setErrorMsg(data.error || '未知錯誤')
        setStatus('error')
        return
      }

      if (data.defaultRate && rate === 0.023) {
        setRate(data.defaultRate)
      }

      setProduct(data.data)
      setStatus('preview')
    } catch {
      setErrorMsg('無法連線至 Sinsang Market，請稍後再試')
      setStatus('error')
    }
  }, [goodsId, rate])

  const handleCreate = useCallback(async () => {
    if (!product) return
    setStatus('creating')
    setCreateMsg('')

    try {
      // 建立 variants（顏色 × 尺碼）
      const variants = []
      for (const color of product.colors) {
        for (const size of product.sizes) {
          variants.push({
            colorName: color,
            colorCode: '',
            size,
            sku: `SSM-${product.sourceId}-${color.slice(0, 2)}-${size}`,
            stock: 0,
          })
        }
      }

      const twdPrice = Math.round(product.priceKRW * rate)

      const slug = product.name
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-|-$/g, '')
        || `sinsang-${product.sourceId}`

      const body = {
        name: product.name,
        slug: `${slug}-${product.sourceId}`,
        price: twdPrice,
        variants,
        stock: 0,
        status: 'draft', // 預設為草稿，由管理員審核後上架
        weight: 0,
        isNew: false,
        isHot: false,
        // 內部採購資訊
        sourcing: {
          sourceId: product.sourceId,
          supplierName: product.supplierName,
          supplierLocation: product.supplierLocation,
          costKRW: product.priceKRW,
          costTWD: twdPrice,
          exchangeRate: rate,
          originalDescription: product.originalDescription,
          fabricInfo: {
            material: product.material,
            thickness: product.fabric.thickness,
            transparency: product.fabric.transparency,
            elasticity: product.fabric.elasticity,
            madeIn: product.madeIn,
          },
        },
      }

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const result = await res.json()
        setStatus('done')
        setCreateMsg(`✅ 商品已建立為草稿！ID: ${result.doc?.id || '成功'}`)
        // 2 秒後刷新列表
        setTimeout(() => { window.location.reload() }, 2000)
      } else {
        const err = await res.json().catch(() => ({}))
        setErrorMsg(err.errors?.[0]?.message || `建立失敗 (${res.status})`)
        setStatus('error')
      }
    } catch (e) {
      setErrorMsg('建立商品時發生錯誤')
      setStatus('error')
    }
  }, [product, rate])

  const twdPreview = Math.round((product?.priceKRW || 7000) * rate)

  if (!isOpen) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setIsOpen(true)}
          type="button"
          style={{
            padding: '8px 16px',
            backgroundColor: '#C19A5B',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          📦 從 Sinsang Market 匯入
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        marginBottom: 20,
        padding: 20,
        border: '1px solid #e5e0d8',
        borderRadius: 8,
        backgroundColor: '#faf8f5',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          📦 從 Sinsang Market 匯入
        </h3>
        <button
          onClick={() => { setIsOpen(false); setStatus('idle'); setProduct(null); setErrorMsg('') }}
          type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999' }}
        >
          ✕
        </button>
      </div>

      {/* 輸入列 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>商品 ID</label>
          <input
            type="text"
            value={goodsId}
            onChange={(e) => setGoodsId(e.target.value.replace(/\D/g, ''))}
            placeholder="例如 97970160"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d0cbc3',
              borderRadius: 6,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ flex: '0 0 160px' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>
            韓元換算係數
          </label>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
            step={0.001}
            min={0.001}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d0cbc3',
              borderRadius: 6,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={handleFetch}
          disabled={status === 'fetching'}
          type="button"
          style={{
            padding: '8px 20px',
            backgroundColor: status === 'fetching' ? '#ccc' : '#2C2C2C',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: status === 'fetching' ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'fetching' ? '抓取中…' : '抓取資料'}
        </button>
      </div>

      {/* 換算預覽 */}
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        預覽換算：₩{(product?.priceKRW || 7000).toLocaleString()} × {rate} = <strong style={{ color: '#C19A5B' }}>NT$ {twdPreview.toLocaleString()}</strong>
        <span style={{ marginLeft: 8, color: '#aaa' }}>（僅影響本次匯入，不更動系統預設值）</span>
      </div>

      {/* 錯誤訊息 */}
      {status === 'error' && errorMsg && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          color: '#dc2626',
          fontSize: 13,
          marginBottom: 12,
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 成功訊息 */}
      {status === 'done' && createMsg && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 6,
          color: '#16a34a',
          fontSize: 13,
          marginBottom: 12,
        }}>
          {createMsg}
        </div>
      )}

      {/* 預覽卡片 */}
      {(status === 'preview' || status === 'creating' || status === 'done') && product && (
        <div style={{
          border: '1px solid #e5e0d8',
          borderRadius: 8,
          backgroundColor: '#fff',
          padding: 16,
          marginTop: 8,
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 600 }}>
            預覽：{product.name}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 13, lineHeight: 1.8 }}>
            {/* 前台欄位 */}
            <div>
              <span style={{ color: '#888' }}>進貨成本：</span>
              <span>₩{product.priceKRW.toLocaleString()}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>台幣參考售價：</span>
              <strong style={{ color: '#C19A5B' }}>NT$ {twdPreview.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#888' }}>顏色：</span>
              <span>{product.colors.join('、')}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>尺碼：</span>
              <span>{product.sizes.join('、')}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>材質：</span>
              <span>{product.material || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>製造國：</span>
              <span>{product.madeIn || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>厚度：</span>
              <span>{product.fabric.thickness || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>透明度：</span>
              <span>{product.fabric.transparency || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>彈性：</span>
              <span>{product.fabric.elasticity || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>規格數：</span>
              <span>{product.colors.length} 色 × {product.sizes.length} 碼 = {product.colors.length * product.sizes.length} 個 SKU</span>
            </div>
          </div>

          {/* 後台內部資訊 */}
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 12, color: '#999', cursor: 'pointer' }}>
              🔒 內部採購資訊（僅後台可見）
            </summary>
            <div style={{ fontSize: 12, color: '#666', padding: '8px 0', lineHeight: 1.8, borderTop: '1px dashed #e5e0d8', marginTop: 8 }}>
              <div>來源 ID：{product.sourceId}</div>
              <div>供應商：{product.supplierName}</div>
              <div>位置：{product.supplierLocation}</div>
              {product.originalDescription && (
                <div style={{ marginTop: 4 }}>
                  <span>韓文描述：</span>
                  <div style={{
                    maxHeight: 80,
                    overflow: 'auto',
                    padding: 8,
                    backgroundColor: '#f5f3ef',
                    borderRadius: 4,
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    fontSize: 11,
                  }}>
                    {product.originalDescription}
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* 建立按鈕 */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e0d8' }}>
            <button
              onClick={handleCreate}
              disabled={status === 'creating'}
              type="button"
              style={{
                padding: '10px 24px',
                backgroundColor: '#C19A5B',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {status === 'creating' ? '建立中…' : '建立為草稿商品'}
            </button>
            <span style={{ fontSize: 11, color: '#999', alignSelf: 'center' }}>
              ※ 建立後為「草稿」狀態，所有欄位可自由修改，圖片需另行上傳
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
