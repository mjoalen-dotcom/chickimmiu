'use client'

import React, { useEffect, useState } from 'react'

/**
 * LinkIntegrityClient — /admin/diagnostics/link-integrity 的純 client 互動層。
 *
 * Server wrapper：LinkIntegrityView.tsx
 * 資料源：GET /api/products/admin/link-integrity-scan（src/endpoints/linkIntegrityScan.ts）
 * 重新計算 endpoint：POST /api/categories/recount（src/endpoints/recountCategories.ts）
 * 批次修復 endpoint：POST /api/products/admin/bulk-fix-links（src/endpoints/bulkFixLinks.ts，PR-η）
 *
 * 6 種檢查 + 3 種批次修復（PR-η）：
 *   ① 沒有分類的商品          → 「全部歸到 [選分類]」
 *   ② Orphan 分類引用          → 「全部 orphan 改指向 [選分類]」
 *   ③ 重複 slug                → 「自動加 -2 / -3 後綴（最舊保留原 slug）」
 *   ④ 分類商品數不一致         → 「重新計算分類商品數」(原本就有)
 *   ⑤ 圖片連結斷裂            → 人工
 *   ⑥ 重複 alias slug          → 人工（PR-δ aliasSlugs 是合法欄）
 */

const GOLD = '#C19A5B'
const BORDER = 'var(--theme-elevation-150, #e4e4e7)'
const CARD_BG = 'var(--theme-elevation-0, #fff)'
const TEXT = 'var(--theme-elevation-900, #111)'
const MUTED = 'var(--theme-elevation-600, #666)'
const OK = '#16A34A'
const ERR = '#DC2626'

type ScanResult = {
  generatedAt: string
  totals: { products: number; categories: number }
  productsWithoutCategory: Array<{ id: number; name: string; slug: string }>
  orphanCategoryRefs: Array<{ id: number; name: string; categoryId: string }>
  duplicateSlugs: Array<{ slug: string; count: number; ids: number[] }>
  countMismatch: Array<{ id: number; name: string; stored: number; actual: number }>
  imageBroken: Array<{ id: number; name: string; reason: string }>
  duplicateAliasSlugs: Array<{ slug: string; productIds: number[] }>
}

type CategoryOption = { id: number; name: string; slug?: string }

const cardStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: 20,
  background: CARD_BG,
  marginBottom: 16,
}

const buttonPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: GOLD,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
}

const buttonSecondary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
}

const buttonSmall: React.CSSProperties = {
  padding: '6px 12px',
  background: GOLD,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
}

const buttonDisabled: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 13,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  background: CARD_BG,
  color: TEXT,
}

export default function LinkIntegrityClient() {
  const [busy, setBusy] = useState(false)
  const [recountBusy, setRecountBusy] = useState(false)
  const [data, setData] = useState<ScanResult | null>(null)
  const [err, setErr] = useState('')
  const [recountMsg, setRecountMsg] = useState('')

  // PR-η: categories for dropdowns + bulk-fix state
  const [cats, setCats] = useState<CategoryOption[]>([])
  const [targetForNoCat, setTargetForNoCat] = useState<number | ''>('')
  const [targetForOrphan, setTargetForOrphan] = useState<number | ''>('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  useEffect(() => {
    // 載入分類給 dropdown 用（公開 read，不需 admin gate）
    fetch('/api/categories?limit=1000&depth=0', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((j: { docs?: Array<{ id: number; name: string; slug?: string }> }) => {
        const docs = Array.isArray(j.docs) ? j.docs : []
        const opts = docs
          .map((d) => ({ id: d.id, name: d.name, slug: d.slug }))
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'))
        setCats(opts)
      })
      .catch(() => {
        /* dropdown 沒載到也不影響掃描，下面 button 會 disable */
      })
  }, [])

  const scan = async () => {
    setBusy(true)
    setErr('')
    setRecountMsg('')
    setBulkMsg('')
    try {
      const r = await fetch('/api/products/admin/link-integrity-scan', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!r.ok) {
        const text = await r.text()
        throw new Error(`HTTP ${r.status}：${text.slice(0, 200)}`)
      }
      const j = (await r.json()) as ScanResult
      setData(j)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const recount = async () => {
    if (!confirm('確定要重新計算所有分類的商品數？將更新所有 categories.productCount。')) {
      return
    }
    setRecountBusy(true)
    setRecountMsg('')
    try {
      const r = await fetch('/api/categories/recount', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
      if (r.status === 404) {
        setRecountMsg('未啟用：/api/categories/recount endpoint 尚未上線')
        return
      }
      if (!r.ok) {
        const text = await r.text()
        throw new Error(`HTTP ${r.status}：${text.slice(0, 200)}`)
      }
      const j = (await r.json()) as { changed?: unknown[]; updated?: number }
      const n = Array.isArray(j.changed) ? j.changed.length : (j.updated ?? 0)
      setRecountMsg(`完成：更新 ${n} 個分類`)
      scan()
    } catch (e) {
      setRecountMsg(`錯誤：${(e as Error).message}`)
    } finally {
      setRecountBusy(false)
    }
  }

  // PR-η: 三種批次修復共用 caller
  const callBulkFix = async (
    body: Record<string, unknown>,
    confirmMsg: string,
    successMsg: (j: { updated?: number; renamed?: unknown[] }) => string,
  ) => {
    if (!confirm(confirmMsg)) return
    setBulkBusy(true)
    setBulkMsg('')
    try {
      const r = await fetch('/api/products/admin/bulk-fix-links', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const text = await r.text()
        throw new Error(`HTTP ${r.status}：${text.slice(0, 200)}`)
      }
      const j = (await r.json()) as {
        updated?: number
        renamed?: unknown[]
        errors?: unknown[]
      }
      setBulkMsg(successMsg(j))
      scan() // 自動重新掃描反映新狀態
    } catch (e) {
      setBulkMsg(`錯誤：${(e as Error).message}`)
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkAssignNoCategory = () => {
    if (!data || data.productsWithoutCategory.length === 0) return
    if (typeof targetForNoCat !== 'number') {
      setBulkMsg('請先選一個目標分類')
      return
    }
    const ids = data.productsWithoutCategory.map((p) => p.id)
    const target = cats.find((c) => c.id === targetForNoCat)
    callBulkFix(
      {
        action: 'assign-category',
        productIds: ids,
        toCategoryId: targetForNoCat,
      },
      `將 ${ids.length} 支沒分類的商品全部歸到「${target?.name ?? targetForNoCat}」？`,
      (j) => `① 完成：${j.updated ?? 0} 支商品已歸類`,
    )
  }

  const bulkReplaceOrphan = () => {
    if (!data || data.orphanCategoryRefs.length === 0) return
    if (typeof targetForOrphan !== 'number') {
      setBulkMsg('請先選一個目標分類')
      return
    }
    const target = cats.find((c) => c.id === targetForOrphan)
    callBulkFix(
      {
        action: 'replace-orphan',
        toCategoryId: targetForOrphan,
      },
      `將 ${data.orphanCategoryRefs.length} 支 orphan 商品全部改指向「${target?.name ?? targetForOrphan}」？`,
      (j) => `② 完成：${j.updated ?? 0} 支 orphan 商品已修正`,
    )
  }

  const bulkDedupeSlug = () => {
    if (!data || data.duplicateSlugs.length === 0) return
    const totalDupes = data.duplicateSlugs.reduce((acc, d) => acc + (d.count - 1), 0)
    callBulkFix(
      { action: 'dedupe-slug' },
      `將自動為 ${totalDupes} 支重複 slug 的商品加 -2 / -3 後綴（最舊的保留原 slug）？`,
      (j) => `③ 完成：${j.updated ?? 0} 支商品已改 slug`,
    )
  }

  const total = data
    ? data.productsWithoutCategory.length +
      data.orphanCategoryRefs.length +
      data.duplicateSlugs.length +
      data.countMismatch.length +
      data.imageBroken.length +
      data.duplicateAliasSlugs.length
    : 0

  return (
    <div>
      {/* Toolbar */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={scan}
            disabled={busy}
            style={{ ...buttonPrimary, ...(busy ? buttonDisabled : {}) }}
          >
            {busy ? '掃描中…' : data ? '重新掃描' : '開始掃描'}
          </button>
          {data && (
            <button
              onClick={recount}
              disabled={recountBusy}
              style={{ ...buttonSecondary, ...(recountBusy ? buttonDisabled : {}) }}
              title="呼叫 /api/categories/recount，將每個 category.productCount 重新算"
            >
              {recountBusy ? '計算中…' : '重新計算分類商品數'}
            </button>
          )}
          {data && (
            <span style={{ marginLeft: 'auto', fontSize: 13, color: MUTED }}>
              掃描時間：{new Date(data.generatedAt).toLocaleString('zh-TW')} ｜ 商品 {data.totals.products}{' '}
              ｜ 分類 {data.totals.categories}
            </span>
          )}
        </div>
        {err && (
          <div style={{ marginTop: 12, color: ERR, fontSize: 13 }}>掃描失敗：{err}</div>
        )}
        {recountMsg && (
          <div style={{ marginTop: 12, color: recountMsg.startsWith('錯誤') ? ERR : OK, fontSize: 13 }}>
            {recountMsg}
          </div>
        )}
        {bulkMsg && (
          <div style={{ marginTop: 12, color: bulkMsg.startsWith('錯誤') ? ERR : OK, fontSize: 13 }}>
            {bulkMsg}
          </div>
        )}
      </div>

      {data && (
        <>
          <div style={{ ...cardStyle, background: total === 0 ? '#F0FDF4' : '#FFF7ED' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {total === 0 ? '✅ 全部通過 — 沒有偵測到斷鏈問題' : `⚠️ 共 ${total} 筆問題，請逐一檢視下方各區`}
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: MUTED }}>
              依嚴重度排序：先修「沒有分類」「orphan ref」「重複 slug」這三類（影響 PDP / PLP 路由）；
              「商品數不一致」可一鍵重算；圖片斷裂與 alias 重複可批次清。
            </p>
          </div>

          {/* ① 沒有分類的商品 + 批次按鈕 */}
          <Section
            title="① 沒有分類的商品"
            count={data.productsWithoutCategory.length}
            emptyMsg="✅ 所有商品都有歸類"
            items={data.productsWithoutCategory.map((p) => ({
              text: `${p.name}${p.slug ? ` (${p.slug})` : ''}`,
              href: `/admin/collections/products/${p.id}`,
            }))}
            toolbar={
              data.productsWithoutCategory.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <select
                    style={selectStyle}
                    value={targetForNoCat}
                    onChange={(e) => setTargetForNoCat(e.target.value ? Number(e.target.value) : '')}
                    disabled={bulkBusy || cats.length === 0}
                  >
                    <option value="">選擇目標分類…</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.slug ? ` (${c.slug})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={bulkAssignNoCategory}
                    disabled={bulkBusy || targetForNoCat === '' || cats.length === 0}
                    style={{
                      ...buttonSmall,
                      ...(bulkBusy || targetForNoCat === '' || cats.length === 0
                        ? buttonDisabled
                        : {}),
                    }}
                  >
                    {bulkBusy
                      ? '處理中…'
                      : `全部歸到所選分類 (${data.productsWithoutCategory.length} 支)`}
                  </button>
                </div>
              )
            }
          />

          {/* ② Orphan 分類引用 + 批次按鈕 */}
          <Section
            title="② Orphan 分類引用"
            hint="商品的 category 指向不存在的分類 id（可能是分類被刪掉但商品沒清）"
            count={data.orphanCategoryRefs.length}
            emptyMsg="✅ 沒有 orphan 引用"
            items={data.orphanCategoryRefs.map((p) => ({
              text: `${p.name} → 不存在的 category id ${p.categoryId}`,
              href: `/admin/collections/products/${p.id}`,
            }))}
            toolbar={
              data.orphanCategoryRefs.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <select
                    style={selectStyle}
                    value={targetForOrphan}
                    onChange={(e) => setTargetForOrphan(e.target.value ? Number(e.target.value) : '')}
                    disabled={bulkBusy || cats.length === 0}
                  >
                    <option value="">選擇目標分類…</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.slug ? ` (${c.slug})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={bulkReplaceOrphan}
                    disabled={bulkBusy || targetForOrphan === '' || cats.length === 0}
                    style={{
                      ...buttonSmall,
                      ...(bulkBusy || targetForOrphan === '' || cats.length === 0
                        ? buttonDisabled
                        : {}),
                    }}
                  >
                    {bulkBusy
                      ? '處理中…'
                      : `全部 orphan 改指向所選分類 (${data.orphanCategoryRefs.length} 支)`}
                  </button>
                </div>
              )
            }
          />

          {/* ③ 重複 slug + 批次按鈕 */}
          <Section
            title="③ 重複 slug"
            hint="同 slug 有多支商品 → PDP 路由不確定命中哪一個"
            count={data.duplicateSlugs.length}
            emptyMsg="✅ 沒有重複 slug"
            items={data.duplicateSlugs.map((d) => ({
              text: `slug='${d.slug}' 出現 ${d.count} 次：products [${d.ids.join(', ')}]`,
              href:
                d.ids.length > 0
                  ? `/admin/collections/products/${d.ids[0]}`
                  : '#',
            }))}
            toolbar={
              data.duplicateSlugs.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={bulkDedupeSlug}
                    disabled={bulkBusy}
                    style={{
                      ...buttonSmall,
                      ...(bulkBusy ? buttonDisabled : {}),
                    }}
                  >
                    {bulkBusy ? '處理中…' : '自動加 -2 / -3 後綴（保留最舊那支原 slug）'}
                  </button>
                  <span style={{ fontSize: 12, color: MUTED }}>
                    依 createdAt ASC 排序，最舊保留原 slug；其餘自動加數字後綴
                  </span>
                </div>
              )
            }
          />

          <Section
            title="④ 分類商品數不一致"
            hint="categories.productCount 與實際 published 商品數不符；可用上方「重新計算分類商品數」一鍵修"
            count={data.countMismatch.length}
            emptyMsg="✅ 所有分類商品數正確"
            items={data.countMismatch.map((m) => ({
              text: `${m.name}：存 ${m.stored} / 實際 ${m.actual}（差 ${m.actual - m.stored}）`,
              href: `/admin/collections/categories/${m.id}`,
            }))}
          />

          <Section
            title="⑤ 圖片連結斷裂"
            hint="商品圖庫某張的 media ref 是 null（媒體可能被刪除）"
            count={data.imageBroken.length}
            emptyMsg="✅ 沒有斷裂的商品圖"
            items={data.imageBroken.map((b) => ({
              text: `${b.name} — ${b.reason}`,
              href: `/admin/collections/products/${b.id}`,
            }))}
          />

          <Section
            title="⑥ 重複 alias slug"
            hint="aliasSlugs 在多個 product 出現相同 slug（PR-δ 啟用後才有資料）"
            count={data.duplicateAliasSlugs.length}
            emptyMsg="✅ 沒有重複 alias（或 PR-δ 尚未啟用）"
            items={data.duplicateAliasSlugs.map((a) => ({
              text: `${a.slug} → products [${a.productIds.join(', ')}]`,
              href:
                a.productIds.length > 0
                  ? `/admin/collections/products/${a.productIds[0]}`
                  : '#',
            }))}
          />
        </>
      )}

      {!data && !busy && !err && (
        <div style={{ ...cardStyle, color: MUTED, fontSize: 14 }}>
          按上方「開始掃描」進行檢查。掃描會跑 6 個項目，封測量級下約 5–15 秒。
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  hint,
  count,
  emptyMsg,
  items,
  toolbar,
}: {
  title: string
  hint?: string
  count: number
  emptyMsg: string
  items: Array<{ text: string; href: string }>
  toolbar?: React.ReactNode
}) {
  const isOk = count === 0
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>{title}</h3>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 999,
            background: isOk ? '#DCFCE7' : '#FEE2E2',
            color: isOk ? OK : ERR,
          }}
        >
          {count}
        </span>
      </div>
      {hint && (
        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: MUTED }}>{hint}</p>
      )}
      {!isOk && toolbar}
      {isOk ? (
        <div style={{ color: OK, fontSize: 13 }}>{emptyMsg}</div>
      ) : (
        <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.7 }}>
          {items.slice(0, 50).map((item, i) => (
            <li key={i}>
              {item.href !== '#' ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: GOLD, textDecoration: 'none' }}
                >
                  {item.text}
                </a>
              ) : (
                <span>{item.text}</span>
              )}
            </li>
          ))}
          {items.length > 50 && (
            <li style={{ color: MUTED, listStyle: 'none', marginTop: 4 }}>
              ……還有 {items.length - 50} 筆，僅顯示前 50
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
