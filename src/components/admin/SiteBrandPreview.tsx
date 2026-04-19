'use client'

import React, { useEffect, useState } from 'react'

/**
 * SiteBrandPreview
 * ----------------
 * 掛在 GlobalSettings.site group 頂部的 UI 欄位，呈現目前前台正在使用的
 * 四個品牌資產（Logo / Favicon / Apple Touch / OG Image）。
 *
 * 設計選擇：CLIENT component（非 server component）
 * - Payload v3 的 admin.components.Field 對 async server component 支援不穩
 *   （實測會卡住整個 form 的 field 串流，導致同層其他 field 都不渲染）
 * - 改用 client component + fetch /api/globals/global-settings 規避該問題
 */

interface MediaShape {
  url?: string
  filename?: string
  mimeType?: string
  filesize?: number
  width?: number
  height?: number
  alt?: string
}

interface BrandSlot {
  key: 'logo' | 'favicon' | 'appleTouchIcon' | 'ogImage'
  label: string
  recommended: string
  recommendedNote: string
}

const SLOTS: BrandSlot[] = [
  {
    key: 'logo',
    label: '網站 Logo',
    recommended: '建議：橫式 480-800 × 96-160 像素',
    recommendedNote: 'SVG 最佳（可任意放大）或透明背景 PNG',
  },
  {
    key: 'favicon',
    label: 'Favicon（瀏覽器分頁圖示）',
    recommended: '建議：32×32 或 64×64 像素',
    recommendedNote: '.ico 多尺寸最佳；.png 也可',
  },
  {
    key: 'appleTouchIcon',
    label: 'Apple Touch Icon',
    recommended: '建議：180×180 像素 PNG',
    recommendedNote: 'iOS / iPadOS 加入主畫面圖示，背景需不透明',
  },
  {
    key: 'ogImage',
    label: '社群分享圖（OG Image）',
    recommended: '建議：1200×630 像素（2:1）',
    recommendedNote: 'Facebook / X / LINE 預覽圖，JPG 或 PNG，建議 < 1 MB',
  },
]

function formatBytes(n?: number): string {
  if (!n || n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function isMedia(v: unknown): v is MediaShape {
  return Boolean(v) && typeof v === 'object' && typeof (v as MediaShape).url === 'string'
}

export default function SiteBrandPreview() {
  const [site, setSite] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/globals/global-settings?depth=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        setSite((data?.site as Record<string, unknown>) || {})
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setErr(String(e?.message || e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      style={{
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid var(--theme-elevation-100, #e5e7eb)',
      }}
    >
      <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>目前前台品牌資產</h4>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 12,
          color: 'var(--theme-text-light, #6b7280)',
          lineHeight: 1.5,
        }}
      >
        以下顯示各欄位目前生效的檔案。修改下方 upload 欄位、點「Save」存檔後，
        前台 header 與後台 top-nav 會自動同步更新。
      </p>

      {loading && (
        <div style={{ padding: 8, fontSize: 12, color: 'var(--theme-text-light, #9ca3af)' }}>
          載入中…
        </div>
      )}

      {err && (
        <div
          style={{
            padding: 8,
            fontSize: 12,
            color: 'var(--theme-error-500, #b91c1c)',
            background: 'var(--theme-error-50, #fef2f2)',
            borderRadius: 4,
          }}
        >
          無法讀取目前設定：{err}
        </div>
      )}

      {!loading && !err && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {SLOTS.map((slot) => {
            const raw = site?.[slot.key]
            const media = isMedia(raw) ? raw : null
            return (
              <div
                key={slot.key}
                style={{
                  border: '1px solid var(--theme-elevation-100, #e5e7eb)',
                  borderRadius: 6,
                  padding: 12,
                  background: 'var(--theme-bg, #fff)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{slot.label}</div>

                <div
                  style={{
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--theme-elevation-50, #f9fafb)',
                    borderRadius: 4,
                    marginBottom: 8,
                    overflow: 'hidden',
                  }}
                >
                  {media ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.url}
                      alt={media.alt || slot.label}
                      style={{ maxHeight: 72, maxWidth: '90%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--theme-text-light, #9ca3af)' }}>
                      未上傳
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.55,
                    color: 'var(--theme-text, #374151)',
                  }}
                >
                  {media ? (
                    <>
                      <div>檔名：{media.filename || '—'}</div>
                      <div>
                        尺寸：{media.width && media.height ? `${media.width} × ${media.height}` : '—'}
                      </div>
                      <div>
                        大小：{formatBytes(media.filesize)} · {media.mimeType || '—'}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--theme-text-light, #9ca3af)' }}>尚未上傳檔案</div>
                  )}
                  <div
                    style={{
                      marginTop: 6,
                      paddingTop: 6,
                      borderTop: '1px dashed var(--theme-elevation-100, #e5e7eb)',
                      fontSize: 10,
                      color: 'var(--theme-text-light, #6b7280)',
                    }}
                  >
                    {slot.recommended}
                    <div style={{ marginTop: 2 }}>{slot.recommendedNote}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
