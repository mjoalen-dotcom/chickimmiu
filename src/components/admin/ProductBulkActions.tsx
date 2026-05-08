'use client'

/**
 * ProductBulkActions
 * ──────────────────
 * 顯示於「商品列表」頁面上方的一個快速批次操作面板。
 *
 * 兩個區塊：
 *   1. 「按條件批次」— 上方 6 顆按鈕，掃 DB 找符合條件的商品再切換狀態
 *      (e.g. 所有草稿 → 上架；所有缺貨 → 下架；排程；快取)
 *   2. 「對勾選商品執行」— 下方 7 顆按鈕，對使用者在表格中勾選的 N 筆執行
 *      上架 / 下架 / 草稿 / 刪除 / 改分類 / 改價 / 加標籤
 *
 * 走 Payload v3 SelectionProvider context（BeforeListTable 在 SelectionProvider 子樹內）。
 *
 * 所有批次操作走 Payload 標準 REST API：
 *   PATCH  /api/products?where[...]=...     body 為共用欄位
 *   DELETE /api/products?where[id][in]=...
 */

import React, { useState } from 'react'
import { useSelection } from '@payloadcms/ui'

const panel: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e4e4e7)',
  borderRadius: 8,
  padding: 16,
  margin: '12px 0',
  background: 'var(--theme-elevation-50, #fafafa)',
}

const title: React.CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 600,
}

const btnRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const btn: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  background: 'var(--theme-elevation-0, #fff)',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

type CountResult = { docs?: unknown[]; totalDocs?: number }

async function countWhere(query: string): Promise<number> {
  const res = await fetch(`/api/products?${query}&limit=0&depth=0`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as CountResult
  return data.totalDocs ?? data.docs?.length ?? 0
}

async function bulkPatch(
  query: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; updated?: number; message?: string }> {
  const res = await fetch(`/api/products?${query}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      message:
        (data as { errors?: { message?: string }[]; message?: string })?.errors?.[0]
          ?.message ||
        (data as { message?: string })?.message ||
        `HTTP ${res.status}`,
    }
  }
  const updated =
    (data as { docs?: unknown[] })?.docs?.length ??
    (data as { result?: { docs?: unknown[] } })?.result?.docs?.length ??
    0
  return { ok: true, updated }
}

type SelectionContext = {
  count?: number
  getQueryParams?: (additional?: Record<string, unknown>) => string
  selectedIDs?: (string | number)[]
}

type CategoryOption = {
  id: string
  name: string
}

type ProductLite = {
  id: string
  name: string
  price: number
  productSku?: string
  tags?: Array<{ tag?: string }>
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function splitTagInput(value: string): string[] {
  return value
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const output: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size))
  }
  return output
}

const ProductBulkActions: React.FC = () => {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const selection = useSelection() as SelectionContext
  const selectedCount = selection?.count ?? 0
  const selectedIDs = selection?.selectedIDs ?? []
  const getQueryParams = selection?.getQueryParams

  const buildSelectedQuery = (): string | null => {
    if (selectedCount === 0) return null
    if (typeof getQueryParams === 'function') return getQueryParams()
    if (selectedIDs.length > 0) {
      const params = selectedIDs.map((id, i) => `where[id][in][${i}]=${encodeURIComponent(String(id))}`).join('&')
      return `?${params}`
    }
    return null
  }

  const getSelectedProductIDs = async (): Promise<string[]> => {
    if (selectedIDs.length > 0) {
      return selectedIDs.map((id) => String(id))
    }

    const qs = buildSelectedQuery()
    if (!qs) return []

    const query = qs.startsWith('?') ? qs.slice(1) : qs
    const res = await fetch(`/api/products?${query}&limit=200&depth=0`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`讀取勾選商品失敗（HTTP ${res.status}）`)
    const data = (await res.json().catch(() => ({}))) as { docs?: Array<{ id?: string | number }> }
    return (data.docs ?? [])
      .map((doc) => (doc.id == null ? '' : String(doc.id)))
      .filter(Boolean)
  }

  const fetchProductById = async (id: string): Promise<ProductLite> => {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}?depth=0`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`GET /api/products/${id} 失敗（HTTP ${res.status}）`)
    const data = (await res.json()) as Record<string, unknown>
    return {
      id: String(data.id ?? id),
      name: String(data.name ?? ''),
      price: toNumber(data.price) ?? 0,
      productSku: typeof data.productSku === 'string' ? data.productSku : undefined,
      tags: Array.isArray(data.tags) ? (data.tags as Array<{ tag?: string }>) : [],
    }
  }

  const patchProductById = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        errors?: Array<{ message?: string }>
      }
      throw new Error(data.errors?.[0]?.message || data.message || `HTTP ${res.status}`)
    }
  }

  const patchSelected = async (nextStatus: 'published' | 'archived' | 'draft', label: string) => {
    if (busy) return
    if (selectedCount === 0) {
      setMessage('ℹ️ 請先在下方表格勾選要處理的商品')
      return
    }
    if (
      !window.confirm(
        `將把選定的 ${selectedCount} 筆商品設為「${label}」，確定嗎？`,
      )
    ) {
      setMessage('已取消')
      return
    }
    const qs = buildSelectedQuery()
    if (!qs) {
      setMessage('❌ 無法取得勾選清單')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/products${qs}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          `❌ 切換失敗：${
            (data as { errors?: { message?: string }[]; message?: string })?.errors?.[0]?.message ||
            (data as { message?: string })?.message ||
            `HTTP ${res.status}`
          }`,
        )
        return
      }
      const updated =
        (data as { docs?: unknown[] })?.docs?.length ??
        (data as { result?: { docs?: unknown[] } })?.result?.docs?.length ??
        selectedCount
      setMessage(`✅ 已將 ${updated} 筆商品設為「${label}」（即將重新整理）`)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async () => {
    if (busy) return
    if (selectedCount === 0) {
      setMessage('ℹ️ 請先在下方表格勾選要刪除的商品')
      return
    }
    if (
      !window.confirm(
        `⚠️ 將永久刪除選定的 ${selectedCount} 筆商品。\n\n此動作無法復原。確定要繼續嗎？`,
      )
    ) {
      setMessage('已取消')
      return
    }
    const second = window.prompt(
      `再次確認：請輸入「刪除 ${selectedCount} 筆」以執行：`,
      '',
    )
    if (second !== `刪除 ${selectedCount} 筆`) {
      setMessage('已取消（確認字串不一致）')
      return
    }
    const qs = buildSelectedQuery()
    if (!qs) {
      setMessage('❌ 無法取得勾選清單')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch(`/api/products${qs}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(
          `❌ 刪除失敗：${
            (data as { errors?: { message?: string }[]; message?: string })?.errors?.[0]?.message ||
            (data as { message?: string })?.message ||
            `HTTP ${res.status}`
          }`,
        )
        return
      }
      const removed =
        (data as { docs?: unknown[] })?.docs?.length ??
        (data as { result?: { docs?: unknown[] } })?.result?.docs?.length ??
        selectedCount
      setMessage(`✅ 已刪除 ${removed} 筆商品（即將重新整理）`)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const openCategoryModal = async () => {
    if (busy) return
    if (selectedCount === 0) {
      setMessage('ℹ️ 請先勾選要改分類的商品')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/categories?limit=200&depth=0&sort=name', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json().catch(() => ({}))) as {
        docs?: Array<{ id?: string | number; name?: string }>
      }
      const options = (data.docs ?? [])
        .map((doc) => ({
          id: doc.id == null ? '' : String(doc.id),
          name: doc.name || '(未命名分類)',
        }))
        .filter((item) => item.id)

      if (options.length === 0) {
        setMessage('❌ 找不到可用分類')
        return
      }

      setCategories(options)
      setSelectedCategoryId(options[0].id)
      setCategoryModalOpen(true)
    } catch (err) {
      setMessage(`❌ 載入分類失敗：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const applyCategoryChange = async () => {
    if (busy) return
    if (!selectedCategoryId) return

    let ids: string[] = []
    try {
      ids = await getSelectedProductIDs()
    } catch (err) {
      setMessage(`❌ 讀取勾選商品失敗：${err instanceof Error ? err.message : '未知'}`)
      return
    }
    if (ids.length === 0) {
      setMessage('ℹ️ 目前沒有可更新的商品')
      setCategoryModalOpen(false)
      return
    }

    const category = categories.find((item) => item.id === selectedCategoryId)
    const categoryName = category?.name || selectedCategoryId

    if (!window.confirm(`將把 ${ids.length} 筆商品分類改成「${categoryName}」，確定？`)) {
      return
    }

    setBusy(true)
    setMessage('')
    setCategoryModalOpen(false)
    try {
      const query = ids
        .map((id, index) => `where[id][in][${index}]=${encodeURIComponent(id)}`)
        .join('&')

      const res = await fetch(`/api/products?${query}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategoryId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        docs?: unknown[]
        message?: string
        errors?: Array<{ message?: string }>
      }
      if (!res.ok) {
        throw new Error(data.errors?.[0]?.message || data.message || `HTTP ${res.status}`)
      }
      setMessage(`✅ 已把 ${data.docs?.length ?? ids.length} 筆商品改成「${categoryName}」`)
    } catch (err) {
      setMessage(`❌ 改分類失敗：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const bulkChangePrice = async () => {
    if (busy) return
    if (selectedCount === 0) {
      setMessage('ℹ️ 請先勾選要改價的商品')
      return
    }

    const modeInput = window.prompt(
      '請選模式：\na) 全部設為 N\nb) 全部 +N%\nc) 全部 -N%',
      'c',
    )
    if (!modeInput) return
    const mode = modeInput.trim().toLowerCase()
    if (!['a', 'b', 'c'].includes(mode)) {
      setMessage('❌ 模式無效，請輸入 a / b / c')
      return
    }

    const nInput = window.prompt('請輸入 N（a=價格、b/c=百分比）', '10')
    if (!nInput) return
    const n = Number(nInput)
    if (!Number.isFinite(n) || n < 0) {
      setMessage('❌ N 必須是大於等於 0 的數字')
      return
    }

    let ids: string[] = []
    try {
      ids = await getSelectedProductIDs()
    } catch (err) {
      setMessage(`❌ 讀取勾選商品失敗：${err instanceof Error ? err.message : '未知'}`)
      return
    }
    if (ids.length === 0) {
      setMessage('ℹ️ 目前沒有可更新的商品')
      return
    }

    const calcPrice = (base: number): number => {
      if (mode === 'a') return Math.round(n)
      if (mode === 'b') return Math.round(base * (1 + n / 100))
      return Math.max(0, Math.round(base * (1 - n / 100)))
    }

    try {
      const previewRows = await Promise.all(
        ids.slice(0, 3).map(async (id) => {
          const product = await fetchProductById(id)
          return `${product.name || product.productSku || id}: ${product.price} → ${calcPrice(product.price)}`
        }),
      )

      const modeLabel =
        mode === 'a' ? `全部設為 ${n}` : mode === 'b' ? `全部 +${n}%` : `全部 -${n}%`
      if (
        !window.confirm(
          `將對 ${ids.length} 筆商品執行「${modeLabel}」。\n\n樣本：\n${previewRows.join('\n')}\n\n確定繼續？`,
        )
      ) {
        setMessage('已取消')
        return
      }
    } catch (err) {
      setMessage(`❌ 產生改價預覽失敗：${err instanceof Error ? err.message : '未知'}`)
      return
    }

    setBusy(true)
    setMessage('')

    let done = 0
    const failures: string[] = []
    const chunks = chunkArray(ids, 5)

    for (const chunk of chunks) {
      // 並行上限 5，避免一次打爆 API
      await Promise.all(
        chunk.map(async (id) => {
          let product: ProductLite | null = null
          try {
            product = await fetchProductById(id)
            const nextPrice = calcPrice(product.price)
            await patchProductById(id, { price: nextPrice })
          } catch (err) {
            const label = product?.productSku || product?.name || id
            failures.push(`${label}: ${err instanceof Error ? err.message : '未知錯誤'}`)
          } finally {
            done += 1
            setMessage(`⏳ 改價進度：已更新 ${done} / ${ids.length}`)
          }
        }),
      )
    }

    setBusy(false)
    if (failures.length > 0) {
      setMessage(
        `⚠️ 改價完成 ${done}/${ids.length}，失敗 ${failures.length} 筆：${failures.slice(0, 5).join(' | ')}`,
      )
    } else {
      setMessage(`✅ 改價完成，共更新 ${ids.length} 筆`)
    }
  }

  const bulkAddTags = async () => {
    if (busy) return
    if (selectedCount === 0) {
      setMessage('ℹ️ 請先勾選要加標籤的商品')
      return
    }

    const raw = window.prompt('請輸入要加的標籤（逗號分隔，例如：標籤A,標籤B）', '')
    if (raw == null) return
    const tagsToAdd = splitTagInput(raw)
    if (tagsToAdd.length === 0) {
      setMessage('❌ 沒有可加入的標籤')
      return
    }

    let ids: string[] = []
    try {
      ids = await getSelectedProductIDs()
    } catch (err) {
      setMessage(`❌ 讀取勾選商品失敗：${err instanceof Error ? err.message : '未知'}`)
      return
    }
    if (ids.length === 0) {
      setMessage('ℹ️ 目前沒有可更新的商品')
      return
    }

    if (!window.confirm(`將對 ${ids.length} 筆商品加入標籤：${tagsToAdd.join('、')}，確定？`)) {
      setMessage('已取消')
      return
    }

    setBusy(true)
    setMessage('')
    let done = 0
    const failures: string[] = []

    for (const chunk of chunkArray(ids, 5)) {
      await Promise.all(
        chunk.map(async (id) => {
          let product: ProductLite | null = null
          try {
            product = await fetchProductById(id)
            const existing = (product.tags ?? [])
              .map((row) => (typeof row?.tag === 'string' ? row.tag.trim() : ''))
              .filter(Boolean)
            const merged = Array.from(new Set([...existing, ...tagsToAdd]))
            await patchProductById(id, {
              tags: merged.map((tag) => ({ tag })),
            })
          } catch (err) {
            const label = product?.productSku || product?.name || id
            failures.push(`${label}: ${err instanceof Error ? err.message : '未知錯誤'}`)
          } finally {
            done += 1
            setMessage(`⏳ 加標籤進度：已更新 ${done} / ${ids.length}`)
          }
        }),
      )
    }

    setBusy(false)
    if (failures.length > 0) {
      setMessage(
        `⚠️ 加標籤完成 ${done}/${ids.length}，失敗 ${failures.length} 筆：${failures.slice(0, 5).join(' | ')}`,
      )
    } else {
      setMessage(`✅ 已為 ${ids.length} 筆商品加入標籤：${tagsToAdd.join('、')}`)
    }
  }

  const publishAllDrafts = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[status][equals]=draft'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 目前沒有草稿商品')
        return
      }
      if (!window.confirm(`將把 ${count} 筆草稿商品設為「已上架」，確定要繼續嗎？`)) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'published' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆草稿商品上架`)
      } else {
        setMessage(`❌ 批次上架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const archiveOutOfStock = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[and][0][stock][equals]=0&where[and][1][status][equals]=published'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 沒有庫存為 0 的上架商品')
        return
      }
      if (
        !window.confirm(
          `將把 ${count} 筆「已上架但庫存 0」的商品設為「已下架」，確定嗎？`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'archived' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆缺貨商品下架`)
      } else {
        setMessage(`❌ 批次下架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const archiveByLowStock = async () => {
    if (busy) return
    const input = window.prompt(
      '將把「已上架且庫存 < N」的商品設為下架。請輸入 N（庫存閾值，例：3）',
      '3',
    )
    if (input == null) return
    const threshold = Number(input)
    if (!Number.isFinite(threshold) || threshold < 0) {
      setMessage('❌ 請輸入大於等於 0 的整數')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const query = `where[and][0][stock][less_than]=${threshold}&where[and][1][status][equals]=published`
      const count = await countWhere(query)
      if (count === 0) {
        setMessage(`ℹ️ 沒有「已上架且庫存 < ${threshold}」的商品`)
        return
      }
      if (
        !window.confirm(
          `將把 ${count} 筆「已上架且庫存 < ${threshold}」的商品設為「已下架」，確定嗎？`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'archived' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆低庫存商品下架`)
      } else {
        setMessage(`❌ 批次下架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const archiveAllPublished = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[status][equals]=published'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 目前沒有已上架商品')
        return
      }
      // 雙重確認 — 破壞性大
      if (
        !window.confirm(
          `⚠️ 將把全部 ${count} 筆「已上架」商品全部下架。確定嗎？（此動作會立刻讓前台所有商品消失）`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const second = window.prompt(
        `再次確認：請輸入「下架全部 ${count} 筆」以確認執行：`,
        '',
      )
      if (second !== `下架全部 ${count} 筆`) {
        setMessage('已取消（確認字串不一致）')
        return
      }

      const result = await bulkPatch(query, { status: 'archived' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆商品全部下架`)
      } else {
        setMessage(`❌ 批次下架失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const draftAllArchived = async () => {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const query = 'where[status][equals]=archived'
      const count = await countWhere(query)
      if (count === 0) {
        setMessage('ℹ️ 沒有已下架商品')
        return
      }
      if (
        !window.confirm(
          `將把 ${count} 筆「已下架」商品轉回「草稿」狀態（不會自動上架），確定嗎？`,
        )
      ) {
        setMessage('已取消')
        return
      }
      const result = await bulkPatch(query, { status: 'draft' })
      if (result.ok) {
        setMessage(`✅ 已將 ${result.updated ?? count} 筆商品轉為草稿`)
      } else {
        setMessage(`❌ 批次轉草稿失敗：${result.message}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const applySchedulesNow = async () => {
    if (busy) return
    if (
      !window.confirm(
        '立刻掃描「預定上架/下架時間」並切換符合條件的商品狀態？（也會由 cron 自動跑，這個是手動觸發）',
      )
    ) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/products/apply-schedules', {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        published?: number
        archived?: number
        message?: string
      }
      if (res.ok) {
        setMessage(
          `✅ 排程已執行：上架 ${data.published ?? 0} 筆 / 下架 ${data.archived ?? 0} 筆`,
        )
      } else {
        setMessage(`❌ 排程執行失敗：${data?.message ?? `HTTP ${res.status}`}`)
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const revalidateAll = async () => {
    if (busy) return
    if (!window.confirm('確定要重新產生整個前台快取嗎？（/、/products 會立即更新）')) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/products/revalidate-all', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setMessage('✅ 已觸發全站 revalidate')
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage(
          `❌ Revalidate 失敗：${(data as { message?: string })?.message || `HTTP ${res.status}`}`,
        )
      }
    } catch (err) {
      setMessage(`❌ 錯誤：${err instanceof Error ? err.message : '未知'}`)
    } finally {
      setBusy(false)
    }
  }

  const btnDanger: React.CSSProperties = {
    ...btn,
    background: '#fef2f2',
    borderColor: '#fecaca',
    color: '#b91c1c',
  }
  const btnFeature: React.CSSProperties = {
    ...btn,
    background: 'var(--theme-elevation-100, #f5f5f7)',
    borderColor: 'var(--theme-elevation-250, #c9c9cf)',
  }
  const modalBackdrop: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70,
    padding: 16,
  }
  const modalCard: React.CSSProperties = {
    width: '100%',
    maxWidth: 460,
    borderRadius: 10,
    border: '1px solid var(--theme-elevation-200, #d4d4d8)',
    background: 'var(--theme-elevation-0, #ffffff)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.22)',
    padding: 16,
  }

  const dimWhenIdle: React.CSSProperties = selectedCount === 0 ? { opacity: 0.5 } : {}

  return (
    <div style={panel}>
      <h4 style={title}>⚡ 批次操作</h4>
      <div style={{ ...btnRow, marginBottom: 8 }}>
        <button type="button" style={btn} onClick={publishAllDrafts} disabled={busy}>
          ✅ 批次上架所有草稿
        </button>
        <button type="button" style={btn} onClick={draftAllArchived} disabled={busy}>
          📝 將已下架轉回草稿
        </button>
        <button type="button" style={btn} onClick={applySchedulesNow} disabled={busy}>
          ⏰ 立刻執行排程上下架
        </button>
        <button type="button" style={btn} onClick={revalidateAll} disabled={busy}>
          🔄 全站快取重新生成
        </button>
      </div>
      <div style={btnRow}>
        <button type="button" style={btn} onClick={archiveOutOfStock} disabled={busy}>
          📦 庫存 0 自動下架
        </button>
        <button type="button" style={btn} onClick={archiveByLowStock} disabled={busy}>
          📉 依庫存閾值下架（輸入 N）
        </button>
        <button type="button" style={btnDanger} onClick={archiveAllPublished} disabled={busy}>
          ⚠️ 全部下架（停售/暫停營業用）
        </button>
      </div>

      <hr
        style={{
          margin: '14px 0 10px',
          border: 'none',
          borderTop: '1px dashed var(--theme-elevation-200, #d4d4d8)',
        }}
      />
      <h4 style={title}>
        🎯 對勾選的商品執行
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            fontWeight: 500,
            color: selectedCount > 0 ? 'var(--color-brand-gold, #c19a5b)' : '#888',
          }}
        >
          （已勾選 {selectedCount} 筆）
        </span>
      </h4>
      {selectedCount === 0 && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          ※ 請在下方表格每列最左側的 checkbox 勾選要處理的商品；勾選後再點下面的按鈕。
        </div>
      )}
      <div style={btnRow}>
        <button
          type="button"
          style={{ ...btn, ...dimWhenIdle }}
          onClick={() => patchSelected('published', '已上架')}
          disabled={busy || selectedCount === 0}
        >
          ✅ 上架選定 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btn, ...dimWhenIdle }}
          onClick={() => patchSelected('archived', '已下架')}
          disabled={busy || selectedCount === 0}
        >
          📦 下架選定 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btn, ...dimWhenIdle }}
          onClick={() => patchSelected('draft', '草稿')}
          disabled={busy || selectedCount === 0}
        >
          📝 轉為草稿 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btnDanger, ...dimWhenIdle }}
          onClick={deleteSelected}
          disabled={busy || selectedCount === 0}
        >
          🗑️ 刪除選定 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
      </div>
      <div style={{ ...btnRow, marginTop: 8 }}>
        <button
          type="button"
          style={{ ...btnFeature, ...dimWhenIdle }}
          onClick={openCategoryModal}
          disabled={busy || selectedCount === 0}
        >
          📁 改分類 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btnFeature, ...dimWhenIdle }}
          onClick={bulkChangePrice}
          disabled={busy || selectedCount === 0}
        >
          💰 改價 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
        <button
          type="button"
          style={{ ...btnFeature, ...dimWhenIdle }}
          onClick={bulkAddTags}
          disabled={busy || selectedCount === 0}
        >
          🏷️ 加標籤 {selectedCount > 0 ? `(${selectedCount})` : ''}
        </button>
      </div>

      {categoryModalOpen && (
        <div
          style={modalBackdrop}
          onClick={() => {
            if (!busy) setCategoryModalOpen(false)
          }}
        >
          <div
            style={modalCard}
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <h5 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>📁 批次改分類</h5>
            <p style={{ marginTop: 0, marginBottom: 8, fontSize: 13, color: '#555' }}>
              即將影響 {selectedCount} 筆商品，請先選擇目標分類。
            </p>
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              style={{
                width: '100%',
                marginBottom: 12,
                borderRadius: 6,
                border: '1px solid var(--theme-elevation-250, #c9c9cf)',
                background: 'var(--theme-elevation-0, #ffffff)',
                color: 'var(--theme-text, #222222)',
                padding: '8px 10px',
                fontSize: 14,
              }}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div style={{ ...btnRow, justifyContent: 'flex-end' }}>
              <button type="button" style={btn} onClick={() => setCategoryModalOpen(false)} disabled={busy}>
                取消
              </button>
              <button type="button" style={btnFeature} onClick={applyCategoryChange} disabled={busy}>
                套用分類
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: message.startsWith('✅')
              ? '#0a0'
              : message.startsWith('ℹ️')
                ? '#666'
                : '#c00',
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}

export default ProductBulkActions
