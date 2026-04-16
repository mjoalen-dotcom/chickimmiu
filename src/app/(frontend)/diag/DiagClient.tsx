'use client'

/**
 * DiagClient — 隱私 / 環境診斷面板
 * ───────────────────────────────
 * 在 client 端執行各種「會在隱私模式下炸掉」的 API，並把結果秀出來。
 * 所有測試都包在 try/catch 裡，這個頁面本身永遠不會白屏。
 */

import { useEffect, useState } from 'react'

type Diag = { ls?: number; ss?: number; ck?: number; idb?: number; err?: string }

declare global {
  interface Window {
    __ckmuPriv?: Diag
  }
}

interface Result {
  name: string
  status: 'pass' | 'fail' | 'shimmed' | 'unknown'
  detail: string
}

function check(): Result[] {
  const out: Result[] = []
  const priv = (typeof window !== 'undefined' && window.__ckmuPriv) || ({} as Diag)

  // ── localStorage ──
  try {
    window.localStorage.setItem('__diag__', '1')
    const v = window.localStorage.getItem('__diag__')
    window.localStorage.removeItem('__diag__')
    if (v === '1') {
      out.push({
        name: 'localStorage',
        status: priv.ls ? 'shimmed' : 'pass',
        detail: priv.ls ? 'native blocked, in-memory shim active' : 'native works',
      })
    } else {
      out.push({ name: 'localStorage', status: 'fail', detail: 'roundtrip failed' })
    }
  } catch (e) {
    out.push({ name: 'localStorage', status: 'fail', detail: String((e as Error).message || e) })
  }

  // ── sessionStorage ──
  try {
    window.sessionStorage.setItem('__diag__', '1')
    const v = window.sessionStorage.getItem('__diag__')
    window.sessionStorage.removeItem('__diag__')
    if (v === '1') {
      out.push({
        name: 'sessionStorage',
        status: priv.ss ? 'shimmed' : 'pass',
        detail: priv.ss ? 'native blocked, in-memory shim active' : 'native works',
      })
    } else {
      out.push({ name: 'sessionStorage', status: 'fail', detail: 'roundtrip failed' })
    }
  } catch (e) {
    out.push({ name: 'sessionStorage', status: 'fail', detail: String((e as Error).message || e) })
  }

  // ── document.cookie ──
  try {
    const c = document.cookie
    out.push({
      name: 'document.cookie',
      status: priv.ck ? 'shimmed' : 'pass',
      detail: priv.ck
        ? 'native blocked, in-memory shim active'
        : `length=${typeof c === 'string' ? c.length : 'unknown'}`,
    })
  } catch (e) {
    out.push({ name: 'document.cookie', status: 'fail', detail: String((e as Error).message || e) })
  }

  // ── indexedDB ──
  try {
    if (typeof window.indexedDB === 'undefined') {
      out.push({ name: 'indexedDB', status: 'fail', detail: 'undefined' })
    } else {
      out.push({
        name: 'indexedDB',
        status: priv.idb ? 'shimmed' : 'pass',
        detail: priv.idb ? 'open() wrapped to no-op' : 'available',
      })
    }
  } catch (e) {
    out.push({ name: 'indexedDB', status: 'fail', detail: String((e as Error).message || e) })
  }

  // ── fetch ──
  try {
    if (typeof window.fetch !== 'function') {
      out.push({ name: 'fetch', status: 'fail', detail: 'not a function' })
    } else {
      out.push({ name: 'fetch', status: 'pass', detail: 'available' })
    }
  } catch (e) {
    out.push({ name: 'fetch', status: 'fail', detail: String((e as Error).message || e) })
  }

  // ── ResizeObserver ──
  try {
    out.push({
      name: 'ResizeObserver',
      status: typeof window.ResizeObserver === 'function' ? 'pass' : 'fail',
      detail: typeof window.ResizeObserver,
    })
  } catch (e) {
    out.push({ name: 'ResizeObserver', status: 'fail', detail: String((e as Error).message || e) })
  }

  // ── IntersectionObserver ──
  try {
    out.push({
      name: 'IntersectionObserver',
      status: typeof window.IntersectionObserver === 'function' ? 'pass' : 'fail',
      detail: typeof window.IntersectionObserver,
    })
  } catch (e) {
    out.push({
      name: 'IntersectionObserver',
      status: 'fail',
      detail: String((e as Error).message || e),
    })
  }

  // ── Crypto subtle ──
  try {
    out.push({
      name: 'crypto.subtle',
      status: window.crypto && window.crypto.subtle ? 'pass' : 'fail',
      detail: window.crypto && window.crypto.subtle ? 'available' : 'missing',
    })
  } catch (e) {
    out.push({ name: 'crypto.subtle', status: 'fail', detail: String((e as Error).message || e) })
  }

  return out
}

export function DiagClient() {
  const [results, setResults] = useState<Result[]>([])
  const [ua, setUa] = useState('')
  const [cookieEnabled, setCookieEnabled] = useState<boolean | string>('')
  const [pixelRatio, setPixelRatio] = useState(0)
  const [viewport, setViewport] = useState('')
  const [priv, setPriv] = useState<Diag | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      setResults(check())
      setUa(navigator.userAgent || '')
      setCookieEnabled(
        typeof navigator.cookieEnabled === 'boolean'
          ? navigator.cookieEnabled
          : 'unknown',
      )
      setPixelRatio(window.devicePixelRatio || 1)
      setViewport(`${window.innerWidth}×${window.innerHeight}`)
      setPriv(window.__ckmuPriv || null)
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }, [])

  const colorForStatus = (s: Result['status']) => {
    if (s === 'pass') return '#2E7D32'
    if (s === 'shimmed') return '#C19A5B'
    if (s === 'fail') return '#C62828'
    return '#6B6B6B'
  }

  const labelForStatus = (s: Result['status']) => {
    if (s === 'pass') return '✓ OK'
    if (s === 'shimmed') return '⚠ shim'
    if (s === 'fail') return '✗ FAIL'
    return '?'
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#FDF8F3',
        color: '#2C2C2C',
        padding: '24px 16px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 8px', fontWeight: 600 }}>
          隱私 / 環境診斷
        </h1>
        <p style={{ fontSize: '13px', color: '#6B6B6B', margin: '0 0 24px', lineHeight: 1.7 }}>
          這個頁面會檢查 Safari 的隱私設定阻擋了哪些 API，以及 polyfill 有沒有成功接管。
          回報問題時請截圖整頁傳給我們。
        </p>

        {error && (
          <div
            style={{
              background: '#FFF3E0',
              border: '1px solid #FFB74D',
              borderRadius: '12px',
              padding: '12px 16px',
              margin: '0 0 16px',
              fontSize: '13px',
              color: '#E65100',
            }}
          >
            診斷頁本身發生錯誤：{error}
          </div>
        )}

        {/* Privacy shim diagnostic from layout.tsx */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E5DED4',
            borderRadius: '14px',
            padding: '16px 18px',
            margin: '0 0 16px',
          }}
        >
          <h2 style={{ fontSize: '14px', margin: '0 0 10px', fontWeight: 600 }}>
            inline polyfill 結果 (window.__ckmuPriv)
          </h2>
          {priv ? (
            <pre
              style={{
                margin: 0,
                fontSize: '12px',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
                background: '#F5F0E8',
                padding: '10px 12px',
                borderRadius: '8px',
                overflow: 'auto',
              }}
            >
              {JSON.stringify(priv, null, 2)}
            </pre>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: '#C62828',
              }}
            >
              <strong>polyfill 沒有跑！</strong> window.__ckmuPriv 不存在 —
              代表 layout.tsx 的 inline shim 根本沒被執行到。
              這就是 iPad 白屏的根本原因。
            </p>
          )}
        </div>

        {/* API status */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E5DED4',
            borderRadius: '14px',
            padding: '16px 18px',
            margin: '0 0 16px',
          }}
        >
          <h2 style={{ fontSize: '14px', margin: '0 0 12px', fontWeight: 600 }}>
            API 可用性
          </h2>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: '8px',
            }}
          >
            {results.map((r) => (
              <li
                key={r.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: '#FAF6EF',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  <div style={{ color: '#6B6B6B', fontSize: '11px', marginTop: '2px' }}>
                    {r.detail}
                  </div>
                </div>
                <div
                  style={{
                    color: colorForStatus(r.status),
                    fontWeight: 600,
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {labelForStatus(r.status)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Browser info */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E5DED4',
            borderRadius: '14px',
            padding: '16px 18px',
            margin: '0 0 16px',
          }}
        >
          <h2 style={{ fontSize: '14px', margin: '0 0 10px', fontWeight: 600 }}>
            瀏覽器資訊
          </h2>
          <dl
            style={{
              margin: 0,
              fontSize: '12px',
              lineHeight: 1.7,
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              gap: '4px 12px',
            }}
          >
            <dt style={{ color: '#6B6B6B' }}>cookieEnabled</dt>
            <dd style={{ margin: 0 }}>{String(cookieEnabled)}</dd>

            <dt style={{ color: '#6B6B6B' }}>devicePixelRatio</dt>
            <dd style={{ margin: 0 }}>{pixelRatio}</dd>

            <dt style={{ color: '#6B6B6B' }}>viewport</dt>
            <dd style={{ margin: 0 }}>{viewport}</dd>

            <dt style={{ color: '#6B6B6B' }}>userAgent</dt>
            <dd
              style={{
                margin: 0,
                wordBreak: 'break-all',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
                fontSize: '11px',
              }}
            >
              {ua}
            </dd>
          </dl>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: '#C19A5B',
              color: '#fff',
              borderRadius: '999px',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            回首頁
          </a>
        </div>
      </div>
    </main>
  )
}
