'use client'

import { useState, useCallback, useRef } from 'react'
import {
  parseShoplineCSV,
  toExportJSON,
  type ParseResult,
  type ParsedProduct,
} from '@/lib/shopline/csvParser'
import { getAllNewCategories } from '@/lib/shopline/categoryMapping'

type TabKey = 'bulk' | 'single'
type ImportMode = 'create' | 'update' | 'skip-existing'

interface ImportProgress {
  status: 'idle' | 'importing' | 'done' | 'error'
  total: number
  current: number
  results: {
    success: number
    failed: number
    skipped: number
    details: { name: string; status: string; message?: string }[]
  } | null
  error?: string
}

/* ─── Inline Styles (Payload Admin Compatible) ─── */
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

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: 4,
  background: 'var(--theme-elevation-100, #222)',
  borderRadius: 8,
  width: 'fit-content',
  marginBottom: 16,
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

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  background: 'var(--theme-elevation-150, #333)',
  color: 'var(--theme-text, #fff)',
  border: '1px solid var(--theme-elevation-200, #444)',
  borderRadius: 6,
  fontSize: 13,
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
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--theme-elevation-150, #333)',
  background: 'var(--theme-elevation-50, #1a1a1a)',
}

const dropZoneBase: React.CSSProperties = {
  border: '2px dashed var(--theme-elevation-200, #444)',
  borderRadius: 12,
  padding: '40px 20px',
  textAlign: 'center' as const,
  cursor: 'pointer',
  transition: 'all 0.2s',
}

const dropZoneActive: React.CSSProperties = {
  ...dropZoneBase,
  borderColor: '#C19A5B',
  background: 'rgba(193, 154, 91, 0.05)',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  borderCollapse: 'collapse' as const,
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left' as const,
  borderBottom: '1px solid var(--theme-elevation-150, #333)',
  background: 'var(--theme-elevation-100, #222)',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--theme-text, #ccc)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--theme-elevation-100, #222)',
  fontSize: 13,
}

const tagStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  background: 'rgba(193, 154, 91, 0.15)',
  color: '#C19A5B',
}

/* ─── Main Component ─── */
export default function ShoplineImportPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div style={panelStyle}>
      <div style={headerStyle} onClick={() => setIsOpen(!isOpen)}>
        <div style={headerTitleStyle}>
          <span style={{ fontSize: 16 }}>📦</span>
          <span>Shopline 商品匯入</span>
          <span
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'rgba(193, 154, 91, 0.15)',
              color: '#C19A5B',
            }}
          >
            CSV / 單筆
          </span>
        </div>
        <span style={{ fontSize: 18, color: 'var(--theme-text, #888)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▾
        </span>
      </div>

      {isOpen && (
        <div style={bodyStyle}>
          <ShoplineImportContent />
        </div>
      )}
    </div>
  )
}

/* ─── Import Content (Bulk + Single) ─── */
function ShoplineImportContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('bulk')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [importMode, setImportMode] = useState<ImportMode>('skip-existing')
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: 'idle', total: 0, current: 0, results: null,
  })
  const [sortField, setSortField] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const allCategories = getAllNewCategories()

  const handleFileRead = useCallback((file: File) => {
    setFileName(file.name)
    setImportProgress({ status: 'idle', total: 0, current: 0, results: null })
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return
      const result = parseShoplineCSV(text)
      setParseResult(result)
      setSelectedProducts(new Set(result.products.map((_, i) => i)))
      setExpandedRows(new Set())
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileRead(file)
    }
  }, [handleFileRead])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileRead(file)
  }, [handleFileRead])

  const downloadJSON = useCallback(() => {
    if (!parseResult) return
    const selected = parseResult.products.filter((_, i) => selectedProducts.has(i))
    const json = toExportJSON(selected)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shopline-import-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [parseResult, selectedProducts])

  const handleImport = useCallback(async () => {
    if (!parseResult) return
    const selected = parseResult.products.filter((_, i) => selectedProducts.has(i))
    if (selected.length === 0) return

    setImportProgress({ status: 'importing', total: selected.length, current: 0, results: null })

    try {
      const batchSize = 20
      const allDetails: { name: string; status: string; message?: string }[] = []
      let totalSuccess = 0, totalFailed = 0, totalSkipped = 0

      for (let i = 0; i < selected.length; i += batchSize) {
        const batch = selected.slice(i, i + batchSize)
        const response = await fetch('/api/shopline-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: batch, mode: importMode }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || `HTTP ${response.status}`)
        }

        const data = await response.json()
        totalSuccess += data.success || 0
        totalFailed += data.failed || 0
        totalSkipped += data.skipped || 0
        allDetails.push(...(data.details || []))

        setImportProgress(prev => ({ ...prev, current: Math.min(i + batchSize, selected.length) }))
      }

      setImportProgress({
        status: 'done',
        total: selected.length,
        current: selected.length,
        results: { success: totalSuccess, failed: totalFailed, skipped: totalSkipped, details: allDetails },
      })

      // Auto-reload after 2s on success
      if (totalSuccess > 0) {
        setTimeout(() => { window.location.reload() }, 2000)
      }
    } catch (err: unknown) {
      setImportProgress(prev => ({ ...prev, status: 'error', error: (err as Error).message }))
    }
  }, [parseResult, selectedProducts, importMode])

  const filteredProducts = parseResult?.products
    .map((p, i) => ({ ...p, _index: i }))
    .filter(p => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name, 'zh-TW'); break
        case 'price': cmp = a.price_ntd - b.price_ntd; break
        case 'category': cmp = a.category.localeCompare(b.category, 'zh-TW'); break
        case 'variants': cmp = a.variants.length - b.variants.length; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const toggleSelectAll = () => {
    if (!filteredProducts) return
    const allIdxs = filteredProducts.map(p => p._index)
    const allSelected = allIdxs.every(i => selectedProducts.has(i))
    if (allSelected) {
      const next = new Set(selectedProducts)
      allIdxs.forEach(i => next.delete(i))
      setSelectedProducts(next)
    } else {
      setSelectedProducts(new Set([...selectedProducts, ...allIdxs]))
    }
  }

  const tabBtn = (key: TabKey, label: string, emoji: string) => (
    <button
      onClick={() => setActiveTab(key)}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
        background: activeTab === key ? 'rgba(193, 154, 91, 0.2)' : 'transparent',
        color: activeTab === key ? '#C19A5B' : 'var(--theme-text, #999)',
      }}
    >
      {emoji} {label}
    </button>
  )

  return (
    <div>
      <div style={tabContainerStyle}>
        {tabBtn('bulk', '批量匯入', '📄')}
        {tabBtn('single', '單筆新增', '➕')}
      </div>

      {/* ═══ Bulk Import Tab ═══ */}
      {activeTab === 'bulk' && (
        <div>
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            style={isDragging ? dropZoneActive : dropZoneBase}
          >
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
            <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--theme-text, #fff)', marginBottom: 4 }}>
              {fileName ? <span style={{ color: '#C19A5B' }}>{fileName}</span> : '拖放 CSV 檔案到此處'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--theme-text, #888)' }}>
              支援 Shopline Bulk Update Excel 轉出的 CSV (UTF-8)
            </p>
            {fileName && (
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                style={{ marginTop: 8, fontSize: 12, color: '#C19A5B', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                重新選擇檔案
              </button>
            )}
          </div>

          {/* Parse Result */}
          {parseResult && (
            <div style={{ marginTop: 16 }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                <StatCard label="商品數" value={parseResult.totalProducts} color="#C19A5B" />
                <StatCard label="變體數" value={parseResult.totalVariants} color="#60a5fa" />
                <StatCard label="警告" value={parseResult.warnings.length} color={parseResult.warnings.length > 0 ? '#fbbf24' : '#4ade80'} />
                <StatCard label="錯誤" value={parseResult.errors.length} color={parseResult.errors.length > 0 ? '#f87171' : '#4ade80'} />
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {parseResult.errors.map((err, i) => (
                    <div key={i} style={{ padding: '6px 12px', marginBottom: 4, background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: 6, fontSize: 12, color: '#f87171' }}>
                      ❌ Row {err.row}: {err.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {parseResult.warnings.slice(0, 5).map((w, i) => (
                    <div key={i} style={{ padding: '6px 12px', marginBottom: 4, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 6, fontSize: 12, color: '#fbbf24' }}>
                      ⚠️ Row {w.row}: {w.message}
                    </div>
                  ))}
                  {parseResult.warnings.length > 5 && (
                    <p style={{ fontSize: 11, color: '#888', paddingLeft: 12 }}>...及另外 {parseResult.warnings.length - 5} 個警告</p>
                  )}
                </div>
              )}

              {/* Unmapped Categories */}
              {parseResult.unmappedCategories.length > 0 && (
                <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.2)', borderRadius: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#fb923c', marginBottom: 6 }}>
                    未映射的 Shopline 分類（將歸入「全部商品」）：
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {parseResult.unmappedCategories.map(cat => (
                      <span key={cat} style={{ ...tagStyle, background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="搜尋商品名稱、分類、SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ ...inputStyle, width: 240 }}
                  />
                  <span style={{ fontSize: 11, color: '#888' }}>
                    已選 {selectedProducts.size} / {parseResult.totalProducts} 筆
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={downloadJSON} disabled={selectedProducts.size === 0} style={{ ...btnSecondary, opacity: selectedProducts.size === 0 ? 0.4 : 1 }}>
                    ⬇ JSON
                  </button>
                  <select value={importMode} onChange={(e) => setImportMode(e.target.value as ImportMode)} style={selectStyle}>
                    <option value="skip-existing">跳過已存在</option>
                    <option value="create">僅新增</option>
                    <option value="update">更新已存在</option>
                  </select>
                  <button
                    onClick={handleImport}
                    disabled={selectedProducts.size === 0 || importProgress.status === 'importing'}
                    style={{ ...btnPrimary, opacity: selectedProducts.size === 0 || importProgress.status === 'importing' ? 0.5 : 1 }}
                  >
                    {importProgress.status === 'importing'
                      ? `⏳ 匯入中 (${importProgress.current}/${importProgress.total})`
                      : '📥 匯入到資料庫'}
                  </button>
                </div>
              </div>

              {/* Import Result */}
              {importProgress.status === 'done' && importProgress.results && (
                <div style={{ padding: 16, marginBottom: 12, background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: 8 }}>
                  <p style={{ fontWeight: 600, color: '#4ade80', marginBottom: 8 }}>✅ 匯入完成（頁面即將重新載入）</p>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <span style={{ color: '#4ade80' }}>成功: {importProgress.results.success}</span>
                    <span style={{ color: '#fbbf24' }}>跳過: {importProgress.results.skipped}</span>
                    <span style={{ color: '#f87171' }}>失敗: {importProgress.results.failed}</span>
                  </div>
                  {importProgress.results.details.some(d => d.status === 'error') && (
                    <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
                      {importProgress.results.details.filter(d => d.status === 'error').map((d, i) => (
                        <p key={i} style={{ fontSize: 11, color: '#f87171' }}>{d.name}: {d.message}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importProgress.status === 'error' && (
                <div style={{ padding: 12, marginBottom: 12, background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: 8 }}>
                  <p style={{ color: '#f87171' }}>❌ 匯入錯誤: {importProgress.error}</p>
                </div>
              )}

              {/* Product Table */}
              <div style={{ border: '1px solid var(--theme-elevation-150, #333)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 36 }}>
                          <input
                            type="checkbox"
                            checked={(filteredProducts?.length ?? 0) > 0 && filteredProducts?.every(p => selectedProducts.has(p._index))}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th style={{ ...thStyle, width: 32 }}>#</th>
                        <SortTh field="name" label="商品名稱" current={sortField} dir={sortDir} onToggle={toggleSort} />
                        <SortTh field="category" label="分類" current={sortField} dir={sortDir} onToggle={toggleSort} />
                        <SortTh field="price" label="價格" current={sortField} dir={sortDir} onToggle={toggleSort} />
                        <SortTh field="variants" label="變體" current={sortField} dir={sortDir} onToggle={toggleSort} />
                        <th style={thStyle}>顏色</th>
                        <th style={thStyle}>尺寸</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts?.map((product, idx) => (
                        <ProductTableRow
                          key={product._index}
                          product={product}
                          displayIdx={idx}
                          isExpanded={expandedRows.has(product._index)}
                          isSelected={selectedProducts.has(product._index)}
                          onToggleExpand={() => {
                            setExpandedRows(prev => {
                              const next = new Set(prev)
                              if (next.has(product._index)) next.delete(product._index)
                              else next.add(product._index)
                              return next
                            })
                          }}
                          onToggleSelect={() => {
                            setSelectedProducts(prev => {
                              const next = new Set(prev)
                              if (next.has(product._index)) next.delete(product._index)
                              else next.add(product._index)
                              return next
                            })
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {(!filteredProducts || filteredProducts.length === 0) && (
                  <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>
                    {searchQuery ? '沒有符合搜尋條件的商品' : '尚無商品資料'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          {!parseResult && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
              <InstructionCard step={1} title="匯出 CSV" desc="Shopline 後台 → 商品管理 → 批量更新 → 匯出 CSV (UTF-8)" />
              <InstructionCard step={2} title="上傳解析" desc="將 CSV 拖放到上方區域，系統自動解析並預覽" />
              <InstructionCard step={3} title="確認匯入" desc="檢查結果、選擇商品、點擊匯入" />
            </div>
          )}
        </div>
      )}

      {/* ═══ Single Add Tab ═══ */}
      {activeTab === 'single' && (
        <SingleProductForm categories={allCategories} />
      )}
    </div>
  )
}

/* ─── Sub Components ─── */

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...cardStyle, borderColor: `${color}33` }}>
      <p style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color }}>{value.toLocaleString()}</p>
    </div>
  )
}

function SortTh({ field, label, current, dir, onToggle }: {
  field: string; label: string; current: string; dir: 'asc' | 'desc'; onToggle: (f: string) => void
}) {
  const isActive = current === field
  return (
    <th
      style={{ ...thStyle, cursor: 'pointer', color: isActive ? '#C19A5B' : undefined }}
      onClick={() => onToggle(field)}
    >
      {label} {isActive ? (dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
}

function ProductTableRow({ product, displayIdx, isExpanded, isSelected, onToggleExpand, onToggleSelect }: {
  product: ParsedProduct & { _index: number }
  displayIdx: number
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
}) {
  const hasErrors = product._errors.length > 0
  const hasWarnings = product._warnings.length > 0

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--theme-elevation-100, #222)', background: hasErrors ? 'rgba(248,113,113,0.05)' : hasWarnings ? 'rgba(251,191,36,0.05)' : undefined }}>
        <td style={tdStyle}>
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        </td>
        <td style={{ ...tdStyle, color: '#888', fontFamily: 'monospace', fontSize: 11 }}>{displayIdx + 1}</td>
        <td style={tdStyle}>
          <button onClick={onToggleExpand} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text, #fff)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{isExpanded ? '▼' : '▶'}</span>
            <span style={{ fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</span>
          </button>
          {product.sku && <span style={{ fontSize: 10, color: '#888', marginLeft: 18 }}>SKU: {product.sku}</span>}
        </td>
        <td style={tdStyle}>
          <span style={{ ...tagStyle, background: product.categorySlug ? 'rgba(193,154,91,0.15)' : 'rgba(136,136,136,0.15)', color: product.categorySlug ? '#C19A5B' : '#888' }}>
            {product.category}
          </span>
        </td>
        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
          {product.price_ntd !== product.original_price_ntd ? (
            <span>
              <span style={{ color: '#C19A5B' }}>NT${product.price_ntd.toLocaleString()}</span>
              <br />
              <span style={{ color: '#888', textDecoration: 'line-through', fontSize: 11 }}>NT${product.original_price_ntd.toLocaleString()}</span>
            </span>
          ) : (
            <span>NT${product.price_ntd.toLocaleString()}</span>
          )}
        </td>
        <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{product.variants.length}</td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {product.colors.slice(0, 3).map(c => (
              <span key={c} style={{ padding: '1px 6px', background: 'var(--theme-elevation-100, #222)', borderRadius: 3, fontSize: 10 }}>{c}</span>
            ))}
            {product.colors.length > 3 && <span style={{ fontSize: 10, color: '#888' }}>+{product.colors.length - 3}</span>}
          </div>
        </td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {product.sizes.map(s => (
              <span key={s} style={{ padding: '1px 6px', background: 'var(--theme-elevation-100, #222)', borderRadius: 3, fontSize: 10 }}>{s}</span>
            ))}
          </div>
        </td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          {hasErrors ? '❌' : hasWarnings ? '⚠️' : '✅'}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0 }}>
            <div style={{ padding: 12, background: 'var(--theme-elevation-50, #1a1a1a)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, fontSize: 12, marginBottom: 8 }}>
                <div><span style={{ color: '#888' }}>摘要：</span><br />{product.short_desc || '—'}</div>
                <div><span style={{ color: '#888' }}>重量：</span><br />{product.weight_kg ? `${product.weight_kg} kg` : '—'}</div>
                <div><span style={{ color: '#888' }}>SEO：</span><br /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.seo_title || '—'}</span></div>
                <div>
                  <span style={{ color: '#888' }}>標籤：</span><br />
                  {product.tags.length > 0 ? product.tags.map(t => (
                    <span key={t} style={{ ...tagStyle, marginRight: 4, fontSize: 10 }}>{t}</span>
                  )) : '—'}
                </div>
              </div>

              {(product._errors.length > 0 || product._warnings.length > 0) && (
                <div style={{ marginBottom: 8 }}>
                  {product._errors.map((e, i) => <p key={`e${i}`} style={{ fontSize: 11, color: '#f87171' }}>❌ {e}</p>)}
                  {product._warnings.map((w, i) => <p key={`w${i}`} style={{ fontSize: 11, color: '#fbbf24' }}>⚠️ {w}</p>)}
                </div>
              )}

              {product.variants.length > 0 && (
                <table style={{ ...tableStyle, fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, fontSize: 11 }}>顏色</th>
                      <th style={{ ...thStyle, fontSize: 11 }}>尺寸</th>
                      <th style={{ ...thStyle, fontSize: 11, textAlign: 'right' }}>價格</th>
                      <th style={{ ...thStyle, fontSize: 11, textAlign: 'right' }}>庫存</th>
                      <th style={{ ...thStyle, fontSize: 11 }}>SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((v, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{v.color}</td>
                        <td style={tdStyle}>{v.size}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>NT${v.price.toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{v.stock}</td>
                        <td style={{ ...tdStyle, color: '#888' }}>{v.sku}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function InstructionCard({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(193,154,91,0.2)', color: '#C19A5B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        {step}
      </div>
      <p style={{ fontWeight: 500, fontSize: 13, marginBottom: 4, color: 'var(--theme-text, #fff)' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#888' }}>{desc}</p>
    </div>
  )
}

/* ─── Single Product Form ─── */
function SingleProductForm({ categories }: { categories: { name: string; slug: string }[] }) {
  const [formData, setFormData] = useState({
    name: '', category: '', price: '', salePrice: '', description: '', weight: '', sku: '', seoTitle: '', seoDescription: '',
  })
  const [variants, setVariants] = useState([{ color: '', size: '', price: '', stock: '0', sku: '' }])
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)

  const updateField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }))
  const updateVariant = (idx: number, key: string, value: string) => setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [key]: value } : v))
  const addVariant = () => setVariants(prev => [...prev, { color: '', size: '', price: '', stock: '0', sku: '' }])
  const removeVariant = (idx: number) => setVariants(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      setSaveResult({ ok: false, message: '請填寫商品名稱和價格' })
      return
    }

    setSaving(true)
    setSaveResult(null)

    try {
      const product: ParsedProduct = {
        id: `single-${Date.now()}`,
        name: formData.name,
        category: categories.find(c => c.slug === formData.category)?.name || '未分類',
        categorySlug: formData.category,
        price_ntd: parseFloat(formData.salePrice) || parseFloat(formData.price),
        original_price_ntd: parseFloat(formData.price),
        colors: [...new Set(variants.map(v => v.color).filter(Boolean))],
        sizes: [...new Set(variants.map(v => v.size).filter(Boolean))],
        short_desc: formData.description,
        full_description: formData.description,
        main_image_url: '',
        product_url: '',
        weight_kg: parseFloat(formData.weight) || 0,
        sku: formData.sku,
        tags: [],
        seo_title: formData.seoTitle || formData.name,
        seo_description: formData.seoDescription,
        variants: variants.filter(v => v.color || v.size).map(v => ({
          color: v.color || '預設',
          size: v.size || 'Free',
          price: parseFloat(v.price) || parseFloat(formData.price),
          stock: parseInt(v.stock) || 0,
          sku: v.sku || formData.sku,
        })),
        _warnings: [],
        _errors: [],
        _rowNumbers: [],
      }

      const res = await fetch('/api/shopline-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: [product], mode: 'create' }),
      })

      const data = await res.json()
      if (res.ok && data.success > 0) {
        setSaveResult({ ok: true, message: `商品「${formData.name}」新增成功！頁面即將重新載入...` })
        setFormData({ name: '', category: '', price: '', salePrice: '', description: '', weight: '', sku: '', seoTitle: '', seoDescription: '' })
        setVariants([{ color: '', size: '', price: '', stock: '0', sku: '' }])
        setTimeout(() => { window.location.reload() }, 2000)
      } else {
        setSaveResult({ ok: false, message: data.error || data.details?.[0]?.message || '新增失敗' })
      }
    } catch (err: unknown) {
      setSaveResult({ ok: false, message: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const fieldRow = (label: string, key: string, type = 'text', placeholder = '') => (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={formData[key as keyof typeof formData]}
        onChange={(e) => updateField(key, e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ maxWidth: 640 }}>
      {saveResult && (
        <div style={{
          padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 13,
          background: saveResult.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${saveResult.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
          color: saveResult.ok ? '#4ade80' : '#f87171',
        }}>
          {saveResult.ok ? '✅' : '❌'} {saveResult.message}
        </div>
      )}

      {/* Basic Info */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--theme-text, #fff)' }}>📦 基本資訊</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {fieldRow('商品名稱 *', 'name')}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>商品分類 *</label>
            <select value={formData.category} onChange={(e) => updateField('category', e.target.value)} style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }}>
              <option value="">選擇分類</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          {fieldRow('原價 (NTD) *', 'price', 'number')}
          {fieldRow('特價 (NTD)', 'salePrice', 'number', '留空表示無特價')}
          {fieldRow('重量 (KG)', 'weight', 'number')}
          {fieldRow('SKU', 'sku')}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>商品描述</label>
          <textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Variants */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--theme-text, #fff)' }}>🎨 商品變體</p>
          <button onClick={addVariant} style={{ fontSize: 12, color: '#C19A5B', background: 'rgba(193,154,91,0.1)', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>
            + 新增變體
          </button>
        </div>
        {variants.map((v, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#888', marginBottom: 2 }}>顏色</label>
              <input value={v.color} onChange={(e) => updateVariant(i, 'color', e.target.value)} placeholder="黑色" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#888', marginBottom: 2 }}>尺寸</label>
              <input value={v.size} onChange={(e) => updateVariant(i, 'size', e.target.value)} placeholder="M" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#888', marginBottom: 2 }}>價格</label>
              <input type="number" value={v.price} onChange={(e) => updateVariant(i, 'price', e.target.value)} placeholder="同主價" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#888', marginBottom: 2 }}>庫存</label>
              <input type="number" value={v.stock} onChange={(e) => updateVariant(i, 'stock', e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#888', marginBottom: 2 }}>SKU</label>
              <input value={v.sku} onChange={(e) => updateVariant(i, 'sku', e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ paddingBottom: 2 }}>
              {variants.length > 1 && (
                <button onClick={() => removeVariant(i)} style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
                  移除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* SEO */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--theme-text, #fff)' }}>🏷 SEO 設定</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {fieldRow('SEO 標題', 'seoTitle', 'text', '留空使用商品名稱')}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>SEO 描述</label>
            <textarea
              value={formData.seoDescription}
              onChange={(e) => updateField('seoDescription', e.target.value)}
              rows={2}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{ ...btnPrimary, width: '100%', justifyContent: 'center', padding: '10px 16px', opacity: saving ? 0.5 : 1 }}
      >
        {saving ? '⏳ 儲存中...' : '📥 新增商品到資料庫'}
      </button>
    </div>
  )
}
