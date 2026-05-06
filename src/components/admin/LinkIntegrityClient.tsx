'use client'

import React, { useState } from 'react'

/**
 * LinkIntegrityClient — Wave 1 PR-ζ
 *
 * 顯示 6 種 link 完整性檢查的結果。資料源：
 *   GET /api/products/admin/link-integrity/scan
 *
 * 「重新計算分類商品數」按鈕串接 PR-γ 的 endpoint：
 *   POST /api/categories/recount
 * PR-γ 未 merge 時 endpoint 不存在 → 顯示提示而非整頁炸掉。
 */

type ScanResult = {
  productsWithoutCategory: Array<{ id: number; name: string; slug: string }>
  orphanCategoryRefs: Array<{ id: number; name: string; categoryId: number }>
  duplicateSlugs: Array<{ slug: string; count: number; ids: number[] }>
  countMismatch: Array<{ id: number; name: string; stored: number; actual: number }>
  imageBroken: Array<{ id: number; name: string; reason: string }>
  duplicateAliasSlugs: Array<{ slug: string; productIds: number[] }>
  scannedAt?: string
  totalProducts?: number
  totalCategories?: number
}

const SCAN_URL = '/api/products/admin/link-integrity/scan'
const RECOUNT_URL = '/api/categories/recount'

const LinkIntegrityClient: React.FC = () => {
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<ScanResult | null>(null)
  const [err, setErr] = useState('')
  const [recountStatus, setRecountStatus] = useState('')

  const scan = async () => {
    setBusy(true)
    setErr('')
    setRecountStatus('')
    try {
      const r = await fetch(SCAN_URL, { credentials: 'include' })
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        throw new Error(`HTTP ${r.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
      }
      const json = (await r.json()) as ScanResult
      setData(json)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const recount = async () => {
    if (!confirm('確定要重新計算所有分類商品數？這會更新 categories.productCount 欄位。')) return
    setRecountStatus('計算中…')
    try {
      const r = await fetch(RECOUNT_URL, { method: 'POST', credentials: 'include' })
      if (!r.ok) {
        if (r.status === 404) {
          setRecountStatus('PR-γ recount endpoint 尚未 merge — 請等該 PR 上線後再試')
          return
        }
        throw new Error(`HTTP ${r.status}`)
      }
      const j = (await r.json()) as { changed?: unknown[] }
      const n = Array.isArray(j.changed) ? j.changed.length : 0
      setRecountStatus(`完成：更新 ${n} 個分類`)
      scan()
    } catch (e) {
      setRecountStatus(`失敗：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={scan}
          disabled={busy}
          style={{
            padding: '8px 16px',
            background: '#C19A5B',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? '掃描中…' : '開始掃描'}
        </button>
        {data && (
          <button
            onClick={recount}
            style={{
              padding: '8px 16px',
              background: '#fff',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            重新計算分類商品數
          </button>
        )}
        {recountStatus && (
          <span style={{ color: recountStatus.includes('失敗') ? 'crimson' : '#555', fontSize: 13 }}>
            {recountStatus}
          </span>
        )}
      </div>

      {err && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: '#fee',
            color: 'crimson',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          錯誤：{err}
        </div>
      )}

      {data && (
        <>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            掃描時間：{data.scannedAt ?? '—'} · 商品 {data.totalProducts ?? '?'} 筆 · 分類{' '}
            {data.totalCategories ?? '?'} 筆
          </div>
          <div style={{ display: 'grid', gap: 24 }}>
            <Section
              title={`沒有分類的商品 (${data.productsWithoutCategory.length})`}
              hint="商品必須屬於某分類；遺漏的商品會在前台 Category route 看不到。"
              items={data.productsWithoutCategory.map((p) => ({
                text: `${p.name} (${p.slug})`,
                href: `/admin/collections/products/${p.id}`,
              }))}
            />
            <Section
              title={`Orphan 分類引用 (${data.orphanCategoryRefs.length})`}
              hint="商品的 category 指向已被刪除的分類 id；前台 PDP 麵包屑會炸。"
              items={data.orphanCategoryRefs.map((p) => ({
                text: `${p.name} → 不存在的 category id ${p.categoryId}`,
                href: `/admin/collections/products/${p.id}`,
              }))}
            />
            <Section
              title={`重複 slug (${data.duplicateSlugs.length})`}
              hint="商品 slug 應 unique；DB constraint 應該已擋，但 legacy data 可能漏。"
              items={data.duplicateSlugs.map((d) => ({
                text: `slug='${d.slug}' 出現 ${d.count} 次：products [${d.ids.join(', ')}]`,
                href: '#',
              }))}
            />
            <Section
              title={`分類商品數不一致 (${data.countMismatch.length})`}
              hint="categories.productCount（顯示用）與實際 COUNT 不符。點上方「重新計算」可一鍵修。"
              items={data.countMismatch.map((m) => ({
                text: `${m.name}: 存 ${m.stored} / 實際 ${m.actual}`,
                href: `/admin/collections/categories/${m.id}`,
              }))}
            />
            <Section
              title={`圖片破損 (${data.imageBroken.length})`}
              hint="抽樣前 100 筆檢查；image.url 為空或商品無圖片。完整檢查請另跑批次工具。"
              items={data.imageBroken.map((b) => ({
                text: `${b.name} — ${b.reason}`,
                href: `/admin/collections/products/${b.id}`,
              }))}
            />
            <Section
              title={`重複 alias slug (${data.duplicateAliasSlugs.length})`}
              hint="PR-δ aliasSlugs 同一個 slug 被多商品宣告會造成 PDP 跳錯商品。PR-δ 未 merge 時恆為空。"
              items={data.duplicateAliasSlugs.map((a) => ({
                text: `${a.slug} → products [${a.productIds.join(', ')}]`,
                href: '#',
              }))}
            />
          </div>
        </>
      )}
    </div>
  )
}

function Section({
  title,
  hint,
  items,
}: {
  title: string
  hint?: string
  items: Array<{ text: string; href: string }>
}) {
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 4, fontWeight: 600 }}>{title}</h3>
      {hint && <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{hint}</div>}
      {items.length === 0 ? (
        <div style={{ color: 'green', fontSize: 14 }}>✓ 沒問題</div>
      ) : (
        <ul style={{ paddingLeft: 16, margin: 0 }}>
          {items.slice(0, 50).map((item, i) => (
            <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>
              {item.href !== '#' ? (
                <a href={item.href} target="_blank" rel="noreferrer" style={{ color: '#0070f3' }}>
                  {item.text}
                </a>
              ) : (
                item.text
              )}
            </li>
          ))}
          {items.length > 50 && (
            <li style={{ fontSize: 13, color: '#666' }}>...還有 {items.length - 50} 筆，僅顯示前 50</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default LinkIntegrityClient
