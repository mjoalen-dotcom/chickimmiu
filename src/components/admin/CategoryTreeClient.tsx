'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'

/**
 * CategoryTreeClient
 * ──────────────────
 * Shopline 風格的分類樹管理介面（拖曳變 parent / 排序 + 4 個行動按鈕）。
 *
 * 操作：
 *   - 拖曳列上半 (before-zone) = 放到該列「之前」（同層）
 *   - 拖曳列下半 (into-zone)   = 放到該列「之內」（變子分類，level 自動推導）
 *   - 最底部的 root drop zone  = 變成頂層分類尾端
 *   - 展開/收合箭頭切換 expand
 *   - 4 個行動：啟用 toggle / 查閱 (frontend 新分頁) / 編輯 (admin edit page) / 刪除 (confirm)
 *
 * 儲存：不 autosave；改完按「保存結構」一次 POST /api/categories/reorder 批次。
 */

type Category = {
  id: string | number
  name: string
  slug: string
  parent: string | number | null
  level: '1' | '2' | '3'
  sortOrder: number
  isActive: boolean
  icon?: string | null
  productCount?: number
}

type DropTarget =
  | { kind: 'before'; targetId: string }
  | { kind: 'into'; targetId: string }
  | { kind: 'root-end' }
  | null

const MAX_LEVEL = 3

function CategoryTreeClient() {
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget>(null)
  const [toggleBusy, setToggleBusy] = useState<Set<string>>(new Set())
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/categories?limit=500&depth=0&sort=sortOrder', {
        credentials: 'include',
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = (await r.json()) as { docs?: unknown[] }
      const docs = Array.isArray(data.docs) ? data.docs : []
      const parsed: Category[] = docs.map((raw) => {
        const d = raw as Record<string, unknown>
        const parentRaw = d.parent
        const parentId =
          parentRaw && typeof parentRaw === 'object'
            ? ((parentRaw as { id?: string | number }).id ?? null)
            : (parentRaw as string | number | null) ?? null
        const level = (d.level as string) || '1'
        return {
          id: d.id as string | number,
          name: (d.name as string) || '(未命名)',
          slug: (d.slug as string) || '',
          parent: parentId,
          level: (level === '1' || level === '2' || level === '3' ? level : '1') as
            | '1'
            | '2'
            | '3',
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
          isActive: Boolean(d.isActive),
          icon: (d.icon as string) || null,
          productCount: typeof d.productCount === 'number' ? d.productCount : 0,
        }
      })
      // Stable sort: by parent chain then sortOrder then name
      parsed.sort((a, b) => {
        if (String(a.parent ?? '') !== String(b.parent ?? '')) {
          return String(a.parent ?? '').localeCompare(String(b.parent ?? ''))
        }
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
        return a.name.localeCompare(b.name, 'zh-Hant')
      })
      setItems(parsed)
      // Default: collapsed at scale; 若 ≤ 30 筆就展到 L2
      if (parsed.length <= 30) {
        const defaultExpand = new Set<string>()
        for (const it of parsed) if (it.level === '1') defaultExpand.add(String(it.id))
        setExpanded(defaultExpand)
      } else {
        setExpanded(new Set())
      }
      setDirty(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Build parent→children map & DFS order for rendering
  const { childrenByParent, orderedRows } = useMemo(() => {
    const byParent = new Map<string, Category[]>()
    for (const it of items) {
      const key = String(it.parent ?? 'ROOT')
      if (!byParent.has(key)) byParent.set(key, [])
      byParent.get(key)!.push(it)
    }
    for (const arr of byParent.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder)

    const rows: { node: Category; depth: number; visible: boolean }[] = []
    const walk = (parentKey: string, depth: number, parentVisible: boolean) => {
      const kids = byParent.get(parentKey) || []
      for (const n of kids) {
        const isExpanded = expanded.has(String(n.id))
        rows.push({ node: n, depth, visible: parentVisible })
        walk(String(n.id), depth + 1, parentVisible && isExpanded)
      }
    }
    walk('ROOT', 0, true)
    return { childrenByParent: byParent, orderedRows: rows }
  }, [items, expanded])

  const hasChildren = useCallback(
    (id: string | number) => (childrenByParent.get(String(id))?.length ?? 0) > 0,
    [childrenByParent],
  )

  const toggleExpand = useCallback((id: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      const k = String(id)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }, [])

  // Return set of ids that are descendants of `rootId` (inclusive)
  const subtreeIds = useCallback(
    (rootId: string) => {
      const result = new Set<string>([rootId])
      const queue = [rootId]
      while (queue.length) {
        const cur = queue.shift()!
        const kids = childrenByParent.get(cur) || []
        for (const k of kids) {
          const kid = String(k.id)
          if (!result.has(kid)) {
            result.add(kid)
            queue.push(kid)
          }
        }
      }
      return result
    },
    [childrenByParent],
  )

  const onDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id))
    setDropTarget(null)
  }

  const onDragOver = (e: { over: { id: string | number } | null }) => {
    if (!e.over) {
      setDropTarget(null)
      return
    }
    const overId = String(e.over.id)
    if (overId === 'root-end') {
      setDropTarget({ kind: 'root-end' })
      return
    }
    if (overId.startsWith('before-')) {
      setDropTarget({ kind: 'before', targetId: overId.slice('before-'.length) })
      return
    }
    if (overId.startsWith('into-')) {
      setDropTarget({ kind: 'into', targetId: overId.slice('into-'.length) })
      return
    }
    setDropTarget(null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const sourceId = activeDragId
    setActiveDragId(null)
    const target = dropTarget
    setDropTarget(null)
    if (!sourceId || !target) return

    // Guard: can't drop into self or own descendants
    const srcSubtree = subtreeIds(sourceId)
    if (target.kind !== 'root-end' && srcSubtree.has(target.targetId)) return

    setItems((prev) => {
      const source = prev.find((x) => String(x.id) === sourceId)
      if (!source) return prev

      let newParent: string | number | null = null
      let anchorIndex = -1
      const isBefore = target.kind === 'before'
      const isInto = target.kind === 'into'

      if (target.kind === 'before') {
        const anchor = prev.find((x) => String(x.id) === target.targetId)
        if (!anchor) return prev
        newParent = anchor.parent
      } else if (target.kind === 'into') {
        const anchor = prev.find((x) => String(x.id) === target.targetId)
        if (!anchor) return prev
        // Cap at MAX_LEVEL
        const anchorLevel = parseInt(anchor.level, 10)
        if (anchorLevel >= MAX_LEVEL) return prev
        newParent = anchor.id
      } else {
        newParent = null
      }

      // Recompute level for moved subtree based on new parent chain
      const parentLevel = ((): number => {
        if (newParent === null) return 0
        const p = prev.find((x) => String(x.id) === String(newParent))
        return p ? parseInt(p.level, 10) : 0
      })()

      // Reject if moving subtree would exceed MAX_LEVEL at deepest descendant
      const srcOriginalLevel = parseInt(source.level, 10)
      const depthFromSource = (nodeId: string): number => {
        const kids = prev.filter((x) => String(x.parent ?? '') === nodeId)
        if (kids.length === 0) return 0
        return 1 + Math.max(...kids.map((k) => depthFromSource(String(k.id))))
      }
      const srcTreeDepth = depthFromSource(sourceId)
      const targetDeepestLevel = (parentLevel + 1) + srcTreeDepth
      if (targetDeepestLevel > MAX_LEVEL) return prev

      // Apply: change source.parent, recompute level for entire subtree
      const levelDelta = (parentLevel + 1) - srcOriginalLevel
      const next = prev.map((it) => {
        if (srcSubtree.has(String(it.id))) {
          const cur = parseInt(it.level, 10)
          const nl = Math.max(1, Math.min(MAX_LEVEL, cur + levelDelta))
          if (String(it.id) === sourceId) {
            return { ...it, parent: newParent, level: String(nl) as '1' | '2' | '3' }
          }
          return { ...it, level: String(nl) as '1' | '2' | '3' }
        }
        return it
      })

      // Recompute sortOrder within the new sibling group
      const siblings = next
        .filter((x) => String(x.parent ?? '') === String(newParent ?? ''))
        .filter((x) => String(x.id) !== sourceId)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      let insertIndex = siblings.length
      if (target.kind === 'before') {
        insertIndex = siblings.findIndex((s) => String(s.id) === target.targetId)
        if (insertIndex < 0) insertIndex = siblings.length
      } else if (target.kind === 'into') {
        insertIndex = siblings.length // append to end
      }

      const srcInNext = next.find((x) => String(x.id) === sourceId)!
      const reordered = [...siblings.slice(0, insertIndex), srcInNext, ...siblings.slice(insertIndex)]

      // Reassign sortOrder in steps of 10
      return next.map((it) => {
        if (String(it.parent ?? '') === String(newParent ?? '')) {
          const idx = reordered.findIndex((r) => String(r.id) === String(it.id))
          if (idx >= 0) return { ...it, sortOrder: (idx + 1) * 10 }
        }
        return it
      })
    })
    setDirty(true)
    setSaveResult(null)
    // Helpful: if dropped "into", auto-expand that parent
    if (isIntoTarget(target)) {
      const tid = target.targetId
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(tid)
        return next
      })
    }
  }

  const saveTree = async () => {
    setSaving(true)
    setSaveResult(null)
    try {
      const payload = items.map((it) => ({
        id: it.id,
        parent: it.parent,
        sortOrder: it.sortOrder,
        level: it.level,
      }))
      const r = await fetch('/api/categories/reorder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      })
      const data = (await r.json()) as { success?: boolean; updated?: number; errors?: unknown[]; message?: string }
      if (!r.ok || !data.success) {
        setSaveResult(`❌ 儲存失敗：${data.message ?? 'unknown'}`)
      } else {
        setSaveResult(`✅ 已更新 ${data.updated ?? 0} 筆`)
        setDirty(false)
      }
    } catch (e) {
      setSaveResult(`❌ 網路錯誤：${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (cat: Category) => {
    setToggleBusy((prev) => new Set(prev).add(String(cat.id)))
    try {
      const r = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      })
      if (r.ok) {
        setItems((prev) =>
          prev.map((it) => (String(it.id) === String(cat.id) ? { ...it, isActive: !cat.isActive } : it)),
        )
      } else {
        alert(`切換啟用失敗：HTTP ${r.status}`)
      }
    } finally {
      setToggleBusy((prev) => {
        const next = new Set(prev)
        next.delete(String(cat.id))
        return next
      })
    }
  }

  const deleteCategory = async (cat: Category) => {
    const descendantCount = subtreeIds(String(cat.id)).size - 1
    const msg =
      descendantCount > 0
        ? `確定刪除「${cat.name}」？該分類還有 ${descendantCount} 個子分類，將一併移除。`
        : `確定刪除「${cat.name}」？`
    if (!window.confirm(msg)) return
    setDeleteBusy(String(cat.id))
    try {
      // Delete descendants first (deepest first)
      const sub = Array.from(subtreeIds(String(cat.id)))
      const sorted = sub
        .map((id) => items.find((x) => String(x.id) === id)!)
        .filter(Boolean)
        .sort((a, b) => parseInt(b.level, 10) - parseInt(a.level, 10))
      for (const n of sorted) {
        const r = await fetch(`/api/categories/${n.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!r.ok) {
          alert(`刪除「${n.name}」失敗：HTTP ${r.status}`)
          return
        }
      }
      await load()
    } finally {
      setDeleteBusy(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 32 }}>載入分類中…</div>
  }
  if (error) {
    return (
      <div style={{ padding: 32, color: 'crimson' }}>
        載入失敗：{error}
        <div>
          <button onClick={() => void load()} style={btnStyle}>
            重試
          </button>
        </div>
      </div>
    )
  }

  const activeDragNode = activeDragId
    ? items.find((x) => String(x.id) === activeDragId) ?? null
    : null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <button onClick={() => void load()} style={btnStyle} disabled={saving}>
          ↻ 重新載入
        </button>
        <button
          onClick={() => void saveTree()}
          disabled={!dirty || saving}
          style={{
            ...btnStyle,
            background: dirty ? '#0ea5e9' : '#ccc',
            color: 'white',
            cursor: dirty && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? '儲存中…' : dirty ? '💾 保存結構' : '已儲存'}
        </button>
        <button
          onClick={() => setExpanded(new Set(items.filter((x) => hasChildren(x.id)).map((x) => String(x.id))))}
          style={btnStyle}
          title="展開所有分類"
        >
          ▾ 全部展開
        </button>
        <button onClick={() => setExpanded(new Set())} style={btnStyle} title="收合所有分類">
          ▸ 全部收合
        </button>
        <a
          href="/admin/collections/categories/create"
          style={{ ...btnStyle, textDecoration: 'none' }}
        >
          ＋ 新增分類
        </a>
        {saveResult && (
          <span style={{ fontSize: 13, color: saveResult.startsWith('✅') ? 'green' : 'crimson' }}>
            {saveResult}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#666' }}>
          共 {items.length} 個分類｜頂層 {items.filter((x) => !x.parent).length}
        </span>
      </div>

      <div
        style={{
          fontSize: 12,
          color: '#666',
          marginBottom: 12,
          padding: '8px 12px',
          background: 'var(--theme-elevation-100, #f4f4f5)',
          borderRadius: 6,
          lineHeight: 1.6,
        }}
      >
        拖曳列的<b>上半</b>放到另一列<b>之前</b>（同層）；拖曳列的<b>下半</b>放入另一列內（變子分類）。
        變更不會立即生效，請按「保存結構」。最深支援 3 層。
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div style={{ border: '1px solid var(--theme-elevation-150, #e5e5e5)', borderRadius: 8, overflow: 'hidden' }}>
          {orderedRows.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>尚無分類。</div>
          )}
          {orderedRows
            .filter((r) => r.visible)
            .map((row) => (
              <TreeRow
                key={String(row.node.id)}
                node={row.node}
                depth={row.depth}
                expanded={expanded.has(String(row.node.id))}
                hasKids={hasChildren(row.node.id)}
                onToggleExpand={() => toggleExpand(row.node.id)}
                onToggleActive={() => void toggleActive(row.node)}
                onDelete={() => void deleteCategory(row.node)}
                toggling={toggleBusy.has(String(row.node.id))}
                deleting={deleteBusy === String(row.node.id)}
                isBeforeActive={
                  dropTarget?.kind === 'before' && dropTarget.targetId === String(row.node.id)
                }
                isIntoActive={
                  dropTarget?.kind === 'into' && dropTarget.targetId === String(row.node.id)
                }
                isDragging={activeDragId === String(row.node.id)}
              />
            ))}
          <RootEndDropZone active={dropTarget?.kind === 'root-end'} />
        </div>
        <DragOverlay>
          {activeDragNode ? (
            <div
              style={{
                background: 'white',
                padding: '8px 12px',
                border: '1px solid #0ea5e9',
                borderRadius: 6,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                fontSize: 14,
                fontWeight: 600,
                color: '#333',
              }}
            >
              {activeDragNode.icon ? <span style={{ marginRight: 6 }}>{activeDragNode.icon}</span> : null}
              {activeDragNode.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function isIntoTarget(t: DropTarget): t is { kind: 'into'; targetId: string } {
  return !!t && t.kind === 'into'
}

/** One row = drag source (entire row) + 2 droppable zones (top half = before, bottom half = into) */
function TreeRow({
  node,
  depth,
  expanded,
  hasKids,
  onToggleExpand,
  onToggleActive,
  onDelete,
  toggling,
  deleting,
  isBeforeActive,
  isIntoActive,
  isDragging,
}: {
  node: Category
  depth: number
  expanded: boolean
  hasKids: boolean
  onToggleExpand: () => void
  onToggleActive: () => void
  onDelete: () => void
  toggling: boolean
  deleting: boolean
  isBeforeActive: boolean
  isIntoActive: boolean
  isDragging: boolean
}) {
  const drag = useDraggable({ id: String(node.id) })
  const beforeDrop = useDroppable({ id: `before-${node.id}` })
  const intoDrop = useDroppable({ id: `into-${node.id}` })

  return (
    <div
      style={{
        position: 'relative',
        borderBottom: '1px solid var(--theme-elevation-100, #f1f1f1)',
        background: isDragging ? 'rgba(14,165,233,0.05)' : 'white',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* before-zone (top half) */}
      <div
        ref={beforeDrop.setNodeRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          zIndex: 2,
          borderTop: isBeforeActive ? '3px solid #0ea5e9' : '3px solid transparent',
          pointerEvents: 'auto',
        }}
      />
      {/* into-zone (bottom half) */}
      <div
        ref={intoDrop.setNodeRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          zIndex: 2,
          background: isIntoActive ? 'rgba(14,165,233,0.15)' : 'transparent',
          pointerEvents: 'auto',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          paddingLeft: 12 + depth * 24,
          fontSize: 14,
          gap: 8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* drag handle */}
        <span
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          title="拖曳移動"
          style={{
            cursor: 'grab',
            color: '#999',
            padding: '4px 6px',
            userSelect: 'none',
            fontFamily: 'monospace',
            fontSize: 14,
          }}
        >
          ≡
        </span>

        {/* expand/collapse */}
        {hasKids ? (
          <button
            onClick={onToggleExpand}
            style={{
              width: 20,
              height: 20,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              color: '#666',
              padding: 0,
            }}
            aria-label={expanded ? '收合' : '展開'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 20 }} />
        )}

        {/* icon/emoji */}
        {node.icon ? <span style={{ fontSize: 16 }}>{node.icon}</span> : null}

        {/* name + slug */}
        <span style={{ fontWeight: 600, color: node.isActive ? '#111' : '#999' }}>
          {node.name}
        </span>
        <span style={{ color: '#999', fontSize: 12 }}>/{node.slug}</span>
        <span
          style={{
            background: 'var(--theme-elevation-100, #f4f4f5)',
            color: '#666',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
          }}
        >
          L{node.level}
        </span>
        {typeof node.productCount === 'number' && node.productCount > 0 ? (
          <span style={{ color: '#999', fontSize: 12 }}>({node.productCount} 商品)</span>
        ) : null}

        {/* actions on the right */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* 啟用 toggle */}
          <button
            onClick={onToggleActive}
            disabled={toggling}
            title={node.isActive ? '點擊停用' : '點擊啟用'}
            style={{
              ...btnStyle,
              padding: '4px 10px',
              fontSize: 12,
              background: node.isActive ? '#10b981' : '#e5e5e5',
              color: node.isActive ? 'white' : '#666',
              border: 'none',
              minWidth: 60,
            }}
          >
            {toggling ? '…' : node.isActive ? '啟用中' : '已停用'}
          </button>
          {/* 查閱 */}
          <a
            href={`/category/${node.slug}`}
            target="_blank"
            rel="noreferrer"
            title="在前台查閱"
            style={{ ...actionIconStyle, textDecoration: 'none' }}
          >
            👁
          </a>
          {/* 編輯 */}
          <a
            href={`/admin/collections/categories/${node.id}`}
            title="進入編輯頁"
            style={{ ...actionIconStyle, textDecoration: 'none' }}
          >
            ✎
          </a>
          {/* 刪除 */}
          <button
            onClick={onDelete}
            disabled={deleting}
            title="刪除"
            style={{
              ...actionIconStyle,
              color: '#dc2626',
              border: '1px solid #fecaca',
            }}
          >
            {deleting ? '…' : '🗑'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RootEndDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'root-end' })
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '16px 12px',
        textAlign: 'center',
        fontSize: 12,
        color: active ? '#0ea5e9' : '#999',
        background: active ? 'rgba(14,165,233,0.08)' : 'transparent',
        borderTop: active ? '2px dashed #0ea5e9' : '2px dashed transparent',
        transition: 'all 120ms',
      }}
    >
      ↓ 拖到此處變成頂層分類尾端
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 13,
  border: '1px solid var(--theme-elevation-200, #ddd)',
  borderRadius: 6,
  background: 'white',
  color: '#333',
  cursor: 'pointer',
}

const actionIconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: '1px solid var(--theme-elevation-200, #ddd)',
  borderRadius: 6,
  background: 'white',
  color: '#555',
  cursor: 'pointer',
  fontSize: 14,
}

export default CategoryTreeClient
