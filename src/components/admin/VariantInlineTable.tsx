'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useField, useFormFields } from '@payloadcms/ui'

type VariantValue = {
  id?: string
  colorName?: string
  colorCode?: string
  colorSwatch?: unknown
  size?: string
  sku?: string
  stock?: number
  priceOverride?: number
  gtin?: string
}

type VariantRow = VariantValue & {
  __key: string
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function mediaId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.id == null) return null
    return String(record.id)
  }
  return null
}

function rowKey(row: VariantValue, index: number): string {
  if (row.id) return `id-${row.id}`
  const sku = toText(row.sku).trim()
  if (sku) return `sku-${sku}-${index}`
  return `row-${index}`
}

function sanitizeRows(rows: VariantRow[]): VariantValue[] {
  return rows.map(({ __key, ...rest }) => ({ ...rest }))
}

function buildRows(value: unknown): VariantRow[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const row = (item ?? {}) as VariantValue
    return {
      ...row,
      __key: rowKey(row, index),
    }
  })
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString('zh-TW')
}

const wrapperStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-200, #d4d4d8)',
  borderRadius: 8,
  background: 'var(--theme-elevation-0, #fff)',
  margin: '10px 0 16px',
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  padding: 12,
  borderBottom: '1px solid var(--theme-elevation-150, #e4e4e7)',
  background: 'var(--theme-elevation-50, #fafafa)',
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-250, #c4c4cf)',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  background: 'var(--theme-elevation-0, #fff)',
}

const actionBtn: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-250, #c4c4cf)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  background: 'var(--theme-elevation-0, #fff)',
}

function SwatchPreview({ url, colorCode }: { url?: string; colorCode?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt="色塊"
        width={32}
        height={32}
        style={{
          width: 32,
          height: 32,
          objectFit: 'cover',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-200, #d4d4d8)',
        }}
      />
    )
  }

  if (colorCode && colorCode.trim()) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 32,
          height: 32,
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-200, #d4d4d8)',
          background: colorCode,
        }}
      />
    )
  }

  return <span style={{ color: 'var(--theme-elevation-500, #71717a)' }}>—</span>
}

function SortableVariantRow({
  row,
  rowIndex,
  swatchUrl,
  isDropTarget,
  onChange,
  onRemove,
}: {
  row: VariantRow
  rowIndex: number
  swatchUrl?: string
  isDropTarget: boolean
  onChange: (index: number, key: keyof VariantValue, value: unknown) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.__key })

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        background: isDropTarget
          ? 'var(--theme-success-100, #dcfce7)'
          : 'var(--theme-elevation-0, #fff)',
      }}
    >
      <td style={{ padding: '8px 6px' }}>
        <button
          type="button"
          style={{ ...actionBtn, padding: '4px 6px', cursor: 'grab' }}
          {...attributes}
          {...listeners}
          title="拖曳排序"
        >
          ↕
        </button>
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input
          style={{ ...inputStyle, width: 100 }}
          value={toText(row.colorName)}
          onChange={(e) => onChange(rowIndex, 'colorName', e.target.value)}
          placeholder="顏色"
        />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input
          style={{ ...inputStyle, width: 92 }}
          value={toText(row.colorCode)}
          onChange={(e) => onChange(rowIndex, 'colorCode', e.target.value)}
          placeholder="#HEX"
        />
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
        <SwatchPreview url={swatchUrl} colorCode={toText(row.colorCode)} />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input
          style={{ ...inputStyle, width: 60 }}
          value={toText(row.size)}
          onChange={(e) => onChange(rowIndex, 'size', e.target.value)}
          placeholder="尺寸"
        />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input
          style={{ ...inputStyle, width: 130 }}
          value={toText(row.sku)}
          onChange={(e) => onChange(rowIndex, 'sku', e.target.value)}
          placeholder="SKU"
        />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input
          type="number"
          min={0}
          style={{ ...inputStyle, width: 70 }}
          value={toText(row.stock ?? 0)}
          onChange={(e) => onChange(rowIndex, 'stock', Number(e.target.value || '0'))}
          placeholder="庫存"
        />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input
          type="number"
          min={0}
          style={{ ...inputStyle, width: 80 }}
          value={toText(row.priceOverride ?? '')}
          onChange={(e) => {
            const raw = e.target.value
            onChange(rowIndex, 'priceOverride', raw === '' ? undefined : Number(raw))
          }}
          placeholder="留空=原價"
        />
      </td>
      <td style={{ padding: '8px 6px' }}>
        <input
          style={{ ...inputStyle, width: 130 }}
          value={toText(row.gtin)}
          onChange={(e) => onChange(rowIndex, 'gtin', e.target.value)}
          placeholder="GTIN"
        />
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
        <button
          type="button"
          style={{ ...actionBtn, color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}
          onClick={() => onRemove(rowIndex)}
        >
          刪除
        </button>
      </td>
    </tr>
  )
}

const VariantInlineTable: React.FC = () => {
  const { value, setValue } = useField<VariantValue[]>({
    path: 'variants',
    hasRows: true,
  })
  const stockValue = useFormFields(([fields]) => fields.stock?.value as unknown)

  const rows = useMemo(() => buildRows(value), [value])
  const [swatchMap, setSwatchMap] = useState<Record<string, string>>({})
  const [batchStock, setBatchStock] = useState<string>('0')
  const [batchPrice, setBatchPrice] = useState<string>('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    const ids = Array.from(
      new Set(
        rows
          .map((row) => mediaId(row.colorSwatch))
          .filter((id): id is string => Boolean(id)),
      ),
    )
    const pending = ids.filter((id) => !swatchMap[id])
    if (pending.length === 0) return

    let cancelled = false
    ;(async () => {
      const updates: Record<string, string> = {}
      await Promise.all(
        pending.map(async (id) => {
          try {
            const res = await fetch(`/api/media/${id}?depth=0`, {
              credentials: 'include',
            })
            if (!res.ok) return
            const json = (await res.json()) as { url?: string }
            if (json.url) updates[id] = json.url
          } catch {
            // 取不到縮圖時保持空白即可
          }
        }),
      )

      if (!cancelled && Object.keys(updates).length > 0) {
        setSwatchMap((prev) => ({ ...prev, ...updates }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rows, swatchMap])

  const applyRows = (nextRows: VariantRow[]) => {
    setValue(sanitizeRows(nextRows))
  }

  const updateRow = (index: number, key: keyof VariantValue, nextValue: unknown) => {
    const nextRows = rows.map((row, i) =>
      i === index ? { ...row, [key]: nextValue } : row,
    )
    applyRows(nextRows)
  }

  const removeRow = (index: number) => {
    const nextRows = rows.filter((_, i) => i !== index)
    applyRows(nextRows)
  }

  const addRow = () => {
    const nextRows: VariantRow[] = [
      ...rows,
      {
        __key: `new-${Date.now()}`,
        colorName: '',
        colorCode: '',
        size: '',
        sku: '',
        stock: 0,
        priceOverride: undefined,
        gtin: '',
      },
    ]
    applyRows(nextRows)
  }

  const bulkSetStock = () => {
    const stock = toNumber(batchStock)
    if (stock == null || stock < 0) {
      window.alert('請輸入大於等於 0 的庫存數字')
      return
    }
    if (
      !window.confirm(`即將影響 ${rows.length} 筆變體，確認把全部庫存設為 ${Math.round(stock)}？`)
    ) {
      return
    }
    applyRows(rows.map((row) => ({ ...row, stock: Math.round(stock) })))
  }

  const bulkSetPrice = () => {
    const price = toNumber(batchPrice)
    if (price == null || price < 0) {
      window.alert('請輸入大於等於 0 的變體價格')
      return
    }
    if (!window.confirm(`即將影響 ${rows.length} 筆變體，確認把全部變體價設為 ${Math.round(price)}？`)) {
      return
    }
    applyRows(rows.map((row) => ({ ...row, priceOverride: Math.round(price) })))
  }

  const bulkClearPrice = () => {
    if (!window.confirm(`即將影響 ${rows.length} 筆變體，確認清空全部變體價？`)) {
      return
    }
    applyRows(rows.map((row) => ({ ...row, priceOverride: undefined })))
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const onDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    const active = String(event.active.id)
    const over = event.over ? String(event.over.id) : null

    setActiveId(null)
    setOverId(null)

    if (!over || active === over) return

    const oldIndex = rows.findIndex((row) => row.__key === active)
    const newIndex = rows.findIndex((row) => row.__key === over)
    if (oldIndex < 0 || newIndex < 0) return

    applyRows(arrayMove(rows, oldIndex, newIndex))
  }

  const activeRow = rows.find((row) => row.__key === activeId) ?? null
  const totalStock = rows.reduce((sum, row) => sum + (toNumber(row.stock) ?? 0), 0)
  const skuCount = new Set(rows.map((row) => toText(row.sku).trim()).filter(Boolean)).size

  return (
    <div style={wrapperStyle}>
      <div style={toolbarStyle}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>批次填入</span>

        <input
          type="number"
          min={0}
          style={{ ...inputStyle, width: 90 }}
          value={batchStock}
          onChange={(e) => setBatchStock(e.target.value)}
          placeholder="庫存 N"
        />
        <button type="button" style={actionBtn} onClick={bulkSetStock}>
          全部庫存設為 [N]
        </button>

        <input
          type="number"
          min={0}
          style={{ ...inputStyle, width: 110 }}
          value={batchPrice}
          onChange={(e) => setBatchPrice(e.target.value)}
          placeholder="變體價 N"
        />
        <button type="button" style={actionBtn} onClick={bulkSetPrice}>
          全部變體價設為 [N]
        </button>
        <button type="button" style={actionBtn} onClick={bulkClearPrice}>
          全部變體價清空
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: 'var(--theme-elevation-50, #fafafa)' }}>
              <tr>
                <th style={{ padding: '8px 6px' }}>排序</th>
                <th style={{ padding: '8px 6px' }}>顏色名稱</th>
                <th style={{ padding: '8px 6px' }}>色碼</th>
                <th style={{ padding: '8px 6px' }}>色塊預覽</th>
                <th style={{ padding: '8px 6px' }}>尺寸</th>
                <th style={{ padding: '8px 6px' }}>SKU</th>
                <th style={{ padding: '8px 6px' }}>庫存</th>
                <th style={{ padding: '8px 6px' }}>變體價</th>
                <th style={{ padding: '8px 6px' }}>GTIN</th>
                <th style={{ padding: '8px 6px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              <SortableContext
                items={rows.map((row) => row.__key)}
                strategy={verticalListSortingStrategy}
              >
                {rows.map((row, index) => {
                  const sid = mediaId(row.colorSwatch)
                  const swatchUrl = sid ? swatchMap[sid] : undefined
                  return (
                    <SortableVariantRow
                      key={row.__key}
                      row={row}
                      rowIndex={index}
                      swatchUrl={swatchUrl}
                      isDropTarget={Boolean(overId && overId === row.__key && activeId !== row.__key)}
                      onChange={updateRow}
                      onRemove={removeRow}
                    />
                  )
                })}
              </SortableContext>
            </tbody>
          </table>

          <DragOverlay>
            {activeRow ? (
              <div
                style={{
                  pointerEvents: 'none',
                  border: '1px solid var(--theme-elevation-300, #a1a1aa)',
                  borderRadius: 8,
                  background: 'var(--theme-elevation-0, #fff)',
                  padding: '6px 10px',
                  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {toText(activeRow.colorName) || '未命名顏色'} / {toText(activeRow.size) || '未填尺寸'} /{' '}
                {toText(activeRow.sku) || '未填 SKU'}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div
        style={{
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--theme-elevation-150, #e4e4e7)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <button type="button" style={actionBtn} onClick={addRow}>
          + 新增變體
        </button>
        <div style={{ fontSize: 12, color: 'var(--theme-elevation-700, #3f3f46)' }}>
          合計 {formatInt(totalStock)} 件 / {formatInt(skuCount)} 個 SKU
          {typeof stockValue === 'number' ? `（總庫存欄位：${formatInt(stockValue)}）` : ''}
        </div>
      </div>
    </div>
  )
}

export default VariantInlineTable
