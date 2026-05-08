'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DefaultCellComponentProps } from 'payload'

/**
 * Admin list view cell — 商品上架狀態一鍵切換
 *
 * 顯示目前 status 的有色 chip；點擊彈出小選單（草稿 / 上架 / 下架）。
 * 選擇後 PATCH /api/products/<id> { status }，成功後 router.refresh() 讓
 * list 重拉。
 *
 * 與 OrderProcessingCellButton 同樣 stop click propagation，避免誤觸 row link。
 */

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  draft: { label: '草稿', bg: '#9ca3af', fg: '#fff' },
  published: { label: '已上架', bg: '#10b981', fg: '#fff' },
  archived: { label: '已下架', bg: '#ef4444', fg: '#fff' },
}

const NEXT_STATUS: Array<{ value: string; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已上架' },
  { value: 'archived', label: '已下架' },
]

export default function ProductStatusCell(props: DefaultCellComponentProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const rowData = props.rowData as Record<string, unknown> | undefined
  const productId = rowData?.id as string | number | undefined
  const status = ((rowData?.status as string | undefined) ?? 'draft') as string
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft

  const togglePublish = async (newStatus: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!productId || busy || newStatus === status) {
      setMenuOpen(false)
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { errors?: { message: string }[]; message?: string }
          | null
        const msg =
          body?.errors?.[0]?.message || body?.message || `HTTP ${res.status}`
        alert(`狀態切換失敗：${msg}`)
        return
      }

      router.refresh()
    } catch (err) {
      console.error('[ProductStatusCell] error:', err)
      alert('狀態切換失敗，請檢查網路後重試')
    } finally {
      setBusy(false)
      setMenuOpen(false)
    }
  }

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={openMenu}
        disabled={busy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 10px',
          background: cfg.bg,
          color: cfg.fg,
          border: 'none',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
        title="點擊切換上架狀態"
      >
        {busy ? '…' : cfg.label}
        <span aria-hidden style={{ fontSize: 9, opacity: 0.85 }}>▾</span>
      </button>

      {menuOpen && (
        <>
          {/* backdrop 攔截外點關閉 */}
          <span
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuOpen(false)
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'transparent',
              zIndex: 9998,
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              minWidth: 110,
              background: 'var(--theme-elevation-0, #fff)',
              border: '1px solid var(--theme-elevation-150, #e4e4e7)',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              zIndex: 9999,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {NEXT_STATUS.map((opt) => {
              const optCfg = STATUS_CONFIG[opt.value]
              const isCurrent = opt.value === status
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => togglePublish(opt.value, e)}
                  disabled={isCurrent || busy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    background: 'transparent',
                    color: isCurrent ? '#888' : 'var(--theme-text, #333)',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: isCurrent || busy ? 'default' : 'pointer',
                    textAlign: 'left',
                    opacity: isCurrent ? 0.55 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent && !busy) {
                      ;(e.currentTarget as HTMLElement).style.background =
                        'var(--theme-elevation-50, #f4f4f5)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background =
                      'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: optCfg?.bg ?? '#999',
                      flexShrink: 0,
                    }}
                  />
                  {opt.label}
                  {isCurrent && (
                    <span
                      style={{ marginLeft: 'auto', fontSize: 10, color: '#888' }}
                    >
                      目前
                    </span>
                  )}
                </button>
              )
            })}
          </span>
        </>
      )}
    </span>
  )
}
