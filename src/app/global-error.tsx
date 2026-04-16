'use client'

/**
 * Root-level error boundary
 * ─────────────────────────
 * Catches errors thrown in the root layout or providers — including
 * crashes from third-party scripts on iOS Safari with strict privacy
 * settings (Block All Cookies, Lockdown Mode, etc.). Without this file,
 * a layout-level throw produces a blank white screen because the
 * segment-level (frontend)/error.tsx only catches errors below the
 * layout. Must define its own <html>/<body>.
 */
type Diag = { ls?: number; ss?: number; ck?: number; idb?: number; err?: string }
declare global {
  interface Window {
    __ckmuPriv?: Diag
  }
}

function readDiag(): Diag | null {
  if (typeof window === 'undefined') return null
  return window.__ckmuPriv || null
}

function diagLabel(code: number | undefined): string {
  if (!code) return '正常'
  if (code === 1) return '已被阻擋（已用記憶體模式接管）'
  if (code === 2) return '已被阻擋且無法接管'
  return '錯誤 ' + code
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const diag = readDiag()
  return (
    <html lang="zh-Hant-TW">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#FDF8F3',
          color: '#2C2C2C',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif',
        }}
      >
        <div style={{ maxWidth: '420px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', margin: '0 0 12px', fontWeight: 600 }}>
            載入發生問題
          </h1>
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.7,
              color: '#6B6B6B',
              margin: '0 0 24px',
            }}
          >
            您的瀏覽器隱私權設定可能阻擋了部分網站功能。
            <br />
            請嘗試開啟 Cookie 或在 Safari 中關閉「防止跨網站追蹤」。
          </p>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '12px 28px',
                background: '#C19A5B',
                color: '#fff',
                border: 'none',
                borderRadius: '999px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              重新載入
            </button>
            <a
              href="/"
              style={{
                padding: '12px 28px',
                background: 'transparent',
                color: '#2C2C2C',
                border: '1px solid #E5DED4',
                borderRadius: '999px',
                fontSize: '14px',
                textDecoration: 'none',
              }}
            >
              回首頁
            </a>
          </div>
          {error?.digest && (
            <p
              style={{
                fontSize: '11px',
                color: '#A8A8A8',
                marginTop: '24px',
                fontFamily: 'monospace',
              }}
            >
              ref: {error.digest}
            </p>
          )}
          {diag && (
            <details
              style={{
                marginTop: '20px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#6B6B6B',
                background: '#fff',
                border: '1px solid #E5DED4',
                borderRadius: '12px',
                padding: '12px 16px',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
                技術細節 (privacy diagnostics)
              </summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', lineHeight: 1.7 }}>
                <li>localStorage：{diagLabel(diag.ls)}</li>
                <li>sessionStorage：{diagLabel(diag.ss)}</li>
                <li>document.cookie：{diagLabel(diag.ck)}</li>
                <li>indexedDB：{diagLabel(diag.idb)}</li>
                {diag.err && <li>shim error: {diag.err}</li>}
                {error?.message && <li>錯誤：{error.message}</li>}
              </ul>
            </details>
          )}
        </div>
      </body>
    </html>
  )
}
